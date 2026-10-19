// Headless-Chrome rendering for JS-heavy pages, via puppeteer-core and a
// locally installed Chrome/Edge (no bundled Chromium). The crawler calls this
// only when static extraction comes back thin, or when js_render='always'.

import puppeteer from 'puppeteer-core';
import type { Browser, Page } from 'puppeteer-core';
import { existsSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { isPrivateHost } from './safeFetch.ts';

const CANDIDATE_PATHS = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : undefined,
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter((p): p is string => Boolean(p));

const RENDER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 IsaacBot/2.0';
const RENDER_CONCURRENCY = 2;
const BLOCKED_RESOURCE_TYPES = new Set(['image', 'media', 'font', 'stylesheet']);
const SETTLE_MS = 800;

function chromeAvailable(): string | undefined {
  for (const p of CANDIDATE_PATHS) {
    try {
      if (existsSync(p)) return p;
    } catch (_) {}
  }
  return undefined;
}

let browserPromise: Promise<Browser> | null = null;
let inFlightRenders = 0;
const renderWaiters: Array<() => void> = [];

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const executablePath = chromeAvailable();
    if (!executablePath) throw new Error('No Chrome/Edge installation found');
    browserPromise = puppeteer.launch({
      executablePath,
      headless: true,
      timeout: 90_000,
      userDataDir: mkdtempSync(join(tmpdir(), 'isaac-chrome-')),
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--mute-audio',
        '--disable-extensions',
        '--no-first-run'
      ]
    });
    browserPromise.catch(() => {
      browserPromise = null;
    });
  }
  return browserPromise;
}

async function acquireRenderSlot(): Promise<void> {
  if (inFlightRenders < RENDER_CONCURRENCY) {
    inFlightRenders++;
    return;
  }
  await new Promise<void>(resolve => renderWaiters.push(resolve));
  inFlightRenders++;
}

function releaseRenderSlot(): void {
  inFlightRenders--;
  const next = renderWaiters.shift();
  if (next) next();
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Renders a page in headless Chrome and returns the post-JavaScript HTML.
 * Blocks navigation/subresources to private hosts and skips heavy asset types.
 * Returns undefined if Chrome is unavailable, navigation fails, or the result
 * isn't usable.
 */
export async function renderPage(url: string, timeoutMs = 20_000): Promise<string | undefined> {
  const dbg = (msg: string) => {
    if (process.env.RENDER_DEBUG) console.log(`[renderer] ${url}: ${msg}`);
  };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (_) {
    dbg('invalid URL');
    return undefined;
  }
  if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || isPrivateHost(parsed.hostname)) {
    dbg('blocked scheme/host');
    return undefined;
  }
  if (!chromeAvailable()) {
    dbg('no chrome found');
    return undefined;
  }

  await acquireRenderSlot();
  let page: Page | undefined;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setUserAgent(RENDER_UA);
    await page.setRequestInterception(true);
    page.on('request', req => {
      try {
        if (BLOCKED_RESOURCE_TYPES.has(req.resourceType())) {
          void req.abort();
          return;
        }
        const host = new URL(req.url()).hostname;
        if (isPrivateHost(host)) {
          void req.abort();
          return;
        }
        void req.continue();
      } catch (_) {
        try { void req.continue(); } catch (_) {}
      }
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    // Give client-side scripts a moment to hydrate, then snapshot the DOM.
    await sleep(SETTLE_MS);
    const html = await page.content();
    if (!html || html.length <= 200) {
      dbg(`html too small (${html?.length || 0} chars)`);
      return undefined;
    }
    return html;
  } catch (err) {
    dbg(`failed: ${(err as Error)?.message || err}`);
    return undefined;
  } finally {
    try { await page?.close(); } catch (_) {}
    releaseRenderSlot();
  }
}
