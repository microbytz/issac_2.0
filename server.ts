import express from 'express';
import compression from 'compression';
import sharp from 'sharp';
import type { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import zlib from 'zlib';
import crypto from 'crypto';
import { zipSync } from 'fflate';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  detectCompanyTicker,
  selectRelevantContent
} from './src/utils/fireplexityUtils.ts';
import type {
  FireplexitySource,
  FireplexityNewsItem,
  FireplexityImageItem
} from './src/utils/fireplexityUtils.ts';
import {
  isPrivateHost as isPrivateImageHost,
  fetchPublicResource,
  fetchPublicText
} from './safeFetch.ts';
import {
  setPageIndexer,
  setJobListener,
  startCrawl,
  pauseCrawl,
  retryCrawl,
  getCrawlStatus,
  getCrawlHistory,
  getCrawlTrend,
  getInlinkCount,
  loadCrawlHistory,
  exportLinkGraph,
  importLinkGraph,
  getHostQuality,
  exportHostStats,
  importHostStats,
  extractPage,
  extractLinksDetailed,
  recordLink,
  recordAnchor,
  getAnchorText,
  exportAnchorGraph,
  importAnchorGraph,
  computePageRank,
  getRelativeAuthority,
  checkRobotsAllowed,
  computeLinkSpam,
  getLinkSpam,
  setBlockedHosts,
  isBlockedHost
} from './crawler.ts';
import type { CrawledPage } from './crawler.ts';
import { queryCCIndex, fetchWarcHtml } from './commonCrawl.ts';
import type { CCRecord } from './commonCrawl.ts';
import { InvertedIndex } from './searchIndex.ts';
import { searchWeb, queryTerms, termCoverage, WEB_SOURCE_LABEL } from './shared/webSearch.ts';
import { getWeights, importWeights, exportWeights, learnFromPair } from './ranker.ts';
import { rerankHits, exportDocEmbeddings, importDocEmbeddings } from './reranker.ts';
import {
  recordClick,
  getUrlClicks,
  getQueryClicks,
  exportClicks,
  importClicks,
  normalizeQuery
} from './feedback.ts';

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const MAX_CATALOG_PAGES = 500;
const MAX_SERVER_SEEDS = 500;
const MAX_NOTE_LENGTH = 2000;
const MAX_URL_LENGTH = 2048;
const MAX_PAGE_CONTENT_LENGTH = 200_000;
const MAX_NOTES_PER_URL = 50;
const MAX_NOTE_URLS = 1000;
const MAX_VOTES_PER_NOTE = 10_000;
const MAX_READER_CACHE_ENTRIES = 200;
const MAX_VIDEO_CACHE_ENTRIES = 200;
const MAX_READER_BYTES = 2 * 1024 * 1024;

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > MAX_URL_LENGTH) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function getCorsOrigins(): string[] {
  return (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
}

/**
 * When ADMIN_API_KEY is configured, admin/mutating routes require it via
 * `X-Admin-Key: <key>` or `Authorization: Bearer <key>`. When unset, routes stay open.
 */
function safeKeyEqual(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isAdminRequest(req: Request): boolean {
  const adminKey = process.env.ADMIN_API_KEY?.trim();
  if (!adminKey) return true;
  const headerKey = req.header('x-admin-key');
  const bearer = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  return safeKeyEqual(headerKey, adminKey) || safeKeyEqual(bearer, adminKey);
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (isAdminRequest(req)) {
    next();
    return;
  }
  res.status(401).json({ error: 'Admin API key required' });
}

function sortPages(pages: ServerIndexedPage[], sortBy: string) {
  const time = (p: ServerIndexedPage) => (p.indexed_at ? new Date(p.indexed_at).getTime() : 0);
  if (sortBy === 'likes_desc') {
    pages.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  } else if (sortBy === 'date_desc') {
    pages.sort((a, b) => time(b) - time(a));
  } else if (sortBy === 'date_asc') {
    pages.sort((a, b) => time(a) - time(b));
  } else if (sortBy === 'backlinks_desc') {
    pages.sort((a, b) => (b.backlinks || 0) - (a.backlinks || 0));
  } else if (sortBy === 'title_asc') {
    pages.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  } else if (sortBy === 'title_desc') {
    pages.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
  }
}

/** Drops the oldest auto-indexed pages (never manually indexed or seed pages) once the catalog exceeds its cap. */
function trimCatalog() {
  let evicted = false;
  for (let i = serverIndexedPages.length - 1; i >= 0 && serverIndexedPages.length > MAX_CATALOG_PAGES; i--) {
    if (serverIndexedPages[i].auto_indexed) {
      searchIndex.remove(serverIndexedPages[i].id);
      serverIndexedPages.splice(i, 1);
      evicted = true;
    }
  }
  if (evicted) scheduleStateSave();
}

function trimSeeds() {
  if (serverSeeds.length > MAX_SERVER_SEEDS) {
    serverSeeds = serverSeeds.slice(0, MAX_SERVER_SEEDS);
  }
}

// Crawled and WARC-ingested pages enter the catalog through the same path as
// /api/index — they're marked auto_indexed so trimCatalog can evict them.
function indexCrawledPage(page: CrawledPage) {
  // rel=canonical wins: duplicate/alias URLs collapse onto the canonical one.
  const pageUrl = page.canonical_url || page.final_url || page.url;
  try {
    if (isBlockedHost(new URL(pageUrl).hostname)) return;
  } catch (_) {
    return;
  }
  if (blockedUrls.has(pageUrl)) return;
  const existingIdx = serverIndexedPages.findIndex(
    p => p.url.toLowerCase() === pageUrl.toLowerCase() || p.url.toLowerCase() === page.url.toLowerCase()
  );
  const entry: ServerIndexedPage = {
    id: existingIdx !== -1 ? serverIndexedPages[existingIdx].id : `crawl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    url: pageUrl,
    canonical_url: page.canonical_url || page.final_url || page.url,
    title: page.title,
    snippet: String(page.snippet || '').slice(0, 300),
    content: String(page.content || '').slice(0, MAX_PAGE_CONTENT_LENGTH),
    backlinks: existingIdx !== -1
      ? (serverIndexedPages[existingIdx].backlinks || 1)
      : Math.max(1, getInlinkCount(pageUrl)),
    host_quality: getHostQuality(pageUrl),
    authority: getRelativeAuthority(pageUrl),
    link_spam: getLinkSpam(pageUrl),
    anchor_text: getAnchorText(pageUrl) || undefined,
    clicks: existingIdx !== -1 ? (serverIndexedPages[existingIdx].clicks || 0) : getUrlClicks(pageUrl),
    indexed_at: new Date().toUTCString(),
    cache_hit: false,
    likes: existingIdx !== -1 ? (serverIndexedPages[existingIdx].likes || 0) : 0,
    author: page.author,
    language: page.language || 'English',
    tags: Array.isArray(page.keywords) ? page.keywords.slice(0, 10) : [],
    meta_description: page.meta_description,
    keywords: page.keywords,
    auto_indexed: true,
    crawled: true,
    images: Array.isArray(page.images) ? page.images.slice(0, 20) : undefined,
    rich: page.rich
  };
  if (existingIdx !== -1) {
    serverIndexedPages[existingIdx] = { ...serverIndexedPages[existingIdx], ...entry };
    syncIndex(serverIndexedPages[existingIdx]);
  } else {
    serverIndexedPages.unshift(entry);
    syncIndex(entry);
  }
  trimCatalog();
}
setPageIndexer(indexCrawledPage);

// After each crawl or WARC ingest: PageRank propagates authority through the
// link graph, inlink counts become backlink signals, and host quality updates —
// refresh pages so ranking reflects the latest outcomes.
function refreshRankSignals() {
  computePageRank();
  computeLinkSpam();
  for (const p of serverIndexedPages) {
    const inlinks = getInlinkCount(p.url);
    const quality = getHostQuality(p.url);
    const authority = getRelativeAuthority(p.url);
    const linkSpamMult = getLinkSpam(p.url);
    const anchors = getAnchorText(p.url);
    let changed = false;
    if (inlinks > (p.backlinks || 0)) {
      p.backlinks = inlinks;
      changed = true;
    }
    if (quality !== (p.host_quality ?? 1)) {
      p.host_quality = quality;
      changed = true;
    }
    if (authority !== (p.authority ?? 0)) {
      p.authority = authority;
      changed = true;
    }
    if (linkSpamMult !== (p.link_spam ?? 1)) {
      p.link_spam = linkSpamMult;
      changed = true;
    }
    if (anchors && anchors !== p.anchor_text) {
      p.anchor_text = anchors;
      changed = true;
    }
    if (changed) searchIndex.add(p);
  }
  scheduleStateSave();
}

// ---------------------------------------------------------------------------
// Recrawl — stale pages are re-fetched so indexed content stays fresh. Dead
// pages (404/410) drop out of the catalog; everything else re-indexes through
// the normal path (likes/clicks are preserved by the existing merge).
// ---------------------------------------------------------------------------

interface RecrawlResult {
  checked: number;
  refreshed: number;
  removed: number;
  failed: number;
  duration_ms: number;
}

let recrawlRunning = false;

async function recrawlStalePages(maxAgeDays: number, limit: number): Promise<RecrawlResult> {
  const cutoff = Date.now() - maxAgeDays * 86400000;
  const stale = serverIndexedPages
    .filter(p => p.crawled || p.auto_indexed)
    .filter(p => {
      const t = p.indexed_at ? Date.parse(p.indexed_at) : 0;
      return t > 0 && t < cutoff;
    })
    .sort((a, b) => Date.parse(a.indexed_at!) - Date.parse(b.indexed_at!))
    .slice(0, Math.min(Math.max(1, limit), 50));

  const started = Date.now();
  const result: RecrawlResult = { checked: 0, refreshed: 0, removed: 0, failed: 0, duration_ms: 0 };
  for (const p of stale) {
    result.checked++;
    try {
      if (!(await checkRobotsAllowed(p.url))) {
        result.failed++;
        continue;
      }
      const res = await fetchPublicResource(p.url, {
        timeoutMs: 12_000,
        maxBytes: 2 * 1024 * 1024,
        userAgent: 'IsaacBot/2.0 (+https://issac.microbytz.xyz)',
        accept: 'text/html,application/xhtml+xml;q=0.9'
      });
      if (!res) {
        result.failed++;
        continue;
      }
      if (res.status === 404 || res.status === 410) {
        const idx = serverIndexedPages.findIndex(x => x.id === p.id);
        if (idx !== -1) {
          searchIndex.remove(p.id);
          serverIndexedPages.splice(idx, 1);
          searchResponseCache.clear();
        }
        result.removed++;
        continue;
      }
      if (res.status >= 400 || !res.body) {
        result.failed++;
        continue;
      }
      const page = extractPage(res.body.toString('utf-8'), p.url, res.finalUrl || p.url);
      if (page && !page.noindex) {
        indexCrawledPage(page);
        result.refreshed++;
      } else {
        result.failed++;
      }
    } catch (_) {
      result.failed++;
    }
    await new Promise(r => setTimeout(r, 800)); // politeness between refetches
  }
  result.duration_ms = Date.now() - started;
  if (result.checked > 0) scheduleStateSave();
  return result;
}

let geminiClientInstance: GoogleGenAI | null | undefined;

function getGeminiClient(): GoogleGenAI | null {
  if (geminiClientInstance !== undefined) return geminiClientInstance;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    geminiClientInstance = null;
    return null;
  }
  geminiClientInstance = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
  return geminiClientInstance;
}

function writeNdjsonEvent(res: Response, payload: Record<string, any>) {
  res.write(JSON.stringify(payload) + '\n');
}

function cleanScrapedExcerpt(raw: string, maxLen: number = 360): string {
  if (!raw) return '';
  return raw
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/we use cookies.*?(\n|$)/gi, '')
    .replace(/decline\s*accept/gi, '')
    .replace(/privacy policy/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function buildStructuredSynthesisFromSources(
  query: string,
  sources: FireplexitySource[]
): string {
  if (sources.length === 0) {
    return `### Overview: ${query}\n\nNo external sources were returned for **${query}**. Try refining your search terms or checking domain filters.`;
  }

  const leadSource = sources[0];
  const leadExcerpt = cleanScrapedExcerpt(
    selectRelevantContent(
      leadSource.markdown || leadSource.content || leadSource.description || '',
      query,
      900
    ),
    420
  );

  const sections: string[] = [];
  sections.push(`### Executive Summary\n\n**${query}** — ${leadExcerpt || leadSource.description || leadSource.title} [1].`);

  if (sources.length > 1) {
    const secondSource = sources[1];
    const secondExcerpt = cleanScrapedExcerpt(
      selectRelevantContent(
        secondSource.markdown || secondSource.content || secondSource.description || '',
        query,
        800
      ),
      380
    );
    if (secondExcerpt) {
      sections.push(`${secondExcerpt} [2].`);
    }
  }

  const bulletLines: string[] = ['### Key Insights & Source Breakdown'];
  sources.forEach((src, idx) => {
    const citationNum = idx + 1;
    const snippet = cleanScrapedExcerpt(
      selectRelevantContent(
        src.markdown || src.content || src.description || '',
        query,
        600
      ) || src.description || '',
      280
    );
    const cleanTitle = (src.title || src.siteName || 'Source').replace(/[\[\]]/g, '');
    bulletLines.push(
      `- **${cleanTitle}** (${src.siteName || 'web'}): ${
        snippet || 'Provides technical documentation and reference benchmarks.'
      } [${citationNum}]`
    );
  });

  sections.push(bulletLines.join('\n'));
  return sections.join('\n\n');
}

/**
 * Live multi-source web, news, and image retrieval fallback when FIRECRAWL_API_KEY
 * is not configured or unavailable. Queries Wikipedia REST API, HackerNews Algolia API,
 * and the local Isaac Search catalog in parallel.
 */
async function performLiveMultiSourceFallback(
  query: string,
  localCatalogPages: Array<any> = []
): Promise<{
  sources: FireplexitySource[];
  newsResults: FireplexityNewsItem[];
  imageResults: FireplexityImageItem[];
}> {
  const sources: FireplexitySource[] = [];
  const newsResults: FireplexityNewsItem[] = [];
  const imageResults: FireplexityImageItem[] = [];
  const seenUrls = new Set<string>();

  const queryTerms = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);

  // 1. Match relevant pages from the local Isaac Search catalog first
  for (const page of localCatalogPages) {
    if (!page || !page.url || seenUrls.has(page.url)) continue;
    const hay = `${page.title || ''} ${page.snippet || ''} ${(page.tags || []).join(' ')}`.toLowerCase();
    const hits = queryTerms.filter(t => hay.includes(t)).length;
    if (hits > 0) {
      seenUrls.add(page.url);
      let siteName = 'isaac-index';
      try {
        siteName = new URL(page.url).hostname.replace('www.', '');
      } catch (_) {}
      sources.push({
        url: page.url,
        title: page.title || page.url,
        description: page.snippet || page.meta_description || '',
        markdown: `# ${page.title}\n\n${page.content || page.snippet || ''}\n\n${page.meta_description || ''}`,
        siteName,
        favicon: `https://www.google.com/s2/favicons?domain=${siteName}&sz=32`
      });
    }
  }

  // 2. Query Wikipedia Search + Extracts + PageImages API in parallel with HackerNews Algolia API
  const wikiPromise = (async () => {
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        query
      )}&gsrlimit=4&prop=extracts|pageimages|info&exintro=1&explaintext=1&inprop=url&pithumbsize=600&format=json&origin=*`;
      const res = await fetch(wikiUrl, {
        headers: { 'User-Agent': 'IsaacSearchFireplexity/2.0' }
      });
      if (!res.ok) return;
      const data: any = await res.json();
      const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
      for (const p of pages as any[]) {
        const pageUrl = p.fullurl || `https://en.wikipedia.org/?curid=${p.pageid}`;
        if (!seenUrls.has(pageUrl) && p.extract) {
          seenUrls.add(pageUrl);
          sources.push({
            url: pageUrl,
            title: `${p.title} - Wikipedia`,
            description: p.extract.slice(0, 260),
            markdown: `# ${p.title}\n\n${p.extract}`,
            siteName: 'en.wikipedia.org',
            favicon: 'https://www.google.com/s2/favicons?domain=en.wikipedia.org&sz=32',
            image: p.thumbnail?.source
          });
        }
        if (p.thumbnail?.source) {
          imageResults.push({
            url: pageUrl,
            title: p.title || 'Wikipedia Visual',
            thumbnail: p.thumbnail.source,
            source: 'en.wikipedia.org',
            width: p.thumbnail.width,
            height: p.thumbnail.height
          });
        }
      }
    } catch (_) {}
  })();

  const hnPromise = (async () => {
    try {
      const hnUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(
        query
      )}&tags=story&hitsPerPage=6`;
      const res = await fetch(hnUrl);
      if (!res.ok) return;
      const data: any = await res.json();
      const hits = Array.isArray(data?.hits) ? data.hits : [];
      for (const hit of hits) {
        const storyUrl =
          hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
        let hostname = 'news.ycombinator.com';
        try {
          hostname = new URL(storyUrl).hostname.replace('www.', '');
        } catch (_) {}

        const createdDate = hit.created_at
          ? new Date(hit.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })
          : undefined;

        newsResults.push({
          url: storyUrl,
          title: hit.title || 'Hacker News Discussion',
          description:
            hit.story_text?.replace(/<[^>]+>/g, '').slice(0, 200) ||
            `${hit.points || 0} points • ${hit.num_comments || 0} comments on Hacker News (${hostname})`,
          publishedDate: createdDate,
          source: hostname
        });

        if (sources.length < 6 && !seenUrls.has(storyUrl)) {
          seenUrls.add(storyUrl);
          sources.push({
            url: storyUrl,
            title: hit.title || storyUrl,
            description: `Community discussion and technical reference on ${hostname} (${hit.points || 0} upvotes, ${hit.num_comments || 0} comments).`,
            markdown: `# ${hit.title}\n\nSource: ${storyUrl} (${hostname})\nPublished: ${createdDate || 'Recent'}\n\n${
              hit.story_text?.replace(/<[^>]+>/g, '') ||
              `Referenced technical article on ${hostname} discussing ${query}.`
            }`,
            siteName: hostname,
            favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
          });
        }
      }
    } catch (_) {}
  })();

  await Promise.all([wikiPromise, hnPromise]);

  if (imageResults.length < 4) {
    try {
      const openverseUrl = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(
        query
      )}&page=1&page_size=6&mature=false`;
      const ovRes = await fetch(openverseUrl, {
        headers: { Accept: 'application/json', 'User-Agent': 'IsaacSearchFireplexity/2.0' },
        signal: AbortSignal.timeout(3500)
      });
      if (ovRes.ok) {
        const ovData: any = await ovRes.json();
        const results = Array.isArray(ovData?.results) ? ovData.results : [];
        for (const r of results) {
          if (imageResults.length >= 6) break;
          const imgUrl = r.thumbnail || r.url;
          if (imgUrl) {
            imageResults.push({
              url: r.foreign_landing_url || r.url || 'https://openverse.org',
              title: r.title || `${query} Visual Reference`,
              thumbnail: imgUrl,
              source: 'openverse.org'
            });
          }
        }
      }
    } catch (_) {}
  }

  return {
    sources: sources.slice(0, 6),
    newsResults: newsResults.slice(0, 6),
    imageResults: imageResults.slice(0, 6)
  };
}

