import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tag, Hash, Sparkles } from 'lucide-react';

export interface TagSuggestionItem {
  tag: string;
  count?: number;
}

export interface TagAutocompleteInputProps {
  value: string;
  onChange: (newValue: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  existingTags: Array<TagSuggestionItem | string>;
  multivalue?: boolean;
  placeholder?: string;
  className?: string;
  containerClassName?: string;
  dropdownClassName?: string;
  theme?: 'light' | 'dark';
  autoFocus?: boolean;
  id?: string;
  disabled?: boolean;
  maxSuggestions?: number;
  onSelectTag?: (selectedTag: string) => void;
}

export const TagAutocompleteInput: React.FC<TagAutocompleteInputProps> = ({
  value,
  onChange,
  onKeyDown,
  existingTags,
  multivalue = false,
  placeholder,
  className,
  containerClassName = '',
  dropdownClassName = '',
  theme = 'light',
  autoFocus = false,
  id,
  disabled = false,
  maxSuggestions = 8,
  onSelectTag
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normalize existing tags into { tag: string, count: number }
  const normalizedExistingTags = useMemo<TagSuggestionItem[]>(() => {
    const map = new Map<string, { tag: string; count: number }>();
    for (const item of existingTags) {
      if (!item) continue;
      const tagName = typeof item === 'string' ? item.trim() : item.tag.trim();
      if (!tagName) continue;
      const cleanName = tagName.replace(/^#+/, '');
      const lower = cleanName.toLowerCase();
      const count = typeof item === 'object' && typeof item.count === 'number' ? item.count : 1;

      if (map.has(lower)) {
        const existing = map.get(lower)!;
        existing.count = Math.max(existing.count, count);
      } else {
        map.set(lower, { tag: cleanName, count });
      }
    }
    return Array.from(map.values()).sort((a, b) => (b.count || 0) - (a.count || 0) || a.tag.localeCompare(b.tag));
  }, [existingTags]);

  // Determine current active token being typed
  const { currentToken, prefixText, alreadySelectedTags } = useMemo(() => {
    if (!multivalue) {
      const clean = value.trim().replace(/^#+/, '');
      return {
        currentToken: clean,
        prefixText: '',
        alreadySelectedTags: new Set<string>()
      };
    }

    // For multi-value (comma-separated):
    const parts = value.split(',');
    // Active token is the last token or token currently being typed
    const lastPart = parts[parts.length - 1] || '';
    const cleanLast = lastPart.trim().replace(/^#+/, '');
    
    // Everything before the last token
    const prefix = parts.length > 1 ? parts.slice(0, parts.length - 1).join(',') + ', ' : '';
    
    // Set of already added tags to filter out duplicates
    const alreadySelected = new Set(
      parts
        .slice(0, Math.max(0, parts.length - 1))
        .map(p => p.trim().replace(/^#+/, '').toLowerCase())
        .filter(Boolean)
    );

    return {
      currentToken: cleanLast,
      prefixText: prefix,
      alreadySelectedTags: alreadySelected
    };
  }, [value, multivalue]);

  // Filter and sort suggestions
  const suggestions = useMemo(() => {
    const tokenLower = currentToken.toLowerCase();

    // Filter out tags already chosen in multi-value mode
    const candidates = normalizedExistingTags.filter(
      item => !alreadySelectedTags.has(item.tag.toLowerCase())
    );

    if (!tokenLower) {
      // If no token is typed yet, show top popular tags
      return candidates.slice(0, maxSuggestions);
    }

    // Rank: prefix matches first, then substring matches
    const prefixMatches: TagSuggestionItem[] = [];
    const substringMatches: TagSuggestionItem[] = [];

    for (const item of candidates) {
      const itemLower = item.tag.toLowerCase();
      if (itemLower.startsWith(tokenLower)) {
        prefixMatches.push(item);
      } else if (itemLower.includes(tokenLower)) {
        substringMatches.push(item);
      }
    }

    // Sort prefix matches by count desc, then name
    prefixMatches.sort((a, b) => (b.count || 0) - (a.count || 0) || a.tag.localeCompare(b.tag));
    // Sort substring matches by count desc, then name
    substringMatches.sort((a, b) => (b.count || 0) - (a.count || 0) || a.tag.localeCompare(b.tag));

    return [...prefixMatches, ...substringMatches].slice(0, maxSuggestions);
  }, [normalizedExistingTags, currentToken, alreadySelectedTags, maxSuggestions]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(suggestions.length > 0 ? 0 : -1);
  }, [suggestions]);

  // Handle selecting a tag suggestion
  const handleSelectSuggestion = (tagItem: TagSuggestionItem) => {
    let newValue: string;
    if (multivalue) {
      newValue = `${prefixText}${tagItem.tag}, `;
    } else {
      newValue = tagItem.tag;
    }

    onChange(newValue);
    if (onSelectTag) {
      onSelectTag(tagItem.tag);
    }

    setIsOpen(false);
    setHighlightedIndex(-1);

    // Keep focus on input for smooth typing
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isOpen && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % suggestions.length);
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          e.preventDefault();
          handleSelectSuggestion(suggestions[highlightedIndex]);
          return;
        }
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        return;
      }
    }

    // If dropdown is closed and user hits ArrowDown, open suggestions
    if (!isOpen && e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex(0);
      return;
    }

    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  // Helper to highlight matched characters in tag name
  const renderHighlightedTagName = (tagName: string, query: string) => {
    if (!query) return <span>{tagName}</span>;
    const lowerName = tagName.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerName.indexOf(lowerQuery);

    if (index === -1) {
      return <span>{tagName}</span>;
    }

    const before = tagName.slice(0, index);
    const match = tagName.slice(index, index + query.length);
    const after = tagName.slice(index + query.length);

    return (
      <span>
        {before}
        <span className={theme === 'dark' ? 'text-blue-400 font-extrabold underline' : 'text-blue-600 font-extrabold underline'}>
          {match}
        </span>
        {after}
      </span>
    );
  };

  const isDark = theme === 'dark';

  return (
    <div ref={containerRef} className={`relative w-full ${containerClassName}`}>
      <input
        ref={inputRef}
        type="text"
        id={id}
        aria-label={placeholder || "Filter tags"}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => {
          if (suggestions.length > 0) {
            setIsOpen(true);
          }
        }}
        onKeyDown={handleKeyDown}
        className={className}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
      />

      {/* Auto-complete Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (suggestions.length > 0 || (currentToken.length > 0 && normalizedExistingTags.length > 0)) && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className={`absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border shadow-2xl overflow-hidden font-sans text-xs max-h-64 overflow-y-auto ${
              isDark
                ? 'bg-slate-900/98 backdrop-blur-md border-slate-700/80 text-slate-200'
                : 'bg-white border-slate-200 text-slate-800 shadow-xl'
            } ${dropdownClassName}`}
          >
            {/* Header banner */}
            <div
              className={`px-3 py-1.5 flex items-center justify-between border-b text-[10px] font-mono uppercase tracking-wider font-semibold ${
                isDark ? 'bg-slate-950/80 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-blue-400" />
                <span>Existing Index Tags</span>
              </div>
              <span className="text-[9px] opacity-75">
                {currentToken ? `Matches for "${currentToken}"` : 'Popular Tags'}
              </span>
            </div>

            {/* Suggestions list */}
            {suggestions.length > 0 ? (
              <div className="p-1 space-y-0.5">
                {suggestions.map((item, idx) => {
                  const isHighlighted = idx === highlightedIndex;
                  return (
                    <button
                      key={`tag-sugg-${item.tag}`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectSuggestion(item);
                      }}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer font-mono ${
                        isHighlighted
                          ? isDark
                            ? 'bg-blue-950/80 text-blue-200 border border-blue-500/40 shadow-xs'
                            : 'bg-blue-50 text-blue-900 border border-blue-200 shadow-xs font-bold'
                          : isDark
                          ? 'hover:bg-slate-800/80 text-slate-300 border border-transparent'
                          : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Hash className={`w-3.5 h-3.5 shrink-0 ${isHighlighted ? 'text-blue-400' : 'text-slate-400'}`} />
                        <span className="truncate text-xs">
                          {renderHighlightedTagName(item.tag, currentToken)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {item.count !== undefined && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-normal ${
                              isDark
                                ? 'bg-slate-800 text-slate-400 border border-slate-700/60'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {item.count} {item.count === 1 ? 'page' : 'pages'}
                          </span>
                        )}
                        {isHighlighted && (
                          <span className={`text-[9px] font-mono px-1 rounded ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                            Enter ↵
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 text-center text-slate-400 text-xs">
                <Tag className="w-4 h-4 mx-auto mb-1 text-slate-400 opacity-60" />
                <p>No existing tag in index matches &quot;{currentToken}&quot;</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Press Enter or keep typing to create this as a new tag
                </p>
              </div>
            )}

            {/* Footer hint */}
            {suggestions.length > 0 && (
              <div
                className={`px-3 py-1 border-t text-[9px] font-mono flex items-center justify-between ${
                  isDark ? 'bg-slate-950/60 border-slate-800 text-slate-500' : 'bg-slate-50/60 border-slate-100 text-slate-400'
                }`}
              >
                <span>↑↓ Navigate • ↵ / Tab Select</span>
                <span>Esc to dismiss</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
