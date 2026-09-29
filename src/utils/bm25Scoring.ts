/**
 * Whoosh-compatible BM25F Information Retrieval Scoring Engine
 * 
 * Field Weights based on Whoosh schema indexing priorities:
 * - Title: 3.0x (High-intent search matches in page titles)
 * - Snippet: 1.5x (Concise extract / description matches)
 * - Content: 1.0x (Full document body match baseline)
 * - Meta / Keywords / Tags: 1.8x (Structured metadata keywords)
 * 
 * Okapi BM25 Parameters:
 * - k1 = 1.2 (Term frequency saturation control)
 * - b = 0.75 (Document field length normalization penalty)
 */

export interface BM25FieldBreakdown {
  total: number;
  titleScore: number;
  snippetScore: number;
  contentScore: number;
  metaScore: number;
  titleMatches: number;
  snippetMatches: number;
  contentMatches: number;
  metaMatches: number;
  titleWeight: number;
  snippetWeight: number;
  contentWeight: number;
  metaWeight: number;
  matchedTerms: string[];
  idfBreakdown: Record<string, number>;
  relativePercentage: number; // 0 - 100 relative to top score
}

export const WHOOSH_FIELD_WEIGHTS = {
  TITLE: 3.0,
  SNIPPET: 1.5,
  CONTENT: 1.0,
  META: 1.8,
  URL: 0.8
};

export const BM25_CONSTANTS = {
  k1: 1.2,
  b: 0.75
};

export interface PageScoringTarget {
  id: string;
  url: string;
  title: string;
  snippet: string;
  content?: string;
  meta_description?: string;
  keywords?: string[] | string;
  tags?: string[];
  likes?: number;
  backlinks?: number;
}

/**
 * Clean & tokenize text query into lowercase distinct terms
 */