// In-memory state for Isaac Search backend routes so /api/* never 404s or returns HTML
interface ServerNote {
  id: string;
  url: string;
  content: string;
  helpful_count: number;
  not_helpful_count: number;
  score: number;
  created_at: number;
}

const communityNotesByUrl = new Map<string, ServerNote[]>([
  [
    'https://fastapi.tiangolo.com',
    [
      {
        id: 'seed-note-fastapi-1',
        url: 'https://fastapi.tiangolo.com',
        content: 'Official FastAPI documentation. Covers Starlette ASGI routing, Pydantic v2 validation, and OpenAPI schema generation.',
        helpful_count: 14,
        not_helpful_count: 0,
        score: 14,
        created_at: Math.floor(Date.now() / 1000) - 86400 * 3
      }
    ]
  ],
  [
    'https://en.wikipedia.org/wiki/Search_engine',
    [
      {
        id: 'seed-note-wiki-1',
        url: 'https://en.wikipedia.org/wiki/Search_engine',
        content: 'Foundational overview of web crawling, inverted index data structures, and BM25 probabilistic relevance ranking.',
        helpful_count: 19,
        not_helpful_count: 1,
        score: 18,
        created_at: Math.floor(Date.now() / 1000) - 86400 * 5
      }
    ]
  ]
]);

let serverSeeds = [
  {
    id: 'seed-1',
    url: 'https://news.ycombinator.com',
    domain: 'news.ycombinator.com',
    source: 'common_crawl',
    created_at: Date.now() - 86400000 * 2
  },
  {
    id: 'seed-2',
    url: 'https://en.wikipedia.org/wiki/Search_engine',
    domain: 'en.wikipedia.org',
    source: 'manual',
    created_at: Date.now() - 86400000
  }
];

interface ServerIndexedPage {
  id: string;
  url: string;
  canonical_url?: string;
  title: string;
  snippet: string;
  content?: string;
  backlinks?: number;
  indexed_at?: string;
  cache_hit?: boolean;
  likes?: number;
  author?: string;
  language?: string;
  tags?: string[];
  meta_description?: string;
  keywords?: string[] | string;
  is_searxng_fallback?: boolean;
  fallback_source?: string;
  searxng_engines?: string[];
  web_score?: number;
  web_coverage?: number;
  auto_indexed?: boolean;
  crawled?: boolean;
  clicks?: number;
  host_quality?: number;
  authority?: number;
  link_spam?: number;
  anchor_text?: string;
  images?: Array<{ url: string; alt: string }>;
  rich?: {
    type: string;
    name?: string;
    rating?: number;
    rating_count?: number;
    date_published?: string;
    price?: string;
  };
}

const serverIndexedPages: ServerIndexedPage[] = [
  {
    id: 'page_wiki',
    url: 'https://en.wikipedia.org/wiki/Search_engine',
    canonical_url: 'https://en.wikipedia.org/wiki/Search_engine',
    title: 'Search engine - Wikipedia, the free encyclopedia',
    snippet: 'An information retrieval software system designed to help find information stored on a computer network. Results are typically presented in a line of results, often referred to as search engine results pages.',
    backlinks: 18,
    indexed_at: 'Tue Jun 16 01:48:00 2026',
    cache_hit: false,
    likes: 120,
    tags: ['search-engine', 'information-retrieval', 'algorithms', 'indexing', 'architecture'],
    meta_description: 'Comprehensive encyclopedia article explaining search engine architectures, web crawling algorithms, and inverted Whoosh index schemas.',
    keywords: ['search engine', 'information retrieval', 'web crawler', 'indexing', 'whoosh']
  },
  {
    id: 'page_fastapi',
    url: 'https://fastapi.tiangolo.com',
    title: 'FastAPI - Modern, high-performance web framework',
    snippet: 'FastAPI is a modern, fast (high-performance), web framework for building APIs with Python 3.8+ based on standard Python type hints. Features include key generation, auto swagger, and typing.',
    backlinks: 8,
    indexed_at: 'Tue Jun 16 01:30:00 2026',
    cache_hit: true,
    likes: 180,
    tags: ['python', 'fastapi', 'rest-api', 'backend', 'web-framework'],
    meta_description: 'High performance Python web framework for building RESTful search microservices with automatic OpenAPI documentation.',
    keywords: ['fastapi', 'python', 'rest api', 'swagger', 'pydantic', 'whoosh']
  },
  {
    id: 'page_firestore',
    url: 'https://firebase.google.com/docs/firestore',
    title: 'Cloud Firestore | Firebase Documentation',
    snippet: 'Use Firebase Cloud Firestore to store and sync data for client- and server-side development. Cloud Firestore is a flexible, scalable database for mobile, web, and server development.',
    backlinks: 15,
    indexed_at: 'Tue Jun 16 01:25:00 2026',
    cache_hit: false,
    likes: 95,
    tags: ['database', 'firestore', 'nosql', 'cloud', 'firebase'],
    meta_description: 'Cloud Firestore flexible NoSQL document database for real-time synchronization, offline support, and indexed search collections.',
    keywords: ['firebase', 'firestore', 'nosql', 'cloud database', 'realtime']
  },
  {
    id: 'page_whoosh',
    url: 'https://whoosh.readthedocs.io',
    title: 'Whoosh - Raw Python Search Engine Library',
    snippet: 'Whoosh is a fast, pure-Python search engine library. It allows you to build full-text search systems easily with custom schema definition, tokenizers, highlights, and stemmers.',
    backlinks: 5,
    indexed_at: 'Tue Jun 16 01:10:00 2026',
    cache_hit: true,
    likes: 45,
    tags: ['python', 'whoosh', 'search-engine', 'indexing', 'bm25'],
    meta_description: 'Pure Python indexing and search library providing custom schema fields, BM25 scoring, and high accuracy query parsers.',
    keywords: ['whoosh', 'python search', 'bm25', 'full-text index', 'schema', 'stemmer']
  },
  {
    id: 'page_pydantic',
    url: 'https://docs.pydantic.dev',
    title: 'Pydantic Documentation - Data validation and settings management',
    snippet: 'Data validation using Python type hints. Fast and extensible, Pydantic plays nicely with your linters, IDEs, and search index ingestion pipelines.',
    backlinks: 12,
    indexed_at: 'Tue Jun 16 02:05:00 2026',
    cache_hit: true,
    likes: 110,
    tags: ['python', 'pydantic', 'data-validation', 'typing'],
    meta_description: 'Fast Python data validation library using type annotations.',
    keywords: ['pydantic', 'validation', 'types', 'schema']
  },
  {
    id: 'page_scrapy',
    url: 'https://scrapy.org',
    title: 'Scrapy - An open source and collaborative web crawling framework',
    snippet: 'An open source and collaborative framework for extracting the data you need from websites in a fast, simple, yet extensible way.',
    backlinks: 16,
    indexed_at: 'Tue Jun 16 02:15:00 2026',
    cache_hit: false,
    likes: 140,
    tags: ['crawler', 'spider', 'python', 'scraping', 'scrapy'],
    meta_description: 'Fast high-level web crawling and web scraping framework for Python.',
    keywords: ['scrapy', 'crawler', 'spider', 'scraping', 'pipelines']
  },
  {
    id: 'page_mit',
    url: 'https://mit.edu/research/information-retrieval',
    title: 'MIT CSAIL Information Retrieval and Web Algorithms',
    snippet: 'Research lab publications on inverted indexes, TF-IDF vector models, BM25 probabilistic ranking, and distributed graph link analysis.',
    backlinks: 22,
    indexed_at: 'Tue Jun 16 02:30:00 2026',
    cache_hit: true,
    likes: 215,
    tags: ['algorithms', 'information-retrieval', 'academic', 'research'],
    meta_description: 'MIT research on search engine algorithmic retrieval and web scale graphs.',
    keywords: ['information retrieval', 'mit', 'algorithms', 'ranking', 'bm25']
  },
  {
    id: 'page_mdn',
    url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP',
    title: 'HTTP Documentation - MDN Web Docs',
    snippet: 'Hypertext Transfer Protocol (HTTP) is an application-layer protocol for transmitting hypermedia documents, such as HTML, images, and JSON API payloads.',
    backlinks: 34,
    indexed_at: 'Tue Jun 16 02:40:00 2026',
    cache_hit: true,
    likes: 290,
    tags: ['http', 'web-standards', 'networking', 'mdn', 'docs'],
    meta_description: 'Authoritative web development reference on HTTP headers, status codes, and methods.',
    keywords: ['http', 'protocol', 'headers', 'status codes', 'caching']
  },
  {
    id: 'page_starlette',
    url: 'https://www.starlette.io',
    title: 'Starlette - The little ASGI framework that shines',
    snippet: 'Starlette is a lightweight ASGI framework and toolkit, ideal for building async web services and high-throughput search microservices in Python.',
    backlinks: 7,
    indexed_at: 'Tue Jun 16 02:45:00 2026',
    cache_hit: false,
    likes: 68,
    tags: ['python', 'starlette', 'asgi', 'async', 'backend'],
    meta_description: 'Lightweight ASGI framework toolkit for high performance async search microservices.',
    keywords: ['starlette', 'asgi', 'asyncio', 'python', 'rest api']
  },
  {
    id: 'page_nist',
    url: 'https://nist.gov/itl/ssd/information-retrieval',
    title: 'NIST TREC Text REtrieval Conference Benchmark Evaluation',
    snippet: 'National Institute of Standards and Technology benchmark datasets and standard evaluation methodologies for information retrieval and search ranking engines.',
    backlinks: 14,
    indexed_at: 'Tue Jun 16 02:50:00 2026',
    cache_hit: true,
    likes: 85,
    tags: ['benchmark', 'standards', 'trec', 'evaluation', 'ir'],
    meta_description: 'NIST standard evaluations and corpora for modern search engines.',
    keywords: ['nist', 'trec', 'benchmark', 'information retrieval', 'precision-recall']
  }
];

// ============================================================================
// INVERTED INDEX, QUERY LOG & STATE PERSISTENCE
// ============================================================================
// The catalog is indexed by a real inverted index (BM25, field-weighted,
// stemmed) — see searchIndex.ts. Engine state (catalog, seeds, crawl history,
// schedule, query log) persists to data/engine-state.json so the index and
// crawler history survive restarts.

const searchIndex = new InvertedIndex<ServerIndexedPage>();
const queryLog = new Map<string, number>();
const MAX_QUERY_LOG = 5000;
// Per-query ranking features of the last result set — consumed by the click
// endpoint to run pairwise weight updates (ranker.ts).
const recentQueryFeatures = new Map<string, Map<string, number[]>>();
// 60s response cache for /api/search — keyed by the full param set.
const SEARCH_CACHE_TTL_MS = 60_000;
const SEARCH_CACHE_MAX = 200;
const searchResponseCache = new Map<string, { at: number; payload: object }>();

const STATE_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(STATE_DIR, 'engine-state.json');
const PERSISTED_CONTENT_CAP = 30_000;

function saveEngineState() {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    const pages = serverIndexedPages.map(p =>
      p.content && p.content.length > PERSISTED_CONTENT_CAP
        ? { ...p, content: p.content.slice(0, PERSISTED_CONTENT_CAP) }
        : p
    );
    const payload = {
      pages,
      seeds: serverSeeds,
      crawlHistory: getCrawlHistory(),
      linkGraph: exportLinkGraph(),
      anchorGraph: exportAnchorGraph(),
      hostStats: exportHostStats(),
      clicks: exportClicks(),
      rankWeights: exportWeights(),
      docEmbeddings: exportDocEmbeddings(),
      schedule: serverSchedule,
      autoCrawl: serverAutoCrawlEnabled,
      blockedHosts: [...blockedHostnames],
      blockedUrls: [...blockedUrls],
      queryLog: [...queryLog.entries()],
      savedAt: Date.now()
    };
    const tmp = STATE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(payload));
    fs.renameSync(tmp, STATE_FILE);
  } catch (_) {}
}

let stateSaveTimer: NodeJS.Timeout | null = null;
function scheduleStateSave() {
  if (stateSaveTimer) return;
  stateSaveTimer = setTimeout(() => {
    stateSaveTimer = null;
    saveEngineState();
  }, 3000);
  stateSaveTimer.unref();
}

function loadEngineState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    const st = JSON.parse(raw);
    if (Array.isArray(st.pages)) {
      const valid = st.pages.filter(
        (p: any) =>
          p && typeof p.id === 'string' && typeof p.url === 'string' && typeof p.title === 'string' &&
          // DuckDuckGo category links were auto-indexed by the old fallback; they're not documents.
          !/^https?:\/\/(www\.)?duckduckgo\.com\/c\//i.test(p.url)
      ).slice(0, MAX_CATALOG_PAGES);
      // Persisted pages win over the hardcoded defaults (they may carry crawl
      // updates/likes); defaults only fill in URLs the file doesn't have.
      const persistedUrls = new Set(valid.map((p: ServerIndexedPage) => p.url.toLowerCase()));
      const defaults = serverIndexedPages.splice(0);
      serverIndexedPages.push(...valid);
      for (const d of defaults) {
        if (!persistedUrls.has(d.url.toLowerCase())) serverIndexedPages.push(d);
      }
    }
    if (Array.isArray(st.seeds)) {
      const validSeeds = st.seeds.filter((s: any) => s && typeof s.id === 'string' && isHttpUrl(s.url));
      if (validSeeds.length > 0) serverSeeds = validSeeds.slice(0, MAX_SERVER_SEEDS);
    }
    if (Array.isArray(st.crawlHistory)) loadCrawlHistory(st.crawlHistory);
    if (Array.isArray(st.linkGraph)) {
      importLinkGraph(
        st.linkGraph.filter(
          (e: any) => Array.isArray(e) && typeof e[0] === 'string' && Array.isArray(e[1])
        )
      );
    }
    if (Array.isArray(st.anchorGraph)) {
      importAnchorGraph(
        st.anchorGraph.filter(
          (e: any) => Array.isArray(e) && typeof e[0] === 'string' && Array.isArray(e[1])
        )
      );
    }
    if (st.rankWeights && typeof st.rankWeights === 'object') importWeights(st.rankWeights);
    if (Array.isArray(st.docEmbeddings)) importDocEmbeddings(st.docEmbeddings);
    if (Array.isArray(st.hostStats)) {
      importHostStats(
        st.hostStats.filter((e: any) => Array.isArray(e) && typeof e[0] === 'string' && e[1])
      );
    }
    if (st.clicks && typeof st.clicks === 'object') importClicks(st.clicks);
    // Apply restored click counts, host quality, and PageRank authority onto
    // the merged catalog.
    computePageRank();
    computeLinkSpam();
    for (const p of serverIndexedPages) {
      const c = getUrlClicks(p.url);
      if (c > 0) p.clicks = c;
      p.host_quality = getHostQuality(p.url);
      p.authority = getRelativeAuthority(p.url);
      p.link_spam = getLinkSpam(p.url);
      const anchors = getAnchorText(p.url);
      if (anchors) p.anchor_text = anchors;
    }
    if (st.schedule && typeof st.schedule === 'object') {
      serverSchedule = { ...serverSchedule, ...st.schedule };
    }
    serverAutoCrawlEnabled = Boolean(st.autoCrawl);
    if (Array.isArray(st.blockedHosts)) {
      for (const h of st.blockedHosts) {
        if (typeof h === 'string' && h.trim()) blockedHostnames.add(h.trim().toLowerCase());
      }
      setBlockedHosts([...blockedHostnames]);
    }
    if (Array.isArray(st.blockedUrls)) {
      for (const u of st.blockedUrls) {
        if (typeof u === 'string' && u.trim()) blockedUrls.add(u.trim());
      }
    }
    if (Array.isArray(st.queryLog)) {
      for (const e of st.queryLog) {
        if (Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'number') {
          queryLog.set(e[0], e[1]);
          if (queryLog.size >= MAX_QUERY_LOG) break;
        }
      }
    }
  } catch (_) {}
}

