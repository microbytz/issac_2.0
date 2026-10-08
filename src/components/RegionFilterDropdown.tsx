import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, ChevronDown, Check, Search, X } from 'lucide-react';
import { SEARCH_REGIONS, SearchRegion, getRegionByCode } from '../utils/duckRegions';

interface RegionFilterDropdownProps {
  selectedRegion: string;
  onSelectRegion: (code: string) => void;
  isLight: boolean;
}

export const RegionFilterDropdown: React.FC<RegionFilterDropdownProps> = ({
  selectedRegion,
  onSelectRegion,
  isLight
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeRegion = getRegionByCode(selectedRegion);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filteredRegions = SEARCH_REGIONS.filter(r => {
    if (!search.trim()) return true;
    const clean = search.toLowerCase().trim();
    return r.name.toLowerCase().includes(clean) || r.code.toLowerCase().includes(clean);
  });

  return (
    <div ref={dropdownRef} className="relative inline-block text-left select-none">
      {/* Trigger Button: DuckDuckGo-style compact pill */}
      <button
        id="region-filter-dropdown-btn"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={`Region Filter: currently set to ${activeRegion.name}`}
        className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer active:scale-95 shrink-0 ${
          selectedRegion !== 'all'
            ? isLight
              ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 shadow-sm'
              : 'bg-blue-950/40 border-blue-500/50 text-blue-300 hover:bg-blue-900/50 shadow-sm'
            : isLight
              ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400'
              : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
        }`}
      >
        <span className="text-sm leading-none">{activeRegion.flag}</span>
        <span className="font-semibold truncate max-w-[110px] sm:max-w-none">
          {activeRegion.name}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={`absolute right-0 sm:left-0 sm:right-auto mt-2 w-64 rounded-2xl shadow-2xl border overflow-hidden z-50 ${
              isLight
                ? 'bg-white border-slate-200 text-slate-800'
                : 'bg-[#070e24] border-slate-800 text-slate-100'
            }`}
          >
            {/* Header / Search box */}
            <div className={`p-2.5 border-b ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
            }`}>
              <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border ${
                isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
              }`}>
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Filter country / region..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  className="w-full bg-transparent border-none text-xs outline-none placeholder:text-slate-500"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-200">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Country List */}
            <div className="max-h-60 overflow-y-auto p-1.5 flex flex-col gap-0.5">
              {filteredRegions.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500">
                  No matching region found
                </div>
              ) : (
                filteredRegions.map((region) => {
                  const isSelected = selectedRegion === region.code;
                  return (
                    <button
                      key={region.code}
                      type="button"
                      onClick={() => {
                        onSelectRegion(region.code);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer text-left ${
                        isSelected
                          ? isLight
                            ? 'bg-blue-50 text-blue-700 font-bold'
                            : 'bg-blue-950/60 text-blue-300 font-bold'
                          : isLight
                            ? 'hover:bg-slate-100 text-slate-700'
                            : 'hover:bg-slate-900/70 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base leading-none">{region.flag}</span>
                        <span className="truncate">{region.name}</span>
                        {region.code === 'all' && (
                          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                            isLight ? 'bg-slate-100 text-slate-500' : 'bg-slate-800 text-slate-400'
                          }`}>
                            Global
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 text-blue-500 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer tip */}
            <div className={`p-2 border-t text-[10px] text-center font-mono ${
              isLight ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-slate-950/80 text-slate-400 border-slate-800'
            }`}>
              Regional index boosts local domains & sources
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RegionFilterDropdown;
