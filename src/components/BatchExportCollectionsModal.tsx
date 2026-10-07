import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Archive,
  Download,
  Copy,
  Check,
  X,
  Sliders,
  Database,
  Globe,
  Tag,
  Clock,
  CheckSquare,
  Square,
  FileCode,
  FolderArchive,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import {
  SearchCollection,
  BulkExportOptions,
  generateMasterCollectionsJsonArchive,
  downloadMasterCollectionsJsonArchive,
  extractDomain
} from '../utils/collectionExport';

interface BatchExportCollectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections: SearchCollection[];
  isLight?: boolean;
  onNotify?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const BatchExportCollectionsModal: React.FC<BatchExportCollectionsModalProps> = ({
  isOpen,
  onClose,
  collections,
  isLight = false,
  onNotify
}) => {
  const [activeTab, setActiveTab] = useState<'configure' | 'manifest' | 'preview'>('configure');
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Selected collection IDs to export (defaults to all collections)
  const [selectedColIds, setSelectedColIds] = useState<string[]>(() => collections.map(c => c.id));

  // If collections change, keep selection in sync
  React.useEffect(() => {
    if (collections.length > 0) {
      setSelectedColIds(prev => {
        const validIds = new Set(collections.map(c => c.id));
        const filtered = prev.filter(id => validIds.has(id));
        return filtered.length > 0 ? filtered : collections.map(c => c.id);
      });
    }
  }, [collections]);

  // Export options state
  const [options, setOptions] = useState<BulkExportOptions>({
    includeContent: true,
    includeNotes: true,
    includeMetadata: true,
    includeAnalytics: true,
    prettyPrint: true
  });

  const [customFilename, setCustomFilename] = useState<string>('');

  const toggleCollectionSelect = (colId: string) => {
    setSelectedColIds(prev =>
      prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId]
    );
  };

  const selectAllCollections = () => {
    setSelectedColIds(collections.map(c => c.id));
  };

  const deselectAllCollections = () => {
    setSelectedColIds([]);
  };

  const masterArchiveResult = useMemo(() => {
    if (!isOpen || collections.length === 0) return null;
    return generateMasterCollectionsJsonArchive(collections, options, selectedColIds);
  }, [isOpen, collections, options, selectedColIds]);

  if (!isOpen) return null;

  const displayFilename = customFilename.trim() || masterArchiveResult?.filename || 'isaac_master_collections_backup.json';
  const totalAvailableBookmarks = collections.reduce((sum, c) => sum + (c.pages?.length || 0), 0);
  const selectedCollections = collections.filter(c => selectedColIds.includes(c.id));
  const selectedBookmarksCount = selectedCollections.reduce((sum, c) => sum + (c.pages?.length || 0), 0);

  const handleDownload = () => {
    if (selectedColIds.length === 0) {
      if (onNotify) onNotify('Please select at least one collection to export.', 'info');
      return;
    }

    setIsDownloading(true);
    try {
      const result = downloadMasterCollectionsJsonArchive(
        collections,
        options,
        selectedColIds,
        customFilename.trim() || undefined
      );

      if (result.success) {
        if (onNotify) {
          onNotify(
            `Master backup exported successfully! (${result.collectionsCount} collections, ${result.totalBookmarks} bookmarks saved to ${result.filename})`,
            'success'
          );
        }
        setTimeout(() => {
          onClose();
        }, 350);
      } else {
        if (onNotify) onNotify('Failed to generate and download master collections JSON archive.', 'error');
      }
    } catch (err) {
      console.error(err);
      if (onNotify) onNotify('Error generating master collections JSON export.', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyJson = async () => {
    if (!masterArchiveResult?.jsonString) return;
    try {
      await navigator.clipboard.writeText(masterArchiveResult.jsonString);
      setIsCopied(true);
      if (onNotify) onNotify('Master backup JSON copied to clipboard!', 'success');
      setTimeout(() => setIsCopied(false), 2200);
    } catch {
      if (onNotify) onNotify('Failed to copy to clipboard', 'error');
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Batch export collections" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.2 }}
        className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden font-sans ${
          isLight
            ? 'bg-slate-50 border-slate-200 text-slate-900 shadow-slate-300'
            : 'bg-[#080f28] border-slate-800 text-slate-100 shadow-[0_25px_60px_rgba(0,0,0,0.8)]'
        }`}
      >
        {/* Header */}
        <div className={`p-5 sm:px-6 border-b flex items-start justify-between gap-4 ${isLight ? 'border-slate-200 bg-white/70' : 'border-slate-800/80 bg-[#091334]/80'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold">
                  Batch Export All Search Collections
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  Master JSON Backup
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate a unified master JSON archive of all existing search collections for backups and data migration.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-slate-800 text-slate-400'
            }`}
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Overview Metrics Strip */}
        <div className={`px-6 py-3 border-b grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono ${isLight ? 'bg-slate-100/70 border-slate-200' : 'bg-[#040817]/60 border-slate-800/60'}`}>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-sans font-semibold">Collections</span>
              <span className="font-bold text-slate-200">
                {selectedColIds.length} <span className="text-slate-500 font-normal">/ {collections.length}</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-sans font-semibold">Total Bookmarks</span>
              <span className="font-bold text-slate-200">
                {selectedBookmarksCount} <span className="text-slate-500 font-normal">pages</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-zinc-300 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-sans font-semibold">Unique Domains</span>
              <span className="font-bold text-slate-200">
                {masterArchiveResult?.stats.uniqueDomains.length || 0}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-sans font-semibold">Read Time (Est.)</span>
              <span className="font-bold text-slate-200">
                ~{masterArchiveResult?.stats.estimatedReadingTimeMin || 1} min
              </span>
            </div>
          </div>
        </div>

        {/* Modal Tabs */}
        <div className={`px-6 pt-3 border-b flex items-center gap-2 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800/80 bg-[#060c22]'}`}>
          <button
            type="button"
            onClick={() => setActiveTab('configure')}
            className={`pb-3 px-3 text-xs font-bold font-sans flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'configure'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Select Collections & Settings</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manifest')}
            className={`pb-3 px-3 text-xs font-bold font-sans flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'manifest'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Backup Manifest ({selectedColIds.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`pb-3 px-3 text-xs font-bold font-sans flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'preview'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Master JSON Preview</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* TAB 1: CONFIGURE */}
          {activeTab === 'configure' && (
            <div className="space-y-6">
              {/* Collection Selection Panel */}
              <div className={`p-4 rounded-2xl border ${isLight ? 'bg-white border-slate-200' : 'bg-[#040817]/60 border-slate-800/80'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/60 mb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-emerald-400 flex items-center gap-2">
                      <FolderArchive className="w-4 h-4" />
                      Collections to Include in Master Export
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Choose which collections to bundle into this master JSON backup.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <button
                      type="button"
                      onClick={selectAllCollections}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer text-[11px]"
                    >
                      Select All ({collections.length})
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllCollections}
                      className="px-2.5 py-1 bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-all cursor-pointer text-[11px]"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                  {collections.map(col => {
                    const isSelected = selectedColIds.includes(col.id);
                    const pagesCount = col.pages?.length || 0;
                    return (
                      <div
                        key={col.id}
                        onClick={() => toggleCollectionSelect(col.id)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-emerald-950/20 border-emerald-500/40 text-slate-100 shadow-sm'
                            : 'bg-[#020512]/40 border-slate-800/60 text-slate-400 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600 shrink-0" />
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold truncate">{col.name}</span>
                            <span className="text-[10px] text-slate-400 truncate">
                              {col.description || 'Categorized search folder'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                            isSelected
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                              : 'bg-slate-900 text-slate-500 border-slate-800'
                          }`}>
                            {pagesCount} {pagesCount === 1 ? 'bookmark' : 'bookmarks'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Export Field Options */}
              <div className={`p-4 rounded-2xl border ${isLight ? 'bg-white border-slate-200' : 'bg-[#040817]/60 border-slate-800/80'}`}>
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-emerald-400 flex items-center gap-2 mb-3">
                  <Sliders className="w-4 h-4" />
                  Master Archive Inclusions & Payload Settings
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Include Content */}
                  <label className="flex items-start gap-3 p-3 rounded-xl bg-[#020512]/40 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.includeContent}
                      onChange={(e) => setOptions(prev => ({ ...prev, includeContent: e.target.checked }))}
                      className="mt-0.5 rounded text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                     aria-label="Include page content" />
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-200">Include Extracted Page Content</span>
                      <span className="text-[11px] text-slate-400">Preserve full text content and cached snippets for offline search and analysis.</span>
                    </div>
                  </label>

                  {/* Include Notes */}
                  <label className="flex items-start gap-3 p-3 rounded-xl bg-[#020512]/40 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.includeNotes}
                      onChange={(e) => setOptions(prev => ({ ...prev, includeNotes: e.target.checked }))}
                      className="mt-0.5 rounded text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                     aria-label="Include notes" />
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-200">Include Collection Research Notes</span>
                      <span className="text-[11px] text-slate-400">Retain Markdown research notebooks, synthesis notes, and folder memos.</span>
                    </div>
                  </label>

                  {/* Include Metadata */}
                  <label className="flex items-start gap-3 p-3 rounded-xl bg-[#020512]/40 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.includeMetadata}
                      onChange={(e) => setOptions(prev => ({ ...prev, includeMetadata: e.target.checked }))}
                      className="mt-0.5 rounded text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                     aria-label="Include metadata" />
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-200">Include SEO, Tags & Author Metadata</span>
                      <span className="text-[11px] text-slate-400">Save custom category tags, language identifiers, authors, and canonical links.</span>
                    </div>
                  </label>

                  {/* Include Analytics */}
                  <label className="flex items-start gap-3 p-3 rounded-xl bg-[#020512]/40 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.includeAnalytics}
                      onChange={(e) => setOptions(prev => ({ ...prev, includeAnalytics: e.target.checked }))}
                      className="mt-0.5 rounded text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                     aria-label="Include analytics" />
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-200">Include Metrics & Backlink Analytics</span>
                      <span className="text-[11px] text-slate-400">Include PageRank estimates, upvotes, crawl timestamps, and domain frequencies.</span>
                    </div>
                  </label>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between flex-wrap gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={options.prettyPrint}
                      onChange={(e) => setOptions(prev => ({ ...prev, prettyPrint: e.target.checked }))}
                      className="rounded text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                     aria-label="Pretty print JSON" />
                    <span className="text-xs font-semibold text-slate-300">Format with readable indentation (2-space pretty-print)</span>
                  </label>

                  {/* Custom Filename */}
                  <div className="flex items-center gap-2 text-xs font-mono w-full sm:w-auto">
                    <span className="text-slate-400">Save as:</span>
                    <input
                      type="text"
                      value={customFilename}
                      onChange={(e) => setCustomFilename(e.target.value)}
                      placeholder={masterArchiveResult?.filename || 'isaac_master_collections_backup.json'}
                      className="bg-[#020512] border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 text-xs outline-none focus:border-emerald-500 transition-colors flex-1 sm:w-64"
                     aria-label="Custom filename" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MANIFEST */}
          {activeTab === 'manifest' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
                <span>Included Collections: <strong className="text-emerald-400">{selectedCollections.length}</strong></span>
                <span>Total Bookmarks: <strong className="text-blue-400">{selectedBookmarksCount}</strong></span>
              </div>

              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {selectedCollections.map((col, idx) => (
                  <div
                    key={col.id}
                    className={`p-4 rounded-2xl border ${isLight ? 'bg-white border-slate-200' : 'bg-[#040817]/60 border-slate-800/80'} flex flex-col gap-2`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <h4 className="text-sm font-bold text-slate-100">{col.name}</h4>
                      </div>
                      <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-800/40">
                        {col.pages?.length || 0} bookmarks
                      </span>
                    </div>

                    {col.description && (
                      <p className="text-xs text-slate-400">{col.description}</p>
                    )}

                    {/* Sample bookmarks */}
                    {col.pages && col.pages.length > 0 ? (
                      <div className="mt-2 space-y-1 bg-[#020512]/40 rounded-xl p-2.5 border border-slate-800/60">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-1">
                          Sample Pages:
                        </span>
                        {col.pages.slice(0, 3).map(page => (
                          <div key={page.id} className="text-xs text-slate-300 truncate flex items-center gap-2">
                            <span className="text-slate-600">•</span>
                            <span className="font-medium truncate">{page.title}</span>
                            <span className="text-[10px] font-mono text-slate-500">({extractDomain(page.url)})</span>
                          </div>
                        ))}
                        {col.pages.length > 3 && (
                          <span className="text-[10px] font-mono text-slate-500 block mt-1">
                            + {col.pages.length - 3} more bookmarks in this collection
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 italic mt-1">Folder contains no bookmarks yet.</span>
                    )}
                  </div>
                ))}

                {selectedCollections.length === 0 && (
                  <div className="p-8 text-center bg-[#040817]/40 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs">
                    No collections selected. Go to the "Select Collections & Settings" tab to select collections to export.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PREVIEW */}
          {activeTab === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">$schema:</span>
                  <span className="text-slate-300">master-collections-backup-v1.json</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Format: <strong className="text-blue-400">isaac_master_collections_backup</strong></span>
                </div>
              </div>

              <div className="relative">
                <pre className={`border font-mono text-[11px] p-4 rounded-2xl overflow-x-auto max-h-[380px] leading-relaxed select-all ${
                  isLight ? 'bg-slate-50 border-slate-200 text-emerald-800' : 'bg-[#020510] border-slate-800 text-emerald-300'
                }`}>
                  {masterArchiveResult?.jsonString || '// Generating master archive preview...'}
                </pre>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className={`absolute top-3 right-3 px-3 py-1.5 rounded-xl font-sans text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg border cursor-pointer ${
                    isLight
                      ? 'bg-white/95 hover:bg-slate-100 text-slate-700 border-slate-200'
                      : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700'
                  }`}
                  title="Copy formatted JSON to clipboard"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'Copied!' : 'Copy JSON'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 sm:px-6 border-t flex items-center justify-between gap-3 flex-wrap ${isLight ? 'border-slate-200 bg-white/70' : 'border-slate-800/80 bg-[#091334]/80'}`}>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <Info className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate max-w-xs sm:max-w-md">
              File: <strong className="text-slate-200 font-sans">{displayFilename}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isLight ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300'
              }`}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleCopyJson}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="Copy entire JSON to clipboard"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{isCopied ? 'Copied' : 'Copy JSON'}</span>
            </button>

            <button
              type="button"
              id="confirm-batch-export-json-btn"
              onClick={handleDownload}
              disabled={isDownloading || selectedColIds.length === 0}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50 border border-emerald-500/50 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>
                {isDownloading
                  ? 'Generating Backup...'
                  : `Export Master JSON (${selectedColIds.length} Collections)`}
              </span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default BatchExportCollectionsModal;
