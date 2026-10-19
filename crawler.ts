// Real web crawler: BFS frontier, robots.txt compliance, per-host politeness,
// bounded concurrency, content extraction, and indexing callbacks.
// The engine is a module-level singleton — one crawl job at a time.

import { gunzipSync } from 'node:zlib';
import { isPrivateHost, fetchPublicResource } from './safeFetch.ts';
import { renderPage } from './renderer.ts';

const BOT_UA = 'IsaacBot/2.0 (+https://issac.microbytz.xyz)';

const DEFAULT_MAX_PAGES = 50;
const MAX_PAGES_CAP = 200;
const DEFAULT_MAX_DEPTH = 2;
const MAX_DEPTH_CAP = 4;
const CONCURRENCY = 4;
const DEFAULT_HOST_DELAY_MS = 1200;
const MAX_HOST_DELAY_MS = 10_000;
const FETCH_TIMEOUT_MS = 9_000;
const ROBOTS_TIMEOUT_MS = 10_000;
const ROBOTS_CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_ROBOTS_BYTES = 512 * 1024;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_ROBOTS_CACHE_ORIGINS = 500;
const MAX_FRONTIER = 2000;
const MAX_HISTORY = 100;
const MAX_JOB_DURATION_MS = 15 * 60 * 1000;
const MAX_FAILED_URLS = 200;
const MAX_SITEMAP_BYTES = 1024 * 1024;
const MAX_SITEMAP_URLS = 1000;
const MAX_SITEMAP_CHILDREN = 10;
const SITEMAP_TIMEOUT_MS = 12_000;

// Binary/asset paths the crawler should never fetch.
const SKIP_EXT_RE = /\.(png|jpe?g|gif|webp|svg|ico|avif|css|js|mjs|map|pdf|zip|gz|tgz|tar|rar|7z|bz2|xz|mp[34]|m4a|webm|mov|avi|wmv|flv|woff2?|ttf|otf|eot|xml|json|txt|csv|tsv|exe|msi|dmg|iso|apk|wasm|docx?|xlsx?|pptx?)(\?|#|$)/i;

export interface CrawledImage {
  url: string;
  alt: string;
}

export interface CrawledPage {
  url: string;
  final_url: string;
  title: string;
  snippet: string;
  content: string;
  meta_description?: string;
  keywords?: string[];
  author?: string;
  language?: string;
  images?: CrawledImage[];
  canonical_url?: string;
  noindex?: boolean;
  nofollow?: boolean;
  rich?: StructuredResult;
}

interface FrontierItem {
  url: string;
  depth: number;
}

export interface CrawlJobState {
  id: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  seeds: string[];
  max_pages: number;
  max_depth: number;
  same_host_only: boolean;
  triggered_by: string;
  started_at: number;
  finished_at?: number;
  queued: number;
  visited: number;
  fetched: number;
  indexed: number;
  skipped: number;
  failed: number;
  robots_blocked: number;
  rendered: number;
  sitemap_discovered: number;
  js_render: 'off' | 'auto' | 'always';
  current_url?: string;
}

export interface FailedUrlInfo {
  url: string;
  errorCode: number;
  reason: string;
}

export interface CrawlHistoryRecord {
  id: string;
  start_url: string;
  status: string;
  pages_crawled: number;
  errors: number;
  triggered_by: string;
  timestamp: number;
  time_str: string;
  execution_duration_ms: number;
  memory_peak_mb: number;
  firestore_docs_written: number;
  failed_urls: FailedUrlInfo[];
}

interface JobInternal {
  state: CrawlJobState;
  frontier: FrontierItem[];
  visitedSet: Set<string>;
  allowedHosts: Set<string> | null;
  failedUrls: FailedUrlInfo[];
  peakMemoryMb: number;
  sitemapsPending: boolean;
}

export interface CrawlStartOptions {
  seeds: string[];
  maxPages?: number;
  maxDepth?: number;
  sameHostOnly?: boolean;
  triggeredBy?: string;
  jsRender?: 'off' | 'auto' | 'always';
  useSitemaps?: boolean;
}

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

interface RobotsEntry {
  disallow: string[];
  allow: string[];
  crawlDelayMs: number | null;
  sitemaps: string[];
  fetchedAt: number;
}

const robotsCache = new Map<string, RobotsEntry>();

function parseRobots(txt: string): Omit<RobotsEntry, 'fetchedAt'> {
  interface Group {
    agents: string[];
    disallow: string[];
    allow: string[];
    delay: number | null;
  }
  const groups: Group[] = [];
  const sitemaps: string[] = [];
  let cur: Group | null = null;

  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const val = line.slice(colon + 1).trim();

    // Sitemap: lines are file-global — they live outside user-agent groups.
    if (key === 'sitemap') {
      if (/^https?:\/\//i.test(val) && sitemaps.length < 10) sitemaps.push(val);
      continue;
    }

    if (key === 'user-agent') {
      if (cur && cur.disallow.length + cur.allow.length === 0 && cur.delay === null) {
        cur.agents.push(val.toLowerCase());
      } else {
        cur = { agents: [val.toLowerCase()], disallow: [], allow: [], delay: null };
        groups.push(cur);
      }
    } else if (cur) {
      if (key === 'disallow' && val !== '') cur.disallow.push(val);
      else if (key === 'allow' && val !== '') cur.allow.push(val);
      else if (key === 'crawl-delay') {
        const secs = parseFloat(val);
        if (Number.isFinite(secs) && secs > 0) cur.delay = secs;
      }
    }
  }

  const specific = groups.filter(g => g.agents.some(a => a === 'isaacbot' || a === 'isaacbot/2.0' || a.startsWith('isaacbot')));
  const chosen = specific.length > 0 ? specific : groups.filter(g => g.agents.includes('*'));

  const entry: Omit<RobotsEntry, 'fetchedAt'> = { disallow: [], allow: [], crawlDelayMs: null, sitemaps };
  for (const g of chosen) {
    entry.disallow.push(...g.disallow);
    entry.allow.push(...g.allow);
    if (g.delay !== null) {
      const ms = Math.min(Math.round(g.delay * 1000), MAX_HOST_DELAY_MS);
      entry.crawlDelayMs = Math.max(entry.crawlDelayMs ?? 0, ms);
    }
  }
  return entry;
}

async function getRobots(origin: string): Promise<RobotsEntry> {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_CACHE_TTL_MS) return cached;

  let entry: RobotsEntry = { disallow: [], allow: [], crawlDelayMs: null, sitemaps: [], fetchedAt: Date.now() };
  const res = await fetchPublicResource(`${origin}/robots.txt`, {
    timeoutMs: ROBOTS_TIMEOUT_MS,
    maxBytes: MAX_ROBOTS_BYTES,
    userAgent: BOT_UA,
    accept: 'text/plain,text/*,*/*'
  });
  if (res && res.status >= 200 && res.status < 300 && res.body) {
    try {
      entry = { ...parseRobots(res.body.toString('utf-8')), fetchedAt: Date.now() };
    } catch (_) {}
  }

  if (robotsCache.size >= MAX_ROBOTS_CACHE_ORIGINS) {
    const oldest = robotsCache.keys().next().value;
    if (oldest !== undefined) robotsCache.delete(oldest);
  }
  robotsCache.set(origin, entry);
  return entry;
}