// Keeps the inverted index and persisted state in sync with catalog mutations.
// Also invalidates the search cache — results changed.
function syncIndex(page: ServerIndexedPage) {
  searchIndex.add(page);
  searchResponseCache.clear();
  scheduleStateSave();
}

function recordQuery(q: string) {
  const key = q.toLowerCase().trim();
  if (!key) return;
  queryLog.set(key, (queryLog.get(key) || 0) + 1);
  if (queryLog.size > MAX_QUERY_LOG) {
    const oldest = queryLog.keys().next().value;
    if (oldest !== undefined) queryLog.delete(oldest);
  }
  scheduleStateSave();
}

const PUBLIC_SEARXNG_INSTANCES = [
  'https://searx.be',
  'https://search.ononoki.org',
  'https://searx.tiekoetter.com',
  'https://opnxng.com',
  'https://search.bus-hit.me'
];

const DOMINANT_COLOR_CACHE = new Map<string, string>();
const MAX_DOMINANT_COLOR_CACHE = 2000;
const MAX_COLOR_SAMPLE_BYTES = 5 * 1024 * 1024;

function rgbToPaletteColor(r: number, g: number, b: number): { name: string; chromatic: boolean; sat: number } {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const delta = max - min;
  const sat = max === 0 ? 0 : delta / max;
  if (max < 0.2) return { name: 'black', chromatic: false, sat };
  if (sat < 0.2) return { name: max > 0.6 ? 'white' : 'black', chromatic: false, sat };

  let hue = 0;
  const rn = r / 255, gn = g / 255, bn = b / 255;
  if (max === rn) hue = 60 * (((gn - bn) / delta) % 6);
  else if (max === gn) hue = 60 * ((bn - rn) / delta + 2);
  else hue = 60 * ((rn - gn) / delta + 4);
  if (hue < 0) hue += 360;

  if (hue >= 15 && hue < 45 && max < 0.6) return { name: 'brown', chromatic: true, sat };
  if (hue < 15 || hue >= 345) return { name: max < 0.45 && sat < 0.5 ? 'brown' : 'red', chromatic: true, sat };
  if (hue < 45) return { name: 'orange', chromatic: true, sat };
  if (hue < 70) return { name: 'yellow', chromatic: true, sat };
  if (hue < 160) return { name: 'green', chromatic: true, sat };
  if (hue < 190) return { name: 'teal', chromatic: true, sat };
  if (hue < 250) return { name: 'blue', chromatic: true, sat };
  if (hue < 290) return { name: 'purple', chromatic: true, sat };
  return { name: 'pink', chromatic: true, sat };
}

// Downsamples the image and returns the most common palette color, weighting the
// centre (where the subject usually is) and preferring colourful pixels over
// grey/black/white backgrounds.
function classifyDominantColor(pixels: Buffer, width: number, height: number): string | undefined {
  const scores = new Map<string, number>();
  let chromaticWeight = 0;
  let totalWeight = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const dx = (x + 0.5) / width - 0.5;
      const dy = (y + 0.5) / height - 0.5;
      const centreWeight = 1.5 - Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2);
      const { name, chromatic, sat } = rgbToPaletteColor(pixels[i], pixels[i + 1], pixels[i + 2]);
      const weight = chromatic ? centreWeight * (0.5 + sat) : centreWeight;
      scores.set(name, (scores.get(name) || 0) + weight);
      totalWeight += weight;
      if (chromatic) chromaticWeight += weight;
    }
  }
  if (totalWeight === 0) return undefined;
  const preferChromatic = chromaticWeight / totalWeight >= 0.15;
  let best: string | undefined;
  let bestScore = -1;
  for (const [name, score] of scores) {
    if (preferChromatic && (name === 'white' || name === 'black')) continue;
    if (score > bestScore) {
      best = name;
      bestScore = score;
    }
  }
  return best;
}

// Flickr serves fixed size variants that share the same secret (except `_o` originals),
// so a medium copy can be shown in the grid and a small one sampled for colour.
function flickrSizedUrls(url: string): { display: string; sample: string } | null {
  const match = url.match(/^(https:\/\/live\.staticflickr\.com\/\d+\/\d+_[0-9a-f]+)(?:_([a-z]))?\.jpg$/);
  if (!match || match[2] === 'o') return null;
  return { display: `${match[1]}_z.jpg`, sample: `${match[1]}_m.jpg` };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

// Fetches at most MAX_COLOR_SAMPLE_BYTES of an image through the SSRF-guarded
// shared fetcher (scheme + host validated on every redirect hop).
async function fetchImageSample(imageUrl: string): Promise<Buffer | undefined> {
  const res = await fetchPublicResource(imageUrl, {
    timeoutMs: 3000,
    maxBytes: MAX_COLOR_SAMPLE_BYTES,
    userAgent: 'IsaacSearchEngine/2.0',
    accept: 'image/*'
  });
  return res?.body;
}

/** Inserts into a Map while capping its size, evicting the oldest entry first. */
function boundedCacheSet<K, V>(map: Map<K, V>, key: K, value: V, maxEntries: number) {
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  while (map.size > maxEntries) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

// Fetches a public page for readability extraction through the shared
// SSRF-guarded fetcher, keeping the reader's browser-style UA.
function fetchPublicPage(pageUrl: string, timeoutMs: number): Promise<string | undefined> {
  return fetchPublicText(pageUrl, timeoutMs, {
    maxBytes: MAX_READER_BYTES,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (IsaacReader/2.0)'
  });
}

async function detectDominantColor(imageUrl: string): Promise<string | undefined> {
  if (DOMINANT_COLOR_CACHE.has(imageUrl)) return DOMINANT_COLOR_CACHE.get(imageUrl);
  let color: string | undefined;
  try {
    const buffer = await fetchImageSample(imageUrl);
    if (buffer) {
      const size = 24;
      const pixels = await sharp(buffer, { failOn: 'none' })
        .resize(size, size, { fit: 'cover' })
        .removeAlpha()
        .toColourspace('srgb')
        .raw()
        .toBuffer();
      color = classifyDominantColor(pixels, size, size);
    }
  } catch (_) {
    color = undefined;
  }
  if (!color) return undefined;
  if (DOMINANT_COLOR_CACHE.size >= MAX_DOMINANT_COLOR_CACHE) {
    const oldest = DOMINANT_COLOR_CACHE.keys().next().value;
    if (oldest !== undefined) DOMINANT_COLOR_CACHE.delete(oldest);
  }
  DOMINANT_COLOR_CACHE.set(imageUrl, color);
  return color;
}

const IMAGE_QUERY_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'for', 'from', 'how', 'image', 'images', 'in', 'is', 'of', 'on',
  'or', 'photo', 'photos', 'picture', 'pictures', 'the', 'to', 'what', 'with'
]);

function imageQueryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(t => t.length >= 2 && !IMAGE_QUERY_STOPWORDS.has(t))
    .map(t => (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t));
}

// True when at least one query term matches a whole token in the image's
// title/tags, so a 'cat' search can't pass on 'Cathedral'.
function matchesImageQuery(terms: string[], fields: unknown[]): boolean {
  if (terms.length === 0) return true;
  const tokens = new Set(
    fields
      .filter((f): f is string => typeof f === 'string')
      .join(' ')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
      .map(t => (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t))
  );
  return terms.some(term => tokens.has(term));
}

function extractTopicalTags(query: string, title: string, snippet: string): string[] {
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'have',
    'you', 'are', 'but', 'not', 'they', 'about', 'their', 'there', 'more',
    'will', 'can', 'some', 'one', 'all', 'our', 'into', 'has', 'been', 'its', 'out', 'was', 'what', 'how', 'when', 'where', 'why'
  ]);
  const combined = `${query} ${title} ${snippet}`.toLowerCase().replace(/[^a-z0-9\s\-]/g, ' ');
  const tokens = combined.split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));
  const unique = Array.from(new Set(['searxng-fallback', ...tokens.slice(0, 5)]));
  return unique.slice(0, 5);
}

/**
 * Queries SearXNG JSON API (using configured SEARXNG_URL or rotating public SearXNG instances),
 * and seamlessly cascades to open metasearch JSON endpoints (DuckDuckGo Instant Answer + Wikipedia + HN Algolia)
 * if public SearXNG instances rate-limit JSON requests.
 */
const REGION_CONFIGS: Record<string, { lang: string; ddgKl: string; domains: string[] }> = {
  all: { lang: 'en', ddgKl: 'wt-wt', domains: [] },
  us: { lang: 'en', ddgKl: 'us-en', domains: ['.gov', '.edu', '.com', '.us'] },
  uk: { lang: 'en', ddgKl: 'uk-en', domains: ['.uk', '.co.uk', '.gov.uk', '.ac.uk'] },
  de: { lang: 'de', ddgKl: 'de-de', domains: ['.de'] },
  fr: { lang: 'fr', ddgKl: 'fr-fr', domains: ['.fr', '.gouv.fr'] },
  jp: { lang: 'ja', ddgKl: 'jp-jp', domains: ['.jp', '.co.jp'] },
  ca: { lang: 'en', ddgKl: 'ca-en', domains: ['.ca', '.gc.ca'] },
  au: { lang: 'en', ddgKl: 'au-en', domains: ['.au', '.com.au', '.gov.au'] },
  in: { lang: 'en', ddgKl: 'in-en', domains: ['.in', '.co.in', '.gov.in'] },
  es: { lang: 'es', ddgKl: 'es-es', domains: ['.es'] },
  it: { lang: 'it', ddgKl: 'it-it', domains: ['.it'] },
  nl: { lang: 'nl', ddgKl: 'nl-nl', domains: ['.nl'] },
  br: { lang: 'pt', ddgKl: 'br-pt', domains: ['.br', '.com.br'] }
};

async function querySearXNGFallback(
  query: string,
  domainFilter?: string,
  page: number = 1,
  region: string = 'all'
): Promise<{
  results: ServerIndexedPage[];
  providerUsed: string;
}> {
  const safePage = Math.max(1, Number(page) || 1);
  const effectiveQuery = domainFilter?.trim()
    ? `site:${domainFilter.trim()} ${query}`
    : query;

  const regConf = REGION_CONFIGS[region.toLowerCase()] || REGION_CONFIGS.all;
  const customUrl = process.env.SEARXNG_URL?.trim().replace(/\/$/, '');
  const apiKey = process.env.SEARXNG_API_KEY?.trim();

  const candidateInstances = customUrl
    ? [customUrl, ...PUBLIC_SEARXNG_INSTANCES]
    : [...PUBLIC_SEARXNG_INSTANCES];

  // 1. Try SearXNG JSON API instances with fast timeout
  for (const baseUrl of candidateInstances) {
    try {
      const searxLang = regConf.lang !== 'all' ? regConf.lang : 'en';
      const targetUrl = `${baseUrl}/search?q=${encodeURIComponent(effectiveQuery)}&pageno=${safePage}&format=json&language=${searxLang}`;
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'User-Agent': 'IsaacSearchEngine/2.0 (SearXNG-Fallback; +https://isaac-search.app)'
      };
      if (apiKey && baseUrl === customUrl) {
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['X-API-Key'] = apiKey;
      }

      const response = await fetch(targetUrl, {
        headers,
        signal: AbortSignal.timeout(2800)
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data: any = await response.json();
          const rawList = Array.isArray(data?.results) ? data.results : [];
          if (rawList.length > 0) {
            let instanceHost = baseUrl;
            try {
              instanceHost = new URL(baseUrl).hostname;
            } catch (_) {}

            const mapped: ServerIndexedPage[] = rawList
              .filter((r: any) => r && r.url && r.title)
              .slice(0, 25)
              .map((r: any, idx: number) => {
                const snippetText = cleanScrapedExcerpt(r.content || r.snippet || r.title || '', 280);
                const engines: string[] = Array.isArray(r.engines)
                  ? r.engines
                  : r.engine
                  ? [String(r.engine)]
                  : ['searxng'];
                return {
                  id: `searxng_p${safePage}_${Date.now()}_${idx}`,
                  url: r.url,
                  canonical_url: r.url,
                  title: r.title,
                  snippet: snippetText || `Live search result for "${query}" retrieved via SearXNG (${instanceHost}).`,
                  content: r.content || snippetText,
                  backlinks: Math.max(1, (r.score ? Math.round(Number(r.score) * 4) : 6 - Math.min(idx, 5))),
                  indexed_at: new Date().toUTCString(),
                  cache_hit: false,
                  likes: Math.max(1, 15 - idx * 2),
                  author: r.author || instanceHost,
                  language: 'English',
                  tags: extractTopicalTags(query, r.title, snippetText),
                  meta_description: snippetText,
                  keywords: query.split(/\s+/).filter(Boolean),
                  is_searxng_fallback: true,
                  fallback_source: `SearXNG (${instanceHost})`,
                  searxng_engines: engines
                };
              });

            if (mapped.length > 0) {
              return {
                results: mapped,
                providerUsed: `SearXNG (${instanceHost})`
              };
            }
          }
        }
      }
    } catch (_) {
      // Rotate to next SearXNG instance
    }
  }

  // 2. Live web cascade (Brave Search API when keyed + Stack Overflow +
  // Wikipedia + HN), fused and relevance-gated in shared/webSearch.ts.
  const countryCode = region === 'all' ? 'ALL' : region === 'uk' ? 'GB' : region.toUpperCase();
  const { hits, sources } = await searchWeb(effectiveQuery, {
    page: safePage,
    country: countryCode,
    braveApiKey: process.env.BRAVE_SEARCH_API_KEY?.trim()
  });
  const now = new Date().toUTCString();
  let mappedWeb: ServerIndexedPage[] = hits.map((h, idx) => {
    let hostname = '';
    try {
      hostname = new URL(h.url).hostname.replace(/^www\./, '');
    } catch (_) {}
    const label = WEB_SOURCE_LABEL[h.source];
    return {
      id: `web_${h.source}_p${safePage}_${Date.now()}_${idx}`,
      url: h.url,
      canonical_url: h.url,
      title: h.title,
      snippet: cleanScrapedExcerpt(h.snippet, 280) || h.title,
      content: h.snippet,
      backlinks: 0,
      indexed_at: h.published_at || now,
      cache_hit: false,
      likes: 0,
      author: hostname || label,
      language: 'English',
      tags: extractTopicalTags(query, h.title, h.snippet),
      meta_description: cleanScrapedExcerpt(h.snippet, 200),
      keywords: query.split(/\s+/).filter(Boolean),
      is_searxng_fallback: true,
      fallback_source: label,
      searxng_engines: [h.source],
      web_score: h.score,
      web_coverage: h.coverage
    };
  });

  if (domainFilter?.trim()) {
    const dom = domainFilter.toLowerCase().trim();
    mappedWeb = mappedWeb.filter(item => item.url.toLowerCase().includes(dom));
  }

  return {
    results: mappedWeb.slice(0, 30),
    providerUsed: sources.length > 0 ? `Live Web (${sources.map(src => WEB_SOURCE_LABEL[src]).join(' + ')})` : 'Live Web (no source responded)'
  };
}

/**
 * Fetches real-world "Searches related to X" using Google search suggestions,
 * DuckDuckGo autocomplete, and intelligent contextual expansions.
 */
