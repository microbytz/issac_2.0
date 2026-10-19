// Real inverted index for the page catalog: tokenization, light stemming,
// field-weighted postings, BM25 scoring, prefix expansion, phrase boosts and
// vocabulary-driven spell correction. In-memory; the server persists the raw
// catalog to disk and rebuilds this index on boot.

export interface IndexablePage {
  id: string;
  url: string;
  title?: string;
  snippet?: string;
  content?: string;
  meta_description?: string;
  keywords?: string[] | string;
  tags?: string[];
  author?: string;
  backlinks?: number;
  likes?: number;
  indexed_at?: string;
  clicks?: number;       // global click count — live-read at score time
  host_quality?: number; // crawler-derived host quality multiplier (0.6-1.05)
  authority?: number;    // PageRank relative to graph average (~1.0 = average)
  link_spam?: number;    // link-spam heuristic multiplier per host (0.5-1.0)
  anchor_text?: string;  // anchor phrases other pages used when linking here
}

export interface SearchHit<T extends IndexablePage = IndexablePage> {
  doc: T;
  score: number;
  /** Raw per-doc ranking features — feeds the online weight tuner. Order:
   *  [click, backlink, authority, freshness, likes] */
  features?: number[];
}

/** Tunable blend weights — the online tuner nudges these from click pairs. */
export interface RankWeights {
  click: number;
  backlink: number;
  authority: number;
  freshness: number;
  likes: number;
}

export const DEFAULT_RANK_WEIGHTS: RankWeights = {
  click: 0.08,
  backlink: 1 / 15,
  authority: 0.12,
  freshness: 0.1,
  likes: 1 / 25
};

export interface SearchOptions {
  weights?: RankWeights;
  /** Navigational queries boost docs whose URL text matches a query term. */
  urlTermBoost?: number;
  /** Fresh queries raise the freshness cap (QDF). */
  freshCap?: number;
  /** Pseudo-relevance feedback — expand the query with top-doc terms. */
  prf?: boolean;
  /** Negated query terms (from -term operators) — docs containing them are excluded. */
  excludeTerms?: string[];
}

const TOKEN_SPLIT_RE = /[^\p{L}\p{N}]+/u;
const BM25_K1 = 1.2;
const BM25_B = 0.75;
const SIMHASH_DEDUP_HAMMING = 4; // fingerprints within this distance = near-dup
const MAX_DOC_TOKENS = 50_000; // per-field token cap during indexing
const MAX_PREFIX_EXPANSIONS = 30;

const FIELD_WEIGHTS = {
  title: 5,
  meta: 4,   // meta_description + keywords + tags + author
  anchor: 4, // how other sites describe this page when linking to it
  snippet: 3,
  url: 2,
  content: 1
};