export function extractQueryTerms(query: string): string[] {
  if (!query) return [];
  // Remove special regex punctuation while preserving alphanumeric words
  return query
    .toLowerCase()
    .trim()
    .split(/[\s,;:.!?_()"'`-]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

/**
 * Counts word count in a text string for length normalization
 */
function getWordCount(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Counts non-overlapping occurrences of term in text string
 */
function countTermOccurrences(text: string, term: string): number {
  if (!text || !term) return 0;
  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  let count = 0;
  let pos = lowerText.indexOf(lowerTerm);
  while (pos !== -1) {
    count++;
    pos = lowerText.indexOf(lowerTerm, pos + lowerTerm.length);
  }
  return count;
}

/**
 * Calculate Whoosh-aligned BM25F scores for all candidate pages given a search query string.
 */
export function calculateWhooshBM25Scores(
  pages: PageScoringTarget[],
  query: string
): Map<string, { score: number; details: BM25FieldBreakdown }> {
  const terms = extractQueryTerms(query);
  const resultMap = new Map<string, { score: number; details: BM25FieldBreakdown }>();

  if (pages.length === 0) return resultMap;

  if (terms.length === 0) {
    // If no search terms, assign base likes-based fallback scores
    pages.forEach(p => {
      const fallbackScore = Number(((p.likes || 0) * 0.05 + (p.backlinks || 0) * 0.02).toFixed(2));
      resultMap.set(p.id, {
        score: fallbackScore,
        details: {
          total: fallbackScore,
          titleScore: 0,
          snippetScore: 0,
          contentScore: 0,
          metaScore: 0,
          titleMatches: 0,
          snippetMatches: 0,
          contentMatches: 0,
          metaMatches: 0,
          titleWeight: WHOOSH_FIELD_WEIGHTS.TITLE,
          snippetWeight: WHOOSH_FIELD_WEIGHTS.SNIPPET,
          contentWeight: WHOOSH_FIELD_WEIGHTS.CONTENT,
          metaWeight: WHOOSH_FIELD_WEIGHTS.META,
          matchedTerms: [],
          idfBreakdown: {},
          relativePercentage: 100
        }
      });
    });
    return resultMap;
  }

  const N = pages.length;

  // 1. Compute Document Frequencies (df) for each query term in corpus
  const docFrequencies: Record<string, number> = {};
  terms.forEach(term => {
    let df = 0;
    pages.forEach(p => {
      const title = p.title || '';
      const snippet = p.snippet || '';
      const content = p.content || '';
      const meta = (p.meta_description || '') + ' ' + (Array.isArray(p.keywords) ? p.keywords.join(' ') : (p.keywords || '')) + ' ' + (p.tags || []).join(' ');
      const url = p.url || '';

      if (
        countTermOccurrences(title, term) > 0 ||
        countTermOccurrences(snippet, term) > 0 ||
        countTermOccurrences(content, term) > 0 ||
        countTermOccurrences(meta, term) > 0 ||
        countTermOccurrences(url, term) > 0
      ) {
        df++;
      }
    });
    docFrequencies[term] = df;
  });

  // 2. Compute average field lengths across entire corpus
  let totalTitleLen = 0;
  let totalSnippetLen = 0;
  let totalContentLen = 0;
  let totalMetaLen = 0;

  pages.forEach(p => {
    totalTitleLen += getWordCount(p.title || '');
    totalSnippetLen += getWordCount(p.snippet || '');
    totalContentLen += getWordCount(p.content || p.snippet || '');
    const metaStr = (p.meta_description || '') + ' ' + (Array.isArray(p.keywords) ? p.keywords.join(' ') : (p.keywords || '')) + ' ' + (p.tags || []).join(' ');
    totalMetaLen += getWordCount(metaStr);
  });

  const avgTitleLen = Math.max(1, totalTitleLen / N);
  const avgSnippetLen = Math.max(1, totalSnippetLen / N);
  const avgContentLen = Math.max(1, totalContentLen / N);
  const avgMetaLen = Math.max(1, totalMetaLen / N);

  const { k1, b } = BM25_CONSTANTS;
  const rawScores: { id: string; score: number; details: BM25FieldBreakdown }[] = [];

  // 3. Score each document using BM25F with Whoosh field boosts
  pages.forEach(p => {
    const titleStr = p.title || '';
    const snippetStr = p.snippet || '';
    const contentStr = p.content || p.snippet || '';
    const metaStr = (p.meta_description || '') + ' ' + (Array.isArray(p.keywords) ? p.keywords.join(' ') : (p.keywords || '')) + ' ' + (p.tags || []).join(' ');

    const titleWords = getWordCount(titleStr);
    const snippetWords = getWordCount(snippetStr);
    const contentWords = getWordCount(contentStr);
    const metaWords = getWordCount(metaStr);

    // Field length normalization factor B_f
    const B_title = (1 - b) + b * (titleWords / avgTitleLen);
    const B_snippet = (1 - b) + b * (snippetWords / avgSnippetLen);
    const B_content = (1 - b) + b * (contentWords / avgContentLen);
    const B_meta = (1 - b) + b * (metaWords / avgMetaLen);

    let docBM25 = 0;
    let titleScoreAccum = 0;
    let snippetScoreAccum = 0;
    let contentScoreAccum = 0;
    let metaScoreAccum = 0;

    let titleMatchesTotal = 0;
    let snippetMatchesTotal = 0;
    let contentMatchesTotal = 0;
    let metaMatchesTotal = 0;

    const matchedTerms: string[] = [];
    const idfBreakdown: Record<string, number> = {};

    terms.forEach(term => {
      const df = docFrequencies[term] || 0;
      // Standard Robertson-Sparck Jones / Whoosh smoothed IDF formula
      const idf = Math.max(0.1, Math.log(1 + (N - df + 0.5) / (df + 0.5)));
      idfBreakdown[term] = Number(idf.toFixed(3));

      const tf_title = countTermOccurrences(titleStr, term);
      const tf_snippet = countTermOccurrences(snippetStr, term);
      const tf_content = countTermOccurrences(contentStr, term);
      const tf_meta = countTermOccurrences(metaStr, term);

      titleMatchesTotal += tf_title;
      snippetMatchesTotal += tf_snippet;
      contentMatchesTotal += tf_content;
      metaMatchesTotal += tf_meta;

      if (tf_title > 0 || tf_snippet > 0 || tf_content > 0 || tf_meta > 0) {
        matchedTerms.push(term);
      }

      // Length-normalized Term Frequencies per field
      const norm_tf_title = tf_title / Math.max(0.1, B_title);
      const norm_tf_snippet = tf_snippet / Math.max(0.1, B_snippet);
      const norm_tf_content = tf_content / Math.max(0.1, B_content);
      const norm_tf_meta = tf_meta / Math.max(0.1, B_meta);

      // Weighted Term Frequency across Whoosh index fields
      const weighted_tf =
        WHOOSH_FIELD_WEIGHTS.TITLE * norm_tf_title +
        WHOOSH_FIELD_WEIGHTS.SNIPPET * norm_tf_snippet +
        WHOOSH_FIELD_WEIGHTS.CONTENT * norm_tf_content +
        WHOOSH_FIELD_WEIGHTS.META * norm_tf_meta;

      if (weighted_tf > 0) {
        // BM25 saturation function
        const termScore = idf * ((weighted_tf * (k1 + 1)) / (weighted_tf + k1));
        docBM25 += termScore;

        // Attribute score breakdown proportionally
        const safeWeightSum = Math.max(0.0001, weighted_tf);
        titleScoreAccum += termScore * ((WHOOSH_FIELD_WEIGHTS.TITLE * norm_tf_title) / safeWeightSum);
        snippetScoreAccum += termScore * ((WHOOSH_FIELD_WEIGHTS.SNIPPET * norm_tf_snippet) / safeWeightSum);
        contentScoreAccum += termScore * ((WHOOSH_FIELD_WEIGHTS.CONTENT * norm_tf_content) / safeWeightSum);
        metaScoreAccum += termScore * ((WHOOSH_FIELD_WEIGHTS.META * norm_tf_meta) / safeWeightSum);
      }
    });

    // Exact phrase match bonuses for title & snippet
    const rawCleanQuery = query.toLowerCase().trim();
    if (rawCleanQuery.length > 2) {
      if (titleStr.toLowerCase().includes(rawCleanQuery)) {
        const titleBonus = 3.5 * WHOOSH_FIELD_WEIGHTS.TITLE;
        docBM25 += titleBonus;
        titleScoreAccum += titleBonus;
      }
      if (snippetStr.toLowerCase().includes(rawCleanQuery)) {
        const snippetBonus = 1.8 * WHOOSH_FIELD_WEIGHTS.SNIPPET;
        docBM25 += snippetBonus;
        snippetScoreAccum += snippetBonus;
      }
    }

    // Small freshness & authority tie-breaker
    const tieBreaker = Math.min(0.5, (p.likes || 0) * 0.005 + (p.backlinks || 0) * 0.005);
    const finalScore = Number((docBM25 + tieBreaker).toFixed(3));

    rawScores.push({
      id: p.id,
      score: finalScore,
      details: {
        total: finalScore,
        titleScore: Number(titleScoreAccum.toFixed(3)),
        snippetScore: Number(snippetScoreAccum.toFixed(3)),
        contentScore: Number(contentScoreAccum.toFixed(3)),
        metaScore: Number(metaScoreAccum.toFixed(3)),
        titleMatches: titleMatchesTotal,
        snippetMatches: snippetMatchesTotal,
        contentMatches: contentMatchesTotal,
        metaMatches: metaMatchesTotal,
        titleWeight: WHOOSH_FIELD_WEIGHTS.TITLE,
        snippetWeight: WHOOSH_FIELD_WEIGHTS.SNIPPET,
        contentWeight: WHOOSH_FIELD_WEIGHTS.CONTENT,
        metaWeight: WHOOSH_FIELD_WEIGHTS.META,
        matchedTerms: Array.from(new Set(matchedTerms)),
        idfBreakdown,
        relativePercentage: 100
      }
    });
  });

  // Calculate relative percentages against highest score
  const maxScore = Math.max(1, ...rawScores.map(r => r.score));
  rawScores.forEach(item => {
    const pct = Math.min(100, Math.max(5, Math.round((item.score / maxScore) * 100)));
    item.details.relativePercentage = pct;
    resultMap.set(item.id, {
      score: item.score,
      details: item.details
    });
  });

  return resultMap;
}
