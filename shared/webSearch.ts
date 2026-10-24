/**
 * Live web search shared by the Express server, the Cloudflare Pages Function
 * (functions/api/web-search.ts) and the browser fallback. Uses only fetch, so it
 * runs in Node, Workers and the browser.
 *
 * Sources: Brave Search API (real web index, needs BRAVE_SEARCH_API_KEY, server
 * side only), Stack Exchange, Wikipedia and Hacker News (all keyless + CORS).
 * Results are fused with reciprocal-rank fusion and gated on query-term coverage
 * so off-topic hits from the niche sources don't drown out the useful ones.
 */

export type WebSource = 'brave' | 'stackexchange' | 'wikipedia' | 'hackernews';

export interface WebHit {
  url: string;
  title: string;
  snippet: string;
  source: WebSource;
  published_at?: string;
  popularity?: number;
  score?: number;
  coverage?: number;
}

export interface WebSearchOptions {
  page?: number;
  braveApiKey?: string;
  country?: string;
  timeoutMs?: number;
  sources?: WebSource[];
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'by', 'at', 'from', 'is', 'are', 'was',
  'be', 'it', 'its', 'as', 'that', 'this', 'what', 'how', 'why', 'when', 'where', 'who', 'which', 'do', 'does',
  'i', 'me', 'my', 'you', 'your', 'can', 'vs', 'best', 'top'
]);

function normToken(t: string): string {
  if (t.length > 4 && t.endsWith('ies')) return t.slice(0, -3) + 'y';
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

/** Content terms of a query: lowercased, stopwords removed, lightly stemmed. */
export function queryTerms(query: string): string[] {
  const toks = query
    .toLowerCase()
    .replace(/\b(site|filetype|inurl|intitle):\S+/g, ' ')
    .split(/[^\p{L}\p{N}+#]+/u)
    .filter(Boolean);
  const content = toks.filter(t => !STOPWORDS.has(t));
  return Array.from(new Set((content.length > 0 ? content : toks).map(normToken)));
}

/** Fraction of query terms present as whole (stemmed) tokens in `text`. */
export function termCoverage(terms: string[], text: string): number {
  if (terms.length === 0) return 1;
  const tokens = new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}+#]+/u)
      .filter(Boolean)
      .map(normToken)
  );
  let hit = 0;
  for (const t of terms) if (tokens.has(t)) hit++;
  return hit / terms.length;
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'",
  rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c', mdash: '\u2014', ndash: '\u2013',
  hellip: '\u2026', copy: '\u00a9', reg: '\u00ae', trade: '\u2122', laquo: '\u00ab', raquo: '\u00bb', middot: '\u00b7'
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+|#39);/gi, (m, e: string) => {
    if (ENTITIES[e.toLowerCase()]) return ENTITIES[e.toLowerCase()];
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return m;
  });
}