function robotsAllowed(url: URL, rules: RobotsEntry): boolean {
  const path = url.pathname + url.search;
  let bestAllow = -1;
  let bestDisallow = -1;
  for (const p of rules.allow) if (path.startsWith(p)) bestAllow = Math.max(bestAllow, p.length);
  for (const p of rules.disallow) if (path.startsWith(p)) bestDisallow = Math.max(bestDisallow, p.length);
  if (bestAllow === -1 && bestDisallow === -1) return true;
  return bestAllow >= bestDisallow;
}

// ---------------------------------------------------------------------------
// Sitemaps — robots.txt Sitemap: lines plus the /sitemap.xml fallback. Sitemap
// index files recurse one level. Discovered URLs seed the frontier at depth 0.
// ---------------------------------------------------------------------------

export async function fetchSitemapUrls(sitemapUrl: string, depth = 0): Promise<string[]> {
  if (depth > 1) return [];
  const res = await fetchPublicResource(sitemapUrl, {
    timeoutMs: SITEMAP_TIMEOUT_MS,
    maxBytes: MAX_SITEMAP_BYTES,
    userAgent: BOT_UA,
    accept: 'application/xml,text/xml,text/plain,*/*'
  });
  if (!res || res.status >= 400 || !res.body) return [];

  let buf = res.body;
  // .xml.gz sitemaps — detect by gzip magic bytes.
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    try {
      buf = gunzipSync(buf);
    } catch (_) {
      return [];
    }
  }
  // A 1MB gz can decompress to tens of MB — cap before regexing the XML.
  if (buf.length > 4 * 1024 * 1024) buf = buf.subarray(0, 4 * 1024 * 1024);
  const xml = buf.toString('utf-8');
  const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(m => decodeEntities(m[1].trim()));

  // <sitemapindex> → child sitemap files; recurse one level.
  if (/<sitemapindex[\s>]/i.test(xml)) {
    const urls: string[] = [];
    for (const child of locs.slice(0, MAX_SITEMAP_CHILDREN)) {
      if (urls.length >= MAX_SITEMAP_URLS) break;
      urls.push(...(await fetchSitemapUrls(child, depth + 1)));
    }
    return urls.slice(0, MAX_SITEMAP_URLS);
  }
  return locs.slice(0, MAX_SITEMAP_URLS);
}

/** Seeds a running job's frontier from the seed hosts' sitemaps. */
async function seedFromSitemaps(job: JobInternal): Promise<void> {
  const { state } = job;
  const origins = [...new Set(
    state.seeds
      .map(s => {
        try {
          return new URL(s).origin;
        } catch (_) {
          return '';
        }
      })
      .filter(Boolean)
  )].slice(0, 5);

  for (const origin of origins) {
    if (state.status !== 'running') break;
    const robots = await getRobots(origin);
    const candidates = robots.sitemaps.length > 0 ? robots.sitemaps : [`${origin}/sitemap.xml`];
    for (const sm of candidates.slice(0, 3)) {
      if (state.status !== 'running') break;
      const urls = await fetchSitemapUrls(sm);
      for (const raw of urls) {
        if (job.frontier.length >= MAX_FRONTIER) break;
        const n = normalizeCrawlUrl(raw, `${origin}/`);
        if (!n || job.visitedSet.has(n)) continue;
        if (job.allowedHosts && !job.allowedHosts.has(hostOf(n))) continue;
        job.visitedSet.add(n);
        job.frontier.push({ url: n, depth: 0 });
        state.sitemap_discovered++;
      }
      state.queued = job.frontier.length;
      state.visited = job.visitedSet.size;
    }
  }
}

