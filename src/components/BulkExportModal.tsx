import React, { useState, useMemo } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileJson,
  Download,
  Copy,
  Check,
  X,
  FileText,
  Sliders,
  Database,
  Globe,
  Tag,
  Clock,
  ExternalLink,
  Sparkles,
  Layers,
  FileCode,
  ShieldCheck,
  CheckSquare,
  Square
} from 'lucide-react';
import {
  SearchCollection,
  BulkExportOptions,
  generateCollectionJsonArchive,
  downloadCollectionJsonArchive,
  extractDomain
} from '../utils/collectionExport';

interface BulkExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: SearchCollection | null;
  selectedPageIds?: string[];
  onTogglePageSelect?: (pageId: string) => void;
  onSelectAllPages?: () => void;
  onClearPageSelection?: () => void;
  isLight?: boolean;
  onNotify?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const BulkExportModal: React.FC<BulkExportModalProps> = ({
  isOpen,
  onClose,
  folder,
  selectedPageIds = [],
  onTogglePageSelect,
  onSelectAllPages,
  onClearPageSelection,
  isLight = false,
  onNotify
}) => {
  const focusTrapRef = useFocusTrap<HTMLDivElement>();
  const [activeTab, setActiveTab] = useState<'configure' | 'bookmarks' | 'preview'>('configure');
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Export options state
  const [options, setOptions] = useState<BulkExportOptions>({
    includeContent: true,
    includeNotes: true,
    includeMetadata: true,
    includeAnalytics: true,
    prettyPrint: true
  });

  // Scope: 'all' or 'selected'
  const [exportScope, setExportScope] = useState<'all' | 'selected'>(
    selectedPageIds.length > 0 ? 'selected' : 'all'
  );

  const effectivePageIds = useMemo(() => {
    if (!folder) return [];
    if (exportScope === 'selected' && selectedPageIds.length > 0) {
      return selectedPageIds;
    }
    return (folder.pages || []).map(p => p.id);
  }, [folder, exportScope, selectedPageIds]);

  const archiveResult = useMemo(() => {
    if (!folder) return null;
    return generateCollectionJsonArchive(folder, options, effectivePageIds);
  }, [folder, options, effectivePageIds]);

  const [customFilename, setCustomFilename] = useState<string>('');

  // Update default filename whenever archiveResult changes if user hasn't typed a custom one
  const displayFilename = customFilename.trim() || archiveResult?.filename || 'collection_archive.json';

  if (!isOpen || !folder) return null;

  const totalPagesInFolder = folder.pages?.length || 0;
  const isSelectedScopeActive = exportScope === 'selected';

  const handleDownload = () => {
    setIsDownloading(true);
    try {
      const result = downloadCollectionJsonArchive(
        folder,
        options,
        effectivePageIds,
        customFilename.trim() || undefined
      );

      if (result.success) {
        if (onNotify) {
          onNotify(`Successfully saved "${result.filename}" with ${result.count} bookmarks!`, 'success');
        }
        setTimeout(() => {
          onClose();
        }, 300);
      } else {
        if (onNotify) {
          onNotify('Failed to generate and download JSON archive', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      if (onNotify) {
        onNotify('Error creating research export', 'error');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyJson = async () => {
    if (!archiveResult) return;
    try {
      await navigator.clipboard.writeText(archiveResult.jsonString);
      setIsCopied(true);
      if (onNotify) {
        onNotify('JSON archive copied to clipboard!', 'success');
      }
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy JSON:', err);
      if (onNotify) {
        onNotify('Could not copy JSON to clipboard', 'error');
      }
    }
  };

  return (
    <AnimatePresence>
      <div ref={focusTrapRef} role="dialog" aria-modal="true" aria-label="Export collection" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={`w-full max-w-3xl rounded-3xl border shadow-2xl flex flex-col overflow-hidden max-h-[90vh] my-auto ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900 shadow-blue-500/10'
              : 'bg-[#060919] border-slate-800 text-slate-100 shadow-[0_0_50px_rgba(0,0,0,0.8)]'
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-export-title"
        >
          {/* Header */}
          <div
            className={`p-4 sm:p-5 border-b flex items-center justify-between gap-3 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#080d22] border-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 shrink-0">
                <FileJson className="w-5 h-5 text-blue-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 id="bulk-export-title" className="text-base sm:text-lg font-bold font-sans truncate">
                    Bulk Export Research Archive
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/15 border border-blue-500/30 text-blue-400">
                    JSON Archive
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-sans truncate mt-0.5">
                  Folder: <strong className={isLight ? 'text-slate-800' : 'text-slate-200'}>{folder.name}</strong> •{' '}
                  {effectivePageIds.length} {effectivePageIds.length === 1 ? 'item' : 'items'} targeted
                </p>
              </div>
            </div>

            <button
              type="button"
              id="bulk-export-modal-close-btn"
              onClick={onClose}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isLight
                  ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="Close modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Sub-Tabs */}
          <div
            className={`flex items-center gap-2 px-4 sm:px-6 pt-3 border-b text-xs font-mono font-bold select-none ${
              isLight ? 'bg-slate-100/60 border-slate-200' : 'bg-[#040714] border-slate-800/60'
            }`}
          >
            <button
              type="button"
              id="bulk-export-tab-configure"
              onClick={() => setActiveTab('configure')}
              className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'configure'
                  ? 'border-blue-500 text-blue-400'
                  : isLight
                  ? 'border-transparent text-slate-500 hover:text-slate-800'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Configure & Options</span>
            </button>

            <button
              type="button"
              id="bulk-export-tab-bookmarks"
              onClick={() => setActiveTab('bookmarks')}
              className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'bookmarks'
                  ? 'border-blue-500 text-blue-400'
                  : isLight
                  ? 'border-transparent text-slate-500 hover:text-slate-800'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Included Items ({effectivePageIds.length})</span>
            </button>

            <button
              type="button"
              id="bulk-export-tab-preview"
              onClick={() => setActiveTab('preview')}
              className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'preview'
                  ? 'border-blue-500 text-blue-400'
                  : isLight
                  ? 'border-transparent text-slate-500 hover:text-slate-800'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>JSON Schema Preview</span>
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-5 text-sans">
            {/* TAB 1: CONFIGURE & OPTIONS */}
            {activeTab === 'configure' && (
              <div className="flex flex-col gap-5 animate-fade-in">
                {/* Scope Selection Box */}
                <div
                  className={`p-4 rounded-2xl border flex flex-col gap-3 ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#030612] border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider font-mono text-slate-400">
                      Export Target Scope
                    </span>
                    <span className="text-[11px] font-mono text-blue-400">
                      {effectivePageIds.length} of {totalPagesInFolder} selected
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-sans">
                    <button
                      type="button"
                      onClick={() => setExportScope('all')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                        exportScope === 'all'
                          ? 'border-blue-500 bg-blue-500/10 text-white shadow-sm'
                          : isLight
                          ? 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                          : 'border-slate-800 bg-[#070c20] hover:bg-[#0a102c] text-slate-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                          exportScope === 'all' ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-600'
                        }`}
                      >
                        {exportScope === 'all' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold">All Bookmarks in Folder</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Archive all {totalPagesInFolder} saved research pages in "{folder.name}"
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={selectedPageIds.length === 0}
                      onClick={() => setExportScope('selected')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                        selectedPageIds.length === 0
                          ? 'opacity-40 cursor-not-allowed border-slate-800/40 bg-transparent text-slate-600'
                          : exportScope === 'selected'
                          ? 'border-blue-500 bg-blue-500/10 text-white shadow-sm cursor-pointer'
                          : isLight
                          ? 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer'
                          : 'border-slate-800 bg-[#070c20] hover:bg-[#0a102c] text-slate-300 cursor-pointer'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                          exportScope === 'selected' ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-600'
                        }`}
                      >
                        {exportScope === 'selected' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold">
                          Selected Bookmarks Only ({selectedPageIds.length})
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {selectedPageIds.length > 0
                            ? `Archive only the ${selectedPageIds.length} checked bookmarks`
                            : 'Select checkboxes on bookmarks first'}
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Key Research Archive Metrics */}
                {archiveResult && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div
                      className={`p-3 rounded-2xl border font-mono flex flex-col gap-1 ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#030612] border-slate-800/80'
                      }`}
                    >
                      <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                        <Layers className="w-3 h-3 text-blue-400" /> Bookmarks
                      </span>
                      <span className="text-base font-extrabold text-blue-400">
                        {archiveResult.stats.totalBookmarks}
                      </span>
                    </div>

                    <div
                      className={`p-3 rounded-2xl border font-mono flex flex-col gap-1 ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#030612] border-slate-800/80'
                      }`}
                    >
                      <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                        <Globe className="w-3 h-3 text-emerald-400" /> Domains
                      </span>
                      <span className="text-base font-extrabold text-emerald-400">
                        {archiveResult.stats.uniqueDomains.length}
                      </span>
                    </div>

                    <div
                      className={`p-3 rounded-2xl border font-mono flex flex-col gap-1 ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#030612] border-slate-800/80'
                      }`}
                    >
                      <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                        <Tag className="w-3 h-3 text-zinc-300" /> Tags
                      </span>
                      <span className="text-base font-extrabold text-zinc-300">
                        {archiveResult.stats.uniqueTags.length}
                      </span>
                    </div>

                    <div
                      className={`p-3 rounded-2xl border font-mono flex flex-col gap-1 ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#030612] border-slate-800/80'
                      }`}
                    >
                      <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" /> Est. Reading
                      </span>
                      <span className="text-base font-extrabold text-amber-400">
                        ~{archiveResult.stats.estimatedReadingTimeMin} min
                      </span>
                    </div>
                  </div>
                )}

                {/* Export Options Checklist */}
                <div
                  className={`p-4 sm:p-5 rounded-2xl border flex flex-col gap-3.5 ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#030612] border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between border-b pb-2.5 border-slate-800/60">
                    <span className="text-xs font-bold uppercase tracking-wider font-mono text-slate-400 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-blue-400" />
                      Archive Content & Metadata Toggles
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Customizable Payload</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Toggle: Include Content */}
                    <label className="flex items-start gap-2.5 cursor-pointer select-none p-2 rounded-xl hover:bg-slate-800/20 transition-colors">
                      <input
                        type="checkbox"
                        checked={options.includeContent}
                        onChange={(e) => setOptions(prev => ({ ...prev, includeContent: e.target.checked }))}
                        className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-700 bg-slate-900"
                       aria-label="Include page content" />
                      <div>
                        <span className="font-bold block text-slate-200">Full Text & Cached Content</span>
                        <span className="text-[10px] text-slate-400 block leading-tight">
                          Include scraped body text and long snippets for offline reading
                        </span>
                      </div>
                    </label>

                    {/* Toggle: Include Notes */}
                    <label className="flex items-start gap-2.5 cursor-pointer select-none p-2 rounded-xl hover:bg-slate-800/20 transition-colors">
                      <input
                        type="checkbox"
                        checked={options.includeNotes}
                        onChange={(e) => setOptions(prev => ({ ...prev, includeNotes: e.target.checked }))}
                        className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-700 bg-slate-900"
                       aria-label="Include notes" />
                      <div>
                        <span className="font-bold block text-slate-200">Folder Research Notes</span>
                        <span className="text-[10px] text-slate-400 block leading-tight">
                          Include your scratchpad takeaways and synthesized notes
                        </span>
                      </div>
                    </label>

                    {/* Toggle: Include Metadata */}
                    <label className="flex items-start gap-2.5 cursor-pointer select-none p-2 rounded-xl hover:bg-slate-800/20 transition-colors">
                      <input
                        type="checkbox"
                        checked={options.includeMetadata}
                        onChange={(e) => setOptions(prev => ({ ...prev, includeMetadata: e.target.checked }))}
                        className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-700 bg-slate-900"
                       aria-label="Include metadata" />
                      <div>
                        <span className="font-bold block text-slate-200">Meta Tags, SEO & Keywords</span>
                        <span className="text-[10px] text-slate-400 block leading-tight">
                          Preserve page authors, tags, keywords, and description tags
                        </span>
                      </div>
                    </label>

                    {/* Toggle: Include Analytics */}
                    <label className="flex items-start gap-2.5 cursor-pointer select-none p-2 rounded-xl hover:bg-slate-800/20 transition-colors">
                      <input
                        type="checkbox"
                        checked={options.includeAnalytics}
                        onChange={(e) => setOptions(prev => ({ ...prev, includeAnalytics: e.target.checked }))}
                        className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-700 bg-slate-900"
                       aria-label="Include analytics" />
                      <div>
                        <span className="font-bold block text-slate-200">Research Analytics Summary</span>
                        <span className="text-[10px] text-slate-400 block leading-tight">
                          Embed domain breakdown, backlinks tally, and word metrics
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Custom File Name Input */}
                <div
                  className={`p-4 rounded-2xl border flex flex-col gap-2 ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#030612] border-slate-800/80'
                  }`}
                >
                  <label className="text-xs font-bold text-slate-400 font-mono">
                    Output File Name (Saved to Local Downloads)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      id="bulk-export-custom-filename-input"
                      value={customFilename}
                      placeholder={archiveResult?.filename || 'my_collection_archive.json'}
                      onChange={(e) => setCustomFilename(e.target.value)}
                      className={`flex-1 p-2.5 px-3 rounded-xl border text-xs font-mono outline-none transition-all ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                          : 'bg-[#060a1e] border-slate-800 text-slate-200 focus:border-blue-500'
                      }`}
                     aria-label="Custom filename" />
                    <button
                      type="button"
                      onClick={() => setCustomFilename('')}
                      className="px-3 py-2 text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors"
                      title="Reset to default naming"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: INCLUDED BOOKMARKS LIST */}
            {activeTab === 'bookmarks' && (
              <div className="flex flex-col gap-3 animate-fade-in">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-1">
                  <span>
                    Viewing {effectivePageIds.length} of {totalPagesInFolder} bookmarks
                  </span>
                  <div className="flex items-center gap-2">
                    {onSelectAllPages && (
                      <button
                        type="button"
                        onClick={onSelectAllPages}
                        className="text-blue-400 hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                    )}
                    {onClearPageSelection && selectedPageIds.length > 0 && (
                      <button
                        type="button"
                        onClick={onClearPageSelection}
                        className="text-slate-400 hover:underline cursor-pointer"
                      >
                        Clear Selection
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
                  {(folder.pages || []).map((page, index) => {
                    const isSelected = effectivePageIds.includes(page.id);
                    const domain = extractDomain(page.url);

                    return (
                      <div
                        key={page.id}
                        onClick={() => onTogglePageSelect && onTogglePageSelect(page.id)}
                        className={`p-3 rounded-xl border flex items-start gap-3 transition-all cursor-pointer ${
                          isSelected
                            ? isLight
                              ? 'border-blue-300 bg-blue-50/70 text-slate-900'
                              : 'border-blue-500/40 bg-blue-950/20 text-slate-200'
                            : isLight
                            ? 'border-slate-200 bg-slate-50 opacity-60 text-slate-500'
                            : 'border-slate-800/60 bg-[#030612] opacity-50 text-slate-400'
                        }`}
                      >
                        <div className="pt-0.5 shrink-0 text-blue-400">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-bold truncate font-sans">{page.title || 'Untitled Page'}</h4>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 shrink-0">
                              #{index + 1}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-blue-400/90 font-mono mt-0.5 truncate">
                            <span>{domain}</span>
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-400 truncate">{page.url}</span>
                          </div>

                          {page.snippet && (
                            <p className="text-[11px] text-slate-400 line-clamp-1 mt-1 font-sans">
                              {page.snippet}
                            </p>
                          )}

                          {page.tags && page.tags.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap mt-1.5">
                              {page.tags.slice(0, 4).map(tag => (
                                <span
                                  key={tag}
                                  className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-900/60 border border-slate-800 text-slate-400"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {(folder.pages || []).length === 0 && (
                    <div className="text-center py-10 text-slate-500 font-sans text-xs">
                      This folder contains no bookmarked pages to export.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: LIVE JSON SCHEMA PREVIEW */}
            {activeTab === 'preview' && (
              <div className="flex flex-col gap-3 animate-fade-in">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Live Serialized JSON Output</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? 'Copied to Clipboard!' : 'Copy Preview'}</span>
                  </button>
                </div>

                <div
                  className={`p-4 rounded-2xl border font-mono text-[11px] leading-relaxed max-h-[380px] overflow-auto select-all ${
                    isLight
                      ? 'bg-slate-50 text-emerald-800 border-slate-200'
                      : 'bg-[#02040b] text-emerald-300 border-slate-800/90'
                  }`}
                >
                  <pre className="whitespace-pre-wrap break-all">
                    {archiveResult?.jsonString || '// Generating JSON archive...'}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div
            className={`p-4 sm:p-5 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#080d22] border-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 self-start sm:self-auto">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Offline Local Export • No server upload required</span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end font-sans">
              <button
                type="button"
                id="copy-bulk-json-btn"
                onClick={handleCopyJson}
                className={`px-3.5 py-2 rounded-xl border text-xs font-bold font-mono flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                  isLight
                    ? 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700'
                    : 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white'
                }`}
                title="Copy entire JSON archive directly to clipboard"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
                <span>{isCopied ? 'Copied!' : 'Copy JSON'}</span>
              </button>

              <button
                type="button"
                id="confirm-bulk-export-btn"
                disabled={isDownloading || effectivePageIds.length === 0}
                onClick={handleDownload}
                className={`px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-lg active:scale-95 ${
                  effectivePageIds.length === 0
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25'
                }`}
                title={`Download ${effectivePageIds.length} bookmarks as JSON archive`}
              >
                <Download className="w-4 h-4" />
                <span>
                  {isDownloading
                    ? 'Exporting...'
                    : `Download JSON Archive (${effectivePageIds.length})`}
                </span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BulkExportModal;
