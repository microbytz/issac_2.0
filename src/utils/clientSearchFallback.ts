/**
 * Direct Client-Side Open Search Fallback
 * 
 * Used when the backend server is unreachable (e.g. mobile device offline or network error).
 * Queries public, CORS-enabled endpoints (Wikipedia, Stack Overflow, Hacker News) directly from the client.
 */

import { searchWeb, normalizeUrlKey, WEB_SOURCE_LABEL } from '../../shared/webSearch';
import type { WebHit } from '../../shared/webSearch';
import { getBackendBaseUrl } from './apiConfig';

export interface FallbackResultItem {
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
  keywords?: string[];
  score?: number;
  bm25_score?: number;
  is_searxng_fallback?: boolean;
  fallback_source?: string;
  searxng_engines?: string[];
}

/**
 * Live web results for the browser when the Express backend isn't reachable.
 * Prefers the deployment's /api/web-search (Cloudflare Pages Function, which can
 * use a Brave Search key), then queries the keyless CORS sources directly.
 * Results come back fused and relevance-ordered (see shared/webSearch.ts).
 */
export async function fetchClientSideWebResults(query: string, page = 1): Promise<FallbackResultItem[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  let hits: WebHit[] = [];
  try {
    const res = await fetch(`${getBackendBaseUrl()}/api/web-search?q=${encodeURIComponent(cleanQ)}&page=${page}`, {
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
      const data = await res.json();
      if (Array.isArray(data?.hits)) hits = data.hits;
    }
  } catch (_) {}
  if (hits.length === 0) {
    try {
      hits = (await searchWeb(cleanQ, { page })).hits;
    } catch (_) {}
  }

  const now = new Date().toUTCString();
  return hits.map((h, idx) => {
    let hostname = '';
    try {
      hostname = new URL(h.url).hostname.replace(/^www\./, '');
    } catch (_) {}
    return {
      id: `client_web_${h.source}_${idx}_${normalizeUrlKey(h.url).slice(0, 40)}`,
      url: h.url,
      canonical_url: h.url,
      title: h.title,
      snippet: h.snippet || h.title,
      content: h.snippet,
      backlinks: 0,
      indexed_at: h.published_at || now,
      likes: 0,
      tags: [h.source, hostname].filter(Boolean),
      author: hostname || WEB_SOURCE_LABEL[h.source],
      language: 'en',
      score: h.score,
      is_searxng_fallback: true,
      fallback_source: WEB_SOURCE_LABEL[h.source],
      searxng_engines: [h.source]
    };
  });
}
