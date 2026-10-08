import React, { useState, useMemo, useEffect } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { motion, AnimatePresence } from 'motion/react';
import {
  Tags,
  Tag,
  GitMerge,
  Edit2,
  Trash2,
  Search,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sliders,
  CheckSquare,
  Square,
  AlertCircle,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Layers,
  Database,
  Info,
  Filter
} from 'lucide-react';
import { PageItem } from '../utils/collectionExport';
import { TagAutocompleteInput } from './TagAutocompleteInput';

interface GlobalTagManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pages: PageItem[];
  onRenameTag: (oldTag: string, newTag: string) => void;
  onMergeTags: (sourceTags: string[], targetTag: string) => void;
  onDeleteTag: (tagToDelete: string) => void;
  onBatchDeleteTags?: (tagsToDelete: string[]) => void;
  onNormalizeAllTags?: () => void;
  onSelectTagInCatalog?: (tag: string) => void;
  isLight?: boolean;
  onNotify?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const GlobalTagManagerModal: React.FC<GlobalTagManagerModalProps> = ({
  isOpen,
  onClose,
  pages,
  onRenameTag,
  onMergeTags,
  onDeleteTag,
  onBatchDeleteTags,
  onNormalizeAllTags,
  onSelectTagInCatalog,
  isLight = false,
  onNotify
}) => {
  // Navigation tabs within modal
  const [activeTab, setActiveTab] = useState<'all' | 'merge' | 'rename' | 'tools'>('all');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'usage_desc' | 'usage_asc' | 'alpha_asc' | 'alpha_desc'>('usage_desc');
  const [filterType, setFilterType] = useState<'all' | 'multi' | 'single'>('all');

  // Selected tags for batch operations
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);

  // Expanded tag details (to view pages containing this tag)
  const [expandedTagNames, setExpandedTagNames] = useState<Set<string>>(new Set());

  // Inline Rename state for specific tag in the list
  const [inlineEditingTag, setInlineEditingTag] = useState<string | null>(null);
  const [inlineNewTagName, setInlineNewTagName] = useState('');

  // Merge Tab state
  const [mergeSourceTags, setMergeSourceTags] = useState<string[]>([]);
  const [mergeTargetMode, setMergeTargetMode] = useState<'existing' | 'new'>('existing');
  const [mergeTargetExisting, setMergeTargetExisting] = useState('');
  const [mergeTargetNew, setMergeTargetNew] = useState('');

  // Rename Tab state
  const [renameSourceTag, setRenameSourceTag] = useState('');
  const [renameNewTag, setRenameNewTag] = useState('');

  // Delete confirmation modal / prompt
  const [tagPendingDelete, setTagPendingDelete] = useState<string | null>(null);
  const [confirmBatchDeleteOpen, setConfirmBatchDeleteOpen] = useState(false);

  // Compute all unique tags and their pages mapping
  const { tagMap, uniqueTagsList, totalTaggedPages, untaggedPagesCount, totalTagInstances } = useMemo(() => {
    const map = new Map<string, { originalCased: string; count: number; pages: PageItem[] }>();
    let taggedCount = 0;
    let untaggedCount = 0;
    let instances = 0;

    pages.forEach(p => {
      const pTags = p.tags && Array.isArray(p.tags) ? p.tags : [];
      if (pTags.length > 0) {
        taggedCount++;
        // deduplicate tags per page for mapping
        const seenOnPage = new Set<string>();
        pTags.forEach(rawTag => {
          const clean = rawTag.trim();
          if (!clean) return;
          const lower = clean.toLowerCase();
          if (seenOnPage.has(lower)) return;
          seenOnPage.add(lower);
          instances++;

          const existing = map.get(lower);
          if (existing) {
            existing.count += 1;
            existing.pages.push(p);
          } else {
            map.set(lower, {
              originalCased: clean,
              count: 1,
              pages: [p]
            });
          }
        });
      } else {
        untaggedCount++;
      }
    });

    const list = Array.from(map.entries()).map(([key, data]) => ({
      key,
      name: data.originalCased,
      count: data.count,
      pages: data.pages
    }));

    return {
      tagMap: map,
      uniqueTagsList: list,
      totalTaggedPages: taggedCount,
      untaggedPagesCount: untaggedCount,
      totalTagInstances: instances
    };
  }, [pages]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        if (inlineEditingTag) {
          setInlineEditingTag(null);
        } else if (tagPendingDelete) {
          setTagPendingDelete(null);
        } else if (confirmBatchDeleteOpen) {
          setConfirmBatchDeleteOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, inlineEditingTag, tagPendingDelete, confirmBatchDeleteOpen, onClose]);

  // Filtered & Sorted Tags list
  const filteredTags = useMemo(() => {
    let result = uniqueTagsList;

    // Search query filter
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(item => item.name.toLowerCase().includes(q));
    }

    // Filter type (multi-page vs single-page)
    if (filterType === 'multi') {
      result = result.filter(item => item.count > 1);
    } else if (filterType === 'single') {
      result = result.filter(item => item.count === 1);
    }

    // Sorting
    return [...result].sort((a, b) => {
      if (sortBy === 'usage_desc') {
        const diff = b.count - a.count;
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      }
      if (sortBy === 'usage_asc') {
        const diff = a.count - b.count;
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      }
      if (sortBy === 'alpha_asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'alpha_desc') {
        return b.name.localeCompare(a.name);
      }
      return 0;
    });
  }, [uniqueTagsList, searchQuery, filterType, sortBy]);

  // Toggle tag selection
  const toggleSelectTag = (tagName: string) => {
    const lower = tagName.toLowerCase();
    setSelectedTagNames(prev =>
      prev.includes(lower) ? prev.filter(t => t !== lower) : [...prev, lower]
    );
  };

  const handleSelectAllFiltered = () => {
    const allFilteredKeys = filteredTags.map(t => t.key);
    const allSelected = allFilteredKeys.length > 0 && allFilteredKeys.every(k => selectedTagNames.includes(k));
    if (allSelected) {
      setSelectedTagNames(prev => prev.filter(k => !allFilteredKeys.includes(k)));
    } else {
      setSelectedTagNames(prev => Array.from(new Set([...prev, ...allFilteredKeys])));
    }
  };

  // Toggle page list accordion for a tag
  const toggleExpandTag = (tagKey: string) => {
    setExpandedTagNames(prev => {
      const next = new Set(prev);
      if (next.has(tagKey)) {
        next.delete(tagKey);
      } else {
        next.add(tagKey);
      }
      return next;
    });
  };

  // Start inline rename
  const handleStartInlineRename = (tagItem: { key: string; name: string }) => {
    setInlineEditingTag(tagItem.key);
    setInlineNewTagName(tagItem.name);
  };

  // Save inline rename
  const handleSaveInlineRename = (oldTagName: string) => {
    const cleanNew = inlineNewTagName.trim().replace(/^#+/, '');
    if (!cleanNew) {
      onNotify?.('Please provide a non-empty tag name', 'error');
      return;
    }
    if (cleanNew.toLowerCase() === oldTagName.toLowerCase()) {
      setInlineEditingTag(null);
      return;
    }

    onRenameTag(oldTagName, cleanNew);
    setInlineEditingTag(null);
    setInlineNewTagName('');
  };

  // Initiate batch merge with currently selected tags
  const handleStartMergeFromSelection = () => {
    if (selectedTagNames.length < 1) return;
    const sources = selectedTagNames.map(key => {
      const found = uniqueTagsList.find(t => t.key === key);
      return found ? found.name : key;
    });
    setMergeSourceTags(sources);
    if (sources.length > 0) {
      setMergeTargetExisting(sources[0]);
    }
    setActiveTab('merge');
  };

  // Initiate merge for a single tag row
  const handleStartMergeSingleTag = (tagItem: { name: string }) => {
    setMergeSourceTags([tagItem.name]);
    // pick first available different tag as target default
    const otherTag = uniqueTagsList.find(t => t.key !== tagItem.name.toLowerCase());
    if (otherTag) {
      setMergeTargetExisting(otherTag.name);
    } else {
      setMergeTargetMode('new');
      setMergeTargetNew('');
    }
    setActiveTab('merge');
  };

  // Execute Merge
  const handleExecuteMerge = () => {
    if (mergeSourceTags.length === 0) {
      onNotify?.('Please select at least one source tag to merge', 'error');
      return;
    }

    const targetTag = mergeTargetMode === 'existing' ? mergeTargetExisting.trim() : mergeTargetNew.trim();
    const cleanTarget = targetTag.replace(/^#+/, '');

    if (!cleanTarget) {
      onNotify?.('Please specify a target tag name to merge into', 'error');
      return;
    }

    onMergeTags(mergeSourceTags, cleanTarget);
    setSelectedTagNames([]);
    setMergeSourceTags([]);
    setMergeTargetNew('');
    setActiveTab('all');
  };

  // Execute Dedicated Rename
  const handleExecuteRename = () => {
    if (!renameSourceTag) {
      onNotify?.('Please choose an existing tag to rename', 'error');
      return;
    }
    const cleanNew = renameNewTag.trim().replace(/^#+/, '');
    if (!cleanNew) {
      onNotify?.('Please specify the new tag name', 'error');
      return;
    }
    if (cleanNew.toLowerCase() === renameSourceTag.toLowerCase()) {
      onNotify?.('The new tag name is identical to the current name', 'info');
      return;
    }

    onRenameTag(renameSourceTag, cleanNew);
    setRenameSourceTag('');
    setRenameNewTag('');
    setActiveTab('all');
  };

  // Execute Delete
  const handleConfirmDelete = () => {
    if (!tagPendingDelete) return;
    onDeleteTag(tagPendingDelete);
    setSelectedTagNames(prev => prev.filter(t => t !== tagPendingDelete.toLowerCase()));
    setTagPendingDelete(null);
  };

  // Execute Batch Delete
  const handleConfirmBatchDelete = () => {
    if (selectedTagNames.length === 0) return;
    const names = selectedTagNames.map(key => {
      const found = uniqueTagsList.find(t => t.key === key);
      return found ? found.name : key;
    });

    if (onBatchDeleteTags) {
      onBatchDeleteTags(names);
    } else {
      names.forEach(n => onDeleteTag(n));
    }

    setSelectedTagNames([]);
    setConfirmBatchDeleteOpen(false);
  };

  if (!isOpen) return null;

  const focusTrapRef = useFocusTrap<HTMLDivElement>();
  return (
    <div ref={focusTrapRef} role="dialog" aria-modal="true" aria-label="Manage tags" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 font-sans">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-200 z-10"
        role="dialog"
        aria-labelledby="global-tag-manager-title"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-950/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 shrink-0">
              <Tags className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="global-tag-manager-title" className="text-lg sm:text-xl font-bold text-white truncate font-sans">
                  Global Tag Manager
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  {uniqueTagsList.length} Unique Tags
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                Audit, rename, merge, and organize metadata tags across all indexed catalog pages simultaneously.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0"
            title="Close dialog (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 sm:px-6 bg-slate-950/60 border-b border-slate-800/80 font-mono text-xs">
          <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Unique Tags</span>
            <span className="text-sm font-bold text-blue-400">{uniqueTagsList.length}</span>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Tagged Pages</span>
            <span className="text-sm font-bold text-emerald-400">
              {totalTaggedPages} <span className="text-[10px] font-normal text-slate-500">/ {pages.length}</span>
            </span>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Untagged Pages</span>
            <span className="text-sm font-bold text-amber-400">{untaggedPagesCount}</span>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Total Instances</span>
            <span className="text-sm font-bold text-zinc-300">{totalTagInstances}</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 sm:px-6 pt-3 border-b border-slate-800 bg-slate-900/80 text-xs font-sans font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'all'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tags className="w-3.5 h-3.5" />
            <span>All Tags ({uniqueTagsList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (selectedTagNames.length > 0 && mergeSourceTags.length === 0) {
                const sources = selectedTagNames.map(key => {
                  const found = uniqueTagsList.find(t => t.key === key);
                  return found ? found.name : key;
                });
                setMergeSourceTags(sources);
                if (sources.length > 0) setMergeTargetExisting(sources[0]);
              }
              setActiveTab('merge');
            }}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'merge'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitMerge className="w-3.5 h-3.5" />
            <span>Batch Merge Tags</span>
            {selectedTagNames.length > 1 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {selectedTagNames.length} selected
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rename')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'rename'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Quick Rename Tag</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tools')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ml-auto ${
              activeTab === 'tools'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Cleanup Tools</span>
          </button>
        </div>

        {/* Tab 1: All Tags Browser & Overview */}
        {activeTab === 'all' && (
          <div className="flex-1 flex flex-col min-h-0 p-5 sm:p-6 gap-4 overflow-y-auto no-scrollbar">
            {/* Search & Sort Controls Toolbar */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search tags by keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40"
                 aria-label="Search tags by keyword" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5 rounded-md"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                    filterType === 'all'
                      ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  All ({uniqueTagsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('multi')}
                  className={`px-2.5 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                    filterType === 'multi'
                      ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  Multi-page (&gt;1)
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('single')}
                  className={`px-2.5 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                    filterType === 'single'
                      ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  Single (1)
                </button>
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto w-full sm:w-auto">
                <Sliders className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden sm:inline" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full sm:w-auto px-2.5 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                 aria-label="Sort tags">
                  <option value="usage_desc">Most Used Pages</option>
                  <option value="usage_asc">Least Used Pages</option>
                  <option value="alpha_asc">Alphabetical (A-Z)</option>
                  <option value="alpha_desc">Alphabetical (Z-A)</option>
                </select>
              </div>
            </div>

            {/* Batch Selection Action Bar (Appears when 1 or more tags selected) */}
            {selectedTagNames.length > 0 && (
              <div className="p-3 bg-blue-950/40 border border-blue-500/40 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-blue-500/20 text-blue-300">
                    <CheckSquare className="w-4 h-4" />
                  </span>
                  <span className="font-bold text-white">
                    {selectedTagNames.length} tag{selectedTagNames.length === 1 ? '' : 's'} selected
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    (Total{' '}
                    {uniqueTagsList
                      .filter(t => selectedTagNames.includes(t.key))
                      .reduce((acc, t) => acc + t.count, 0)}{' '}
                    page associations)
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {selectedTagNames.length >= 1 && (
                    <button
                      type="button"
                      onClick={handleStartMergeFromSelection}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-95"
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                      <span>Merge {selectedTagNames.length} Tag{selectedTagNames.length === 1 ? '' : 's'}...</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setConfirmBatchDeleteOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTagNames([])}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            )}

            {/* Tags Table / Cards Container */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono px-2">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="flex items-center gap-1.5 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {filteredTags.length > 0 && filteredTags.every(t => selectedTagNames.includes(t.key)) ? (
                    <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>Select All ({filteredTags.length})</span>
                </button>
                <span>Showing {filteredTags.length} of {uniqueTagsList.length} unique tags</span>
              </div>

              {filteredTags.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2">
                  <Tag className="w-8 h-8 text-slate-600" />
                  <p className="text-slate-400 font-medium">No matching tags found</p>
                  <p className="text-xs text-slate-600">Try adjusting your search query or filters.</p>
                </div>
              ) : (
                filteredTags.map((tagItem) => {
                  const isSelected = selectedTagNames.includes(tagItem.key);
                  const isExpanded = expandedTagNames.has(tagItem.key);
                  const isInlineEditing = inlineEditingTag === tagItem.key;

                  return (
                    <div
                      key={tagItem.key}
                      className={`border rounded-2xl transition-all ${
                        isSelected
                          ? 'bg-blue-950/20 border-blue-500/50 shadow-sm'
                          : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      {/* Main Row */}
                      <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {/* Selection Checkbox */}
                          <button
                            type="button"
                            onClick={() => toggleSelectTag(tagItem.name)}
                            className="text-slate-400 hover:text-blue-400 transition-colors p-0.5 cursor-pointer shrink-0"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600" />
                            )}
                          </button>

                          {/* Tag Name / Inline Edit */}
                          {isInlineEditing ? (
                            <div className="flex items-center gap-2 flex-1 max-w-md animate-fade-in">
                              <span className="text-blue-400 font-mono font-bold text-xs">#</span>
                              <TagAutocompleteInput
                                value={inlineNewTagName}
                                onChange={setInlineNewTagName}
                                autoFocus
                                theme={isLight ? 'light' : 'dark'}
                                multivalue={false}
                                existingTags={uniqueTagsList.map(t => ({ tag: t.name, count: t.count }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveInlineRename(tagItem.name);
                                  if (e.key === 'Escape') setInlineEditingTag(null);
                                }}
                                className="w-full px-2.5 py-1 bg-slate-900 border border-blue-500 rounded-lg text-xs text-white focus:outline-none font-mono"
                                containerClassName="flex-1"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveInlineRename(tagItem.name)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
                                title="Save new tag name"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setInlineEditingTag(null)}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors cursor-pointer shrink-0"
                                title="Cancel rename"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 font-mono font-bold text-xs">
                                <Tag className="w-3 h-3 text-blue-400" />
                                <span>#{tagItem.name}</span>
                              </span>

                              <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px]">
                                {tagItem.count} {tagItem.count === 1 ? 'page' : 'pages'}
                              </span>

                              {/* Accordion toggle to inspect pages */}
                              <button
                                type="button"
                                onClick={() => toggleExpandTag(tagItem.key)}
                                className="text-xs text-slate-400 hover:text-blue-300 transition-colors flex items-center gap-1 cursor-pointer font-sans"
                              >
                                <span>{isExpanded ? 'Hide pages' : 'View pages'}</span>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        {!isInlineEditing && (
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            {onSelectTagInCatalog && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectTagInCatalog(tagItem.name);
                                  onClose();
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                                title={`Filter crawler catalog by #${tagItem.name}`}
                              >
                                <Filter className="w-3 h-3 text-blue-400" />
                                <span className="hidden md:inline">Catalog</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleStartInlineRename(tagItem)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-blue-600/20 hover:text-blue-300 hover:border-blue-500/30 text-slate-300 border border-transparent text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                              title={`Rename #${tagItem.name} across all pages`}
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Rename</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleStartMergeSingleTag(tagItem)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-zinc-700/50 hover:text-zinc-200 hover:border-zinc-500/40 text-slate-300 border border-transparent text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                              title={`Merge #${tagItem.name} into another tag`}
                            >
                              <GitMerge className="w-3 h-3" />
                              <span>Merge</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setTagPendingDelete(tagItem.name)}
                              className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                              title={`Delete #${tagItem.name} from all pages`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Expandable Pages Drawer */}
                      {isExpanded && (
                        <div className="px-4 pb-3.5 pt-1 border-t border-slate-800/60 bg-slate-950/60 rounded-b-2xl animate-fade-in flex flex-col gap-2">
                          <span className="text-[11px] font-mono text-slate-400 uppercase font-bold tracking-wider">
                            Indexed Pages with #{tagItem.name} ({tagItem.pages.length}):
                          </span>
                          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto no-scrollbar">
                            {tagItem.pages.map(page => (
                              <div
                                key={page.id}
                                className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-start justify-between gap-3 text-xs"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-200 truncate">{page.title}</span>
                                    {page.language && (
                                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 shrink-0">
                                        {page.language}
                                      </span>
                                    )}
                                  </div>
                                  <a
                                    href={page.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] text-blue-400 hover:underline truncate block max-w-lg"
                                  >
                                    {page.url}
                                  </a>
                                </div>
                                <div className="flex items-center gap-1 flex-wrap shrink-0">
                                  {page.tags
                                    ?.filter(t => t.toLowerCase() !== tagItem.key)
                                    .slice(0, 3)
                                    .map(otherTag => (
                                      <span
                                        key={otherTag}
                                        className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400"
                                      >
                                        #{otherTag}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Dedicated Batch Merge Workspace */}
        {activeTab === 'merge' && (
          <div className="flex-1 p-5 sm:p-6 overflow-y-auto no-scrollbar flex flex-col gap-6">
            <div className="bg-blue-950/20 border border-blue-500/30 p-4 rounded-2xl flex items-start gap-3">
              <GitMerge className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <h4 className="font-bold text-white text-sm">Batch Merge Tags Across Pages</h4>
                <p className="text-slate-300 mt-0.5">
                  Combine redundant, synonymous, or misspelled tags into a single unified tag. All indexed pages
                  currently tagged with any of the source tags will have them replaced with the target tag,
                  automatically deduplicating identical tags.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Step 1: Source Tags to Merge */}
              <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-2xl flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-300 flex items-center gap-1.5">
                    <span>1. Source Tags to Merge</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 text-[10px]">
                      {mergeSourceTags.length}
                    </span>
                  </h3>
                  {mergeSourceTags.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setMergeSourceTags([])}
                      className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                {/* Selected Source Tag Chips */}
                <div className="flex flex-wrap gap-1.5 min-h-[50px] p-2 bg-slate-900 border border-slate-800 rounded-xl">
                  {mergeSourceTags.map(srcTag => (
                    <span
                      key={srcTag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/30 text-blue-200 border border-blue-500/40 text-xs font-mono font-bold"
                    >
                      <span>#{srcTag}</span>
                      <button
                        type="button"
                        onClick={() => setMergeSourceTags(prev => prev.filter(t => t !== srcTag))}
                        className="p-0.5 hover:bg-blue-500/30 rounded cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {mergeSourceTags.length === 0 && (
                    <span className="text-xs text-slate-500 italic p-1">
                      No source tags selected yet. Click tags below to add them.
                    </span>
                  )}
                </div>

                {/* Tag Quick Selector List */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] text-slate-400 font-mono">Available Tags:</span>
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto no-scrollbar p-1">
                    {uniqueTagsList.map(t => {
                      const isAdded = mergeSourceTags.some(s => s.toLowerCase() === t.key);
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => {
                            if (isAdded) {
                              setMergeSourceTags(prev => prev.filter(s => s.toLowerCase() !== t.key));
                            } else {
                              setMergeSourceTags(prev => [...prev, t.name]);
                            }
                          }}
                          className={`px-2 py-0.8 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                            isAdded
                              ? 'bg-blue-600 text-white border-blue-500'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                          }`}
                        >
                          #{t.name} ({t.count})
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Step 2: Destination Target Tag */}
              <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-2xl flex flex-col gap-4">
                <div className="border-b border-slate-800 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-300">
                    2. Destination Target Tag
                  </h3>
                </div>

                {/* Target Mode Toggle */}
                <div className="grid grid-cols-2 gap-2 text-xs font-bold font-sans">
                  <button
                    type="button"
                    onClick={() => setMergeTargetMode('existing')}
                    className={`py-2 px-3 rounded-xl border transition-colors cursor-pointer text-center ${
                      mergeTargetMode === 'existing'
                        ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Merge into Existing Tag
                  </button>
                  <button
                    type="button"
                    onClick={() => setMergeTargetMode('new')}
                    className={`py-2 px-3 rounded-xl border transition-colors cursor-pointer text-center ${
                      mergeTargetMode === 'new'
                        ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Create New Target Tag
                  </button>
                </div>

                {/* Form Controls */}
                {mergeTargetMode === 'existing' ? (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-slate-300">Select target tag:</label>
                    <select
                      value={mergeTargetExisting}
                      onChange={(e) => setMergeTargetExisting(e.target.value)}
                      className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer font-mono"
                     aria-label="Merge into existing tag">
                      {uniqueTagsList.map(t => (
                        <option key={t.key} value={t.name}>
                          #{t.name} ({t.count} pages currently)
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-slate-300">Enter new target tag name:</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 font-mono font-bold text-xs z-10 pointer-events-none">
                        #
                      </span>
                      <TagAutocompleteInput
                        value={mergeTargetNew}
                        onChange={setMergeTargetNew}
                        placeholder="e.g. machine-learning, typescript"
                        theme={isLight ? 'light' : 'dark'}
                        multivalue={false}
                        existingTags={uniqueTagsList.map(t => ({ tag: t.name, count: t.count }))}
                        className="w-full pl-7 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Merge Execution Summary Preview */}
                {(() => {
                  const targetClean = (mergeTargetMode === 'existing' ? mergeTargetExisting : mergeTargetNew).trim().replace(/^#+/, '');
                  const sourceKeys = mergeSourceTags.map(s => s.toLowerCase());
                  const affectedPages = pages.filter(p =>
                    p.tags && p.tags.some(t => sourceKeys.includes(t.toLowerCase().trim()))
                  );

                  return (
                    <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col gap-2 text-xs">
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Merge Summary Preview:</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-slate-300">
                          <strong>{mergeSourceTags.length}</strong> source tag(s)
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-blue-300 font-mono font-bold">
                          #{targetClean || 'target-tag'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Will update <strong className="text-white">{affectedPages.length}</strong> indexed page(s).
                      </p>

                      <button
                        type="button"
                        disabled={mergeSourceTags.length === 0 || !targetClean}
                        onClick={handleExecuteMerge}
                        className="mt-2 w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                      >
                        <GitMerge className="w-4 h-4" />
                        <span>Confirm &amp; Execute Tag Merge</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Dedicated Quick Rename Workspace */}
        {activeTab === 'rename' && (
          <div className="flex-1 p-5 sm:p-6 overflow-y-auto no-scrollbar flex flex-col gap-6 max-w-2xl mx-auto w-full">
            <div className="bg-blue-950/20 border border-blue-500/30 p-4 rounded-2xl flex items-start gap-3">
              <Edit2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <h4 className="font-bold text-white text-sm">Rename Tag Across All Pages</h4>
                <p className="text-slate-300 mt-0.5">
                  Change the name of an existing tag. All indexed pages with this tag will be updated simultaneously.
                </p>
              </div>
            </div>

            <div className="bg-slate-950/40 border border-slate-800 p-5 sm:p-6 rounded-2xl flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-300">1. Select Tag to Rename:</label>
                <select
                  value={renameSourceTag}
                  onChange={(e) => {
                    setRenameSourceTag(e.target.value);
                    setRenameNewTag(e.target.value);
                  }}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer font-mono"
                 aria-label="Tag to rename">
                  <option value="">-- Choose a tag to rename --</option>
                  {uniqueTagsList.map(t => (
                    <option key={t.key} value={t.name}>
                      #{t.name} ({t.count} page{t.count === 1 ? '' : 's'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-300">2. New Tag Name:</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 font-mono font-bold text-xs z-10 pointer-events-none">
                    #
                  </span>
                  <TagAutocompleteInput
                    value={renameNewTag}
                    onChange={setRenameNewTag}
                    placeholder="Enter new tag name..."
                    theme={isLight ? 'light' : 'dark'}
                    multivalue={false}
                    existingTags={uniqueTagsList.map(t => ({ tag: t.name, count: t.count }))}
                    className="w-full pl-7 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              {renameSourceTag && (
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs flex items-center justify-between">
                  <span className="text-slate-400">Pages that will be updated:</span>
                  <span className="font-bold text-blue-400 font-mono">
                    {tagMap.get(renameSourceTag.toLowerCase())?.count || 0} page(s)
                  </span>
                </div>
              )}

              <button
                type="button"
                disabled={!renameSourceTag || !renameNewTag.trim()}
                onClick={handleExecuteRename}
                className="mt-2 w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>Apply Tag Rename</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Cleanup Tools */}
        {activeTab === 'tools' && (
          <div className="flex-1 p-5 sm:p-6 overflow-y-auto no-scrollbar flex flex-col gap-6 max-w-2xl mx-auto w-full">
            <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white font-sans">Global Tag Formatting &amp; Standardization</h3>
              </div>

              <div className="flex flex-col gap-4 text-xs">
                {/* Lowercase Normalization */}
                <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-white">Normalize All Tags to Lowercase</h4>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Converts mixed-casing variations (e.g. <code className="text-blue-300">#React</code> vs{' '}
                      <code className="text-blue-300">#react</code>) into a single standard lowercase format,
                      automatically eliminating redundant duplicates.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (onNormalizeAllTags) {
                        onNormalizeAllTags();
                      }
                    }}
                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold rounded-xl shrink-0 transition-colors cursor-pointer"
                  >
                    Normalize Casing
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 sm:px-6 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Updates are persisted across the active catalog and all collection folders.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </motion.div>

      {/* Delete Single Tag Confirmation Modal */}
      {tagPendingDelete && (
        <div ref={focusTrapRef} role="dialog" aria-modal="true" aria-label="Delete tag" className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-red-500/40 p-5 rounded-2xl shadow-2xl flex flex-col gap-4 text-slate-200">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2 bg-red-500/20 rounded-xl">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-base">Delete Tag #{tagPendingDelete}?</h3>
            </div>
            <p className="text-xs text-slate-300">
              This will remove the tag <strong className="text-white font-mono">#{tagPendingDelete}</strong> from all{' '}
              <strong className="text-white">
                {tagMap.get(tagPendingDelete.toLowerCase())?.count || 0}
              </strong>{' '}
              indexed page(s). This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTagPendingDelete(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Delete Tag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {confirmBatchDeleteOpen && (
        <div ref={focusTrapRef} role="dialog" aria-modal="true" aria-label="Confirm batch delete" className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-red-500/40 p-5 rounded-2xl shadow-2xl flex flex-col gap-4 text-slate-200">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2 bg-red-500/20 rounded-xl">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-base">
                Delete {selectedTagNames.length} Selected Tags?
              </h3>
            </div>
            <p className="text-xs text-slate-300">
              This will remove all {selectedTagNames.length} selected tags across every indexed page in your catalog.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmBatchDeleteOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchDelete}
                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Confirm Batch Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalTagManagerModal;