async function fetchRelatedSearches(query: string): Promise<string[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];
  const relatedSet = new Set<string>();

  // 1. Google Suggestions with trailing space returns true Google "Searches related to X"
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=${encodeURIComponent(cleanQ + ' ')}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(1800)
    });
    if (res.ok) {
      const data: any = await res.json();
      if (Array.isArray(data) && Array.isArray(data[1])) {
        for (const item of data[1]) {
          const s = String(item).trim();
          if (s && s.toLowerCase() !== cleanQ.toLowerCase()) {
            relatedSet.add(s);
          }
        }
      }
    }
  } catch (_) {}

  // 2. DuckDuckGo Autocomplete with space
  if (relatedSet.size < 8) {
    try {
      const ddgUrl = `https://duckduckgo.com/ac/?q=${encodeURIComponent(cleanQ + ' ')}&type=list`;
      const res = await fetch(ddgUrl, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data: any = await res.json();
        if (Array.isArray(data) && Array.isArray(data[1])) {
          for (const item of data[1]) {
            const s = String(item).trim();
            if (s && s.toLowerCase() !== cleanQ.toLowerCase()) {
              relatedSet.add(s);
            }
          }
        }
      }
    } catch (_) {}
  }

  // 3. Synthesize contextual search terms from query
  const contextualTerms = [
    `${cleanQ} tutorial`,
    `${cleanQ} documentation`,
    `${cleanQ} best practices`,
    `${cleanQ} examples github`,
    `${cleanQ} guide for beginners`,
    `${cleanQ} alternatives`,
    `${cleanQ} vs`,
    `${cleanQ} cheatsheet`
  ];
  for (const term of contextualTerms) {
    if (relatedSet.size >= 8) break;
    if (!relatedSet.has(term)) {
      relatedSet.add(term);
    }
  }

  return Array.from(relatedSet).slice(0, 10);
}

let serverAutoCrawlEnabled = false;
// Admin blocklist — hosts are rejected by the crawler itself; exact URLs are
// purged from the catalog. Both persist to engine-state.json.
const blockedHostnames = new Set<string>();
const blockedUrls = new Set<string>();
let serverSchedule = {
  enabled: false,
  interval: 'daily',
  start_url: 'https://news.ycombinator.com',
  last_run: '2026-09-25 14:30:00',
  next_run: '2026-09-27 14:30:00'
};