function stripHtml(s: string): string {
  return decodeEntities(String(s || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

async function getJson(url: string, timeoutMs: number, headers?: Record<string, string>): Promise<any> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('json')) throw new Error('non-JSON response');
  return res.json();
}

export async function fetchBrave(query: string, apiKey: string, page = 1, country = 'ALL', timeoutMs = 4000): Promise<WebHit[]> {
  const offset = Math.min(9, Math.max(0, page - 1));
  const params = new URLSearchParams({ q: query, count: '20', offset: String(offset), safesearch: 'moderate' });
  if (country && country.toUpperCase() !== 'ALL') params.set('country', country.toUpperCase());
  const data = await getJson(`https://api.search.brave.com/res/v1/web/search?${params}`, timeoutMs, {
    Accept: 'application/json',
    'X-Subscription-Token': apiKey
  });
  const list: any[] = Array.isArray(data?.web?.results) ? data.web.results : [];
  return list
    .filter(r => r?.url && r?.title)
    .map(r => ({
      url: r.url,
      title: stripHtml(r.title),
      snippet: stripHtml([r.description, ...(Array.isArray(r.extra_snippets) ? r.extra_snippets.slice(0, 1) : [])].filter(Boolean).join(' ')),
      source: 'brave' as const,
      published_at: r.page_age || undefined
    }));
}

export async function fetchStackExchange(query: string, page = 1, timeoutMs = 3500): Promise<WebHit[]> {
  const params = new URLSearchParams({
    q: query,
    site: 'stackoverflow',
    order: 'desc',
    sort: 'relevance',
    pagesize: '8',
    page: String(page),
    filter: 'withbody'
  });
  const data = await getJson(`https://api.stackexchange.com/2.3/search/advanced?${params}`, timeoutMs);
  const items: any[] = Array.isArray(data?.items) ? data.items : [];
  return items
    .filter(it => it?.link && it?.title && (it.score ?? 0) >= 0)
    .map(it => ({
      url: it.link,
      title: `${stripHtml(it.title)} — Stack Overflow`,
      snippet: stripHtml(it.body || '').slice(0, 280),
      source: 'stackexchange' as const,
      published_at: it.creation_date ? new Date(it.creation_date * 1000).toUTCString() : undefined,
      popularity: (it.score || 0) + (it.is_answered ? 5 : 0)
    }));
}

export async function fetchWikipedia(query: string, page = 1, timeoutMs = 3500): Promise<WebHit[]> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: '6',
    sroffset: String((page - 1) * 6),
    srinfo: 'suggestion',
    format: 'json',
    origin: '*'
  });
  const data = await getJson(`https://en.wikipedia.org/w/api.php?${params}`, timeoutMs);
  const items: any[] = Array.isArray(data?.query?.search) ? data.query.search : [];
  return items.map(it => ({
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(it.title).replace(/ /g, '_'))}`,
    title: `${it.title} — Wikipedia`,
    snippet: stripHtml(it.snippet || ''),
    source: 'wikipedia' as const,
    published_at: it.timestamp ? new Date(it.timestamp).toUTCString() : undefined,
    popularity: it.wordcount
  }));
}

export async function fetchHackerNews(query: string, page = 1, timeoutMs = 3500): Promise<WebHit[]> {
  const params = new URLSearchParams({ query, tags: 'story', hitsPerPage: '10', page: String(page - 1) });
  const data = await getJson(`https://hn.algolia.com/api/v1/search?${params}`, timeoutMs);
  const hits: any[] = Array.isArray(data?.hits) ? data.hits : [];
  return hits
    .filter(h => h?.title && (h.points || 0) >= 5)
    .map(h => {
      const url = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`;
      const text = stripHtml(h.story_text || '');
      return {
        url,
        title: stripHtml(h.title),
        snippet: text.slice(0, 260) || `${h.points || 0} points · ${h.num_comments || 0} comments on Hacker News`,
        source: 'hackernews' as const,
        published_at: h.created_at ? new Date(h.created_at).toUTCString() : undefined,
        popularity: h.points
      };
    });
}

// How much each source is trusted in fusion, and the minimum term coverage
// (title + snippet) a hit needs to be kept. Brave is a full web ranker so its
// ordering is trusted; the niche APIs return fuzzy matches and must earn it.
const SOURCE_WEIGHT: Record<WebSource, number> = { brave: 1, stackexchange: 0.7, wikipedia: 0.65, hackernews: 0.35 };
const SOURCE_MIN_COVERAGE: Record<WebSource, number> = { brave: 0, stackexchange: 0.5, wikipedia: 0.5, hackernews: 0.75 };
// Stack Overflow bodies and HN stories mention everything, so those sources are
// gated on title coverage; Wikipedia/Brave use title + snippet.
const GATE_ON_TITLE: Record<WebSource, boolean> = { brave: false, stackexchange: true, wikipedia: false, hackernews: true };
const SOURCE_CAP: Record<WebSource, number> = { brave: 20, stackexchange: 4, wikipedia: 4, hackernews: 3 };
const RRF_K = 10;

export function normalizeUrlKey(url: string): string {
  try {
    const u = new URL(url);
    return (u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '') + u.search).toLowerCase();
  } catch (_) {
    return url.toLowerCase();
  }
}

/** Reciprocal-rank fusion across sources with coverage gating, title-match boosts and dedupe. */
export function fuseWebHits(query: string, lists: WebHit[][]): WebHit[] {
  const terms = queryTerms(query);
  const phrase = terms.join(' ');
  const byKey = new Map<string, WebHit>();
  for (const list of lists) {
    let kept = 0;
    list.forEach((hit, rank) => {
      const src = hit.source;
      if (kept >= SOURCE_CAP[src]) return;
      const titleCov = termCoverage(terms, hit.title);
      const cov = termCoverage(terms, `${hit.title} ${hit.snippet} ${hit.url.replace(/[/_.-]+/g, ' ')}`);
      if ((GATE_ON_TITLE[src] ? titleCov : cov) < SOURCE_MIN_COVERAGE[src] || (terms.length === 1 && cov === 0 && src !== 'brave')) return;
      kept++;
      let s = SOURCE_WEIGHT[src] / (RRF_K + rank + 1);
      s *= 0.5 + 0.5 * cov;
      s *= 1 + 0.4 * titleCov;
      if (terms.length > 1 && hit.title.toLowerCase().includes(phrase)) s *= 1.25;
      const key = normalizeUrlKey(hit.url);
      const prev = byKey.get(key);
      if (prev) {
        prev.score = (prev.score || 0) + s;
        if (hit.snippet.length > prev.snippet.length && src !== 'hackernews') prev.snippet = hit.snippet;
      } else {
        byKey.set(key, { ...hit, score: s, coverage: cov });
      }
    });
  }
  return [...byKey.values()].sort((a, b) => (b.score || 0) - (a.score || 0));
}

const FETCHERS: Record<WebSource, (q: string, opts: Required<Pick<WebSearchOptions, 'page' | 'timeoutMs'>> & WebSearchOptions) => Promise<WebHit[]>> = {
  brave: (q, o) => (o.braveApiKey ? fetchBrave(q, o.braveApiKey, o.page, o.country, o.timeoutMs) : Promise.resolve([])),
  stackexchange: (q, o) => fetchStackExchange(q, o.page, o.timeoutMs),
  wikipedia: (q, o) => fetchWikipedia(q, o.page, o.timeoutMs),
  hackernews: (q, o) => fetchHackerNews(q, o.page, o.timeoutMs)
};

/** Queries every available source in parallel and returns fused, relevance-ordered hits. */
export async function searchWeb(query: string, options: WebSearchOptions = {}): Promise<{ hits: WebHit[]; sources: WebSource[] }> {
  const q = query.trim();
  if (!q) return { hits: [], sources: [] };
  const opts = { page: Math.max(1, options.page || 1), timeoutMs: options.timeoutMs || 3500, ...options };
  const wanted = (options.sources || (Object.keys(FETCHERS) as WebSource[])).filter(s => s !== 'brave' || !!opts.braveApiKey);
  const settled = await Promise.allSettled(wanted.map(s => FETCHERS[s](q, opts)));
  const lists: WebHit[][] = [];
  const used: WebSource[] = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value.length > 0) {
      lists.push(r.value);
      used.push(wanted[i]);
    }
  });
  return { hits: fuseWebHits(q, lists), sources: used };
}

export const WEB_SOURCE_LABEL: Record<WebSource, string> = {
  brave: 'Brave Search',
  stackexchange: 'Stack Overflow',
  wikipedia: 'Wikipedia',
  hackernews: 'Hacker News'
};
