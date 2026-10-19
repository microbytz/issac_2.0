/**
 * Pluggable neural reranker — stage 3 of the ranking pipeline, off by default.
 *
 * Provider via NEURAL_RERANK env:
 *   "gemini" — Google text-embedding-004 over REST. Doc embeddings are computed
 *              lazily (top-25 hits per search), cached per-URL, and persisted
 *              in engine-state.json. Query embeds once per search.
 *   "local"  — all-MiniLM-L6-v2 via @huggingface/transformers, lazily imported.
 *              Only works if the package is installed; otherwise auto-off.
 *   anything else / unset — rerankHits is a no-op.
 *
 * Semantic scores blend into hit.score as a bounded multiplier. Every failure
 * path returns false and leaves scores untouched — the pipeline never degrades
 * if the provider is down.
 */

export interface RerankableDoc {
  id: string;
  url: string;
  title?: string;
  snippet?: string;
}

export interface RerankableHit {
  doc: RerankableDoc;
  score: number;
}

const PROVIDER = (process.env.NEURAL_RERANK || '').trim().toLowerCase();
const EMBED_MODEL = 'text-embedding-004';
const EMBED_TIMEOUT_MS = 15_000;
const MAX_RERANK = 25;
const MAX_DOC_EMBEDDINGS = 500;

const docEmbeddings = new Map<string, number[]>();
let localExtractor: ((text: string, opts?: object) => Promise<{ data: Float32Array }>) | null | undefined;

function embedText(doc: RerankableDoc): string {
  return `${doc.title || ''} ${(doc.snippet || '').slice(0, 300)}`.trim().slice(0, 1000);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na > 0 && nb > 0 ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

// --- provider: gemini REST ---

async function geminiEmbed(texts: string[]): Promise<number[][] | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || texts.length === 0) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: texts.map(t => ({
            model: `models/${EMBED_MODEL}`,
            content: { parts: [{ text: t }] }
          }))
        }),
        signal: AbortSignal.timeout(EMBED_TIMEOUT_MS)
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const out: number[][] = [];
    for (const e of data?.embeddings || []) {
      if (Array.isArray(e?.values) && e.values.length > 0) out.push(e.values);
      else return null;
    }
    return out.length === texts.length ? out : null;
  } catch (_) {
    return null;
  }
}

// --- provider: local transformers.js (optional dependency) ---

async function localEmbed(texts: string[]): Promise<number[][] | null> {
  if (localExtractor === undefined) {
    try {
      // Optional dependency — resolved at runtime only when NEURAL_RERANK=local.
      const spec = '@huggingface/transformers';
      const mod: any = await import(/* @vite-ignore */ spec);
      localExtractor = await mod.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    } catch (_) {
      localExtractor = null;
    }
  }
  if (!localExtractor) return null;
  try {
    const out: number[][] = [];
    for (const t of texts) {
      const r = await localExtractor(t, { pooling: 'mean', normalize: true });
      out.push(Array.from(r.data as Float32Array));
    }
    return out;
  } catch (_) {
    return null;
  }
}

async function embed(texts: string[]): Promise<number[][] | null> {
  if (PROVIDER === 'gemini') return geminiEmbed(texts);
  if (PROVIDER === 'local') return localEmbed(texts);
  return null;
}

/**
 * Reranks up to MAX_RERANK hits in place via embedding cosine similarity.
 * Returns true when neural scores were applied.
 */
export async function rerankHits(query: string, hits: RerankableHit[]): Promise<boolean> {
  if (!PROVIDER || hits.length === 0) return false;
  const top = hits.slice(0, MAX_RERANK);

  const qVec = (await embed([query]))?.[0];
  if (!qVec) return false;

  const missing = top.filter(h => !docEmbeddings.has(h.doc.url));
  if (missing.length > 0) {
    const vectors = await embed(missing.map(h => embedText(h.doc)));
    if (!vectors) return false;
    for (let i = 0; i < missing.length; i++) {
      if (docEmbeddings.size >= MAX_DOC_EMBEDDINGS && !docEmbeddings.has(missing[i].doc.url)) break;
      docEmbeddings.set(missing[i].doc.url, vectors[i]);
    }
  }

  for (const h of top) {
    const vec = docEmbeddings.get(h.doc.url);
    if (!vec) continue;
    const sim = cosine(qVec, vec);
    if (sim > 0) h.score *= 1 + Math.min(0.6, sim * 0.8);
  }
  return true;
}

export function exportDocEmbeddings(): Array<[string, number[]]> {
  return [...docEmbeddings.entries()].slice(0, MAX_DOC_EMBEDDINGS);
}

export function importDocEmbeddings(entries: Array<[string, number[]]>): void {
  for (const [url, vec] of entries) {
    if (docEmbeddings.size >= MAX_DOC_EMBEDDINGS) break;
    if (typeof url === 'string' && Array.isArray(vec) && vec.length > 0) {
      docEmbeddings.set(url, vec);
    }
  }
}
