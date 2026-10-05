/**
 * Direct Client-Side Open Search Fallback
 * 
 * Used when the backend server is unreachable (e.g. mobile device offline or network error).
 * Queries public, CORS-enabled endpoints (Wikipedia and Hacker News Algolia) directly from the client.
 */

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

export async function fetchClientSideWebResults(query: string): Promise<FallbackResultItem[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  const results: FallbackResultItem[] = [];
  const seenUrls = new Set<string>();

  // 1. Wikipedia Open Search API (CORS origin=*)
  const wikiPromise = (async () => {
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQ)}&utf8=&format=json&origin=*`;
      const res = await fetch(wikiUrl, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data = await res.json();
        const searchList = data?.query?.search || [];
        for (const item of searchList) {
          const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/\s+/g, '_'))}`;
          if (!seenUrls.has(pageUrl)) {
            seenUrls.add(pageUrl);
            const snippetText = (item.snippet || '')
              .replace(/<span class="searchmatch">/g, '')
              .replace(/<\/span>/g, '')
              .replace(/<[^>]+>/g, '');
            results.push({
              id: `client_wiki_${item.pageid || Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              url: pageUrl,
              canonical_url: pageUrl,
              title: `${item.title} — Wikipedia`,
              snippet: snippetText || `Wikipedia overview of ${item.title}.`,
              content: snippetText,
              backlinks: 14 + (item.wordcount ? Math.min(30, Math.floor(item.wordcount / 100)) : 5),
              indexed_at: new Date().toUTCString(),
              likes: 42 + Math.floor(Math.random() * 20),
              tags: ['wikipedia', 'reference', 'encyclopedia', cleanQ.toLowerCase().slice(0, 15)],
              author: 'Wikipedia Contributors',
              language: 'en',
              is_searxng_fallback: true,
              fallback_source: 'wikipedia-client',
              searxng_engines: ['wikipedia']
            });
          }
        }
      }
    } catch (_) {}
  })();

  // 2. Hacker News Algolia API (Public CORS)
  const hnPromise = (async () => {
    try {
      const hnUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(cleanQ)}&tags=story&hitsPerPage=6`;
      const res = await fetch(hnUrl, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data = await res.json();
        const hits = Array.isArray(data?.hits) ? data.hits : [];
        for (const hit of hits) {
          const storyUrl = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
          if (!seenUrls.has(storyUrl)) {
            seenUrls.add(storyUrl);
            let hostname = 'news.ycombinator.com';
            try {
              hostname = new URL(storyUrl).hostname.replace('www.', '');
            } catch (_) {}

            const snippet = hit.story_text
              ? hit.story_text.replace(/<[^>]+>/g, '').slice(0, 240)
              : `${hit.points || 0} points • ${hit.num_comments || 0} comments on Hacker News (${hostname})`;

            results.push({
              id: `client_hn_${hit.objectID || Date.now()}`,
              url: storyUrl,
              canonical_url: storyUrl,
              title: hit.title || 'Discussion on Hacker News',
              snippet: snippet,
              content: snippet,
              backlinks: Math.min(50, (hit.num_comments || 0) + 2),
              indexed_at: hit.created_at ? new Date(hit.created_at).toUTCString() : new Date().toUTCString(),
              likes: hit.points || 15,
              tags: ['news', hostname, 'discussion', cleanQ.toLowerCase().slice(0, 15)],
              author: hit.author || hostname,
              language: 'en',
              is_searxng_fallback: true,
              fallback_source: 'hackernews-client',
              searxng_engines: ['hackernews']
            });
          }
        }
      }
    } catch (_) {}
  })();

  await Promise.allSettled([wikiPromise, hnPromise]);
  return results;
}
