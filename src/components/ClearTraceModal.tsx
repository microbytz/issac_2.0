import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, ShieldCheck, Trash2, X, AlertTriangle, RefreshCw, Sparkles, Check } from 'lucide-react';

interface ClearTraceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmClear: () => void;
  isLight: boolean;
  searchHistoryCount: number;
  hasActiveFilters: boolean;
}

export const ClearTraceModal: React.FC<ClearTraceModalProps> = ({
  isOpen,
  onClose,
  onConfirmClear,
  isLight,
  searchHistoryCount,
  hasActiveFilters
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className={`w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden ${
            isLight
              ? 'bg-white border-slate-200 text-slate-800'
              : 'bg-[#070e24] border-slate-800 text-slate-100'
          }`}
        >
          {/* Header */}
          <div className={`p-5 border-b flex items-start justify-between gap-3 ${
            isLight ? 'bg-orange-50/70 border-slate-200' : 'bg-gradient-to-r from-orange-950/30 via-slate-900 to-amber-950/20 border-slate-800'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0 shadow-inner">
                <Flame className="w-5 h-5 text-orange-400 animate-pulse" />
              </div>
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <span>Clear All Trace</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 font-semibold uppercase">
                    Zero Traces
                  </span>
                </h2>
                <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  DuckDuckGo-inspired privacy purge & session reset
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 flex flex-col gap-4">
            <p className={`text-xs sm:text-sm leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Clearing all trace will burn and vaporize your search activity in this session, leaving zero logs behind.
            </p>

            {/* Checklist of what will be erased */}
            <div className={`p-3.5 rounded-xl border flex flex-col gap-2.5 font-mono text-xs ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800/80'
            }`}>
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Search query & cached results
                </span>
                <span className="text-[10px] text-emerald-400 font-bold">Purged</span>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Recent search history
                </span>
                <span className="text-[10px] font-bold text-orange-400">{searchHistoryCount} items</span>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Domain, date & country filters
                </span>
                <span className="text-[10px] text-slate-500">
                  {hasActiveFilters ? 'Active filters reset' : 'Clean'}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Temporary suggestions & preview cache
                </span>
                <span className="text-[10px] text-emerald-400 font-bold">Wiped</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
              <ShieldCheck className="w-4 h-4 shrink-0 text-amber-400" />
              <span>No telemetry or search profiles are ever retained.</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className={`p-4 border-t flex items-center justify-end gap-2.5 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
          }`}>
            <button
              onClick={onClose}
              type="button"
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                isLight ? 'hover:bg-slate-200 text-slate-700' : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              Cancel
            </button>

            <button
              onClick={() => {
                onConfirmClear();
                onClose();
              }}
              type="button"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-lg shadow-orange-950/50 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              <Flame className="w-4 h-4 text-white" />
              <span>Clear All Trace Now</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ClearTraceModal;
