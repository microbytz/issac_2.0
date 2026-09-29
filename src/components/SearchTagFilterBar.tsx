import React, { useState } from 'react';
import { Tag, Tags, Check, X, Filter, Sparkles, SlidersHorizontal } from 'lucide-react';

export interface TagCountItem {
  tag: string;
  count: number;
}

export interface SearchTagFilterBarProps {
  availableTags: TagCountItem[];
  selectedTags: string[];
  filterLogic: 'any' | 'all';
  totalResultsCount: number;
  filteredResultsCount: number;
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
  onToggleLogic: () => void;
  isLight?: boolean;
}

export const SearchTagFilterBar: React.FC<SearchTagFilterBarProps> = ({
  availableTags,
  selectedTags,
  filterLogic,
  totalResultsCount,
  filteredResultsCount,
  onToggleTag,
  onClearTags,
  onToggleLogic,
  isLight = false,
}) => {
  const [filterSearch, setFilterSearch] = useState('');

  // Filter available tags if user types in search input
  const visibleTags = filterSearch.trim()
    ? availableTags.filter(item => item.tag.toLowerCase().includes(filterSearch.toLowerCase().trim()))
    : availableTags;

  if (availableTags.length === 0) {
    return null;
  }

  const isAnyTagActive = selectedTags.length > 0;

  return (
    <div
      id="search-tag-filter-bar"
      className={`rounded-2xl border p-3.5 sm:p-4 transition-all duration-200 ${
        isLight
          ? 'bg-slate-50/90 border-slate-200 shadow-xs'
          : 'bg-[#070e24]/60 border-slate-800 shadow-lg'
      }`}
    >
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-700/40">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className={`p-1.5 rounded-lg ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-950/70 text-blue-400 border border-blue-500/20'}`}>
              <Tags className="w-3.5 h-3.5" />
            </div>
            <span className={`text-xs font-bold font-sans ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
              Filter by Tag
            </span>
          </div>

          <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md ${
            isLight ? 'bg-slate-200/80 text-slate-600' : 'bg-slate-800/80 text-slate-400'
          }`}>
            {isAnyTagActive ? `${filteredResultsCount} of ${totalResultsCount} visible` : `${availableTags.length} tags available`}
          </span>

          {isAnyTagActive && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              {selectedTags.length} active
            </span>
          )}
        </div>

        {/* Controls: Logic switcher + Clear button */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {selectedTags.length > 1 && (
            <button
              type="button"
              onClick={onToggleLogic}
              title={`Switch matching condition (currently ${filterLogic.toUpperCase()})`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer border ${
                filterLogic === 'all'
                  ? isLight
                    ? 'bg-slate-200 border-slate-400 text-slate-800 hover:bg-slate-300'
                    : 'bg-zinc-800/80 border-zinc-600/50 text-zinc-200 hover:bg-zinc-700/80'
                  : isLight
                    ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                    : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3 text-blue-400" />
              <span>Logic: <strong className="text-amber-400 uppercase">{filterLogic}</strong></span>
              <span className="text-[9px] opacity-75">({filterLogic === 'all' ? 'All match' : 'Any match'})</span>
            </button>
          )}

          {isAnyTagActive && (
            <button
              type="button"
              onClick={onClearTags}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-sans font-bold transition-all cursor-pointer border ${
                isLight
                  ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                  : 'bg-rose-950/40 border-rose-800/50 text-rose-300 hover:bg-rose-900/50'
              }`}
            >
              <X className="w-3 h-3" />
              <span>Reset Tags</span>
            </button>
          )}
        </div>
      </div>

      {/* Optional quick search for tags if there are more than 6 tags */}
      {availableTags.length > 6 && (
        <div className="pt-2.5 pb-1 flex items-center gap-2">
          <input
            type="text"
            placeholder="Search tags..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className={`w-full max-w-xs px-2.5 py-1 text-xs rounded-lg border outline-none font-mono transition-all ${
              isLight
                ? 'bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-400'
                : 'bg-[#030712] border-slate-800 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-900'
            }`}
          />
          {filterSearch && (
            <button
              type="button"
              onClick={() => setFilterSearch('')}
              className="text-[10px] font-mono text-slate-400 hover:text-slate-200 px-1.5 py-0.5"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Tag Buttons Row */}
      <div className="flex items-center gap-1.5 flex-wrap pt-2.5">
        {/* "All" Tag Chip */}
        <button
          type="button"
          onClick={onClearTags}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border ${
            !isAnyTagActive
              ? isLight
                ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                : 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-950/60'
              : isLight
                ? 'bg-white text-slate-600 hover:text-slate-900 border-slate-200 hover:border-slate-300'
                : 'bg-[#030712]/60 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span>All Pages</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            !isAnyTagActive ? 'bg-blue-700/80 text-blue-100' : isLight ? 'bg-slate-100 text-slate-500' : 'bg-slate-800 text-slate-400'
          }`}>
            {totalResultsCount}
          </span>
        </button>

        {/* Individual Tag Chips */}
        {visibleTags.map(({ tag, count }) => {
          const isSelected = selectedTags.includes(tag);

          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggleTag(tag)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border select-none ${
                isSelected
                  ? isLight
                    ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                    : 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-950/60'
                  : isLight
                    ? 'bg-white text-slate-700 hover:text-blue-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                    : 'bg-[#030712]/60 text-slate-300 hover:text-white border-slate-800 hover:border-blue-500/50 hover:bg-blue-950/20'
              }`}
              title={`Toggle tag #${tag} (${count} matching result${count === 1 ? '' : 's'})`}
            >
              {isSelected ? (
                <Check className="w-3 h-3 text-white shrink-0" />
              ) : (
                <Tag className="w-2.5 h-2.5 text-blue-400 shrink-0 opacity-80" />
              )}
              <span>#{tag}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                isSelected
                  ? 'bg-blue-700/90 text-blue-100'
                  : isLight
                    ? 'bg-slate-100 text-slate-500'
                    : 'bg-slate-800/80 text-slate-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}

        {visibleTags.length === 0 && (
          <span className="text-xs text-slate-500 font-mono py-1">
            No tags match "{filterSearch}"
          </span>
        )}
      </div>

      {/* Active Filter Summary Bar */}
      {isAnyTagActive && (
        <div className={`mt-2.5 pt-2 border-t flex items-center justify-between flex-wrap gap-2 text-xs ${
          isLight ? 'border-slate-200/80 text-slate-600' : 'border-slate-800/80 text-slate-400'
        }`}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[11px] font-semibold">Active Tag Filter:</span>
            {selectedTags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-blue-500/15 border border-blue-500/30 text-blue-400"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => onToggleTag(tag)}
                  className="hover:text-red-400 transition-colors p-0.5 rounded cursor-pointer"
                  title={`Remove #${tag} filter`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
          <span className="font-mono text-[11px]">
            {filteredResultsCount === 0 ? (
              <span className="text-rose-400 font-bold">No results match this tag combo</span>
            ) : (
              <span className="text-blue-400 font-bold">
                Showing {filteredResultsCount} of {totalResultsCount}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
};

export default SearchTagFilterBar;
