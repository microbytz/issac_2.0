import React from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { motion } from 'motion/react';
import { Sparkles, Sliders, Target, FileText, AlignLeft, Info, Tag, CheckCircle } from 'lucide-react';
import { BM25FieldBreakdown, WHOOSH_FIELD_WEIGHTS } from '../utils/bm25Scoring';

interface BM25ScoreInspectorProps {
  score?: number;
  details?: BM25FieldBreakdown;
  query: string;
  theme?: 'dark' | 'light';
  isOpen: boolean;
  onClose: () => void;
}

export const BM25ScoreInspector: React.FC<BM25ScoreInspectorProps> = ({
  score = 0,
  details,
  query,
  theme = 'dark',
  isOpen,
  onClose
}) => {
  const focusTrapRef = useFocusTrap<HTMLDivElement>();
  if (!isOpen) return null;

  const isDark = theme === 'dark';
  const totalScore = details ? details.total : score;
  const titleScore = details ? details.titleScore : 0;
  const snippetScore = details ? details.snippetScore : 0;
  const contentScore = details ? details.contentScore : 0;
  const metaScore = details ? details.metaScore : 0;

  const titleWeight = details ? details.titleWeight : WHOOSH_FIELD_WEIGHTS.TITLE;
  const snippetWeight = details ? details.snippetWeight : WHOOSH_FIELD_WEIGHTS.SNIPPET;
  const contentWeight = details ? details.contentWeight : WHOOSH_FIELD_WEIGHTS.CONTENT;

  const titleMatches = details ? details.titleMatches : 0;
  const snippetMatches = details ? details.snippetMatches : 0;
  const contentMatches = details ? details.contentMatches : 0;
  const metaMatches = details ? details.metaMatches : 0;

  const matchedTerms = details?.matchedTerms || [];
  const idfBreakdown = details?.idfBreakdown || {};

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity" 
        onClick={onClose}
      />

      {/* Modal */}
      <div ref={focusTrapRef} role="dialog" aria-modal="true" aria-label="BM25 score details" className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 10 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className={`pointer-events-auto w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden font-sans ${
            isDark 
              ? 'bg-[#091332] border-slate-700/80 text-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.85)]' 
              : 'bg-white border-slate-200 text-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.15)]'
          }`}
        >
          {/* Header */}
          <div className={`p-4 border-b flex items-center justify-between ${
            isDark ? 'border-slate-800/80 bg-[#070e24]/70' : 'border-slate-100 bg-slate-50/80'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold flex items-center gap-1.5">
                  <span>Whoosh BM25 Score Inspector</span>
                  <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono text-[10px]">
                    Relevance
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400 font-mono">
                  Term query: &ldquo;{query}&rdquo;
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg text-xs font-mono transition-colors ${
                isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="p-4 flex flex-col gap-4 text-xs max-h-[80vh] overflow-y-auto">
            {/* Top Score Banner */}
            <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
              isDark 
                ? 'bg-blue-950/30 border-blue-800/50 text-blue-200' 
                : 'bg-blue-50/70 border-blue-200 text-blue-900'
            }`}>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-blue-400">
                  Computed BM25F Value
                </span>
                <span className="text-2xl font-bold font-mono tracking-tight text-white">
                  {totalScore.toFixed(3)}
                </span>
              </div>

              <div className="flex flex-col items-end gap-1 font-mono text-[10px]">
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                  k1 = 1.2 • b = 0.75
                </span>
                <span className="text-slate-400 text-[9px]">
                  Field-Length Normalized
                </span>
              </div>
            </div>

            {/* Field Weight Contributions */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase font-mono tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                Whoosh Index Field Weight Breakdown
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Title Weight Card */}
                <div className={`p-3 rounded-xl border flex flex-col gap-1.5 ${
                  isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1 text-slate-300">
                      <Target className="w-3.5 h-3.5 text-amber-400" />
                      Title
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-mono font-bold text-[10px]">
                      {titleWeight.toFixed(1)}x Weight
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-lg font-bold font-mono text-amber-300">
                      +{titleScore.toFixed(2)}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {titleMatches} {titleMatches === 1 ? 'hit' : 'hits'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Highest boost for exact topic / intent matches in page titles.
                  </p>
                </div>

                {/* Snippet Weight Card */}
                <div className={`p-3 rounded-xl border flex flex-col gap-1.5 ${
                  isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1 text-slate-300">
                      <AlignLeft className="w-3.5 h-3.5 text-emerald-400" />
                      Snippet
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono font-bold text-[10px]">
                      {snippetWeight.toFixed(1)}x Weight
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-lg font-bold font-mono text-emerald-300">
                      +{snippetScore.toFixed(2)}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {snippetMatches} {snippetMatches === 1 ? 'hit' : 'hits'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Medium boost for dense summaries and excerpt descriptions.
                  </p>
                </div>

                {/* Body Content Weight Card */}
                <div className={`p-3 rounded-xl border flex flex-col gap-1.5 ${
                  isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1 text-slate-300">
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      Content
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 font-mono font-bold text-[10px]">
                      {contentWeight.toFixed(1)}x Weight
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-lg font-bold font-mono text-blue-300">
                      +{contentScore.toFixed(2)}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {contentMatches} {contentMatches === 1 ? 'hit' : 'hits'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Standard baseline weight for raw article body text.
                  </p>
                </div>
              </div>
            </div>

            {/* Matched Query Terms & IDF Table */}
            {matchedTerms.length > 0 && (
              <div className={`p-3 rounded-xl border flex flex-col gap-2 ${
                isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-blue-400" />
                    Matched Query Terms &amp; IDF Weights
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">
                    {matchedTerms.length} terms resolved
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {matchedTerms.map(term => (
                    <span
                      key={term}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-950/60 border border-blue-800/60 text-blue-200 font-mono text-[11px]"
                    >
                      <CheckCircle className="w-3 h-3 text-blue-400" />
                      <strong className="font-bold text-white">{term}</strong>
                      {idfBreakdown[term] !== undefined && (
                        <span className="text-[9px] text-slate-400 ml-1">
                          (IDF: {idfBreakdown[term]})
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Educational Formula Note */}
            <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
              isDark ? 'bg-[#030712]/60 border-slate-800 text-slate-400' : 'bg-slate-100/70 border-slate-200 text-slate-600'
            }`}>
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1 text-[11px] leading-relaxed">
                <p>
                  <strong>Why Title vs. Snippet Weighting Matters:</strong> Whoosh uses BM25F to weight matches based on search context. Matches in the page title (3.0x) reflect core subject relevance, while matches in snippet excerpts (1.5x) reflect concentrated summary coverage.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={`p-3.5 border-t flex items-center justify-end ${
            isDark ? 'border-slate-800/80 bg-[#070e24]/70' : 'border-slate-100 bg-slate-50'
          }`}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold transition-all shadow-md shadow-blue-950/50 cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default BM25ScoreInspector;