// Curated synonym groups — each member expands to the others at reduced
// weight. Terms are stemmed at lookup time, so "cars" matches "car" too.
const SYNONYM_GROUPS: string[][] = [
  ['car', 'automobile', 'vehicle'],
  ['photo', 'picture', 'image', 'pic'],
  ['movie', 'film', 'cinema'],
  ['buy', 'purchase', 'shop', 'store'],
  ['job', 'work', 'career', 'employment'],
  ['kid', 'child', 'children'],
  ['fast', 'quick', 'rapid', 'speedy'],
  ['big', 'large', 'huge', 'giant'],
  ['begin', 'start', 'commence'],
  ['end', 'finish', 'complete'],
  ['fix', 'repair', 'mend'],
  ['learn', 'study', 'tutorial', 'guide'],
  ['news', 'latest', 'headlines'],
  ['weather', 'forecast', 'climate'],
  ['map', 'directions', 'route'],
  ['email', 'mail'],
  ['phone', 'mobile', 'cell'],
  ['tv', 'television'],
  ['book', 'novel', 'ebook'],
  ['recipe', 'cooking', 'cook'],
  ['music', 'song', 'audio'],
  ['game', 'gaming', 'play'],
  ['code', 'programming', 'develop', 'dev'],
  ['ai', 'artificial', 'intelligence'],
  ['ml', 'machine', 'learning'],
  ['js', 'javascript'],
  ['py', 'python'],
  ['doc', 'docs', 'documentation'],
  ['app', 'application', 'software'],
  ['web', 'website', 'site', 'page'],
  ['search', 'find', 'lookup', 'query'],
  ['cheap', 'budget', 'affordable'],
  ['free', 'gratis'],
  ['best', 'top', 'greatest'],
  ['review', 'rating', 'opinion'],
  ['download', 'fetch'],
  ['upload', 'share'],
  ['price', 'cost', 'fee'],
  ['hotel', 'motel', 'lodging', 'inn'],
  ['flight', 'airline'],
  ['restaurant', 'food', 'dining'],
  ['health', 'medical', 'doctor'],
  ['lawyer', 'attorney', 'legal'],
  ['school', 'college', 'university', 'education'],
  ['house', 'home', 'property'],
  ['video', 'watch', 'stream'],
  ['podcast', 'listen'],
  ['blog', 'post', 'article'],
  ['error', 'bug', 'issue', 'problem'],
  ['install', 'setup', 'deploy'],
  ['api', 'endpoint', 'rest'],
  ['database', 'db', 'storage'],
  ['server', 'host', 'hosting'],
  ['security', 'secure', 'privacy'],
  ['speed', 'performance'],
  ['crawl', 'crawler', 'spider', 'bot'],
  ['index', 'indexing', 'inverted'],
  ['rank', 'ranking', 'ranked'],
  ['link', 'hyperlink', 'url'],
  ['cache', 'cached', 'caching'],
  ['token', 'auth', 'authentication'],
  ['user', 'account', 'profile'],
  ['setting', 'config', 'configuration', 'preference'],
  ['history', 'log', 'record'],
  ['vote', 'like', 'upvote'],
  ['reader', 'read', 'reading'],
  ['image', 'img', 'thumbnail', 'graphic'],
  ['engine', 'system', 'service'],
];

let synonymLookup: Map<string, string[]> | null = null;

function getSynonyms(): Map<string, string[]> {
  if (synonymLookup) return synonymLookup;
  const map = new Map<string, string[]>();
  for (const group of SYNONYM_GROUPS) {
    const stems = group.map(stem);
    for (const s of stems) {
      const others = stems.filter(x => x !== s);
      map.set(s, [...(map.get(s) || []), ...others]);
    }
  }
  synonymLookup = map;
  return map;
}

export function tokenize(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const tok of text.toLowerCase().split(TOKEN_SPLIT_RE)) {
    if (!tok) continue;
    // Keep CJK single chars; require >=2 chars for latin (drops 'a', 'i' noise)
    if (tok.length === 1 && !/[㐀-鿿豈-﫿぀-ヿ가-힯]/.test(tok)) continue;
    out.push(tok);
    if (out.length >= MAX_DOC_TOKENS) break;
  }
  return out;
}

// Light English suffix stemmer — good enough to join run/running/runs,
// crawl/crawler/crawling, index/indexes/indexing without a full Porter impl.
export function stem(w: string): string {
  if (w.length <= 3 || /\d/.test(w)) return w;
  if (w.endsWith("'s")) w = w.slice(0, -2);
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('sses')) return w.slice(0, -2);
  if (w.endsWith('ing') && w.length > 5) return dedupTail(w.slice(0, -3));
  if (w.endsWith('ied') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('ed') && w.length > 4) return dedupTail(w.slice(0, -2));
  if (w.endsWith('es') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('er') && w.length > 5) return dedupTail(w.slice(0, -2));
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  return w;
}

// running->runn->run, stopped->stopp->stop
function dedupTail(w: string): string {
  if (w.length > 2 && w[w.length - 1] === w[w.length - 2] && !'aeiou'.includes(w[w.length - 1])) {
    return w.slice(0, -1);
  }
  return w;
}

function editDistance(a: string, b: string, maxDist: number): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** FNV-1a over UTF-16 code units → 64-bit fingerprint hash. */
function fnv1a64(s: string): bigint {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = (1n << 64n) - 1n;
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i));
    h = (h * prime) & mask;
  }
  return h;
}