// ---------------------------------------------------------------------------
// Page extraction
// ---------------------------------------------------------------------------

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Math.min(Number(n) || 0, 0x10ffff)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function metaContent(html: string, names: string[]): string | undefined {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']` +
      `|<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`,
      'i'
    );
    const m = html.match(re);
    const v = m?.[1] ?? m?.[2];
    if (v && v.trim()) return decodeEntities(v.trim());
  }
  return undefined;
}

/** Compact schema.org payload extracted from JSON-LD — powers rich results. */
export interface StructuredResult {
  type: string;
  name?: string;
  rating?: number;
  rating_count?: number;
  date_published?: string;
  price?: string;
}

/** First useful schema.org entity from JSON-LD blocks — Article, Product,
 *  Recipe, FAQPage, SoftwareApplication, etc. */
function extractStructuredData(html: string): StructuredResult | undefined {
  const WANTED = new Set([
    'article', 'newsarticle', 'blogposting', 'product', 'recipe',
    'faqpage', 'softwareapplication', 'book', 'course', 'event', 'review'
  ]);
  for (const m of html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: any;
    try {
      data = JSON.parse(m[1].trim());
    } catch (_) {
      continue;
    }
    const nodes = Array.isArray(data) ? data : [data];
    if (data?.['@graph']) nodes.push(...data['@graph']);
    for (const node of nodes) {
      const type = String(node?.['@type'] || '').toLowerCase();
      if (!WANTED.has(type)) continue;
      const ratingVal = Number(node?.aggregateRating?.ratingValue);
      const price = node?.offers?.price ?? node?.offers?.[0]?.price;
      const out: StructuredResult = { type };
      const name = node?.headline || node?.name;
      if (typeof name === 'string' && name.trim()) out.name = name.trim().slice(0, 200);
      if (Number.isFinite(ratingVal)) {
        out.rating = ratingVal;
        const rc = Number(node?.aggregateRating?.ratingCount ?? node?.aggregateRating?.reviewCount);
        if (Number.isFinite(rc)) out.rating_count = rc;
      }
      const date = node?.datePublished || node?.dateCreated;
      if (typeof date === 'string') out.date_published = date.slice(0, 30);
      if (typeof price === 'string' || typeof price === 'number') {
        out.price = `${node?.offers?.priceCurrency || ''}${price}`.slice(0, 30);
      }
      return out;
    }
  }
  return undefined;
}