async function startServer() {
  const app = express();
  // Behind Cloud Run's single managed proxy — makes req.ip the real client IP
  // for click-feedback dedup and community-note vote tracking.
  app.set('trust proxy', 1);

  // Restore persisted engine state (catalog, seeds, crawl history, schedule,
  // query log), then rebuild the inverted index from the restored catalog.
  loadEngineState();
  searchIndex.rebuild(serverIndexedPages);
  // After each crawl: real inlink counts from the graph become backlink
  // signals, and host quality updates — refresh affected pages so ranking
  // reflects the latest crawl outcomes.
  setJobListener(refreshRankSignals);

  // Allow cross-origin requests from mobile apps (Capacitor https://localhost / capacitor://localhost)
  // Set CORS_ORIGINS (comma-separated) to restrict cross-origin access; defaults to '*'.
  const corsOrigins = getCorsOrigins();
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (corsOrigins.length === 0) {
      res.header('Access-Control-Allow-Origin', '*');
    } else {
      const origin = req.header('origin');
      if (origin && corsOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
      }
      res.header('Vary', 'Origin');
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Admin-Key');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: '5mb' }));
  app.use(compression());

  // Basic security headers — nosniff, no framing, sane referrer policy.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Per-IP sliding-window rate limit on expensive endpoints — every search can
  // trigger external fetches (SearXNG) and auto-index writes, so unbounded
  // traffic is a real cost/DoS vector, not just a fairness issue.
  const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
    '/search': { max: 60, windowMs: 60_000 },
    '/suggest': { max: 120, windowMs: 60_000 }
  };
  const rateHits = new Map<string, number[]>(); // "bucket|ip" -> timestamps
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const rule = req.path === '/search' || req.path.startsWith('/search/')
      ? RATE_LIMITS['/search']
      : RATE_LIMITS[req.path];
    if (!rule) {
      next();
      return;
    }
    const key = `${req.path}|${req.ip || 'anon'}`;
    const now = Date.now();
    let hits = rateHits.get(key);
    if (!hits) {
      hits = [];
      rateHits.set(key, hits);
    }
    while (hits.length > 0 && now - hits[0] > rule.windowMs) hits.shift();
    if (hits.length >= rule.max) {
      res.status(429).json({
        error: 'rate limit exceeded',
        retry_after_seconds: Math.ceil((rule.windowMs - (now - hits[0])) / 1000)
      });
      return;
    }
    hits.push(now);
    if (rateHits.size > 10_000) rateHits.clear(); // memory bound
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, index_size: searchIndex.size, uptime_s: Math.floor(process.uptime()) });
  });

  // Forward /api/* (except Fireplexity, which only lives here) to the FastAPI backend when PYTHON_BACKEND_URL is set.
  const pythonBackendUrl = process.env.PYTHON_BACKEND_URL?.trim().replace(/\/$/, '');
  if (pythonBackendUrl) {
    app.use('/api', async (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/fireplexity')) {
        next();
        return;
      }
      try {
        const headers: Record<string, string> = {};
        for (const name of ['content-type', 'accept', 'authorization', 'x-admin-key']) {
          const value = req.header(name);
          if (value) headers[name] = value;
        }
        const hasBody = !['GET', 'HEAD'].includes(req.method);
        const upstream = await fetch(`${pythonBackendUrl}${req.url}`, {
          method: req.method,
          headers,
          body: hasBody && req.body !== undefined ? JSON.stringify(req.body) : undefined,
          signal: AbortSignal.timeout(30000)
        });
        res.status(upstream.status);
        const contentType = upstream.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);
        res.send(Buffer.from(await upstream.arrayBuffer()));
      } catch (error: any) {
        res.status(502).json({ error: `Python backend unreachable: ${error?.message || 'unknown error'}` });
      }
    });
  }

  // ============================================================================
  // 1. COMMUNITY NOTES API ROUTES
  // ============================================================================
  app.get('/api/pages/notes', (req: Request, res: Response) => {
    const url = String(req.query.url || '').trim();
    if (!url) {
      res.json([]);
      return;
    }
    const notes = communityNotesByUrl.get(url) || [];
    res.json([...notes].sort((a, b) => b.score - a.score));
  });

  app.post('/api/pages/notes', (req: Request, res: Response) => {
    const { url, content } = req.body || {};
    if (!isHttpUrl(url) || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'A valid http(s) url and non-empty content are required' });
      return;
    }
    if (content.length > MAX_NOTE_LENGTH) {
      res.status(400).json({ error: `content must be at most ${MAX_NOTE_LENGTH} characters` });
      return;
    }
    const newNote: ServerNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      url: String(url),
      content: String(content).trim(),
      helpful_count: 0,
      not_helpful_count: 0,
      score: 0,
      created_at: Math.floor(Date.now() / 1000)
    };
    const existing = communityNotesByUrl.get(url) || [];
    if (existing.length >= MAX_NOTES_PER_URL) {
      res.status(429).json({ error: `This page already has the maximum of ${MAX_NOTES_PER_URL} notes` });
      return;
    }
    if (!communityNotesByUrl.has(url) && communityNotesByUrl.size >= MAX_NOTE_URLS) {
      const oldestUrl = communityNotesByUrl.keys().next().value;
      if (oldestUrl !== undefined) communityNotesByUrl.delete(oldestUrl);
    }
    communityNotesByUrl.set(url, [newNote, ...existing]);
    res.json(newNote);
  });

  // Tracks each voter's current vote per note (keyed by requester IP) so the
  // client-claimed previous_vote can't be replayed to inflate counts.
  const noteVotesByNoteId = new Map<string, Map<string, 'helpful' | 'not_helpful'>>();

  app.post('/api/pages/notes/:noteId/vote', (req: Request, res: Response) => {
    const { noteId } = req.params;
    const { vote_type, previous_vote } = req.body || {};
    const isVote = (v: unknown): v is 'helpful' | 'not_helpful' => v === 'helpful' || v === 'not_helpful';
    if (!isVote(vote_type) || (previous_vote != null && !isVote(previous_vote))) {
      res.status(400).json({ error: "vote_type (and previous_vote, if set) must be 'helpful' or 'not_helpful'" });
      return;
    }
    for (const notes of communityNotesByUrl.values()) {
      const note = notes.find(n => n.id === noteId);
      if (note) {
        const voterKey = req.ip || 'unknown';
        let voters = noteVotesByNoteId.get(noteId);
        if (!voters) {
          voters = new Map();
          noteVotesByNoteId.set(noteId, voters);
        }
        const recordedVote = voters.get(voterKey);
        if (recordedVote !== vote_type && (recordedVote !== undefined || voters.size < MAX_VOTES_PER_NOTE)) {
          if (recordedVote === 'helpful') note.helpful_count = Math.max(0, note.helpful_count - 1);
          if (recordedVote === 'not_helpful') note.not_helpful_count = Math.max(0, note.not_helpful_count - 1);
          if (vote_type === 'helpful') note.helpful_count += 1;
          else note.not_helpful_count += 1;
          voters.set(voterKey, vote_type);
        }
        note.score = note.helpful_count - note.not_helpful_count;
        res.json(note);
        return;
      }
    }
    res.status(404).json({ error: 'Community note not found' });
  });

  // ============================================================================
  // 2. CRAWLER & TELEMETRY API ROUTES
  // ============================================================================
  app.get('/api/crawler/seeds', (_req: Request, res: Response) => {
    res.json(serverSeeds);
  });

  app.delete('/api/crawler/seeds/:id', requireAdmin, (req: Request, res: Response) => {
    serverSeeds = serverSeeds.filter(s => s.id !== req.params.id);
    scheduleStateSave();
    res.json({ status: 'deleted', id: req.params.id });
  });

  app.get('/api/crawler/auto-crawl', (_req: Request, res: Response) => {
    res.json({ enabled: serverAutoCrawlEnabled });
  });

  app.post('/api/crawler/auto-crawl', requireAdmin, (req: Request, res: Response) => {
    serverAutoCrawlEnabled = Boolean(req.body?.enabled);
    scheduleStateSave();
    res.json({ enabled: serverAutoCrawlEnabled });
  });

  app.get('/api/crawler/schedule', (_req: Request, res: Response) => {
    res.json(serverSchedule);
  });

  app.post('/api/crawler/schedule', requireAdmin, (req: Request, res: Response) => {
    const { enabled, interval, start_url } = req.body || {};
    if (interval !== undefined && interval !== 'daily' && interval !== 'weekly') {
      res.status(400).json({ error: "interval must be 'daily' or 'weekly'" });
      return;
    }
    if (start_url !== undefined && start_url !== '' && !isHttpUrl(start_url)) {
      res.status(400).json({ error: 'start_url must be a valid http(s) URL' });
      return;
    }
    serverSchedule = {
      ...serverSchedule,
      enabled: Boolean(enabled),
      interval: interval || serverSchedule.interval,
      start_url: start_url || serverSchedule.start_url
    };
    if (serverSchedule.enabled) {
      const intervalMs = serverSchedule.interval === 'weekly' ? 7 * 86400000 : 86400000;
      serverSchedule.next_run = new Date(Date.now() + intervalMs).toISOString().replace('T', ' ').slice(0, 19);
    }
    scheduleStateSave();
    res.json({ status: 'updated', schedule: serverSchedule });
  });

  app.get('/api/crawler/history', (_req: Request, res: Response) => {
    res.json(getCrawlHistory());
  });

  app.get('/api/crawler/trend', (req: Request, res: Response) => {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
    res.json(getCrawlTrend(days));
  });

  app.get('/api/crawler/status', (_req: Request, res: Response) => {
    res.json(getCrawlStatus());
  });

  app.post('/api/crawl/start', requireAdmin, (req: Request, res: Response) => {
    const body = req.body || {};
    let seeds: string[];
    if (isHttpUrl(body.url)) {
      seeds = [String(body.url)];
    } else if (Array.isArray(body.urls) && body.urls.length > 0) {
      seeds = body.urls.filter(isHttpUrl).slice(0, 20);
    } else {
      seeds = serverSeeds.map(s => s.url).filter(isHttpUrl);
    }
    const result = startCrawl({
      seeds,
      maxPages: body.max_pages !== undefined ? Number(body.max_pages) : undefined,
      maxDepth: body.max_depth !== undefined ? Number(body.max_depth) : undefined,
      sameHostOnly: body.same_host !== false,
      triggeredBy: 'manual',
      jsRender: body.js_render === 'off' || body.js_render === 'always' ? body.js_render : 'auto',
      useSitemaps: body.use_sitemaps !== false
    });
    if ('error' in result) {
      res.status(409).json(result);
      return;
    }
    res.json({ status: 'started', job: result.job });
  });

  app.post('/api/crawl/pause', requireAdmin, (_req: Request, res: Response) => {
    res.json(pauseCrawl());
  });

  app.post('/api/crawl/retry', requireAdmin, (_req: Request, res: Response) => {
    const result = retryCrawl();
    if ('error' in result) {
      res.status(409).json(result);
      return;
    }
    res.json({ status: 'started', job: result.job });
  });

  // Stale-page recrawl: re-fetch catalog pages older than max_age_days so the
  // index tracks the live web. Dead pages (404/410) are evicted.
  app.post('/api/crawler/recrawl', requireAdmin, async (req: Request, res: Response) => {
    if (recrawlRunning) {
      res.status(409).json({ error: 'a recrawl is already running' });
      return;
    }
    const maxAgeDays = Math.min(Math.max(0.02, Number(req.body?.max_age_days) || 14), 365);
    const limit = Math.min(Math.max(1, Number(req.body?.limit) || 20), 50);
    recrawlRunning = true;
    try {
      res.json(await recrawlStalePages(maxAgeDays, limit));
    } finally {
      recrawlRunning = false;
    }
  });

  // Admin blocklist — demote entire hosts (crawler rejects them too) or exact
  // URLs. Blocking a host purges its catalog pages immediately.
  app.get('/api/crawler/blocklist', (_req: Request, res: Response) => {
    res.json({ hosts: [...blockedHostnames], urls: [...blockedUrls] });
  });

  app.post('/api/crawler/blocklist', requireAdmin, (req: Request, res: Response) => {
    const action = req.body?.action === 'remove' ? 'remove' : 'add';
    const host = String(req.body?.host || '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/\/.*$/, '');
    const url = String(req.body?.url || '').trim();
    if (!host && !url) {
      res.status(400).json({ error: 'host or url required' });
      return;
    }
    let purged = 0;
    if (host) {
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) {
        res.status(400).json({ error: 'invalid host' });
        return;
      }
      if (action === 'add') {
        blockedHostnames.add(host);
        setBlockedHosts([...blockedHostnames]);
        for (let i = serverIndexedPages.length - 1; i >= 0; i--) {
          try {
            const h = new URL(serverIndexedPages[i].url).hostname;
            if (h === host || h.endsWith('.' + host)) {
              searchIndex.remove(serverIndexedPages[i].id);
              serverIndexedPages.splice(i, 1);
              purged++;
            }
          } catch (_) {}
        }
      } else {
        blockedHostnames.delete(host);
        setBlockedHosts([...blockedHostnames]);
      }
    }
    if (url) {
      if (action === 'add') {
        blockedUrls.add(url);
        const idx = serverIndexedPages.findIndex(p => p.url === url);
        if (idx !== -1) {
          searchIndex.remove(serverIndexedPages[idx].id);
          serverIndexedPages.splice(idx, 1);
          purged++;
        }
      } else {
        blockedUrls.delete(url);
      }
    }
    searchResponseCache.clear();
    scheduleStateSave();
    res.json({ action, host: host || undefined, url: url || undefined, purged, hosts: blockedHostnames.size, urls: blockedUrls.size });
  });

  app.post('/api/cloud-functions/scheduled-crawl', requireAdmin, (_req: Request, res: Response) => {
    const seeds = isHttpUrl(serverSchedule.start_url)
      ? [serverSchedule.start_url]
      : serverSeeds.map(s => s.url).filter(isHttpUrl);
    const result = startCrawl({ seeds, triggeredBy: 'scheduled' });
    if ('error' in result) {
      res.status(409).json(result);
      return;
    }
    serverSchedule.last_run = new Date().toISOString().replace('T', ' ').slice(0, 19);
    res.json({ status: 'triggered', job: result.job });
  });

  let commonCrawlIndexId: string | null = null;
  let commonCrawlIndexFetchedAt = 0;

  async function getCommonCrawlIndexId(): Promise<string> {
    // Cache the latest index id for 6 hours
    if (commonCrawlIndexId && Date.now() - commonCrawlIndexFetchedAt < 6 * 3600 * 1000) {
      return commonCrawlIndexId;
    }
    const infoRes = await fetch('https://index.commoncrawl.org/collinfo.json', {
      headers: { 'User-Agent': 'IsaacSearchEngine/2.0' },
      signal: AbortSignal.timeout(8000)
    });
    if (!infoRes.ok) throw new Error(`collinfo ${infoRes.status}`);
    const cols: any = await infoRes.json();
    const id = Array.isArray(cols) && cols[0]?.id;
    if (!id || typeof id !== 'string') throw new Error('No Common Crawl index id');
    commonCrawlIndexId = id;
    commonCrawlIndexFetchedAt = Date.now();
    return id;
  }

  app.get('/api/crawler/common-crawl/search', async (req: Request, res: Response) => {
    const domain = String(req.query.domain || 'example.com')
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .trim();
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 20), 100);

    try {
      const indexId = await getCommonCrawlIndexId();
      const records = await queryCCIndex(indexId, domain, limit);
      const urls = records.map(r => ({
        url: r.url,
        timestamp: r.timestamp,
        mime: r.mime || 'text/html',
        status: r.status || '200',
        filename: r.filename,
        offset: r.offset,
        length: r.length,
        digest: r.digest
      }));
      res.json({ domain, index: indexId, urls });
    } catch (_) {
      res.json({ domain, index: null, urls: [] });
    }
  });

  // ---- Common Crawl WARC ingestion ----
  // Pulls stored page content from data.commoncrawl.org instead of live sites:
  // no robots/politeness needed, no live fetch — extract & index directly.
  interface WarcJob {
    id: string;
    domain: string;
    status: 'running' | 'done' | 'error';
    total: number;
    fetched: number;
    indexed: number;
    skipped: number;
    errors: number;
    started_at: number;
    done_at?: number;
    error?: string;
  }
  const warcJobs = new Map<string, WarcJob>();

  function sanitizeCCRecord(raw: unknown): CCRecord | null {
    const rec = raw as Partial<CCRecord>;
    const url = String(rec?.url || '');
    const filename = String(rec?.filename || '');
    const offset = Number(rec?.offset);
    const length = Number(rec?.length);
    if (!isHttpUrl(url)) return null;
    // WARC filenames always look like crawl-data/CC-MAIN-XXXX-XX/.../*.warc.gz —
    // the client supplies these, so validate before building the range URL.
    if (!/^crawl-data\/[A-Za-z0-9_./-]+\.warc\.gz$/.test(filename)) return null;
    if (!Number.isFinite(offset) || !Number.isFinite(length) || offset < 0 || length <= 0) return null;
    return {
      url,
      filename,
      offset,
      length,
      timestamp: String(rec.timestamp || ''),
      digest: String(rec.digest || ''),
      status: String(rec.status || ''),
      mime: String(rec.mime || '')
    };
  }

  const WARC_JOB_DEADLINE_MS = 15 * 60 * 1000;

  async function runWarcIngest(job: WarcJob, records: CCRecord[]) {
    const queue = records.slice();
    const deadline = Date.now() + WARC_JOB_DEADLINE_MS;
    const worker = async () => {
      while (queue.length > 0 && Date.now() < deadline) {
        const rec = queue.shift()!;
        try {
          const out = await fetchWarcHtml(rec);
          if (!out) {
            job.errors++;
            continue;
          }
          job.fetched++;
          const page = extractPage(out.html, rec.url, rec.url);
          if (!page || page.noindex || page.content.length < 80) {
            job.skipped++;
            continue;
          }
          if (!page.nofollow) {
            for (const link of extractLinksDetailed(out.html, rec.url)) {
              recordLink(rec.url, link.url);
              if (link.text) recordAnchor(link.url, link.text);
            }
          }
          indexCrawledPage(page);
          job.indexed++;
        } catch (_) {
          job.errors++;
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    job.skipped += queue.length; // unfinished at the job deadline
    job.status = 'done';
    job.done_at = Date.now();
    refreshRankSignals();
  }

  app.get('/api/crawler/common-crawl/jobs/:id', (req: Request, res: Response) => {
    const job = warcJobs.get(req.params.id);
    if (!job) {
      res.status(404).json({ error: 'job not found' });
      return;
    }
    res.json({ job });
  });

  app.post('/api/crawler/common-crawl/import', requireAdmin, async (req: Request, res: Response) => {
    const rawRecords = Array.isArray(req.body?.records) ? req.body.records.slice(0, 200) : null;
    const domainRaw = String(req.body?.domain || '')
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .trim();

    // WARC ingest mode: selected records, or a domain to look up + ingest.
    if ((rawRecords && rawRecords.length > 0) || domainRaw) {
      try {
        let records: CCRecord[];
        if (rawRecords && rawRecords.length > 0) {
          records = rawRecords
            .map(sanitizeCCRecord)
            .filter((r): r is CCRecord => r !== null);
        } else {
          const indexId = await getCommonCrawlIndexId();
          const limit = Math.min(Math.max(1, Number(req.body?.limit) || 25), 200);
          records = await queryCCIndex(indexId, domainRaw, limit);
        }
        if (records.length === 0) {
          res.json({ job: null, error: 'no valid WARC records' });
          return;
        }
        let jobDomain = domainRaw;
        if (!jobDomain) {
          try {
            jobDomain = new URL(records[0].url).hostname;
          } catch (_) {}
        }
        const job: WarcJob = {
          id: `warc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          domain: jobDomain,
          status: 'running',
          total: records.length,
          fetched: 0,
          indexed: 0,
          skipped: 0,
          errors: 0,
          started_at: Date.now()
        };
        if (warcJobs.size >= 50) {
          const oldest = warcJobs.keys().next().value;
          if (oldest) warcJobs.delete(oldest);
        }
        warcJobs.set(job.id, job);
        void runWarcIngest(job, records).catch(err => {
          job.status = 'error';
          job.error = String(err?.message || err).slice(0, 200);
          job.done_at = Date.now();
        });
        res.json({ job });
      } catch (e: any) {
        res.status(502).json({ job: null, error: String(e?.message || e).slice(0, 200) });
      }
      return;
    }

    // Legacy mode: bare URLs become crawl seeds.
    const urls: unknown[] = Array.isArray(req.body?.urls) ? req.body.urls.slice(0, 200) : [];
    let added = 0;
    let skipped = 0;
    for (const u of urls) {
      if (!isHttpUrl(u) || serverSeeds.some(s => s.url === u)) {
        skipped++;
      } else {
        let domain = u;
        try {
          domain = new URL(u).hostname;
        } catch (_) {}
        serverSeeds.push({
          id: `seed_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          url: u,
          domain,
          source: 'common_crawl',
          created_at: Date.now()
        });
        added++;
      }
    }
    trimSeeds();
    scheduleStateSave();
    res.json({ added_count: added, skipped_count: skipped });
  });

  // ============================================================================
  // 3. SEARCH, SUGGESTIONS & HISTORY API ROUTES (WITH SEARXNG FALLBACK)
  // ============================================================================

  // Google-style query operators: site:, filetype:/ext:, "exact phrase", -term.
  // site:/filetype:/phrases post-filter results; -term excludes at index level.
  function parseQueryOperators(raw: string) {
    let clean = raw;
    let site: string | null = null;
    const filetypes: string[] = [];
    const phrases: string[] = [];
    const excluded: string[] = [];
    clean = clean.replace(/\bsite:([^\s]+)/gi, (_m, s) => {
      if (!site) site = String(s).toLowerCase();
      return ' ';
    });
    clean = clean.replace(/\b(?:filetype|ext):([a-z0-9]+)/gi, (_m, e) => {
      filetypes.push(String(e).toLowerCase());
      return ' ';
    });
    clean = clean.replace(/"([^"]+)"/g, (_m, p) => {
      const t = String(p).trim().toLowerCase();
      if (t) phrases.push(t);
      return ' ';
    });
    clean = clean.replace(/(?:^|\s)-([^\s"(-][^\s]*)/g, (_m, t) => {
      excluded.push(String(t));
      return ' ';
    });
    return { clean: clean.replace(/\s+/g, ' ').trim(), site, filetypes, phrases, excluded };
  }

  // Live web search only (same contract as functions/api/web-search.ts on
  // Cloudflare Pages) — used by the client fallback.
  app.get('/api/web-search', async (req: Request, res: Response) => {
    const q = String(req.query.q || '').trim().slice(0, 300);
    const page = Math.min(10, Math.max(1, Number(req.query.page) || 1));
    const country = String(req.query.country || 'ALL');
    if (!q) {
      res.json({ hits: [], sources: [] });
      return;
    }
    res.json(await searchWeb(q, { page, country, braveApiKey: process.env.BRAVE_SEARCH_API_KEY?.trim() }));
  });

  app.get('/api/search', async (req: Request, res: Response) => {
    const queryStr = String(req.query.q || '').trim();
    const pageNum = Math.max(1, Number(req.query.page) || 1);
    const domainFilter = String(req.query.domain || '').trim();
    const region = String(req.query.region || 'all').trim().toLowerCase();
    const minBacklinks = Number(req.query.min_backlinks) || 0;
    const dateFromSec = Number(req.query.date_from) || 0;
    const dateToSec = Number(req.query.date_to) || 0;
    const sortBy = String(req.query.sort_by || 'relevance');
    const fallbackEnabled = req.query.fallback !== 'false';
    const forceFallback = req.query.force_fallback === 'true';
    const autoIndex = req.query.auto_index !== 'false';
    const minResultsThreshold = Math.max(1, Number(req.query.min_results) || 3);
    const pageLimit = Math.min(60, Math.max(1, Number(req.query.limit) || 25));

    if (!queryStr) {
      res.json({
        results: serverIndexedPages,
        firestore_count: serverIndexedPages.length,
        fallback_triggered: false,
        fallback_provider: null,
        fallback_count: 0,
        auto_indexed_count: 0,
        new_indexed_pages: []
      });
      return;
    }

    // 1. Query the local inverted index — BM25 scoring over stemmed,
    // field-weighted postings (title ×5, meta ×4, snippet ×3, url ×2, content ×1)
    // with phrase boosts and link/freshness signals.
    // Query operators (site:, filetype:, "exact", -term) are applied server-side
    // — they shape retrieval, not just the visible page.
    const ops = parseQueryOperators(queryStr);
    const effectiveQuery = ops.clean || queryStr;
    const effDomainFilter = domainFilter || ops.site || '';
    recordQuery(effectiveQuery);

    // Result cache — identical request params hit a 60s-TTL response payload.
    // Cleared on every index mutation (syncIndex / blocklist) so new pages and
    // purged ones never linger.
    const cacheKey = [
      normalizeQuery(queryStr), pageNum, pageLimit, sortBy, domainFilter, region,
      minBacklinks, dateFromSec, dateToSec, fallbackEnabled, forceFallback, autoIndex, minResultsThreshold
    ].join('|');
    const cached = searchResponseCache.get(cacheKey);
    if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL_MS) {
      res.json({ ...cached.payload, served_from_cache: true });
      return;
    }

    // Query intent: navigational (short domain/brand-ish query) boosts URL-term
    // matches; fresh-intent queries (latest/news/2026/…) widen the freshness
    // cap — Query Deserves Freshness.
    const qLower = effectiveQuery.trim().toLowerCase();
    const qTerms = qLower.split(/\s+/);
    const isFresh = /\b(latest|news|new|release[sd]?|updates?|20\d{2}|today|recent|announc\w*|breaking)\b/.test(qLower);
    const isNav = qTerms.length <= 2 && /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(qTerms[0]);
    const hits = searchIndex.search(effectiveQuery, 500, {
      weights: getWeights(),
      urlTermBoost: isNav ? 2.5 : 1,
      freshCap: isFresh ? 0.3 : 0.1,
      prf: !isNav, // PRF expands informational queries; navigational stays literal
      excludeTerms: ops.excluded
    });
    // Click-feedback rerank: pages users actually clicked *for this query*
    // get a strong boost; the per-URL global signal lives on the doc and is
    // already blended into BM25 above.
    {
      const qNorm = normalizeQuery(queryStr);
      for (const h of hits) {
        const qc = getQueryClicks(qNorm, h.doc.url);
        if (qc > 0) h.score *= 1 + Math.min(0.5, Math.log1p(qc) * 0.4);
      }
      hits.sort((a, b) => b.score - a.score);
    }
    // Region preference — soft boost for TLD/language matches (a boost, not a
    // filter: hard filtering would starve a small catalog).
    if (region !== 'all') {
      const regConf = REGION_CONFIGS[region] || REGION_CONFIGS.all;
      for (const h of hits) {
        let host = '';
        try {
          host = new URL(h.doc.url).hostname;
        } catch (_) {}
        const lang = (h.doc.language || '').toLowerCase();
        if (regConf.domains.some(d => host.endsWith(d)) || (regConf.lang !== 'en' && lang.startsWith(regConf.lang))) {
          h.score *= 1.3;
        }
      }
      hits.sort((a, b) => b.score - a.score);
    }
    // Optional neural stage — embedding cosine on the top-25 (reranker.ts).
    // Off unless NEURAL_RERANK is set; failures leave scores untouched.
    if (await rerankHits(effectiveQuery, hits)) {
      hits.sort((a, b) => b.score - a.score);
      scheduleStateSave(); // doc embeddings grew — persist
    }
    // Domain diversity — cap any single host at 3 results in the visible window;
    // overflow pages are demoted below the fold rather than dropped.
    {
      const hostCounts = new Map<string, number>();
      const head: typeof hits = [];
      const tail: typeof hits = [];
      for (const h of hits) {
        let host = '';
        try {
          host = new URL(h.doc.url).hostname;
        } catch (_) {}
        const c = hostCounts.get(host) || 0;
        if (head.length < 30 && c >= 3) {
          tail.push(h);
          continue;
        }
        hostCounts.set(host, c + 1);
        head.push(h);
      }
      hits.length = 0;
      hits.push(...head, ...tail);
    }
    // Cache this query's per-doc feature vectors — the click endpoint uses them
    // to learn weight updates from "clicked vs skipped-above" pairs.
    {
      const qNorm = normalizeQuery(queryStr);
      const featMap = new Map<string, number[]>();
      for (const h of hits) if (h.features) featMap.set(h.doc.url, h.features);
      if (recentQueryFeatures.size >= 50 && !recentQueryFeatures.has(qNorm)) {
        const oldest = recentQueryFeatures.keys().next().value;
        if (oldest !== undefined) recentQueryFeatures.delete(oldest);
      }
      recentQueryFeatures.set(qNorm, featMap);
    }
    let matchedPages = hits.map(h => h.doc);
    if (blockedHostnames.size > 0 || blockedUrls.size > 0) {
      matchedPages = matchedPages.filter(p => {
        if (blockedUrls.has(p.url)) return false;
        try {
          return !isBlockedHost(new URL(p.url).hostname);
        } catch (_) {
          return true;
        }
      });
    }

    if (effDomainFilter) {
      const domLower = effDomainFilter.toLowerCase();
      matchedPages = matchedPages.filter(p => {
        if (ops.site) {
          // site: is a strict host match (with subdomains), not a substring hit.
          try {
            const h = new URL(p.url).hostname;
            return h === domLower || h.endsWith('.' + domLower);
          } catch (_) {
            return false;
          }
        }
        return p.url.toLowerCase().includes(domLower);
      });
    }

    // Operator post-filters — filetype: on URL path, "exact phrases" required
    // verbatim in title/snippet/content. Shared by local + fallback results.
    const passesOps = (p: ServerIndexedPage): boolean => {
      if (ops.filetypes.length > 0) {
        try {
          const path = new URL(p.url).pathname.toLowerCase();
          if (!ops.filetypes.some(e => path.endsWith('.' + e))) return false;
        } catch (_) {
          return false;
        }
      }
      if (ops.phrases.length > 0) {
        const text = `${p.title || ''} ${p.snippet || ''} ${p.content || ''}`.toLowerCase();
        if (!ops.phrases.every(ph => text.includes(ph))) return false;
      }
      return true;
    };
    if (ops.filetypes.length > 0 || ops.phrases.length > 0) {
      matchedPages = matchedPages.filter(passesOps);
    }

    if (minBacklinks > 0) {
      matchedPages = matchedPages.filter(p => (p.backlinks || 0) >= minBacklinks);
    }

    if (dateFromSec > 0 || dateToSec > 0) {
      matchedPages = matchedPages.filter(p => {
        const itemSec = p.indexed_at ? Math.floor(new Date(p.indexed_at).getTime() / 1000) : 0;
        if (dateFromSec > 0 && itemSec < dateFromSec) return false;
        if (dateToSec > 0 && itemSec > dateToSec) return false;
        return true;
      });
    }

    // Term-coverage gate: a multi-word query shouldn't be "answered" by pages
    // that only match one word of it (or only PRF/synonym expansions). Pages
    // covering every term are "strong" — only those suppress the web fallback.
    const relTerms = queryTerms(effectiveQuery);
    const localCoverage = new Map<string, number>();
    for (const p of matchedPages) {
      const text = `${p.title || ''} ${p.snippet || ''} ${p.meta_description || ''} ${(p.content || '').slice(0, 8000)} ${p.url.replace(/[/_.:-]+/g, ' ')}`;
      localCoverage.set(p.url, termCoverage(relTerms, text));
    }
    if (relTerms.length >= 2) {
      matchedPages = matchedPages.filter(p => (localCoverage.get(p.url) || 0) >= 0.5);
    }
    // Snippet-only stubs auto-indexed from earlier web fallbacks don't count:
    // otherwise one past fallback would permanently stop live results for a query.
    const strongLocalCount = matchedPages.filter(
      p => (localCoverage.get(p.url) || 0) >= 1 && !(p.is_searxng_fallback && !p.crawled)
    ).length;

    const firestoreCount = matchedPages.length;
    const localMatchUrls = matchedPages.map(p => p.url.toLowerCase());
    sortPages(matchedPages, sortBy);
    let fallbackTriggered = false;
    let fallbackProvider: string | null = null;
    let fallbackCount = 0;
    let autoIndexedCount = 0;
    const newlyIndexedPages: ServerIndexedPage[] = [];

    // 2. Trigger SearXNG Fallback if Firestore doesn't have enough results (or if force_fallback / page > 1 is requested)
    if (fallbackEnabled && (forceFallback || pageNum > 1 || strongLocalCount < minResultsThreshold)) {
      fallbackTriggered = true;
      const searxData = await querySearXNGFallback(effectiveQuery, effDomainFilter, pageNum, region);
      fallbackProvider = searxData.providerUsed;

      const existingUrls = new Set(localMatchUrls);
      const allCatalogUrls = new Set(serverIndexedPages.map(p => p.url.toLowerCase()));

      for (const item of searxData.results) {
        if (minBacklinks > 0 && (item.backlinks || 0) < minBacklinks) continue;
        if (ops.site) {
          try {
            const h = new URL(item.url).hostname;
            if (!(h === ops.site || h.endsWith('.' + ops.site))) continue;
          } catch (_) {
            continue;
          }
        }
        if (!passesOps(item)) continue;
        const normUrl = item.url.toLowerCase();
        if (!existingUrls.has(normUrl)) {
          existingUrls.add(normUrl);
          fallbackCount++;

          // Read-Through Auto-Indexing into Firestore / Catalog & Crawler Seeds
          if (autoIndex && !allCatalogUrls.has(normUrl)) {
            allCatalogUrls.add(normUrl);
            const indexedCopy: ServerIndexedPage = {
              ...item,
              auto_indexed: true
            };
            serverIndexedPages.unshift(indexedCopy);
            syncIndex(indexedCopy);
            newlyIndexedPages.push(indexedCopy);
            autoIndexedCount++;

            // Also queue domain into Crawler Seeds if not already queued
            try {
              const hostname = new URL(item.url).hostname.replace('www.', '');
              if (!serverSeeds.some(s => s.url === item.url || s.domain === hostname)) {
                serverSeeds.unshift({
                  id: `seed_searxng_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  url: item.url,
                  domain: hostname,
                  source: 'searxng_fallback',
                  created_at: Date.now()
                });
              }
            } catch (_) {}

            matchedPages.push(indexedCopy);
          } else {
            matchedPages.push(item);
          }
        }
      }
    }

    if (autoIndexedCount > 0) {
      trimCatalog();
      trimSeeds();
    }

    // Sort combined results, then slice out the requested page window. For
    // relevance order: full-coverage local pages, then live web results (already
    // fused/ranked), then partial local matches.
    sortPages(matchedPages, sortBy);
    if (sortBy === 'relevance') {
      const strong: ServerIndexedPage[] = [];
      const web: ServerIndexedPage[] = [];
      const partial: ServerIndexedPage[] = [];
      for (const p of matchedPages) {
        const cov = localCoverage.get(p.url);
        if (cov === undefined) web.push(p);
        else if (cov >= 1) strong.push(p);
        else partial.push(p);
      }
      matchedPages = [...strong, ...web, ...partial];
    }
    matchedPages = matchedPages.slice((pageNum - 1) * pageLimit, pageNum * pageLimit);

    // "Did you mean" from the index vocabulary (edit distance over real terms).
    const spellcheck = searchIndex.spellcheck(effectiveQuery);

    const relatedSearches = await fetchRelatedSearches(effectiveQuery);

    const payload = {
      results: matchedPages,
      firestore_count: firestoreCount,
      fallback_triggered: fallbackTriggered,
      fallback_provider: fallbackProvider,
      fallback_count: fallbackCount,
      auto_indexed_count: autoIndexedCount,
      new_indexed_pages: newlyIndexedPages,
      spellcheck,
      related_searches: relatedSearches
    };
    if (searchResponseCache.size >= SEARCH_CACHE_MAX) {
      const oldest = searchResponseCache.keys().next().value;
      if (oldest !== undefined) searchResponseCache.delete(oldest);
    }
    searchResponseCache.set(cacheKey, { at: Date.now(), payload });
    res.json(payload);
  });

  // Click feedback — the frontend reports which result was opened so ranking
  // can learn. Dedup'd per (client, query, url) per hour inside feedback.ts.
  app.post('/api/search/click', (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const url = typeof body.url === 'string' ? body.url : '';
      const q = typeof body.q === 'string' ? body.q.slice(0, 200) : '';
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch (_) {
        res.status(400).json({ error: 'Invalid url' });
        return;
      }
      if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || isPrivateImageHost(parsed.hostname)) {
        res.status(400).json({ error: 'Invalid url' });
        return;
      }
      const counted = recordClick(q, url, req.ip || 'anon');
      if (counted) {
        const doc = serverIndexedPages.find(p => p.url === url);
        if (doc) doc.clicks = getUrlClicks(url); // index sees it via shared doc ref
        scheduleStateSave();
      }

      // Pairwise rank learning — results shown *above* the click were seen but
      // skipped. For each: clicked-features should beat skipped-features.
      const above: unknown[] = Array.isArray(body.above) ? body.above.slice(0, 10) : [];
      const featMap = q ? recentQueryFeatures.get(normalizeQuery(q)) : undefined;
      const clickedF = featMap?.get(url);
      if (featMap && clickedF) {
        let pairs = 0;
        for (const u of above) {
          if (typeof u !== 'string' || u === url) continue;
          const skippedF = featMap.get(u);
          if (skippedF) {
            learnFromPair(clickedF, skippedF);
            if (++pairs >= 5) break;
          }
        }
        if (pairs > 0) scheduleStateSave();
      }
      res.json({ ok: true, counted });
    } catch (_) {
      res.status(500).json({ error: 'click failed' });
    }
  });

  // -------------------------------------------------------------------------
  // OTA live updates — the deployed dist/ is offered as the latest app bundle.
  // Version = sha256 of the zip, so every deploy automatically becomes a new
  // update. The app polls /api/app/version at startup and stages the zip via
  // CapacitorUpdater.next() for the next launch.
  // -------------------------------------------------------------------------

  const OTA_DIST_DIR = path.join(__dirname, 'dist');
  let cachedAppBundle: { version: string; checksum: string; zip: Buffer } | null | undefined;

  function getAppBundle() {
    if (cachedAppBundle !== undefined) return cachedAppBundle;
    try {
      if (!fs.existsSync(path.join(OTA_DIST_DIR, 'index.html'))) {
        cachedAppBundle = null;
        return cachedAppBundle;
      }
      const files: Record<string, Uint8Array> = {};
      const collect = (dir: string, prefix: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const abs = path.join(dir, entry.name);
          const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (entry.isDirectory()) collect(abs, rel);
          else if (entry.isFile()) files[rel] = new Uint8Array(fs.readFileSync(abs));
        }
      };
      collect(OTA_DIST_DIR, '');
      const zip = Buffer.from(zipSync(files, { level: 6 }));
      const checksum = crypto.createHash('sha256').update(zip).digest('hex');
      cachedAppBundle = { version: checksum.slice(0, 16), checksum, zip };
      return cachedAppBundle;
    } catch (_) {
      cachedAppBundle = null;
      return cachedAppBundle;
    }
  }

  app.get('/api/app/version', (req: Request, res: Response) => {
    const bundle = getAppBundle();
    if (!bundle) {
      res.json({ version: 'dev', url: null });
      return;
    }
    res.json({
      version: bundle.version,
      checksum: bundle.checksum,
      url: `${req.protocol}://${req.get('host')}/api/app/bundle`
    });
  });

  app.get('/api/app/bundle', (_req: Request, res: Response) => {
    const bundle = getAppBundle();
    if (!bundle) {
      res.status(404).json({ error: 'No bundle built' });
      return;
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="bundle.zip"');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(bundle.zip);
  });

  app.get('/api/search/images', async (req: Request, res: Response) => {
    const queryStr = String(req.query.q || '').trim();
    const pageNum = Math.max(1, Number(req.query.page) || 1);
    if (!queryStr) {
      res.json([]);
      return;
    }

    const customUrl = process.env.SEARXNG_URL?.trim().replace(/\/$/, '');
    const candidateInstances = customUrl
      ? [customUrl, ...PUBLIC_SEARXNG_INSTANCES]
      : [...PUBLIC_SEARXNG_INSTANCES];

    const colors = ['blue', 'teal', 'purple', 'green', 'orange', 'red', 'pink', 'yellow', 'white', 'black'];

    const queryTerms = imageQueryTerms(queryStr);
    type ImageCandidate = { url?: string; title?: string; source_url?: string; color_url?: string };
    const toImageItem = (item: ImageCandidate, _idx: number) => ({
      url: item.url as string,
      alt_text: item.title || queryStr,
      source_url: item.source_url || item.url || '',
      title: item.title || queryStr,
      color_url: item.color_url || item.url
    });
    const sendImages = async (items: ReturnType<typeof toImageItem>[]) => {
      // Local index images lead; provider results fill the rest (deduped).
      const merged = [...localImages];
      for (const item of items) {
        if (merged.length >= 30) break;
        if (item.url && !seenImageUrls.has(item.url)) {
          seenImageUrls.add(item.url);
          merged.push(item);
        }
      }
      const withColors = await mapWithConcurrency(merged, 6, async ({ color_url, ...img }) => ({
        ...img,
        dominant_color: color_url ? await detectDominantColor(color_url) : undefined
      }));
      res.json(withColors);
    };

    // 0. Local index images — pages the crawler actually indexed. These lead
    // the grid because they're ours, then SearXNG fills the rest.
    const localImages: ReturnType<typeof toImageItem>[] = [];
    const seenImageUrls = new Set<string>();
    try {
      for (const h of searchIndex.search(queryStr, 40)) {
        const doc = h.doc as ServerIndexedPage;
        if (!Array.isArray(doc.images)) continue;
        for (const img of doc.images) {
          if (!img.url || seenImageUrls.has(img.url)) continue;
          if (!matchesImageQuery(queryTerms, [img.alt, doc.title])) continue;
          seenImageUrls.add(img.url);
          localImages.push(toImageItem({
            url: img.url,
            title: img.alt || doc.title,
            source_url: doc.url,
            color_url: img.url
          }, localImages.length));
          if (localImages.length >= 12) break;
        }
        if (localImages.length >= 12) break;
      }
    } catch (_) {}

    // 1. SearXNG image search (aggregates Bing/Google/DDG images)
    for (const baseUrl of candidateInstances.slice(0, 3)) {
      try {
        const imgSearchUrl = `${baseUrl}/search?q=${encodeURIComponent(queryStr)}&categories=images&pageno=${pageNum}&format=json`;
        const response = await fetch(imgSearchUrl, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'IsaacSearchEngine/2.0'
          },
          signal: AbortSignal.timeout(2500)
        });
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) continue;
        const data: any = await response.json();
        const rawResults = Array.isArray(data?.results) ? data.results : [];
        const mappedImages = rawResults
          .filter((r: any) => r && (r.img_src || r.thumbnail_src) && matchesImageQuery(queryTerms, [r.title]))
          .slice(0, 20)
          .map((r: any, idx: number) =>
            toImageItem(
              { url: r.img_src || r.thumbnail_src, title: r.title, source_url: r.url, color_url: r.thumbnail_src || r.img_src },
              idx
            )
          );
        if (mappedImages.length > 0) {
          await sendImages(mappedImages);
          return;
        }
      } catch (_) {}
    }

    // 2. Openverse (openly licensed images indexed by title, tags and description)
    try {
      const openverseUrl = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(
        queryStr
      )}&page=${pageNum}&page_size=20&mature=false`;
      const ovRes = await fetch(openverseUrl, {
        headers: { Accept: 'application/json', 'User-Agent': 'IsaacSearchEngine/2.0' },
        signal: AbortSignal.timeout(4000)
      });
      if (ovRes.ok) {
        const ovData: any = await ovRes.json();
        const results = Array.isArray(ovData?.results) ? ovData.results : [];
        const ovImages = results
          .filter((r: any) => (r?.thumbnail || r?.url) && matchesImageQuery(queryTerms, [
            r.title,
            ...(Array.isArray(r.tags) ? r.tags.map((t: any) => t?.name) : [])
          ]))
          .map((r: any, idx: number) => {
            // Prefer the provider's CDN over Openverse's thumbnail proxy, which is
            // rate limited per IP and starts failing when a whole grid loads at once.
            const flickr = typeof r.url === 'string' ? flickrSizedUrls(r.url) : null;
            return toImageItem(
              {
                url: flickr?.display || r.thumbnail || r.url,
                title: r.title,
                source_url: r.foreign_landing_url,
                color_url: flickr?.sample || r.thumbnail || r.url
              },
              idx
            );
          });
        if (ovImages.length > 0) {
          await sendImages(ovImages);
          return;
        }
      }
    } catch (_) {}

    // 3. Wikimedia Commons file search (actual image files, not article lead images)
    try {
      const commonsOffset = (pageNum - 1) * 20;
      const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
        `${queryStr} filetype:bitmap`
      )}&gsrlimit=20&gsroffset=${commonsOffset}&prop=imageinfo&iiprop=url|mime&iiurlwidth=600&format=json&origin=*`;
      const commonsRes = await fetch(commonsUrl, {
        headers: { 'User-Agent': 'IsaacSearchEngine/2.0' },
        signal: AbortSignal.timeout(4000)
      });
      if (commonsRes.ok) {
        const commonsData: any = await commonsRes.json();
        const pages = commonsData?.query?.pages ? (Object.values(commonsData.query.pages) as any[]) : [];
        const commonsImages = pages
          .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
          .map(p => ({ page: p, info: p?.imageinfo?.[0] }))
          .filter(({ page, info }) =>
            info &&
            /^image\/(jpeg|png|webp|gif)$/.test(info.mime || '') &&
            (info.thumburl || info.url) &&
            matchesImageQuery(queryTerms, [page.title])
          )
          .map(({ page, info }, idx) =>
            toImageItem(
              {
                url: info.thumburl || info.url,
                title: String(page.title || '').replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' '),
                source_url: info.descriptionurl
              },
              idx
            )
          );
        if (commonsImages.length > 0) {
          await sendImages(commonsImages);
          return;
        }
      }
    } catch (_) {}

    res.json([]);
  });

  const videoSearchCache = new Map<string, { timestamp: number; results: any[] }>();

  async function searchLiveVideos(queryStr: string, pageNum: number = 1): Promise<any[]> {
    const cacheKey = `${queryStr.toLowerCase().trim()}_${pageNum}`;
    const cached = videoSearchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.results;
    }

    // 1. Live YouTube search extraction (retrieves real video IDs, channels, thumbnails, and play urls)
    try {
      const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(queryStr)}`;
      const response = await fetch(ytUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(4500)
      });

      if (response.ok) {
        const html = await response.text();
        const match = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/ytInitialData\s*=\s*({.+?});/);
        if (match) {
          const data = JSON.parse(match[1]);
          const sections = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
          const videos: any[] = [];
          for (const sec of sections) {
            const items = sec?.itemSectionRenderer?.contents || [];
            for (const item of items) {
              const vr = item.videoRenderer;
              if (vr && vr.videoId) {
                const videoId = String(vr.videoId);
                const title = vr.title?.runs?.map((r: any) => r.text).join('') || vr.title?.simpleText || '';
                if (!title) continue;
                const channel = vr.ownerText?.runs?.map((r: any) => r.text).join('') || vr.longBylineText?.runs?.map((r: any) => r.text).join('') || '';
                const duration = vr.lengthText?.simpleText || '';
                const views = vr.viewCountText?.simpleText || vr.shortViewCountText?.simpleText || '';
                const uploadedAt = vr.publishedTimeText?.simpleText || '';
                const snippet = vr.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((r: any) => r.text).join('') ||
                                vr.descriptionSnippet?.runs?.map((r: any) => r.text).join('') || '';
                const thumbnail = vr.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

                videos.push({
                  id: videoId,
                  title,
                  url: `https://www.youtube.com/watch?v=${videoId}`,
                  embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`,
                  channel,
                  duration,
                  views,
                  uploadedAt,
                  snippet,
                  thumbnail,
                  tags: [queryStr.toLowerCase()]
                });
              }
            }
          }
          if (videos.length > 0) {
            const sliced = videos.slice((pageNum - 1) * 24, pageNum * 24);
            if (sliced.length > 0) {
              boundedCacheSet(videoSearchCache, cacheKey, { timestamp: Date.now(), results: sliced }, MAX_VIDEO_CACHE_ENTRIES);
              return sliced;
            }
          }
        }
      }
    } catch (_) {}

    // 2. SearXNG custom or public instances
    const customUrl = process.env.SEARXNG_URL?.trim().replace(/\/$/, '');
    const candidateInstances = customUrl
      ? [customUrl, ...PUBLIC_SEARXNG_INSTANCES]
      : [...PUBLIC_SEARXNG_INSTANCES];

    for (const baseUrl of candidateInstances.slice(0, 3)) {
      try {
        const vidSearchUrl = `${baseUrl}/search?q=${encodeURIComponent(queryStr)}&categories=videos&pageno=${pageNum}&format=json`;
        const response = await fetch(vidSearchUrl, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'IsaacSearchEngine/2.0'
          },
          signal: AbortSignal.timeout(2500)
        });
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) continue;
        const data: any = await response.json();
        const rawResults = Array.isArray(data?.results) ? data.results : [];
        const videos = rawResults
          .filter((r: any) => r && r.url && r.title)
          .slice(0, 16)
          .map((r: any, idx: number) => {
            let vidId = `vid_${pageNum}_${idx}`;
            let embedUrl = r.iframe_src;
            const ytMatch = r.url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
            if (ytMatch) {
              vidId = ytMatch[1];
              embedUrl = `https://www.youtube-nocookie.com/embed/${vidId}?autoplay=1&rel=0`;
            }
            return {
              id: vidId,
              title: r.title,
              url: r.url,
              embedUrl: embedUrl || undefined,
              thumbnail: r.thumbnail || r.img_src || (ytMatch ? `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg` : ''),
              channel: r.author || (() => { try { return new URL(r.url).hostname; } catch (_) { return ''; } })(),
              duration: r.duration || r.length || '',
              views: '',
              uploadedAt: r.publishedDate ? String(r.publishedDate).slice(0, 10) : '',
              snippet: r.content || '',
              tags: [queryStr.toLowerCase()]
            };
          });
        if (videos.length > 0) {
          boundedCacheSet(videoSearchCache, cacheKey, { timestamp: Date.now(), results: videos }, MAX_VIDEO_CACHE_ENTRIES);
          return videos;
        }
      } catch (_) {}
    }

    // 3. Invidious fallback
    const invidiousInstances = ['https://inv.nadeko.net', 'https://invidious.nerdvpn.de', 'https://vid.priv.au'];
    for (const inv of invidiousInstances) {
      try {
        const invUrl = `${inv}/api/v1/search?q=${encodeURIComponent(queryStr)}&type=video`;
        const response = await fetch(invUrl, { signal: AbortSignal.timeout(2500) });
        if (response.ok) {
          const data: any = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            const videos = data.slice(0, 16).map((item: any) => ({
              id: item.videoId,
              title: item.title,
              url: `https://www.youtube.com/watch?v=${item.videoId}`,
              embedUrl: `https://www.youtube-nocookie.com/embed/${item.videoId}?autoplay=1&rel=0`,
              channel: item.author,
              duration: item.lengthSeconds ? `${Math.floor(item.lengthSeconds / 60)}:${String(item.lengthSeconds % 60).padStart(2, '0')}` : '',
              views: item.viewCount ? `${Number(item.viewCount).toLocaleString()} views` : '',
              uploadedAt: item.publishedText || '',
              snippet: item.description || '',
              thumbnail: item.videoThumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
              tags: [queryStr.toLowerCase()]
            }));
            boundedCacheSet(videoSearchCache, cacheKey, { timestamp: Date.now(), results: videos }, MAX_VIDEO_CACHE_ENTRIES);
            return videos;
          }
        }
      } catch (_) {}
    }

    return [];
  }

  app.get('/api/search/videos', async (req: Request, res: Response) => {
    const queryStr = String(req.query.q || '').trim();
    const pageNum = Math.max(1, Number(req.query.page) || 1);
    if (!queryStr) {
      res.json([]);
      return;
    }

    const videos = await searchLiveVideos(queryStr, pageNum);
    res.json(videos);
  });

  app.get('/api/pages/:id', (req: Request, res: Response) => {
    const page = serverIndexedPages.find(p => p.id === req.params.id);
    if (page) {
      res.json(page);
      return;
    }
    res.status(404).json({ error: 'Page not found' });
  });

  // In-memory reader cache (5-minute TTL)
  const readerCache = new Map<string, { data: any; timestamp: number }>();

  app.get('/api/reader', async (req: Request, res: Response) => {
    const rawUrl = String(req.query.url || '').trim();
    const queryTitle = String(req.query.title || '').trim();
    const querySnippet = String(req.query.snippet || '').trim();

    if (!rawUrl || !isHttpUrl(rawUrl)) {
      res.status(400).json({ error: 'Valid URL is required' });
      return;
    }

    // Reject loopback/private/metadata hosts — the reader must never reach
    // into the internal network (checked again on every redirect hop).
    let readerTarget: URL;
    try {
      readerTarget = new URL(rawUrl);
    } catch (_) {
      res.status(400).json({ error: 'Valid URL is required' });
      return;
    }
    if (isPrivateImageHost(readerTarget.hostname)) {
      res.status(400).json({ error: 'Private or internal addresses are not allowed' });
      return;
    }

    const cacheKey = rawUrl.toLowerCase();
    const cached = readerCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      res.json(cached.data);
      return;
    }

    try {
      // 1. Check local indexed catalog
      const localMatch = serverIndexedPages.find(p => p.url.toLowerCase() === rawUrl.toLowerCase());
      if (localMatch && localMatch.content && localMatch.content.length > 150) {
        const paragraphs = localMatch.content
          .split(/\n\n+/)
          .map(p => p.trim())
          .filter(Boolean);
        const wordCount = localMatch.content.trim().split(/\s+/).filter(Boolean).length;
        const result = {
          url: localMatch.url,
          title: localMatch.title || queryTitle,
          byline: localMatch.author || new URL(rawUrl).hostname,
          content: localMatch.content,
          paragraphs: paragraphs.length > 0 ? paragraphs : [localMatch.content],
          wordCount,
          readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 200)),
          publishedAt: localMatch.indexed_at || new Date().toLocaleDateString(),
          source: new URL(rawUrl).hostname
        };
        boundedCacheSet(readerCache, cacheKey, { data: result, timestamp: Date.now() }, MAX_READER_CACHE_ENTRIES);
        res.json(result);
        return;
      }

      // 2. Wikipedia article extraction
      if (/wikipedia\.org\/wiki\//i.test(rawUrl)) {
        try {
          const titleMatch = rawUrl.match(/wiki\/([^#?]+)/);
          const wikiTitle = titleMatch ? decodeURIComponent(titleMatch[1].replace(/_/g, ' ')) : queryTitle;
          const wikiApiUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|info&explaintext=1&titles=${encodeURIComponent(wikiTitle)}&inprop=url&format=json&origin=*`;
          const wikiRes = await fetch(wikiApiUrl, {
            headers: { 'User-Agent': 'IsaacSearchEngine/2.0' },
            signal: AbortSignal.timeout(3500)
          });
          if (wikiRes.ok) {
            const wikiData: any = await wikiRes.json();
            const pages = wikiData?.query?.pages ? Object.values(wikiData.query.pages) : [];
            const page: any = pages[0];
            if (page && page.extract) {
              const fullText = page.extract;
              const paragraphs = fullText
                .split(/\n\n+/)
                .map((p: string) => p.trim())
                .filter(Boolean);
              const wordCount = fullText.trim().split(/\s+/).filter(Boolean).length;
              const result = {
                url: rawUrl,
                title: page.title || queryTitle || `${wikiTitle} — Wikipedia`,
                byline: 'Wikipedia Contributors',
                content: fullText,
                paragraphs: paragraphs.length > 0 ? paragraphs : [fullText],
                wordCount,
                readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 200)),
                publishedAt: new Date().toLocaleDateString(),
                source: 'en.wikipedia.org'
              };
              boundedCacheSet(readerCache, cacheKey, { data: result, timestamp: Date.now() }, MAX_READER_CACHE_ENTRIES);
              res.json(result);
              return;
            }
          }
        } catch (_) {}
      }

      // 3. Live Web Readability Extraction
      let extractedTitle = queryTitle;
      let extractedContent = '';
      let extractedByline = '';
      const domain = readerTarget.hostname;

      try {
        const html = await fetchPublicPage(rawUrl, 4000);

        if (html) {
          const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleTagMatch && !extractedTitle) {
            extractedTitle = titleTagMatch[1].trim();
          }

          const authorMatch = html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i) ||
                              html.match(/<meta[^>]*property=["']article:author["'][^>]*content=["']([^"']+)["']/i);
          if (authorMatch) {
            extractedByline = authorMatch[1].trim();
          }

          let cleaned = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
            .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
            .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
            .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '');

          const mainMatch = cleaned.match(/<(article|main)[^>]*>([\s\S]*?)<\/\1>/i);
          const targetHtml = mainMatch ? mainMatch[2] : cleaned;

          const pMatches = Array.from(targetHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi));
          const pTexts = pMatches
            .map(m => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
            .filter(t => t.length > 40 && !t.toLowerCase().includes('cookie') && !t.toLowerCase().includes('subscribe') && !t.toLowerCase().includes('privacy policy'));

          if (pTexts.length > 0) {
            extractedContent = pTexts.join('\n\n');
          }
        }
      } catch (_) {}

      // 4. If extracted content is sufficient, return it
      if (extractedContent && extractedContent.split(/\s+/).length > 80) {
        const paragraphs = extractedContent.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
        const wordCount = extractedContent.trim().split(/\s+/).filter(Boolean).length;
        const result = {
          url: rawUrl,
          title: extractedTitle || queryTitle,
          byline: extractedByline || domain,
          content: extractedContent,
          paragraphs,
          wordCount,
          readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 200)),
          publishedAt: undefined,
          source: domain
        };
        boundedCacheSet(readerCache, cacheKey, { data: result, timestamp: Date.now() }, MAX_READER_CACHE_ENTRIES);
        res.json(result);
        return;
      }

      // 5. Extraction failed — return only what we actually know (the result
      // snippet) instead of synthesising article text.
      const fallbackParagraphs = [
        querySnippet,
        `The full article text couldn't be extracted from ${domain}. Open the original page to read it.`
      ].filter(Boolean);
      const fallbackContent = fallbackParagraphs.join('\n\n');
      const wordCount = fallbackContent.trim().split(/\s+/).filter(Boolean).length;

      const fallbackResult = {
        url: rawUrl,
        title: queryTitle || extractedTitle || 'Document Story Preview',
        byline: extractedByline || domain,
        content: fallbackContent,
        paragraphs: fallbackParagraphs,
        wordCount,
        readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 200)),
        publishedAt: undefined,
        extraction_failed: true,
        source: domain
      };

      boundedCacheSet(readerCache, cacheKey, { data: fallbackResult, timestamp: Date.now() }, MAX_READER_CACHE_ENTRIES);
      res.json(fallbackResult);
    } catch (_err) {
      res.status(500).json({ error: 'Failed to extract readable story' });
    }
  });

  app.post('/api/history/save', (_req: Request, res: Response) => {
    res.json({ status: 'saved' });
  });

  app.delete('/api/history', (_req: Request, res: Response) => {
    res.json({ status: 'cleared' });
  });

  app.post('/api/pages/:id/like', (req: Request, res: Response) => {
    const target = serverIndexedPages.find(p => p.id === req.params.id);
    if (target) {
      target.likes = (target.likes || 0) + 1;
      syncIndex(target);
    }
    res.json({ status: 'liked', id: req.params.id, likes: target?.likes });
  });

  app.post('/api/index', (req: Request, res: Response) => {
    const body = req.body || {};
    if (!isHttpUrl(body.url) || typeof body.title !== 'string' || !body.title.trim()) {
      res.status(400).json({ error: 'A valid http(s) url and a title are required' });
      return;
    }
    {
      const existingIdx = serverIndexedPages.findIndex(
        p => p.url.toLowerCase() === String(body.url).toLowerCase()
      );
      if (existingIdx !== -1 && !isAdminRequest(req)) {
        res.status(401).json({ error: 'Admin API key required to overwrite an indexed page' });
        return;
      }
      const newPage: ServerIndexedPage = {
        id: body.id || `page_${Date.now()}`,
        url: String(body.url),
        canonical_url: body.canonical_url || String(body.url),
        title: String(body.title),
        snippet: String(body.snippet || body.content || '').slice(0, 300),
        content: String(body.content || body.snippet || '').slice(0, MAX_PAGE_CONTENT_LENGTH),
        backlinks: Number(body.backlinks) || 1,
        indexed_at: body.indexed_at || new Date().toUTCString(),
        cache_hit: false,
        likes: Number(body.likes) || 0,
        author: body.author,
        language: body.language || 'English',
        tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === 'string').slice(0, 50) : [],
        meta_description: body.meta_description,
        keywords: body.keywords
      };
      if (existingIdx !== -1) {
        serverIndexedPages[existingIdx] = { ...serverIndexedPages[existingIdx], ...newPage };
        syncIndex(serverIndexedPages[existingIdx]);
      } else {
        serverIndexedPages.unshift(newPage);
        syncIndex(newPage);
        trimCatalog();
      }
      res.json({ status: 'indexed', page: newPage });
    }
  });

  app.post('/api/index/image', (req: Request, res: Response) => {
    res.json({ status: 'indexed', image: req.body });
  });

  app.get('/api/suggest', async (req: Request, res: Response) => {
    const query = String(req.query.q || '').trim();
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));

    if (!query) {
      res.json({ query: '', suggestions: [] });
      return;
    }

    const suggestionsSet = new Set<string>();

    // 0. Own signals first — the query log and index vocabulary are the
    // engine's real autocomplete corpus.
    const lowerQ = query.toLowerCase();
    const logMatches = [...queryLog.entries()]
      .filter(([t]) => t.startsWith(lowerQ) || t.includes(lowerQ))
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
    for (const [t] of logMatches) suggestionsSet.add(t);
    for (const t of searchIndex.prefixTerms(lowerQ, limit)) suggestionsSet.add(t);

    // 1. Query Google Autocomplete (fast, high-quality, real query suggestions)
    try {
      const googleUrl = `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=${encodeURIComponent(query)}`;
      const gRes = await fetch(googleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(1800)
      });
      if (gRes.ok) {
        const gData: any = await gRes.json();
        if (Array.isArray(gData) && Array.isArray(gData[1])) {
          for (const item of gData[1]) {
            const s = String(item).trim();
            if (s) suggestionsSet.add(s);
          }
        }
      }
    } catch (_) {}

    // 2. Query DuckDuckGo Autocomplete as secondary/complementary provider
    if (suggestionsSet.size < limit) {
      try {
        const ddgUrl = `https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`;
        const dRes = await fetch(ddgUrl, { signal: AbortSignal.timeout(1500) });
        if (dRes.ok) {
          const dData: any = await dRes.json();
          if (Array.isArray(dData) && Array.isArray(dData[1])) {
            for (const item of dData[1]) {
              const s = String(item).trim();
              if (s) suggestionsSet.add(s);
            }
          }
        }
      } catch (_) {}
    }

    // 3. Query Wikipedia OpenSearch
    if (suggestionsSet.size < limit) {
      try {
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${limit}&namespace=0&format=json`;
        const wRes = await fetch(wikiUrl, { signal: AbortSignal.timeout(1500) });
        if (wRes.ok) {
          const wData: any = await wRes.json();
          if (Array.isArray(wData) && Array.isArray(wData[1])) {
            for (const item of wData[1]) {
              const s = String(item).trim();
              if (s) suggestionsSet.add(s);
            }
          }
        }
      } catch (_) {}
    }

    // 4. In-memory indexed pages (keywords & tags)
    for (const page of serverIndexedPages) {
      if (suggestionsSet.size >= limit * 2) break;
      const kws = Array.isArray(page.keywords) ? page.keywords : String(page.keywords || '').split(',');
      for (const kw of kws) {
        const clean = String(kw).trim();
        if (clean && clean.toLowerCase().includes(lowerQ)) {
          suggestionsSet.add(clean);
        }
      }
      for (const tag of page.tags || []) {
        const clean = String(tag).trim();
        if (clean && clean.toLowerCase().includes(lowerQ)) {
          suggestionsSet.add(clean);
        }
      }
    }

    const resultList = Array.from(suggestionsSet).slice(0, limit);
    res.json({ query, suggestions: resultList });
  });

  app.get('/api/related-searches', async (req: Request, res: Response) => {
    const query = String(req.query.q || '').trim();
    if (!query) {
      res.json({ query: '', related_searches: [] });
      return;
    }
    const related = await fetchRelatedSearches(query);
    res.json({ query, related_searches: related });
  });

  app.post('/api/suggest-tags', (req: Request, res: Response) => {
    const snippet = String(req.body?.snippet || '').toLowerCase();
    const stopWords = new Set([
      'the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'have',
      'you', 'are', 'but', 'not', 'they', 'about', 'their', 'there', 'more',
      'will', 'can', 'some', 'one', 'all', 'our', 'into', 'has', 'been', 'its', 'out', 'was'
    ]);
    const words = snippet.replace(/[^a-z\s]/g, ' ').split(/\s+/);
    const counts: Record<string, number> = {};
    for (const w of words) {
      if (w.length > 3 && !stopWords.has(w)) {
        counts[w] = (counts[w] || 0) + 1;
      }
    }
    const suggested_tags = Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a])
      .slice(0, 5);
    res.json({ suggested_tags });
  });

  // ============================================================================
  // 4. FIREPLEXITY v2 API ROUTES
  // ============================================================================
  app.get('/api/fireplexity/check-env', (_req: Request, res: Response) => {
    const hasFirecrawlKey = Boolean(
      process.env.FIRECRAWL_API_KEY && process.env.FIRECRAWL_API_KEY.trim().length > 0
    );
    const hasGroqKey = Boolean(
      process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 0
    );
    const hasGeminiKey = Boolean(
      process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    );

    res.json({
      hasFirecrawlKey,
      hasGroqKey,
      hasGeminiKey,
      activeSearchProvider: hasFirecrawlKey ? 'Firecrawl v2 API' : 'Live Multi-Source Scraper',
      activeLlmProvider: hasGroqKey ? 'Groq (Kimi K2 Instruct)' : 'Grounded AI Synthesis'
    });
  });

  app.post('/api/fireplexity/search', async (req: Request, res: Response) => {
    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const localCatalogPages = Array.isArray(body.localCatalogPages)
      ? body.localCatalogPages
      : [];

    let query: string = body.query || '';
    if (!query && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (typeof lastMsg.content === 'string') {
        query = lastMsg.content;
      }
    }

    if (!query || !query.trim()) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY?.trim();
    const groqApiKey = process.env.GROQ_API_KEY?.trim();

    let sources: FireplexitySource[] = [];
    let newsResults: FireplexityNewsItem[] = [];
    let imageResults: FireplexityImageItem[] = [];
    let searchProviderUsed = 'Firecrawl v2';

    try {
      writeNdjsonEvent(res, {
        type: 'data-status',
        data: { message: 'Starting search...' }
      });

      writeNdjsonEvent(res, {
        type: 'data-status',
        data: { message: 'Searching for relevant web, news, and image sources...' }
      });

      // 1. Call Firecrawl v2 /v2/search endpoint if FIRECRAWL_API_KEY is configured
      let firecrawlSucceeded = false;
      if (firecrawlApiKey) {
        try {
          const searchResponse = await fetch('https://api.firecrawl.dev/v2/search', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${firecrawlApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              query,
              sources: ['web', 'news', 'images'],
              limit: 6,
              scrapeOptions: {
                formats: ['markdown'],
                onlyMainContent: true,
                maxAge: 86400000
              }
            })
          });

          if (searchResponse.ok) {
            const searchResult: any = await searchResponse.json();
            const searchData = searchResult.data || {};
            const webResults = Array.isArray(searchData.web) ? searchData.web : [];
            const newsData = Array.isArray(searchData.news) ? searchData.news : [];
            const imagesData = Array.isArray(searchData.images) ? searchData.images : [];

            sources = webResults
              .map((item: any) => {
                let siteName = 'web';
                try {
                  siteName = new URL(item.url).hostname.replace('www.', '');
                } catch (_) {}
                return {
                  url: item.url,
                  title: item.title || item.url,
                  description: cleanScrapedExcerpt(item.description || item.snippet || item.markdown || '', 240),
                  content: item.content,
                  markdown: item.markdown,
                  favicon: item.favicon,
                  image: item.ogImage || item.image || item.metadata?.ogImage,
                  siteName
                };
              })
              .filter((item: any) => Boolean(item.url));

            newsResults = newsData
              .map((item: any) => {
                let sourceHost = item.source;
                if (!sourceHost && item.url) {
                  try {
                    sourceHost = new URL(item.url).hostname.replace('www.', '');
                  } catch (_) {}
                }
                return {
                  url: item.url,
                  title: item.title,
                  description: cleanScrapedExcerpt(item.snippet || item.description || '', 220),
                  publishedDate: item.date,
                  source: sourceHost,
                  image: item.imageUrl
                };
              })
              .filter((item: any) => Boolean(item.url));

            imageResults = imagesData
              .map((item: any) => {
                if (!item.url || !item.imageUrl) return null;
                let sourceHost = 'web';
                try {
                  sourceHost = new URL(item.url).hostname.replace('www.', '');
                } catch (_) {}
                return {
                  url: item.url,
                  title: item.title || 'Untitled',
                  thumbnail: item.imageUrl,
                  source: sourceHost,
                  width: item.imageWidth,
                  height: item.imageHeight,
                  position: item.position
                };
              })
              .filter(Boolean) as FireplexityImageItem[];

            if (sources.length > 0) {
              firecrawlSucceeded = true;
              searchProviderUsed = 'Firecrawl v2';
            }
          }
        } catch (_) {
          // Fall back gracefully to live multi-source scraper
        }
      }

      if (!firecrawlSucceeded) {
        searchProviderUsed = 'Live Multi-Source Scraper';
        const fallbackData = await performLiveMultiSourceFallback(
          query,
          localCatalogPages
        );
        sources = fallbackData.sources;
        newsResults = fallbackData.newsResults;
        imageResults = fallbackData.imageResults;
      }

      writeNdjsonEvent(res, {
        type: 'data-sources',
        data: {
          sources,
          newsResults,
          imageResults,
          providerInfo: {
            searchProvider: searchProviderUsed,
            llmProvider: groqApiKey ? 'Groq Kimi-K2' : 'Grounded AI Synthesis'
          }
        }
      });

      const tickerMatch = detectCompanyTicker(query);
      if (tickerMatch) {
        writeNdjsonEvent(res, {
          type: 'data-ticker',
          data: {
            symbol: tickerMatch.ticker,
            companyName: tickerMatch.companyName
          }
        });
      }

      writeNdjsonEvent(res, {
        type: 'data-status',
        data: { message: 'Analyzing sources and generating grounded answer...' }
      });

      const context = sources
        .map((source, index) => {
          const rawContent = source.markdown || source.content || source.description || '';
          const relevantContent = selectRelevantContent(rawContent, query, 2000);
          return `[${index + 1}] ${source.title}\nURL: ${source.url}\n${relevantContent}`;
        })
        .join('\n\n---\n\n');

      const systemPrompt = `You are a friendly, authoritative research assistant that helps users find accurate information.
CRITICAL FORMATTING RULE:
- NEVER use LaTeX/math syntax ($...$) for regular numbers in your response.
- Write ALL numbers as plain text: "1 million" NOT "$1$ million", "50%" NOT "$50\\%$".
- Use clean Markdown headings, bullet points, and bold key terms for readability.
- Include citations inline as [1], [2], etc. when referencing specific sources.
- Citations MUST correspond to the source order (first source = [1], second = [2], etc.).
- Use the exact format [1] not CITATION_1 or any other format.`;

      const userPrompt = `Answer this query: "${query}"\n\nBased on these sources:\n${
        context || 'Provide a comprehensive, accurate technical explanation.'
      }`;

      let fullAnswer = '';
      let llmStreamSucceeded = false;

      // Discards partial output from a provider that failed mid-stream before the next provider retries.
      const resetPartialAnswer = () => {
        if (fullAnswer.length > 0) {
          fullAnswer = '';
          writeNdjsonEvent(res, { type: 'text-reset' });
        }
      };

      // 2A. Primary Path 2: Stream using Groq ('moonshotai/kimi-k2-instruct' / 'llama-3.3-70b-versatile') if GROQ_API_KEY is set
      if (groqApiKey) {
        const groqModels = ['moonshotai/kimi-k2-instruct', 'llama-3.3-70b-versatile'];
        for (const modelName of groqModels) {
          if (llmStreamSucceeded) break;
          resetPartialAnswer();
          try {
            const historyMessages = messages
              .slice(0, -1)
              .slice(-6)
              .map((m: any) => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: String(m.content || '')
              }));

            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: modelName,
                stream: true,
                temperature: 0.7,
                messages: [
                  { role: 'system', content: systemPrompt },
                  ...historyMessages,
                  { role: 'user', content: userPrompt }
                ]
              })
            });

            if (groqRes.ok && groqRes.body) {
              const reader = groqRes.body.getReader();
              const decoder = new TextDecoder();
              let sseBuffer = '';
              let clientDisconnected = false;
              req.on('close', () => {
                clientDisconnected = true;
                reader.cancel().catch(() => {});
              });

              while (true) {
                if (clientDisconnected) break;
                const { value, done } = await reader.read();
                if (done) break;
                sseBuffer += decoder.decode(value, { stream: true });
                const lines = sseBuffer.split('\n');
                sseBuffer = lines.pop() || '';

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith('data:')) continue;
                  const dataStr = trimmed.slice(5).trim();
                  if (dataStr === '[DONE]') continue;
                  try {
                    const parsed = JSON.parse(dataStr);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                      fullAnswer += delta;
                      writeNdjsonEvent(res, {
                        type: 'text-delta',
                        data: { textDelta: delta }
                      });
                    }
                  } catch (_) {}
                }
              }

              if (fullAnswer.trim().length > 0) {
                llmStreamSucceeded = true;
              }
            }
          } catch (_) {}
        }
      }

      // 2B. Fallback to Server-Side Gemini ('gemini-3.8-flash') if Groq key is not set or failed
      if (!llmStreamSucceeded) {
        const ai = getGeminiClient();
        if (ai) {
          resetPartialAnswer();
          try {
            const historyText =
              messages.length > 1
                ? 'Previous Conversation:\n' +
                  messages
                    .slice(0, -1)
                    .slice(-4)
                    .map((m: any) => `${m.role}: ${m.content}`)
                    .join('\n') +
                  '\n\n'
                : '';

            const streamResponse = await ai.models.generateContentStream({
              model: 'gemini-3.8-flash',
              contents: `${historyText}${userPrompt}`,
              config: {
                systemInstruction: systemPrompt,
                temperature: 0.7
              }
            });

            for await (const chunk of streamResponse) {
              const chunkText = chunk.text;
              if (chunkText) {
                fullAnswer += chunkText;
                writeNdjsonEvent(res, {
                  type: 'text-delta',
                  data: { textDelta: chunkText }
                });
              }
            }

            if (fullAnswer.trim().length > 0) {
              llmStreamSucceeded = true;
            }
          } catch (_) {}
        }
      }

      // 2C. Clean structured synthesis from scraped Firecrawl Markdown if external LLM keys are unconfigured/unavailable
      if (!llmStreamSucceeded) {
        resetPartialAnswer();
        const synthesized = buildStructuredSynthesisFromSources(query, sources);
        fullAnswer = synthesized;
        writeNdjsonEvent(res, {
          type: 'text-delta',
          data: { textDelta: synthesized }
        });
      }

      // 3. Generate 5 Follow-Up Questions
      let followUpQuestions: string[] = [];
      const followUpSystemPrompt = `Generate 5 natural follow-up questions based on the query and answer.
Return ONLY the questions, one per line, with no numbering or bullets.`;
      const followUpUserPrompt = `Query: ${query}\n\nAnswer provided: ${fullAnswer.substring(
        0,
        500
      )}...\n\n${
        sources.length > 0
          ? `Available sources: ${sources.map(s => s.title).join(', ')}\n\n`
          : ''
      }Generate 5 diverse follow-up questions that help the user explore this topic from different angles.`;

      if (groqApiKey) {
        try {
          const fqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${groqApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'moonshotai/kimi-k2-instruct',
              temperature: 0.7,
              messages: [
                { role: 'system', content: followUpSystemPrompt },
                { role: 'user', content: followUpUserPrompt }
              ]
            })
          });
          if (fqRes.ok) {
            const fqData: any = await fqRes.json();
            const rawText: string = fqData.choices?.[0]?.message?.content || '';
            followUpQuestions = rawText
              .split('\n')
              .map(q => q.replace(/^[\d\-\*\.\)\s]+/, '').trim())
              .filter(q => q.length > 8)
              .slice(0, 5);
          }
        } catch (_) {}
      }

      if (followUpQuestions.length === 0 && llmStreamSucceeded) {
        const ai = getGeminiClient();
        if (ai) {
          try {
            const fqResponse = await ai.models.generateContent({
              model: 'gemini-3.8-flash',
              contents: followUpUserPrompt,
              config: {
                systemInstruction: followUpSystemPrompt,
                temperature: 0.7
              }
            });
            const rawText = fqResponse.text || '';
            followUpQuestions = rawText
              .split('\n')
              .map(q => q.replace(/^[\d\-\*\.\)\s]+/, '').trim())
              .filter(q => q.length > 8)
              .slice(0, 5);
          } catch (_) {}
        }
      }

      if (followUpQuestions.length === 0) {
        followUpQuestions = [
          `What are the key performance benchmarks and trade-offs for ${query}?`,
          `How is ${query} implemented in production-scale distributed architectures?`,
          `What are the main alternatives or competing approaches to ${query}?`,
          `What recent developments or news updates have impacted ${query}?`,
          `How can I integrate findings on ${query} into a technical specification?`
        ];
      }

      writeNdjsonEvent(res, {
        type: 'data-followup',
        data: { questions: followUpQuestions }
      });

      writeNdjsonEvent(res, { type: 'done' });
      res.end();
    } catch (error: any) {
      writeNdjsonEvent(res, {
        type: 'data-error',
        data: {
          error: error?.message || 'Unexpected error during Fireplexity search',
          suggestion: 'Try simplifying your query or checking your network connection.'
        }
      });
      res.end();
    }
  });

  // Catch-all for any other /api/* routes so they return clean 404 JSON instead of Vite's index.html
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  const distPath = path.join(__dirname, 'dist');
  const distIndexHtml = path.join(distPath, 'index.html');

  if (process.env.NODE_ENV === 'production') {
    // Production Mode: Serve compiled dist assets
    app.use(express.static(distPath));
    app.use((req: Request, res: Response) => {
      if (req.path.startsWith('/assets/')) {
        res.status(404).end('Asset not found');
        return;
      }
      res.sendFile(distIndexHtml);
    });
  } else {
    // Development Mode: Use Vite Dev Server middleware directly
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null
      },
      appType: 'spa'
    });

    // If an old browser tab requests a cached /assets/* bundle from previous builds,
    // fallback gracefully so the browser never crashes with HTML MIME type error
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/assets/')) {
        const candidate = path.resolve(distPath, `.${req.path}`);
        if (candidate.startsWith(distPath + path.sep) && fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory()) {
          res.sendFile(candidate);
          return;
        }
        res.status(404).end('Asset not found');
        return;
      }
      next();
    });

    app.use(vite.middlewares);
    vite.transformRequest('/src/main.tsx').catch(() => {});
    vite.transformRequest('/src/App.tsx').catch(() => {});
  }

  // Scheduler tick — fires scheduled crawls (schedule.start_url) and, when
  // auto-crawl is enabled, a seed-list crawl every 6 hours.
  let lastAutoCrawlAt = 0;
  let lastRecrawlAt = 0;
  const scheduleFmt = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19);
  setInterval(() => {
    try {
      const now = Date.now();
      if (serverSchedule.enabled) {
        const nextTs = new Date(serverSchedule.next_run.replace(' ', 'T')).getTime();
        if (Number.isFinite(nextTs) && now >= nextTs) {
          const seeds = isHttpUrl(serverSchedule.start_url)
            ? [serverSchedule.start_url]
            : serverSeeds.map(s => s.url).filter(isHttpUrl);
          const result = startCrawl({ seeds, triggeredBy: 'scheduled' });
          serverSchedule.last_run = scheduleFmt(new Date());
          const intervalMs = serverSchedule.interval === 'weekly' ? 7 * 86400000 : 86400000;
          serverSchedule.next_run = scheduleFmt(new Date(now + intervalMs));
          if ('error' in result) console.log(`[crawler] scheduled crawl skipped: ${result.error}`);
        }
      }
      if (serverAutoCrawlEnabled && now - lastAutoCrawlAt >= 6 * 3600 * 1000) {
        lastAutoCrawlAt = now;
        const result = startCrawl({
          seeds: serverSeeds.map(s => s.url).filter(isHttpUrl),
          triggeredBy: 'auto'
        });
        if ('error' in result && result.error !== 'A crawl is already running') {
          console.log(`[crawler] auto-crawl skipped: ${result.error}`);
        }
      }
      // Daily stale-page sweep — re-fetches the oldest indexed pages so the
      // catalog tracks the live web. Small batches; dead pages drop out.
      if (!recrawlRunning && now - lastRecrawlAt >= 24 * 3600 * 1000) {
        lastRecrawlAt = now;
        recrawlRunning = true;
        void recrawlStalePages(14, 20)
          .catch(() => {})
          .finally(() => {
            recrawlRunning = false;
          });
      }
    } catch (_) {}
  }, 60 * 1000).unref();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Isaac Search + Fireplexity v2 server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
