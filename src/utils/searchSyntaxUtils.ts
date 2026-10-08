/**
 * DuckDuckGo Search Syntax & Operators Utility
 * 
 * Supports:
 * - Direct Jump: '\query' (instantly opens first match)
 * - Site Operator: 'site:example.com'
 * - Filetype Operator: 'filetype:pdf', 'ext:pdf'
 * - Exact Match: '"exact phrase"'
 * - Exclusion: '-unwanted'
 */

export interface ParsedSearchSyntax {
  isDirectJump: boolean;        // Started with '\'
  cleanQuery: string;           // Query stripped of syntax operators for full-text search
  rawQuery: string;             // Original input
  siteFilter: string | null;    // e.g. "github.com"
  filetypeFilter: string | null;// e.g. "pdf"
  exactPhrases: string[];       // Phrases in quotes
  excludedTerms: string[];      // Terms with '-'
  hasOperators: boolean;
}

export function parseSearchSyntax(rawQuery: string): ParsedSearchSyntax {
  const trimmed = rawQuery.trim();
  const isDirectJump = trimmed.startsWith('\\');
  let workingQuery = isDirectJump ? trimmed.replace(/^\\+/, '').trim() : trimmed;

  let siteFilter: string | null = null;
  let filetypeFilter: string | null = null;
  const exactPhrases: string[] = [];
  const excludedTerms: string[] = [];

  // 1. Extract site:domain
  const siteMatch = workingQuery.match(/\bsite:([^\s]+)/i);
  if (siteMatch) {
    siteFilter = siteMatch[1].toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    workingQuery = workingQuery.replace(siteMatch[0], ' ').trim();
  }

  // 2. Extract filetype:ext or ext:ext
  const filetypeMatch = workingQuery.match(/\b(?:filetype|ext):([a-z0-9]+)/i);
  if (filetypeMatch) {
    filetypeFilter = filetypeMatch[1].toLowerCase();
    workingQuery = workingQuery.replace(filetypeMatch[0], ' ').trim();
  }

  // 3. Extract "exact phrases"
  const quoteRegex = /"([^"]+)"/g;
  let quoteMatch: RegExpExecArray | null;
  while ((quoteMatch = quoteRegex.exec(workingQuery)) !== null) {
    if (quoteMatch[1].trim()) {
      exactPhrases.push(quoteMatch[1].trim().toLowerCase());
    }
  }
  workingQuery = workingQuery.replace(quoteRegex, ' ').trim();

  // 4. Extract -excluded words
  const excludeRegex = /(?:^|\s)-([a-zA-Z0-9_-]+)/g;
  let excludeMatch: RegExpExecArray | null;
  while ((excludeMatch = excludeRegex.exec(workingQuery)) !== null) {
    if (excludeMatch[1].trim()) {
      excludedTerms.push(excludeMatch[1].trim().toLowerCase());
    }
  }
  workingQuery = workingQuery.replace(excludeRegex, ' ').trim();

  // Normalize remaining clean query
  const cleanQuery = workingQuery.replace(/\s+/g, ' ').trim();

  const hasOperators = Boolean(
    siteFilter || filetypeFilter || exactPhrases.length > 0 || excludedTerms.length > 0 || isDirectJump
  );

  return {
    isDirectJump,
    cleanQuery: cleanQuery || (isDirectJump ? trimmed.replace(/^\\+/, '') : trimmed),
    rawQuery,
    siteFilter,
    filetypeFilter,
    exactPhrases,
    excludedTerms,
    hasOperators
  };
}

/**
 * Filter a search result page according to DuckDuckGo syntax rules:
 * - Domain matches siteFilter
 * - URL or title matches filetypeFilter
 * - exactPhrases must appear verbatim in content/title/snippet
 * - excludedTerms must not appear anywhere in content/title/snippet
 */
export function matchesSearchSyntax(
  item: {
    url?: string;
    title?: string;
    snippet?: string;
    content?: string;
  },
  syntax: ParsedSearchSyntax
): boolean {
  const url = (item.url || '').toLowerCase();
  const title = (item.title || '').toLowerCase();
  const snippet = (item.snippet || '').toLowerCase();
  const content = (item.content || '').toLowerCase();
  const allText = `${title} ${snippet} ${content} ${url}`;

  // 1. Check site: filter
  if (syntax.siteFilter) {
    try {
      const parsedUrl = new URL(item.url || '');
      if (!parsedUrl.hostname.toLowerCase().includes(syntax.siteFilter)) {
        return false;
      }
    } catch (_) {
      if (!url.includes(syntax.siteFilter)) {
        return false;
      }
    }
  }

  // 2. Check filetype: filter
  if (syntax.filetypeFilter) {
    const ext = syntax.filetypeFilter;
    const hasExtension = url.endsWith(`.${ext}`) || 
                         url.includes(`.${ext}?`) || 
                         url.includes(`.${ext}#`) ||
                         title.includes(`[${ext}]`) ||
                         title.includes(`.${ext}`) ||
                         snippet.includes(`filetype: ${ext}`);
    if (!hasExtension) {
      return false;
    }
  }

  // 3. Check exact phrases ("...")
  for (const phrase of syntax.exactPhrases) {
    if (!allText.includes(phrase)) {
      return false;
    }
  }

  // 4. Check excluded terms (-term)
  for (const term of syntax.excludedTerms) {
    if (allText.includes(term)) {
      return false;
    }
  }

  return true;
}