function hamming64(a: bigint, b: bigint): number {
  let x = a ^ b;
  let n = 0;
  while (x > 0n) {
    x &= x - 1n;
    n++;
  }
  return n;
}

export class InvertedIndex<T extends IndexablePage> {
  private docs = new Map<string, T>();
  private postings = new Map<string, Map<string, number>>(); // term -> docId -> weighted tf
  private docLen = new Map<string, number>();
  private docFreq = new Map<string, number>(); // term -> df (for spellcheck ranking)
  private spamPenalty = new Map<string, number>(); // docId -> 0.3-1.0 multiplier
  private fingerprints = new Map<string, bigint>(); // docId -> SimHash
  private totalLen = 0;

  get size(): number {
    return this.docs.size;
  }

  private addWeighted(accum: Map<string, number>, text: string, weight: number) {
    if (!text) return;
    for (const tok of tokenize(text)) {
      accum.set(stem(tok), (accum.get(stem(tok)) || 0) + weight);
    }
  }

  add(doc: T): void {
    this.remove(doc.id);
    this.docs.set(doc.id, doc);

    const kwText = Array.isArray(doc.keywords)
      ? doc.keywords.join(' ')
      : String(doc.keywords || '');
    const tagText = (doc.tags || []).join(' ');
    const urlTokens = doc.url
      .replace(/^https?:\/\//, '')
      .replace(/[\/?#&=._~%+-]+/g, ' ');

    const weighted = new Map<string, number>();
    this.addWeighted(weighted, doc.title || '', FIELD_WEIGHTS.title);
    this.addWeighted(weighted, `${doc.meta_description || ''} ${kwText} ${tagText} ${doc.author || ''}`, FIELD_WEIGHTS.meta);
    this.addWeighted(weighted, doc.anchor_text || '', FIELD_WEIGHTS.anchor);
    this.addWeighted(weighted, doc.snippet || '', FIELD_WEIGHTS.snippet);
    this.addWeighted(weighted, urlTokens, FIELD_WEIGHTS.url);
    this.addWeighted(weighted, doc.content || '', FIELD_WEIGHTS.content);

    for (const [term, tf] of weighted) {
      let bucket = this.postings.get(term);
      if (!bucket) {
        bucket = new Map();
        this.postings.set(term, bucket);
      }
      bucket.set(doc.id, tf);
      this.docFreq.set(term, (this.docFreq.get(term) || 0) + 1);
    }

    const titleToks = tokenize(doc.title || '');
    const snippetToks = tokenize(doc.snippet || '');
    const contentToks = tokenize(doc.content || '');
    const len = titleToks.length + snippetToks.length + contentToks.length;
    this.docLen.set(doc.id, Math.max(1, len));
    this.totalLen += Math.max(1, len);
    this.spamPenalty.set(doc.id, this.computeSpamPenalty(doc, titleToks, contentToks));

    // SimHash fingerprint of title+content — detects near-duplicate docs
    // (syndicated copies) so search can collapse them.
    {
      const votes = new Array<number>(64).fill(0);
      const counts = new Map<string, number>();
      const toks = titleToks.concat(titleToks, snippetToks, contentToks); // title ×2
      for (const t of toks) counts.set(t, (counts.get(t) || 0) + 1);
      for (const [term, tf] of counts) {
        const h = fnv1a64(term);
        for (let b = 0; b < 64; b++) {
          votes[b] += (h >> BigInt(b)) & 1n ? tf : -tf;
        }
      }
      let fp = 0n;
      for (let b = 0; b < 64; b++) if (votes[b] >= 0) fp |= 1n << BigInt(b);
      this.fingerprints.set(doc.id, fp);
    }
  }

  /**
   * Content-quality penalty: keyword stuffing, title word repetition, meta
   * keyword bloat, thin pages, keywordy hyphen-domains. Returns 0.3-1.0.
   */
  private computeSpamPenalty(doc: T, titleToks: string[], contentToks: string[]): number {
    let spam = 1;

    if ((doc.content || '').length < 120) spam *= 0.85; // thin page

    if (contentToks.length >= 300) {
      // A single term dominating >6% of the body = stuffing.
      const counts = new Map<string, number>();
      let maxTf = 0;
      for (const t of contentToks) {
        const c = (counts.get(t) || 0) + 1;
        counts.set(t, c);
        if (c > maxTf) maxTf = c;
      }
      if (maxTf / contentToks.length > 0.06) spam *= 0.7;
    }

    const titleCounts = new Map<string, number>();
    for (const t of titleToks) {
      const c = (titleCounts.get(t) || 0) + 1;
      titleCounts.set(t, c);
      if (c >= 3) {
        spam *= 0.85;
        break;
      }
    }

    const kwCount = Array.isArray(doc.keywords)
      ? doc.keywords.length
      : (doc.keywords ? String(doc.keywords).split(',').length : 0);
    if (kwCount > 15) spam *= 0.9;

    try {
      const hyphens = (new URL(doc.url).hostname.match(/-/g) || []).length;
      if (hyphens >= 4) spam *= 0.85;
    } catch (_) {}

    return Math.max(0.3, spam);
  }

  remove(docId: string): void {
    if (!this.docs.has(docId)) return;
    this.docs.delete(docId);
    this.totalLen -= this.docLen.get(docId) || 0;
    this.docLen.delete(docId);
    this.spamPenalty.delete(docId);
    this.fingerprints.delete(docId);
    for (const [term, bucket] of this.postings) {
      if (bucket.delete(docId)) {
        this.docFreq.set(term, (this.docFreq.get(term) || 1) - 1);
        if (bucket.size === 0) {
          this.postings.delete(term);
          this.docFreq.delete(term);
        }
      }
    }
  }

  rebuild(docs: T[]): void {
    this.docs.clear();
    this.postings.clear();
    this.docLen.clear();
    this.docFreq.clear();
    this.spamPenalty.clear();
    this.fingerprints.clear();
    this.totalLen = 0;
    for (const d of docs) this.add(d);
  }

  /** Minimum token span covering every query term — proximity scoring. */
  private minQuerySpan(doc: T, need: Set<string>): number {
    const text = `${doc.title || ''} ${doc.title || ''} ${doc.snippet || ''} ${(doc.content || '').slice(0, 30000)}`;
    const toks = tokenize(text);
    const lastPos = new Map<string, number>();
    let best = Infinity;
    for (let i = 0; i < toks.length; i++) {
      const st = stem(toks[i]);
      if (!need.has(st)) continue;
      lastPos.set(st, i);
      if (lastPos.size === need.size) {
        let min = Infinity;
        for (const p of lastPos.values()) if (p < min) min = p;
        const span = i - min + 1;
        if (span < best) best = span;
        if (best === need.size) break;
      }
    }
    return best;
  }

  search(query: string, limit = 200, opts?: SearchOptions): SearchHit<T>[] {
    const w = opts?.weights ?? DEFAULT_RANK_WEIGHTS;
    const freshCap = opts?.freshCap ?? 0.1;
    const urlBoost = opts?.urlTermBoost ?? 1;
    const rawTerms = tokenize(query);
    if (rawTerms.length === 0 || this.docs.size === 0) return [];
    const stems = rawTerms.map(stem);
    const n = this.docs.size;
    const avgdl = this.totalLen / Math.max(1, n);
    const scores = new Map<string, number>();

    const applyPostings = (term: string, weight: number) => {
      const bucket = this.postings.get(term);
      if (!bucket) return;
      const df = bucket.size;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      for (const [docId, tf] of bucket) {
        const dl = this.docLen.get(docId) || 1;
        const tfNorm = (tf * (BM25_K1 + 1)) / (tf + BM25_K1 * (1 - BM25_B + (BM25_B * dl) / avgdl));
        scores.set(docId, (scores.get(docId) || 0) + idf * tfNorm * weight);
      }
    };

    const synonyms = getSynonyms();
    for (const s of stems) {
      applyPostings(s, 1);
      // Synonym expansion — "movie" also matches "film"/"cinema" docs.
      const syns = synonyms.get(s);
      if (syns) {
        for (const syn of syns.slice(0, 5)) applyPostings(syn, 0.55);
      }
      // Prefix expansion — "firep" matches "fireplexity" with a discount.
      if (!this.postings.has(s) && s.length >= 3) {
        let expanded = 0;
        for (const term of this.postings.keys()) {
          if (term.startsWith(s) && term !== s) {
            applyPostings(term, 0.6);
            if (++expanded >= MAX_PREFIX_EXPANSIONS) break;
          }
        }
      }
    }

    // Pseudo-relevance feedback (RM-style): the top documents of the first
    // pass are treated as relevant; their highest-IDF non-query terms expand
    // the query at low weight, catching related vocabulary the user didn't type.
    if (opts?.prf && scores.size >= 3 && stems.length <= 6) {
      const querySet = new Set(stems);
      const topDocIds = [...scores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([id]) => id);
      const termScore = new Map<string, number>();
      for (const docId of topDocIds) {
        const doc = this.docs.get(docId);
        if (!doc) continue;
        const tf = new Map<string, number>();
        for (const tok of tokenize(`${doc.title || ''} ${(doc.content || '').slice(0, 20000)}`)) {
          const st = stem(tok);
          if (!querySet.has(st) && st.length >= 3) tf.set(st, (tf.get(st) || 0) + 1);
        }
        for (const [term, count] of tf) {
          const df = this.docFreq.get(term) || 0;
          if (df === 0) continue;
          const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
          termScore.set(term, (termScore.get(term) || 0) + idf * Math.min(count, 5));
        }
      }
      const expandTerms = [...termScore.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      for (const [term] of expandTerms) applyPostings(term, 0.25);
    }

    if (scores.size === 0) return [];

    // Negated terms — docs containing a -excluded term are removed entirely.
    if (opts?.excludeTerms?.length) {
      for (const t of opts.excludeTerms) {
        const bucket = this.postings.get(stem(t));
        if (!bucket) continue;
        for (const docId of bucket.keys()) scores.delete(docId);
      }
      if (scores.size === 0) return [];
    }

    const lowerQ = query.toLowerCase().trim();
    const out: SearchHit<T>[] = [];
    for (const [docId, score] of scores) {
      const doc = this.docs.get(docId);
      if (!doc) continue;
      let s = score;

      // Exact-phrase boost — title/snippet containing the raw query.
      if (doc.title?.toLowerCase().includes(lowerQ)) s *= 2.5;
      else if (doc.snippet?.toLowerCase().includes(lowerQ) || doc.meta_description?.toLowerCase().includes(lowerQ)) s *= 1.8;
      else if (doc.content?.toLowerCase().includes(lowerQ)) s *= 1.3;

      // Quality signals: spam penalty, crawler host-quality, link-spam heuristic.
      s *= this.spamPenalty.get(docId) ?? 1;
      s *= doc.host_quality ?? 1;
      s *= doc.link_spam ?? 1;

      // Tunable engagement/authority/freshness blend — the online rank tuner
      // (ranker.ts) nudges these weights from real click-pair preferences.
      const fClick = Math.log1p(doc.clicks || 0);
      const fBacklink = Math.log1p(doc.backlinks || 0);
      const fAuthority = Math.log1p(Math.max(0, doc.authority ?? 0));
      const fLikes = Math.log1p(doc.likes || 0);
      let fFresh = 0;
      const indexedMs = doc.indexed_at ? new Date(doc.indexed_at).getTime() : 0;
      if (indexedMs > 0) {
        const ageDays = (Date.now() - indexedMs) / 86400000;
        if (ageDays < 7) fFresh = 1 - ageDays / 7;
      }
      s *= 1 + Math.min(0.2, fClick * w.click);
      s *= 1 + Math.min(0.3, fBacklink * w.backlink);
      s *= 1 + Math.min(0.4, fAuthority * w.authority);
      s *= 1 + Math.min(0.15, fLikes * w.likes);
      s *= 1 + Math.min(freshCap, fFresh * w.freshness);

      // Navigational intent — a query term appearing in the URL text.
      if (urlBoost > 1) {
        const urlLower = doc.url.toLowerCase();
        for (const t of rawTerms) {
          if (urlLower.includes(t)) {
            s *= urlBoost;
            break;
          }
        }
      }

      out.push({ doc, score: s, features: [fClick, fBacklink, fAuthority, fFresh, fLikes] });
    }

    out.sort((a, b) => b.score - a.score);

    // Stage-2 proximity — minimum span covering all query terms (title counts
    // double). Only runs on the top 50, so cost stays under ~1ms.
    if (stems.length >= 2) {
      const need = new Set(stems);
      for (const h of out.slice(0, 50)) {
        const span = this.minQuerySpan(h.doc, need);
        if (span < Infinity) h.score *= 1 + Math.min(1.0, need.size / span);
      }
      out.sort((a, b) => b.score - a.score);
    }

    // Near-duplicate collapse — docs whose SimHash is within 4 bits of an
    // already-kept doc are dropped (syndicated copies add nothing). Greedy
    // over the top 300; compares only against the kept set.
    if (out.length > 1) {
      const kept: SearchHit<T>[] = [];
      const keptFp: bigint[] = [];
      for (const h of out.slice(0, 300)) {
        // Short docs (<50 tokens) produce unstable fingerprints — never collapse them.
        const fp = (this.docLen.get(h.doc.id) || 0) >= 50 ? this.fingerprints.get(h.doc.id) : undefined;
        if (fp !== undefined && keptFp.some(k => hamming64(fp, k) <= SIMHASH_DEDUP_HAMMING)) continue;
        kept.push(h);
        if (fp !== undefined) keptFp.push(fp);
      }
      if (out.length > 300) kept.push(...out.slice(300));
      return kept.slice(0, limit);
    }

    return out.slice(0, limit);
  }

  /**
   * "Did you mean" — corrects each out-of-vocabulary query term to the closest
   * index term (edit distance 1-2, weighted toward frequent terms).
   */
  spellcheck(query: string): string | null {
    const rawTerms = query.toLowerCase().split(TOKEN_SPLIT_RE).filter(Boolean);
    if (rawTerms.length === 0) return null;

    // Group vocab by first letter once per call — vocab is small at this scale.
    const vocab = Array.from(this.postings.keys());
    if (vocab.length === 0) return null;

    let changed = false;
    const corrected = rawTerms.map(term => {
      if (term.length < 3 || this.postings.has(term) || this.postings.has(stem(term))) return term;
      const maxDist = term.length <= 5 ? 1 : term.length <= 8 ? 2 : 3;
      let best: string | null = null;
      let bestScore = -1;
      for (const v of vocab) {
        if (v[0] !== term[0] || Math.abs(v.length - term.length) > maxDist) continue;
        const d = editDistance(term, v, maxDist);
        if (d > maxDist) continue;
        const df = this.docFreq.get(v) || 1;
        const candidateScore = (maxDist + 1 - d) * 100 + Math.log1p(df);
        if (candidateScore > bestScore) {
          bestScore = candidateScore;
          best = v;
        }
      }
      if (best) {
        changed = true;
        return best;
      }
      return term;
    });

    if (!changed) return null;
    const suggestion = corrected.join(' ');
    return suggestion === query.toLowerCase().trim() ? null : suggestion;
  }

  /** Vocabulary terms starting with a prefix — for autocomplete. */
  prefixTerms(prefix: string, limit = 10): string[] {
    const p = prefix.toLowerCase();
    const out: string[] = [];
    for (const term of this.docFreq.keys()) {
      if (term.startsWith(p) && term !== p) out.push(term);
      if (out.length >= limit * 3) break;
    }
    // This is approximate — stems, not surface forms — so callers should blend
    // with keyword/tag sources too.
    return out.slice(0, limit);
  }
}
