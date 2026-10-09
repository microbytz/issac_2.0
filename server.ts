import express from 'express';
import sharp from 'sharp';
import type { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import zlib from 'zlib';
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

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const MAX_CATALOG_PAGES = 500;
const MAX_SERVER_SEEDS = 500;
const MAX_NOTE_LENGTH = 2000;
const MAX_URL_LENGTH = 2048;
const MAX_PAGE_CONTENT_LENGTH = 200_000;

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
function isAdminRequest(req: Request): boolean {
  const adminKey = process.env.ADMIN_API_KEY?.trim();
  if (!adminKey) return true;
  const headerKey = req.header('x-admin-key');
  const bearer = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  return headerKey === adminKey || bearer === adminKey;
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
  for (let i = serverIndexedPages.length - 1; i >= 0 && serverIndexedPages.length > MAX_CATALOG_PAGES; i--) {
    if (serverIndexedPages[i].auto_indexed) {
      serverIndexedPages.splice(i, 1);
    }
  }
}

function trimSeeds() {
  if (serverSeeds.length > MAX_SERVER_SEEDS) {
    serverSeeds = serverSeeds.slice(0, MAX_SERVER_SEEDS);
  }
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
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
  auto_indexed?: boolean;
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

// Loopback, link-local and RFC1918/CGNAT hosts — provider-supplied image URLs
// must never make the server fetch internal resources.
const PRIVATE_IMAGE_HOST_RE = /^localhost$|\.local$|\.internal$|^0\.0\.0\.0$|^::$|^\[?::1\]?$|^127\.|^10\.|^169\.254\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./i;

function isPrivateImageHost(hostname: string): boolean {
  return PRIVATE_IMAGE_HOST_RE.test(hostname);
}

// Fetches at most MAX_COLOR_SAMPLE_BYTES of an image, validating the scheme and
// host of the URL and every redirect target so results can't pivot into the
// internal network.
async function fetchImageSample(imageUrl: string): Promise<Buffer | undefined> {
  let url = imageUrl;
  for (let hop = 0; hop < 4; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch (_) {
      return undefined;
    }
    if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || isPrivateImageHost(parsed.hostname)) {
      return undefined;
    }
    const response = await fetch(url, {
      headers: { 'User-Agent': 'IsaacSearchEngine/2.0', Accept: 'image/*' },
      signal: AbortSignal.timeout(3000),
      redirect: 'manual'
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return undefined;
      url = new URL(location, url).toString();
      continue;
    }
    if (!response.ok || !response.body) return undefined;
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_COLOR_SAMPLE_BYTES) return undefined;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_COLOR_SAMPLE_BYTES) {
          await reader.cancel();
          return undefined;
        }
        chunks.push(value);
      }
    } catch (_) {
      return undefined;
    }
    return Buffer.concat(chunks);
  }
  return undefined;
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

  // 2. Zero-Cost Open Metasearch Cascade (DuckDuckGo Instant Answer + Wikipedia + HackerNews Algolia)
  const aggregated: ServerIndexedPage[] = [];
  const seenUrls = new Set<string>();

  const ddgPromise = (async () => {
    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(effectiveQuery)}&format=json&no_html=1&skip_disambig=1&kl=${regConf.ddgKl}`;
      const res = await fetch(ddgUrl, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return;
      const data: any = await res.json();

      if (safePage === 1 && data?.AbstractURL && data?.AbstractText && !seenUrls.has(data.AbstractURL)) {
        seenUrls.add(data.AbstractURL);
        aggregated.push({
          id: `searxng_ddg_abs_${Date.now()}`,
          url: data.AbstractURL,
          canonical_url: data.AbstractURL,
          title: data.Heading || `${query} — Overview`,
          snippet: cleanScrapedExcerpt(data.AbstractText, 280),
          content: data.AbstractText,
          backlinks: 24,
          indexed_at: new Date().toUTCString(),
          cache_hit: false,
          likes: 32,
          author: data.AbstractSource || 'DuckDuckGo Instant Answer',
          language: 'English',
          tags: extractTopicalTags(query, data.Heading || query, data.AbstractText),
          meta_description: cleanScrapedExcerpt(data.AbstractText, 200),
          keywords: query.split(/\s+/).filter(Boolean),
          is_searxng_fallback: true,
          fallback_source: 'SearXNG Metasearch (DuckDuckGo)',
          searxng_engines: ['duckduckgo']
        });
      }

      const related = Array.isArray(data?.RelatedTopics) ? data.RelatedTopics : [];
      const startRel = (safePage - 1) * 10;
      for (const topic of related.slice(startRel, startRel + 10)) {
        const topicUrl = topic?.FirstURL;
        const topicText = topic?.Text;
        if (topicUrl && topicText && !seenUrls.has(topicUrl)) {
          seenUrls.add(topicUrl);
          const titlePart = topicText.split(' - ')[0] || topicText.slice(0, 65);
          aggregated.push({
            id: `searxng_ddg_p${safePage}_${Date.now()}_${aggregated.length}`,
            url: topicUrl,
            canonical_url: topicUrl,
            title: titlePart,
            snippet: cleanScrapedExcerpt(topicText, 260),
            content: topicText,
            backlinks: 11,
            indexed_at: new Date().toUTCString(),
            cache_hit: false,
            likes: 14,
            author: 'DuckDuckGo',
            language: 'English',
            tags: extractTopicalTags(query, titlePart, topicText),
            meta_description: cleanScrapedExcerpt(topicText, 200),
            keywords: query.split(/\s+/).filter(Boolean),
            is_searxng_fallback: true,
            fallback_source: 'SearXNG Metasearch (DuckDuckGo)',
            searxng_engines: ['duckduckgo']
          });
        }
      }
    } catch (_) {}
  })();

  const wikiPromise = (async () => {
    try {
      const wikiOffset = (safePage - 1) * 10;
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        effectiveQuery
      )}&gsrlimit=10&gsroffset=${wikiOffset}&prop=extracts|info&exintro=1&explaintext=1&inprop=url&format=json&origin=*`;
      const res = await fetch(wikiUrl, {
        headers: { 'User-Agent': 'IsaacSearchEngine/2.0' },
        signal: AbortSignal.timeout(3200)
      });
      if (!res.ok) return;
      const data: any = await res.json();
      const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
      for (const p of pages as any[]) {
        const pageUrl = p.fullurl || `https://en.wikipedia.org/?curid=${p.pageid}`;
        if (pageUrl && p.extract && !seenUrls.has(pageUrl)) {
          seenUrls.add(pageUrl);
          const snippet = cleanScrapedExcerpt(p.extract, 280);
          aggregated.push({
            id: `searxng_wiki_p${safePage}_${p.pageid || Date.now()}_${aggregated.length}`,
            url: pageUrl,
            canonical_url: pageUrl,
            title: `${p.title} — Wikipedia`,
            snippet,
            content: p.extract,
            backlinks: Math.max(8, 28 - safePage * 2),
            indexed_at: new Date().toUTCString(),
            cache_hit: false,
            likes: Math.max(5, 25 - safePage * 2),
            author: 'Wikipedia Contributors',
            language: 'English',
            tags: extractTopicalTags(query, p.title, snippet),
            meta_description: snippet,
            keywords: query.split(/\s+/).filter(Boolean),
            is_searxng_fallback: true,
            fallback_source: 'SearXNG Metasearch (Wikipedia)',
            searxng_engines: ['wikipedia']
          });
        }
      }
    } catch (_) {}
  })();

  const hnPromise = (async () => {
    try {
      const hnPage = safePage - 1;
      const hnUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(
        effectiveQuery
      )}&tags=story&hitsPerPage=10&page=${hnPage}`;
      const res = await fetch(hnUrl, { signal: AbortSignal.timeout(3200) });
      if (!res.ok) return;
      const data: any = await res.json();
      const hits = Array.isArray(data?.hits) ? data.hits : [];
      for (const hit of hits) {
        const storyUrl = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
        if (!storyUrl || seenUrls.has(storyUrl)) continue;
        seenUrls.add(storyUrl);
        let hostname = 'news.ycombinator.com';
        try {
          hostname = new URL(storyUrl).hostname.replace('www.', '');
        } catch (_) {}
        const rawText = hit.story_text?.replace(/<[^>]+>/g, '') || '';
        const snippet =
          cleanScrapedExcerpt(rawText, 240) ||
          `${hit.title} — Technical discussion & benchmark reference on ${hostname} (${hit.points || 0} points, ${hit.num_comments || 0} comments).`;
        aggregated.push({
          id: `searxng_hn_p${safePage}_${hit.objectID || Date.now()}`,
          url: storyUrl,
          canonical_url: storyUrl,
          title: hit.title || storyUrl,
          snippet,
          content: rawText || snippet,
          backlinks: Math.max(2, Math.round((hit.points || 10) / 15)),
          indexed_at: hit.created_at ? new Date(hit.created_at).toUTCString() : new Date().toUTCString(),
          cache_hit: false,
          likes: hit.points || 12,
          author: hit.author || hostname,
          language: 'English',
          tags: extractTopicalTags(query, hit.title || '', snippet),
          meta_description: snippet,
          keywords: query.split(/\s+/).filter(Boolean),
          is_searxng_fallback: true,
          fallback_source: 'SearXNG Metasearch (HN Algolia)',
          searxng_engines: ['hackernews', 'algolia']
        });
      }
    } catch (_) {}
  })();

  await Promise.all([ddgPromise, wikiPromise, hnPromise]);

  // Apply domain filter if requested
  let filtered = aggregated;
  if (domainFilter?.trim()) {
    const dom = domainFilter.toLowerCase().trim();
    filtered = aggregated.filter(item => item.url.toLowerCase().includes(dom));
  }

  return {
    results: filtered.slice(0, 30),
    providerUsed: 'SearXNG Metasearch (DDG + Wikipedia + HN)'
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
let serverSchedule = {
  enabled: false,
  interval: 'daily',
  start_url: 'https://news.ycombinator.com',
  last_run: '2026-09-25 14:30:00',
  next_run: '2026-09-27 14:30:00'
};

async function startServer() {
  const app = express();

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
    communityNotesByUrl.set(url, [newNote, ...existing]);
    res.json(newNote);
  });

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
        if (previous_vote !== vote_type) {
          if (previous_vote === 'helpful') note.helpful_count = Math.max(0, note.helpful_count - 1);
          if (previous_vote === 'not_helpful') note.not_helpful_count = Math.max(0, note.not_helpful_count - 1);
          if (vote_type === 'helpful') note.helpful_count += 1;
          else note.not_helpful_count += 1;
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
    res.json({ status: 'deleted', id: req.params.id });
  });

  app.get('/api/crawler/auto-crawl', (_req: Request, res: Response) => {
    res.json({ enabled: serverAutoCrawlEnabled });
  });

  app.post('/api/crawler/auto-crawl', requireAdmin, (req: Request, res: Response) => {
    serverAutoCrawlEnabled = Boolean(req.body?.enabled);
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
    res.json({ status: 'updated', schedule: serverSchedule });
  });

  app.get('/api/crawler/history', (_req: Request, res: Response) => {
    res.json([]);
  });

  app.get('/api/crawler/trend', (_req: Request, res: Response) => {
    res.json([]);
  });

  app.post('/api/crawl/start', requireAdmin, (_req: Request, res: Response) => {
    res.json({ status: 'started' });
  });

  app.post('/api/crawl/pause', requireAdmin, (_req: Request, res: Response) => {
    res.json({ status: 'paused' });
  });

  app.post('/api/crawl/retry', requireAdmin, (_req: Request, res: Response) => {
    res.json({ status: 'retried' });
  });

  app.post('/api/cloud-functions/scheduled-crawl', requireAdmin, (_req: Request, res: Response) => {
    res.json({ status: 'triggered' });
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
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    try {
      const indexId = await getCommonCrawlIndexId();
      const ccUrl = `https://index.commoncrawl.org/${indexId}-index?url=${encodeURIComponent(domain + '/*')}&output=json&filter=status:200&matchType=domain&limit=${limit}`;
      const ccRes = await fetch(ccUrl, {
        headers: { 'User-Agent': 'IsaacSearchEngine/2.0' },
        signal: AbortSignal.timeout(12000)
      });
      if (!ccRes.ok) throw new Error(`commoncrawl ${ccRes.status}`);

      const text = await ccRes.text();
      const urls = text
        .split('\n')
        .filter(line => line.trim().startsWith('{'))
        .slice(0, limit)
        .map(line => {
          try {
            const rec = JSON.parse(line);
            return {
              url: rec.url || '',
              timestamp: rec.timestamp || '',
              mime: rec.mime || 'text/html',
              status: String(rec.status || '200')
            };
          } catch (_) {
            return null;
          }
        })
        .filter((r): r is { url: string; timestamp: string; mime: string; status: string } => !!r && !!r.url);

      res.json({ domain, index: indexId, urls });
    } catch (_) {
      res.json({ domain, index: null, urls: [] });
    }
  });

  app.post('/api/crawler/common-crawl/import', requireAdmin, (req: Request, res: Response) => {
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
    res.json({ added_count: added, skipped_count: skipped });
  });

  // ============================================================================
  // 3. SEARCH, SUGGESTIONS & HISTORY API ROUTES (WITH SEARXNG FALLBACK)
  // ============================================================================
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

    const lowerQ = queryStr.toLowerCase();
    const terms = lowerQ.split(/\s+/).filter(Boolean);

    // 1. Query Firestore / local indexed catalog first
    let matchedPages = serverIndexedPages.filter(p => {
      const titleLower = (p.title || '').toLowerCase();
      const snippetLower = (p.snippet || '').toLowerCase();
      const contentLower = (p.content || '').toLowerCase();
      const urlLower = (p.url || '').toLowerCase();
      const metaDescLower = (p.meta_description || '').toLowerCase();
      const keywordsList = p.keywords
        ? Array.isArray(p.keywords)
          ? p.keywords
          : String(p.keywords).split(',')
        : [];
      const tagsList = p.tags || [];
      const authorLower = (p.author || '').toLowerCase();

      return (
        titleLower.includes(lowerQ) ||
        snippetLower.includes(lowerQ) ||
        contentLower.includes(lowerQ) ||
        urlLower.includes(lowerQ) ||
        metaDescLower.includes(lowerQ) ||
        authorLower.includes(lowerQ) ||
        keywordsList.some(k => k.toLowerCase().includes(lowerQ)) ||
        tagsList.some(t => t.toLowerCase().includes(lowerQ)) ||
        (terms.length > 0 &&
          terms.every(
            term =>
              titleLower.includes(term) ||
              snippetLower.includes(term) ||
              contentLower.includes(term) ||
              metaDescLower.includes(term) ||
              keywordsList.some(k => k.toLowerCase().includes(term)) ||
              tagsList.some(t => t.toLowerCase().includes(term))
          ))
      );
    });

    if (domainFilter) {
      const domLower = domainFilter.toLowerCase();
      matchedPages = matchedPages.filter(p => p.url.toLowerCase().includes(domLower));
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

    const firestoreCount = matchedPages.length;
    const localMatchUrls = matchedPages.map(p => p.url.toLowerCase());
    sortPages(matchedPages, sortBy);
    matchedPages = matchedPages.slice((pageNum - 1) * pageLimit, pageNum * pageLimit);
    let fallbackTriggered = false;
    let fallbackProvider: string | null = null;
    let fallbackCount = 0;
    let autoIndexedCount = 0;
    const newlyIndexedPages: ServerIndexedPage[] = [];

    // 2. Trigger SearXNG Fallback if Firestore doesn't have enough results (or if force_fallback / page > 1 is requested)
    if (fallbackEnabled && (forceFallback || pageNum > 1 || firestoreCount < minResultsThreshold)) {
      fallbackTriggered = true;
      const searxData = await querySearXNGFallback(queryStr, domainFilter, pageNum, region);
      fallbackProvider = searxData.providerUsed;

      const existingUrls = new Set(localMatchUrls);
      const allCatalogUrls = new Set(serverIndexedPages.map(p => p.url.toLowerCase()));

      for (const item of searxData.results) {
        if (minBacklinks > 0 && (item.backlinks || 0) < minBacklinks) continue;
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

    // Sort combined results
    sortPages(matchedPages, sortBy);

    let spellcheck: string | null = null;
    if (lowerQ === 'fastapdoc') spellcheck = 'fastapi doc';
    else if (lowerQ === 'whereosh') spellcheck = 'whoosh';
    else if (lowerQ === 'firestur') spellcheck = 'firestore';

    const relatedSearches = await fetchRelatedSearches(queryStr);

    res.json({
      results: matchedPages,
      firestore_count: firestoreCount,
      fallback_triggered: fallbackTriggered,
      fallback_provider: fallbackProvider,
      fallback_count: fallbackCount,
      auto_indexed_count: autoIndexedCount,
      new_indexed_pages: newlyIndexedPages,
      spellcheck,
      related_searches: relatedSearches
    });
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
      const withColors = await mapWithConcurrency(items, 6, async ({ color_url, ...img }) => ({
        ...img,
        dominant_color: color_url ? await detectDominantColor(color_url) : undefined
      }));
      res.json(withColors);
    };

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
            const sliced = videos.slice(0, 24);
            videoSearchCache.set(cacheKey, { timestamp: Date.now(), results: sliced });
            return sliced;
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
              embedUrl: embedUrl || (vidId ? `https://www.youtube-nocookie.com/embed/${vidId}?autoplay=1&rel=0` : undefined),
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
          videoSearchCache.set(cacheKey, { timestamp: Date.now(), results: videos });
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
            videoSearchCache.set(cacheKey, { timestamp: Date.now(), results: videos });
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
      } else {
        serverIndexedPages.unshift(newPage);
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
    const lowerQ = query.toLowerCase();
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

              while (true) {
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
        const candidate = path.join(distPath, req.path);
        if (fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory()) {
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Isaac Search + Fireplexity v2 server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
