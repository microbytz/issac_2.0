// Click-feedback store: which results users actually click, per query and
// globally. Persisted via engine-state.json; feeds ranking boosts in
// searchIndex (global) and /api/search reranking (per-query).
//
// Anti-farming: a click only counts once per (client key, query, url) per
// hour — otherwise a bot could spam-clicks a URL to boost it.

const MAX_CLICK_URLS = 20_000;
const MAX_CLICK_QUERIES = 5_000;
const MAX_URLS_PER_QUERY = 200;
const DEDUP_WINDOW_MS = 60 * 60 * 1000;
const MAX_DEDUP_KEYS = 50_000;

const urlClicks = new Map<string, number>();
const queryClicks = new Map<string, Map<string, number>>();
const dedup = new Map<string, number>(); // "key|query|url" -> last click ms

export function normalizeQuery(q: string): string {
  return (q || '').toLowerCase().trim().replace(/\s+/g, ' ').slice(0, 200);
}

// Evict ~10% oldest entries when a map exceeds its cap (insertion order).
function evictOldest<V>(map: Map<string, V>, cap: number): void {
  const excess = map.size - cap;
  if (excess <= 0) return;
  let n = Math.max(excess, Math.floor(cap * 0.1));
  for (const key of map.keys()) {
    map.delete(key);
    if (--n <= 0) break;
  }
}

/**
 * Records a result click. Returns true if counted, false if deduplicated.
 * `clientKey` is a coarse identity (ip or session) used only for dedup.
 */
export function recordClick(query: string, url: string, clientKey: string): boolean {
  const q = normalizeQuery(query);
  const now = Date.now();

  if (clientKey && q) {
    const key = `${clientKey}|${q}|${url}`;
    const last = dedup.get(key);
    if (last && now - last < DEDUP_WINDOW_MS) return false;
    if (dedup.size >= MAX_DEDUP_KEYS) {
      // Drop expired entries first, then oldest if still over.
      for (const [k, t] of dedup) if (now - t >= DEDUP_WINDOW_MS) dedup.delete(k);
      evictOldest(dedup, MAX_DEDUP_KEYS);
    }
    dedup.set(key, now);
  }

  urlClicks.set(url, (urlClicks.get(url) || 0) + 1);
  if (urlClicks.size > MAX_CLICK_URLS) evictOldest(urlClicks, MAX_CLICK_URLS);

  if (q) {
    let bucket = queryClicks.get(q);
    if (!bucket) {
      bucket = new Map();
      queryClicks.set(q, bucket);
    }
    bucket.set(url, (bucket.get(url) || 0) + 1);
    if (bucket.size > MAX_URLS_PER_QUERY) evictOldest(bucket, MAX_URLS_PER_QUERY);
    if (queryClicks.size > MAX_CLICK_QUERIES) evictOldest(queryClicks, MAX_CLICK_QUERIES);
  }
  return true;
}

export function getUrlClicks(url: string): number {
  return urlClicks.get(url) || 0;
}

export function getQueryClicks(query: string, url: string): number {
  return queryClicks.get(normalizeQuery(query))?.get(url) || 0;
}

export interface ClickState {
  urls: Record<string, number>;
  queries: Record<string, Record<string, number>>;
}

export function exportClicks(): ClickState {
  const urls: Record<string, number> = {};
  const queries: Record<string, Record<string, number>> = {};
  for (const [url, c] of urlClicks) urls[url] = c;
  for (const [q, bucket] of queryClicks) {
    queries[q] = {};
    for (const [url, c] of bucket) queries[q][url] = c;
  }
  return { urls, queries };
}

export function importClicks(state: ClickState | undefined): void {
  urlClicks.clear();
  queryClicks.clear();
  if (!state) return;
  if (state.urls && typeof state.urls === 'object') {
    for (const [url, c] of Object.entries(state.urls)) {
      if (typeof c === 'number' && c > 0) urlClicks.set(url, Math.floor(c));
      if (urlClicks.size >= MAX_CLICK_URLS) break;
    }
  }
  if (state.queries && typeof state.queries === 'object') {
    for (const [q, urls] of Object.entries(state.queries)) {
      const bucket = new Map<string, number>();
      for (const [url, c] of Object.entries(urls || {})) {
        if (typeof c === 'number' && c > 0) bucket.set(url, Math.floor(c));
        if (bucket.size >= MAX_URLS_PER_QUERY) break;
      }
      if (bucket.size > 0) queryClicks.set(normalizeQuery(q), bucket);
      if (queryClicks.size >= MAX_CLICK_QUERIES) break;
    }
  }
}