export function extractPage(html: string, url: string, finalUrl: string): CrawledPage | null {
  const title =
    metaContent(html, ['og:title']) ||
    (() => {
      const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      return m ? decodeEntities(m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()) : undefined;
    })();

  const description = metaContent(html, ['description', 'og:description']);
  const keywordsRaw = metaContent(html, ['keywords']);
  const keywords = keywordsRaw
    ? keywordsRaw.split(',').map(k => k.trim().toLowerCase()).filter(Boolean).slice(0, 50)
    : [];
  const author = metaContent(html, ['author', 'article:author']);
  const langMatch = html.match(/<html[^>]*\slang=["']?([a-zA-Z-]+)/i);

  // <meta name="robots"> directives — 'none' is shorthand for noindex+nofollow.
  const robotsMeta = (metaContent(html, ['robots']) || '').toLowerCase();
  const noindex = /\b(noindex|none)\b/.test(robotsMeta);
  const nofollow = /\b(nofollow|none)\b/.test(robotsMeta);

  // <link rel="canonical"> — the author's declared authoritative URL.
  let canonical_url: string | undefined;
  const canM = html.match(/<link\b[^>]*\brel\s*=\s*["'][^"']*\bcanonical\b[^"']*["'][^>]*>/i);
  if (canM) {
    const hrefM = canM[0].match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (hrefM) {
      const resolved = resolveImageUrl(hrefM[1], finalUrl); // same http(s)+public rules
      if (resolved) canonical_url = resolved;
    }
  }

  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');

  const mainMatch = cleaned.match(/<(article|main)[^>]*>([\s\S]*?)<\/\1>/i);
  const targetHtml = mainMatch ? mainMatch[2] : cleaned;

  const blocks: string[] = [];
  for (const m of targetHtml.matchAll(/<(p|h[1-3]|li)[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const t = decodeEntities(m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
    if (t.length >= 20 && !/cookie|subscribe|privacy policy|all rights reserved/i.test(t)) {
      blocks.push(t);
    }
  }
  // JS-heavy pages (or nonstandard markup: spans/divs instead of paragraphs)
  // can produce no p/h/li blocks at all — fall back to collapsed visible text.
  if (blocks.length === 0) {
    const allText = decodeEntities(
      targetHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    );
    if (allText.length >= 20) blocks.push(allText.slice(0, 100_000));
  }
  const content = blocks.join('\n\n').slice(0, 200_000);

  if (!title && content.length < 100) return null;

  return {
    url,
    final_url: finalUrl,
    title: title || new URL(finalUrl).hostname,
    snippet: (description || content.slice(0, 300)).slice(0, 300),
    content: content || description || '',
    meta_description: description,
    keywords,
    author,
    language: langMatch?.[1],
    images: extractImages(html, finalUrl),
    canonical_url,
    noindex,
    nofollow,
    rich: extractStructuredData(html)
  };
}

function normalizeCrawlUrl(href: string, base: string): string | null {
  let u: URL;
  try {
    u = new URL(href, base);
  } catch (_) {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (isPrivateHost(u.hostname)) return null;
  if (isBlockedHost(u.hostname)) return null;
  u.hash = '';
  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase();
  if (SKIP_EXT_RE.test(u.pathname)) return null;
  const normalized = u.toString();
  if (normalized.length > 2048) return null;
  return normalized;
}

/** Image URL resolution — unlike normalizeCrawlUrl, image extensions are welcome. */
function resolveImageUrl(href: string, base: string): string | null {
  let u: URL;
  try {
    u = new URL(href, base);
  } catch (_) {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (isPrivateHost(u.hostname)) return null;
  const normalized = u.toString();
  if (normalized.length > 2048) return null;
  return normalized;
}

const TRACKER_IMG_RE = /(?:^|[\/_.-])(icon|logo|sprite|pixel|spacer|blank|1x1|beacon|tracking)[\/_.-]/i;

/** Pulls meaningful images (src + alt) out of raw or rendered HTML. */
function extractImages(html: string, finalUrl: string): CrawledImage[] {
  const out: CrawledImage[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const srcM = tag.match(/\b(?:src|data-src|data-lazy-src|data-original)\s*=\s*["']([^"']+)["']/i);
    if (!srcM) continue;
    const url = resolveImageUrl(srcM[1], finalUrl);
    if (!url || seen.has(url) || TRACKER_IMG_RE.test(url)) continue;
    seen.add(url);
    const altM = tag.match(/\balt\s*=\s*["']([^"']*)["']/i);
    out.push({ url, alt: altM ? decodeEntities(altM[1]).trim().slice(0, 200) : '' });
    if (out.length >= 20) break;
  }
  return out;
}

export interface AnchorLink {
  url: string;
  text: string;
}

export function extractLinksDetailed(html: string, baseUrl: string): AnchorLink[] {
  const out: AnchorLink[] = [];
  for (const m of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const n = normalizeCrawlUrl(m[1], baseUrl);
    if (!n) continue;
    const text = decodeEntities(m[2].replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 140);
    out.push({ url: n, text });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

let activeJob: JobInternal | null = null;
let lastJob: JobInternal | null = null;
const crawlHistory: CrawlHistoryRecord[] = [];
const hostDelayOverride = new Map<string, number>();
let pageIndexer: ((page: CrawledPage) => void) | null = null;
let jobListener: (() => void) | null = null;

export function setJobListener(fn: () => void) {
  jobListener = fn;
}

// Global link graph — every discovered link target → set of source URLs.
// This is the crawler's real backlink signal (replaces placeholder counts).
const linkGraph = new Map<string, Set<string>>();
const MAX_LINK_GRAPH_TARGETS = 50_000;

export function getInlinkCount(url: string): number {
  return linkGraph.get(url)?.size || 0;
}

/** Serializable form of the link graph for state persistence. */
export function exportLinkGraph(maxTargets = 20_000, maxSourcesPerTarget = 20): Array<[string, string[]]> {
  const out: Array<[string, string[]]> = [];
  for (const [target, sources] of linkGraph) {
    out.push([target, [...sources].slice(0, maxSourcesPerTarget)]);
    if (out.length >= maxTargets) break;
  }
  return out;
}

export function importLinkGraph(entries: Array<[string, string[]]>): void {
  for (const [target, sources] of entries) {
    if (linkGraph.size >= MAX_LINK_GRAPH_TARGETS && !linkGraph.has(target)) break;
    let set = linkGraph.get(target);
    if (!set) {
      set = new Set();
      linkGraph.set(target, set);
    }
    for (const s of sources) {
      if (set.size >= 1000) break;
      set.add(s);
    }
  }
}

// ---------------------------------------------------------------------------
// Host quality — per-host crawl outcomes feeding a ranking multiplier.
// A host whose pages are mostly thin/failed is likely junk; a host that
// consistently yields solid pages gets a small boost.
// ---------------------------------------------------------------------------

interface HostStat {
  indexed: number;
  thin: number;
  failed: number;
}

const hostStats = new Map<string, HostStat>();
const MAX_HOST_STATS = 10_000;

function recordHostOutcome(url: string, outcome: keyof HostStat): void {
  const host = hostOf(url);
  if (!host) return;
  let s = hostStats.get(host);
  if (!s) {
    if (hostStats.size >= MAX_HOST_STATS) return;
    s = { indexed: 0, thin: 0, failed: 0 };
    hostStats.set(host, s);
  }
  s[outcome]++;
}

/** Ranking multiplier for a URL based on its host's crawl history (0.7-1.05). */
export function getHostQuality(url: string): number {
  const host = hostOf(url);
  const s = host ? hostStats.get(host) : undefined;
  if (!s) return 1;
  const total = s.indexed + s.thin + s.failed;
  if (total < 3) return 1; // insufficient data — neutral
  const badRatio = (s.thin + s.failed) / total;
  if (badRatio > 0.6) return 0.7;
  if (badRatio > 0.4) return 0.85;
  if (badRatio < 0.1 && s.indexed >= 3) return 1.05;
  return 1;
}

export function exportHostStats(): Array<[string, HostStat]> {
  return [...hostStats.entries()];
}

export function importHostStats(entries: Array<[string, HostStat]>): void {
  hostStats.clear();
  for (const [host, s] of entries) {
    if (hostStats.size >= MAX_HOST_STATS) break;
    if (s && typeof s.indexed === 'number') {
      hostStats.set(host, {
        indexed: s.indexed || 0,
        thin: s.thin || 0,
        failed: s.failed || 0
      });
    }
  }
}

// ---------------------------------------------------------------------------
// PageRank — iterative authority propagation over the link graph. A link from
// a high-authority page counts far more than one from a link farm, so this
// doubles as link-spam resistance: farmed inlinks carry little weight.
// ---------------------------------------------------------------------------

const pageRank = new Map<string, number>(); // url -> normalized PR (sums to 1)
let pageRankNodeCount = 0;
const PAGERANK_DAMPING = 0.85;
const PAGERANK_ITERATIONS = 10;
const PAGERANK_MAX_SOURCES_PER_TARGET = 100; // bounds worst-case edge count

/** Recomputes PageRank from the link graph; returns the node count. */
export function computePageRank(): number {
  pageRank.clear();
  pageRankNodeCount = 0;
  if (linkGraph.size === 0) return 0;

  const nodes = new Set<string>();
  const outlinks = new Map<string, string[]>();
  for (const [target, sources] of linkGraph) {
    nodes.add(target);
    let i = 0;
    for (const src of sources) {
      if (++i > PAGERANK_MAX_SOURCES_PER_TARGET) break;
      nodes.add(src);
      let out = outlinks.get(src);
      if (!out) {
        out = [];
        outlinks.set(src, out);
      }
      out.push(target);
    }
  }

  const N = nodes.size;
  const base = (1 - PAGERANK_DAMPING) / N;
  let pr = new Map<string, number>();
  for (const n of nodes) pr.set(n, 1 / N);

  for (let iter = 0; iter < PAGERANK_ITERATIONS; iter++) {
    // Dangling nodes (no outlinks) redistribute their mass evenly.
    let dangling = 0;
    for (const n of nodes) if (!outlinks.has(n)) dangling += pr.get(n)!;
    const next = new Map<string, number>();
    const floor = base + (PAGERANK_DAMPING * dangling) / N;
    for (const n of nodes) next.set(n, floor);
    for (const [src, targets] of outlinks) {
      const share = (PAGERANK_DAMPING * pr.get(src)!) / targets.length;
      for (const t of targets) next.set(t, next.get(t)! + share);
    }
    pr = next;
  }

  pageRankNodeCount = N;
  for (const [u, v] of pr) pageRank.set(u, v);
  return N;
}

/** PageRank normalized so the graph average is ~1.0 (0 when unknown). */
export function getRelativeAuthority(url: string): number {
  if (pageRankNodeCount === 0) return 0;
  return (pageRank.get(url) || 0) * pageRankNodeCount;
}

// ---------------------------------------------------------------------------
// Link-spam heuristics — derived from the link graph, applied per host:
//   reciprocity:     fraction of the host's external edges whose target links
//                    back to that same page (blogroll/exchange rings)
//   concentration:   share of external edges pointing at a single target host
//                    (satellite-site promotion)
//   farm pages:      individual pages with >150 external outlinks
// Result is a 0.5-1.0 score multiplier per host.
// ---------------------------------------------------------------------------

const linkSpam = new Map<string, number>();

/** Recomputes per-host link-spam multipliers from the link graph. */
export function computeLinkSpam(): void {
  linkSpam.clear();
  if (linkGraph.size === 0) return;

  const hostExt = new Map<string, number>(); // external edges out of host
  const hostRecip = new Map<string, number>(); // of those, reciprocal page pairs
  const hostTargets = new Map<string, Map<string, number>>();
  const pageExt = new Map<string, number>(); // external outlinks per page

  for (const [target, sources] of linkGraph) {
    const tHost = hostOf(target);
    for (const src of sources) {
      const sHost = hostOf(src);
      if (!sHost || !tHost || sHost === tHost) continue;
      hostExt.set(sHost, (hostExt.get(sHost) || 0) + 1);
      pageExt.set(src, (pageExt.get(src) || 0) + 1);
      let tm = hostTargets.get(sHost);
      if (!tm) {
        tm = new Map();
        hostTargets.set(sHost, tm);
      }
      tm.set(tHost, (tm.get(tHost) || 0) + 1);
      // Page-level reciprocity: src → target AND target → src.
      if (linkGraph.get(src)?.has(target)) {
        hostRecip.set(sHost, (hostRecip.get(sHost) || 0) + 1);
      }
    }
  }

  for (const [host, ext] of hostExt) {
    if (ext < 10) continue; // too little data — stay neutral
    const recipRatio = (hostRecip.get(host) || 0) / ext;
    let maxShare = 0;
    for (const c of hostTargets.get(host)!.values()) maxShare = Math.max(maxShare, c);
    const concRatio = maxShare / ext;
    let mult = 1;
    if (recipRatio > 0.5) mult *= 0.7;
    else if (recipRatio > 0.3) mult *= 0.85;
    if (concRatio > 0.6) mult *= 0.8;
    else if (concRatio > 0.4) mult *= 0.9;
    if (mult < 1) linkSpam.set(host, Math.max(0.5, mult));
  }
  // Link-farm pages (extreme external outlink counts) drag their host down.
  for (const [page, c] of pageExt) {
    if (c > 150) {
      const h = hostOf(page);
      if (h) linkSpam.set(h, Math.min(linkSpam.get(h) ?? 1, 0.75));
    }
  }
}

/** Link-spam multiplier for a URL's host (1.0 = clean). */
export function getLinkSpam(url: string): number {
  return linkSpam.get(hostOf(url)) ?? 1;
}

// ---------------------------------------------------------------------------
// Blocklist — admin-blocked hosts are rejected before fetching and never enter
// the frontier. Suffix match covers subdomains of a blocked domain.
// ---------------------------------------------------------------------------

const blockedHosts = new Set<string>();

export function setBlockedHosts(hosts: string[]): void {
  blockedHosts.clear();
  for (const h of hosts) {
    const clean = String(h).trim().toLowerCase();
    if (clean) blockedHosts.add(clean);
  }
}

export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (blockedHosts.has(h)) return true;
  for (const b of blockedHosts) {
    if (h.endsWith('.' + b)) return true;
  }
  return false;
}

/** Whether robots.txt permits fetching this URL (shared by crawl + recrawl). */
export async function checkRobotsAllowed(rawUrl: string): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch (_) {
    return false;
  }
  const robots = await getRobots(`${u.protocol}//${u.host}`);
  return robotsAllowed(u, robots);
}

export function recordLink(source: string, target: string) {
  if (linkGraph.size >= MAX_LINK_GRAPH_TARGETS && !linkGraph.has(target)) return;
  let set = linkGraph.get(target);
  if (!set) {
    set = new Set();
    linkGraph.set(target, set);
  }
  if (set.size < 1000) set.add(source);
}

// ---------------------------------------------------------------------------
// Anchor text — the words other sites choose when linking to a page. One of the
// strongest relevance signals in classic IR: it describes the target in
// language the page itself may never use.
// ---------------------------------------------------------------------------

const anchorGraph = new Map<string, Map<string, number>>(); // target -> phrase -> count
const MAX_ANCHOR_TARGETS = 50_000;
const MAX_ANCHOR_PHRASES = 200;
const ANCHOR_JUNK_RE = /^(click here|here|read more|more|link|this|source|download|visit|website|home|back|next|previous|\W+)$/i;

export function recordAnchor(target: string, text: string) {
  if (text.length < 2 || ANCHOR_JUNK_RE.test(text)) return;
  if (anchorGraph.size >= MAX_ANCHOR_TARGETS && !anchorGraph.has(target)) return;
  let phrases = anchorGraph.get(target);
  if (!phrases) {
    phrases = new Map();
    anchorGraph.set(target, phrases);
  }
  if (phrases.size >= MAX_ANCHOR_PHRASES && !phrases.has(text)) return;
  phrases.set(text, (phrases.get(text) || 0) + 1);
}

/** Top anchor phrases for a URL, most frequent first — feeds indexing. */
export function getAnchorText(url: string): string {
  const phrases = anchorGraph.get(url);
  if (!phrases || phrases.size === 0) return '';
  return [...phrases.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([t]) => t)
    .join(' ')
    .slice(0, 1000);
}

export function exportAnchorGraph(maxTargets = 20_000, maxPhrases = 50): Array<[string, Array<[string, number]>]> {
  const out: Array<[string, Array<[string, number]>]> = [];
  for (const [target, phrases] of anchorGraph) {
    out.push([target, [...phrases.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxPhrases)]);
    if (out.length >= maxTargets) break;
  }
  return out;
}

export function importAnchorGraph(entries: Array<[string, Array<[string, number]>]>): void {
  for (const [target, phrases] of entries) {
    if (anchorGraph.size >= MAX_ANCHOR_TARGETS && !anchorGraph.has(target)) break;
    let m = anchorGraph.get(target);
    if (!m) {
      m = new Map();
      anchorGraph.set(target, m);
    }
    for (const [text, count] of phrases.slice(0, MAX_ANCHOR_PHRASES)) {
      m.set(text, (m.get(text) || 0) + (typeof count === 'number' ? count : 1));
    }
  }
}

export function setPageIndexer(fn: (page: CrawledPage) => void) {
  pageIndexer = fn;
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch (_) {
    return '';
  }
}

function hostDelay(host: string): number {
  return hostDelayOverride.get(host) ?? DEFAULT_HOST_DELAY_MS;
}

async function processUrl(job: JobInternal, item: FrontierItem): Promise<void> {
  const { state } = job;
  state.current_url = item.url;

  let u: URL;
  try {
    u = new URL(item.url);
  } catch (_) {
    state.failed++;
    return;
  }

  if (isBlockedHost(u.hostname)) {
    state.skipped++;
    return;
  }

  // robots.txt compliance
  const origin = `${u.protocol}//${u.host}`;
  const robots = await getRobots(origin);
  if (robots.crawlDelayMs !== null && hostDelayOverride.size < MAX_ROBOTS_CACHE_ORIGINS) {
    hostDelayOverride.set(u.hostname, robots.crawlDelayMs);
  }
  if (!robotsAllowed(u, robots)) {
    state.skipped++;
    state.robots_blocked++;
    return;
  }

  const res = await fetchPublicResource(item.url, {
    timeoutMs: FETCH_TIMEOUT_MS,
    maxBytes: MAX_PAGE_BYTES,
    userAgent: BOT_UA,
    accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5'
  });

  if (!res) {
    state.failed++;
    recordHostOutcome(item.url, 'failed');
    if (job.failedUrls.length < MAX_FAILED_URLS) {
      job.failedUrls.push({ url: item.url, errorCode: 0, reason: 'fetch failed or timed out' });
    }
    return;
  }
  if (res.status >= 400) {
    state.failed++;
    recordHostOutcome(item.url, 'failed');
    if (job.failedUrls.length < MAX_FAILED_URLS) {
      job.failedUrls.push({ url: item.url, errorCode: res.status, reason: `HTTP ${res.status}` });
    }
    return;
  }
  const contentType = (res.contentType || '').toLowerCase();
  if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    state.skipped++;
    return;
  }
  if (!res.body) {
    state.failed++;
    recordHostOutcome(item.url, 'failed');
    return;
  }

  state.fetched++;
  let html = res.body.toString('utf-8');
  const finalUrl = res.finalUrl || item.url;
  let page = extractPage(html, item.url, finalUrl);

  // JS-render fallback: static extraction gave us nothing or almost nothing
  // (SPA/JS-heavy pages) — retry through headless Chrome.
  const thin = !page || page.content.length < 400;
  if (state.js_render === 'always' || (state.js_render === 'auto' && thin)) {
    const rendered = await renderPage(finalUrl, 20_000);
    if (rendered) {
      const renderedPage = extractPage(rendered, item.url, finalUrl);
      if (renderedPage && renderedPage.content.length > (page?.content.length || 0)) {
        page = renderedPage;
        html = rendered;
        state.rendered++;
      }
    }
  }

  if (page && !page.noindex) {
    state.indexed++;
    recordHostOutcome(item.url, page.content.length >= 400 ? 'indexed' : 'thin');
    try {
      pageIndexer?.(page);
    } catch (_) {}
  } else {
    state.skipped++;
    // A null page is a thin-content signal; noindex is a deliberate exclusion —
    // it shouldn't hurt the host's quality score.
    if (!page?.noindex) recordHostOutcome(item.url, 'thin');
  }

  // Discover outgoing links — every edge feeds the global link graph
  // (backlink signal) even when scope/depth keeps it out of the frontier.
  // Anchor text is captured alongside: the words a linker chose describe the
  // target page. Pages marked nofollow contribute no edges.
  for (const link of page?.nofollow ? [] : extractLinksDetailed(html, finalUrl)) {
    recordLink(item.url, link.url);
    if (link.text) recordAnchor(link.url, link.text);
    if (item.depth >= state.max_depth || job.frontier.length >= MAX_FRONTIER) continue;
    if (job.visitedSet.has(link.url)) continue;
    if (job.allowedHosts && !job.allowedHosts.has(hostOf(link.url))) continue;
    job.visitedSet.add(link.url);
    job.frontier.push({ url: link.url, depth: item.depth + 1 });
  }
  if (job.frontier.length > MAX_FRONTIER) job.frontier.length = MAX_FRONTIER;
  state.visited = job.visitedSet.size;
  state.queued = job.frontier.length;

  const memMb = Math.round(process.memoryUsage().rss / (1024 * 1024));
  if (memMb > job.peakMemoryMb) job.peakMemoryMb = memMb;
}

async function runJob(job: JobInternal): Promise<void> {
  const deadline = Date.now() + MAX_JOB_DURATION_MS;
  const inFlight = new Set<Promise<void>>();
  const busyHosts = new Set<string>();
  const hostReadyAt = new Map<string, number>();
  const { state } = job;

  while (state.status === 'running' && Date.now() < deadline) {
    if (state.fetched + state.skipped + state.failed >= state.max_pages) break;

    const idx = job.frontier.findIndex(it => {
      const h = hostOf(it.url);
      return !busyHosts.has(h) && (hostReadyAt.get(h) || 0) <= Date.now();
    });

    if (idx === -1) {
      if (inFlight.size === 0) {
        if (job.frontier.length === 0) {
          if (job.sitemapsPending) {
            // Sitemap URLs may still be arriving — don't end the job early.
            await sleep(500);
            continue;
          }
          break;
        }
        // Everything left is waiting on a per-host politeness delay.
        const waits = job.frontier
          .map(it => (hostReadyAt.get(hostOf(it.url)) || 0) - Date.now())
          .filter(w => w > 0);
        if (waits.length === 0) break;
        await sleep(Math.min(Math.min(...waits), 3000));
      } else {
        await Promise.race(inFlight);
      }
      continue;
    }

    if (inFlight.size >= CONCURRENCY) {
      await Promise.race(inFlight);
      continue;
    }

    const item = job.frontier.splice(idx, 1)[0];
    state.queued = job.frontier.length;
    const host = hostOf(item.url);
    busyHosts.add(host);
    const p: Promise<void> = processUrl(job, item)
      .catch(() => { state.failed++; })
      .finally(() => {
        inFlight.delete(p);
        busyHosts.delete(host);
        if (host) hostReadyAt.set(host, Date.now() + hostDelay(host));
      });
    inFlight.add(p);
  }

  await Promise.allSettled(inFlight);
  state.finished_at = Date.now();
  if (state.status === 'running') state.status = 'completed';
}

function finalizeJob(job: JobInternal) {
  const { state } = job;
  const record: CrawlHistoryRecord = {
    id: state.id,
    start_url: state.seeds[0] || '',
    status: state.status,
    pages_crawled: state.indexed,
    errors: state.failed,
    triggered_by: state.triggered_by,
    timestamp: Math.floor(state.started_at / 1000),
    time_str: new Date(state.started_at).toLocaleString(),
    execution_duration_ms: state.finished_at ? state.finished_at - state.started_at : 0,
    memory_peak_mb: job.peakMemoryMb,
    firestore_docs_written: state.indexed,
    failed_urls: job.failedUrls
  };
  crawlHistory.unshift(record);
  if (crawlHistory.length > MAX_HISTORY) crawlHistory.length = MAX_HISTORY;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function startCrawl(opts: CrawlStartOptions): { job: CrawlJobState } | { error: string; job?: CrawlJobState } {
  if (activeJob && activeJob.state.status === 'running') {
    return { error: 'A crawl is already running', job: activeJob.state };
  }
  const seeds = (opts.seeds || [])
    .map(s => normalizeCrawlUrl(s, 'https://x.invalid/'))
    .filter((s): s is string => !!s);
  if (seeds.length === 0) {
    return { error: 'No valid http(s) seed URLs provided' };
  }

  const maxPages = Math.min(Math.max(1, Math.floor(opts.maxPages ?? DEFAULT_MAX_PAGES)), MAX_PAGES_CAP);
  const maxDepth = Math.min(Math.max(0, Math.floor(opts.maxDepth ?? DEFAULT_MAX_DEPTH)), MAX_DEPTH_CAP);
  const sameHostOnly = opts.sameHostOnly !== false;

  const allowedHosts = sameHostOnly ? new Set(seeds.map(hostOf)) : null;
  const visitedSet = new Set(seeds);

  const job: JobInternal = {
    state: {
      id: `crawl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: 'running',
      seeds,
      max_pages: maxPages,
      max_depth: maxDepth,
      same_host_only: sameHostOnly,
      triggered_by: opts.triggeredBy || 'manual',
      started_at: Date.now(),
      queued: seeds.length,
      visited: visitedSet.size,
      fetched: 0,
      indexed: 0,
      skipped: 0,
      failed: 0,
      robots_blocked: 0,
      rendered: 0,
      sitemap_discovered: 0,
      js_render: opts.jsRender || 'auto'
    },
    frontier: seeds.map(url => ({ url, depth: 0 })),
    visitedSet,
    allowedHosts,
    failedUrls: [],
    peakMemoryMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
    sitemapsPending: opts.useSitemaps !== false
  };

  if (job.sitemapsPending) {
    void seedFromSitemaps(job)
      .catch(() => {})
      .finally(() => {
        job.sitemapsPending = false;
      });
  }

  activeJob = job;
  lastJob = job;
  runJob(job)
    .catch(() => { job.state.status = 'failed'; })
    .finally(() => {
      finalizeJob(job);
      if (activeJob === job) activeJob = null;
      try { jobListener?.(); } catch (_) {}
    });
  return { job: job.state };
}

export function pauseCrawl(): { status: string; job?: CrawlJobState } {
  if (activeJob && activeJob.state.status === 'running') {
    activeJob.state.status = 'paused';
    return { status: 'paused', job: activeJob.state };
  }
  return { status: 'idle' };
}

export function retryCrawl(): { job: CrawlJobState } | { error: string } {
  if (activeJob && activeJob.state.status === 'running') {
    return { error: 'A crawl is already running' };
  }
  if (!lastJob || (lastJob.state.status !== 'paused' && lastJob.state.status !== 'failed')) {
    return { error: 'No paused or failed crawl to retry' };
  }
  // Resume the leftover frontier from the previous job.
  const leftover = lastJob.frontier.slice();
  const seeds = leftover.length > 0 ? leftover.map(i => i.url) : lastJob.state.seeds;
  return startCrawl({
    seeds,
    maxPages: lastJob.state.max_pages,
    maxDepth: lastJob.state.max_depth,
    sameHostOnly: lastJob.state.same_host_only,
    triggeredBy: 'retry',
    jsRender: lastJob.state.js_render
  });
}

export function getCrawlStatus() {
  const j = activeJob || lastJob;
  return {
    running: !!(activeJob && activeJob.state.status === 'running'),
    job: j ? j.state : null,
    history_count: crawlHistory.length
  };
}

export function getCrawlHistory(): CrawlHistoryRecord[] {
  return crawlHistory;
}

/** Restores persisted history on boot (keeps the newest-first ordering). */
export function loadCrawlHistory(records: CrawlHistoryRecord[]): void {
  crawlHistory.length = 0;
  for (const r of records.slice(0, MAX_HISTORY)) crawlHistory.push(r);
}

export function getCrawlTrend(days: number): Array<{ date: string; pages_crawled: number; errors: number; run_count: number }> {
  const out = new Map<string, { date: string; pages_crawled: number; errors: number; run_count: number }>();
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now - i * 86400000).toISOString().split('T')[0];
    out.set(date, { date, pages_crawled: 0, errors: 0, run_count: 0 });
  }
  for (const rec of crawlHistory) {
    const date = new Date(rec.timestamp * 1000).toISOString().split('T')[0];
    const slot = out.get(date);
    if (slot) {
      slot.pages_crawled += rec.pages_crawled;
      slot.errors += rec.errors;
      slot.run_count += 1;
    }
  }
  return Array.from(out.values());
}
