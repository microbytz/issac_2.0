/**
 * SafeSearch Utilities for Isaac Search Engine
 * 
 * Provides 3 levels:
 * - 'strict': Completely blocks adult/explicit keywords, domains, and multimedia.
 * - 'moderate': Filters explicit images/videos while allowing informative textual results.
 * - 'off': Disables SafeSearch filtering.
 */

export type SafeSearchLevel = 'strict' | 'moderate' | 'off';

export const EXPLICIT_KEYWORDS = [
  'porn', 'xxx', 'nsfw', 'nude', 'naked', 'erotic', 'hentai', 'sex', 
  'adult toys', 'camgirl', 'escort', 'xvideos', 'pornhub', 'redtube',
  'onlyfans leaked', 'gore', 'beheading'
];

export const EXPLICIT_DOMAINS = [
  'pornhub.com', 'xvideos.com', 'xnxx.com', 'redtube.com', 'youporn.com',
  'chaturbate.com', 'onlyfans.com', 'livejasmin.com', 'xhamster.com'
];

export function getStoredSafeSearch(): SafeSearchLevel {
  if (typeof window === 'undefined') return 'moderate';
  const val = localStorage.getItem('isaac_safesearch');
  if (val === 'strict' || val === 'moderate' || val === 'off') {
    return val;
  }
  return 'moderate';
}

export function setStoredSafeSearch(level: SafeSearchLevel): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('isaac_safesearch', level);
}

export function isTextExplicit(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return EXPLICIT_KEYWORDS.some(kw => {
    // Word boundary check
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    return regex.test(lower);
  });
}

export function isDomainExplicit(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return EXPLICIT_DOMAINS.some(d => lower.includes(d));
}

export function filterItemBySafeSearch<T extends { title?: string; snippet?: string; url?: string; tags?: string[] }>(
  item: T,
  level: SafeSearchLevel,
  mediaType: 'text' | 'image' | 'video' = 'text'
): boolean {
  if (level === 'off') return true;

  const url = item.url || '';
  if (isDomainExplicit(url)) return false;

  const content = `${item.title || ''} ${item.snippet || ''} ${(item.tags || []).join(' ')}`;
  const hasExplicit = isTextExplicit(content);

  if (level === 'strict') {
    return !hasExplicit;
  }

  if (level === 'moderate') {
    // In moderate, filter images/videos strictly, but be lenient on purely technical/textual articles unless clearly pornographic
    if (mediaType === 'image' || mediaType === 'video') {
      return !hasExplicit;
    }
    // For text, block only heavy keywords
    return !['porn', 'xxx', 'hentai', 'xvideos', 'pornhub'].some(kw => content.toLowerCase().includes(kw));
  }

  return true;
}
