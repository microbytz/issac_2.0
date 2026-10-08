import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, Zap, ExternalLink, ArrowRight, BookOpen, Check } from 'lucide-react';
import { DUCK_BANGS, DuckBang } from '../utils/duckBangs';

interface BangsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBang: (bang: DuckBang) => void;
  isLight: boolean;
}

export const BangsModal: React.FC<BangsModalProps> = ({
  isOpen,
  onClose,
  onSelectBang,
  isLight
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [copiedPrefix, setCopiedPrefix] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories = ['All', 'Tech', 'Reference', 'Social', 'Entertainment', 'Research', 'Shopping', 'News'];

  const filteredBangs = DUCK_BANGS.filter(b => {
    const matchesCat = selectedCategory === 'All' || b.category === selectedCategory;
    const cleanSearch = search.toLowerCase().trim();
    if (!cleanSearch) return matchesCat;

    const matchesSearch =
      b.prefix.toLowerCase().includes(cleanSearch) ||
      b.name.toLowerCase().includes(cleanSearch) ||
      b.description.toLowerCase().includes(cleanSearch) ||
      b.aliases?.some(a => a.toLowerCase().includes(cleanSearch));

    return matchesCat && matchesSearch;
  });

  const handleCopy = (prefix: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(prefix);
    setCopiedPrefix(prefix);
    setTimeout(() => setCopiedPrefix(null), 1500);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className={`w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden ${
            isLight
              ? 'bg-white border-slate-200 text-slate-800'
              : 'bg-[#070e24] border-slate-800 text-slate-100'
          }`}
        >
          {/* Header */}
          <div className={`p-4 sm:p-5 border-b flex items-center justify-between gap-3 ${
            isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-900/60 border-slate-800'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center border border-purple-500/20 font-bold">
                <Zap className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <span>DuckDuckGo !bangs</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                    {DUCK_BANGS.length}+ Shortcuts
                  </span>
                </h2>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Search directly across 30+ sites by typing shortcuts like <code className="font-mono font-bold text-purple-400">!w quantum</code> or <code className="font-mono font-bold text-purple-400">!gh react</code>
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

          {/* Search & Category Filter */}
          <div className="p-4 flex flex-col gap-3 border-b border-slate-800/60">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
              isLight
                ? 'bg-slate-50 border-slate-300 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-100'
                : 'bg-slate-950/80 border-slate-800 focus-within:border-purple-500/80 focus-within:ring-2 focus-within:ring-purple-950/40'
            }`}>
              <Search className="w-4 h-4 text-purple-400 shrink-0" />
              <input
                type="text"
                placeholder="Search bangs (e.g. '!w', 'wikipedia', 'github', 'python')..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="w-full bg-transparent border-none text-xs sm:text-sm outline-none placeholder:text-slate-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-purple-600 text-white font-bold shadow-sm shadow-purple-900/40'
                      : isLight
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Bangs Grid */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {filteredBangs.length === 0 ? (
              <div className="py-12 text-center text-xs sm:text-sm text-slate-500">
                No bangs matching &ldquo;{search}&rdquo;. Try another term or choose another category.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {filteredBangs.map((bang) => (
                  <div
                    key={bang.prefix}
                    onClick={() => {
                      onSelectBang(bang);
                      onClose();
                    }}
                    className={`group p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 text-left relative ${
                      isLight
                        ? 'bg-slate-50/70 border-slate-200 hover:bg-purple-50/60 hover:border-purple-300 shadow-sm'
                        : 'bg-[#030712]/60 border-slate-800/80 hover:bg-purple-950/20 hover:border-purple-500/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl leading-none select-none">{bang.icon}</span>
                        <div>
                          <div className="font-bold text-sm tracking-tight group-hover:text-purple-400 transition-colors">
                            {bang.name}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {bang.domain}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {bang.prefix}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleCopy(bang.prefix, e)}
                          title="Copy bang prefix"
                          className={`p-1 rounded text-[10px] font-mono transition-colors ${
                            copiedPrefix === bang.prefix
                              ? 'text-emerald-400'
                              : 'text-slate-500 hover:text-purple-400'
                          }`}
                        >
                          {copiedPrefix === bang.prefix ? <Check className="w-3 h-3" /> : 'Copy'}
                        </button>
                      </div>
                    </div>

                    <p className={`text-xs line-clamp-2 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      {bang.description}
                    </p>

                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-800/30">
                      <span className="text-slate-500">{bang.category}</span>
                      <span className="text-purple-400 font-medium group-hover:underline flex items-center gap-0.5">
                        Click to use <ArrowRight className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer tip */}
          <div className={`p-3 sm:p-4 border-t flex items-center justify-between text-xs ${
            isLight ? 'bg-slate-50 text-slate-600 border-slate-200' : 'bg-slate-950/80 text-slate-400 border-slate-800'
          }`}>
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              <BookOpen className="w-3.5 h-3.5 text-purple-400" />
              Tip: Type <strong className="text-purple-400">!</strong> in the search bar anytime for instant bang autocomplete.
            </span>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BangsModal;
