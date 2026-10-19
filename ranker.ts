import type { RankWeights } from './searchIndex.ts';
import { DEFAULT_RANK_WEIGHTS } from './searchIndex.ts';

/**
 * Online pairwise rank tuner. Each click gives a preference pair: the clicked
 * doc was preferred over the docs ranked above it that the user skipped. A
 * hinge-loss (perceptron-style) update nudges the blend weights so the clicked
 * doc's features score higher. Weights are clamped to safe bounds — a bad
 * click can never destabilize the ranker.
 *
 * Feature order (must match SearchHit.features in searchIndex.ts):
 *   [click, backlink, authority, freshness, likes]
 */

const FEATURE_KEYS = ['click', 'backlink', 'authority', 'freshness', 'likes'] as const;

const WEIGHT_BOUNDS: Record<keyof RankWeights, [number, number]> = {
  click: [0.02, 0.25],
  backlink: [0.02, 0.2],
  authority: [0.03, 0.4],
  freshness: [0.02, 0.3],
  likes: [0.01, 0.15]
};

const LR = 0.02;
const MARGIN = 0.05;

let weights: RankWeights = { ...DEFAULT_RANK_WEIGHTS };
let updates = 0;

export function getWeights(): RankWeights {
  return { ...weights };
}

export function getUpdateCount(): number {
  return updates;
}

export function importWeights(raw: unknown): void {
  const w = raw as Partial<RankWeights> | null | undefined;
  if (!w || typeof w !== 'object') return;
  for (const k of FEATURE_KEYS) {
    const v = w[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const [lo, hi] = WEIGHT_BOUNDS[k];
    weights[k] = Math.min(hi, Math.max(lo, v));
  }
}

export function exportWeights(): RankWeights {
  return { ...weights };
}

/**
 * One preference pair: clicked features should outscore skipped features by
 * MARGIN. If not, hinge-loss gradient step moves weights toward that ranking.
 */
export function learnFromPair(clickedF: number[], skippedF: number[]): void {
  if (clickedF.length !== 5 || skippedF.length !== 5) return;
  const w = FEATURE_KEYS.map(k => weights[k]);
  const clickedScore = clickedF.reduce((acc, f, i) => acc + f * w[i], 0);
  const skippedScore = skippedF.reduce((acc, f, i) => acc + f * w[i], 0);
  const violation = skippedScore - clickedScore + MARGIN;
  if (violation <= 0) return;
  for (let i = 0; i < 5; i++) {
    const [lo, hi] = WEIGHT_BOUNDS[FEATURE_KEYS[i]];
    const next = w[i] + LR * violation * (clickedF[i] - skippedF[i]);
    weights[FEATURE_KEYS[i]] = Math.min(hi, Math.max(lo, next));
  }
  updates++;
}
