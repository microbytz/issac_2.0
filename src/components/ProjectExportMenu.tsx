import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download,
  FileDown,
  FileText,
  FileCode,
  Copy,
  Check,
  ChevronDown,
  X,
  ExternalLink,
  Table,
  CheckSquare,
  BookOpen,
  Sparkles,
  Eye,
  Folder
} from 'lucide-react';
import {
  ResearchProject,
  ProjectExportStats,
  calculateProjectExportStats,
  generateProjectMarkdown,
  generateProjectReferencesCsv,
  generateProjectTasksCsv,
  generateFullProjectCsv,
  downloadProjectMarkdown,
  downloadProjectReferencesCsv,
  downloadProjectTasksCsv,
  downloadFullProjectCsv,
  copyProjectMarkdown,
  getAllProjectPages
} from '../utils/projectExport';
import { SearchCollection } from '../utils/collectionExport';

interface ProjectExportMenuProps {
  project: ResearchProject;
  linkedCols: SearchCollection[];
  onExportPdf?: () => void;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
  variant?: 'button' | 'icon';
}

export const ProjectExportMenu: React.FC<ProjectExportMenuProps> = ({
  project,
  linkedCols,
  onExportPdf,
  onNotify,
  variant = 'button'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewTab, setPreviewTab] = useState<'markdown' | 'references_csv' | 'tasks_csv' | 'full_csv'>('markdown');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setShowPreviewModal(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const stats: ProjectExportStats = useMemo(() => {
    return calculateProjectExportStats(project, linkedCols);
  }, [project, linkedCols]);

  const handleCopyMarkdown = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const success = await copyProjectMarkdown(project, linkedCols);
    if (success) {
      setCopiedKey('markdown');
      onNotify('Project Markdown copied to clipboard!', 'success');
      setTimeout(() => setCopiedKey(null), 2500);
    } else {
      onNotify('Could not copy to clipboard. Please check browser permissions.', 'error');
    }
  };

  const handleDownloadMarkdown = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const filename = downloadProjectMarkdown(project, linkedCols);
      onNotify(`Downloaded Markdown document (${filename})`, 'success');
      setIsOpen(false);
    } catch (err) {
      console.error(err);
      onNotify('Failed to generate Markdown export.', 'error');
    }
  };

  const handleDownloadReferencesCsv = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const filename = downloadProjectReferencesCsv(project, linkedCols);
      onNotify(`Downloaded Reference Catalog CSV (${filename})`, 'success');
      setIsOpen(false);
    } catch (err) {
      console.error(err);
      onNotify('Failed to generate References CSV export.', 'error');
    }
  };

  const handleDownloadTasksCsv = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const filename = downloadProjectTasksCsv(project);
      onNotify(`Downloaded Tasks Checklist CSV (${filename})`, 'success');
      setIsOpen(false);
    } catch (err) {
      console.error(err);
      onNotify('Failed to generate Tasks CSV export.', 'error');
    }
  };

  const handleDownloadFullCsv = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const filename = downloadFullProjectCsv(project, linkedCols);
      onNotify(`Downloaded Full Project Archive CSV (${filename})`, 'success');
      setIsOpen(false);
    } catch (err) {
      console.error(err);
      onNotify('Failed to generate Full Project CSV export.', 'error');
    }
  };

  // Preview content based on active preview tab
  const previewContent = useMemo(() => {
    if (!showPreviewModal) return '';
    switch (previewTab) {
      case 'markdown':
        return generateProjectMarkdown(project, linkedCols);
      case 'references_csv':
        return generateProjectReferencesCsv(project, linkedCols);
      case 'tasks_csv':
        return generateProjectTasksCsv(project);
      case 'full_csv':
        return generateFullProjectCsv(project, linkedCols);
      default:
        return '';
    }
  }, [showPreviewModal, previewTab, project, linkedCols]);

  const handleCopyCurrentPreview = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(previewContent);
        setCopiedKey(previewTab);
        onNotify(`Copied ${previewTab.replace('_', ' ').toUpperCase()} to clipboard!`, 'success');
        setTimeout(() => setCopiedKey(null), 2500);
      }
    } catch {
      onNotify('Failed to copy to clipboard.', 'error');
    }
  };

  const handleDownloadCurrentPreview = () => {
    switch (previewTab) {
      case 'markdown':
        handleDownloadMarkdown();
        break;
      case 'references_csv':
        handleDownloadReferencesCsv();
        break;
      case 'tasks_csv':
        handleDownloadTasksCsv();
        break;
      case 'full_csv':
        handleDownloadFullCsv();
        break;
    }
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Trigger Button */}
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="p-1.5 text-slate-400 hover:text-blue-300 hover:bg-blue-600/20 border border-slate-800 hover:border-blue-500/40 rounded-xl transition-all cursor-pointer flex items-center justify-center"
          title="Export Project Data (CSV, Markdown, PDF)"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <FileDown className="w-4 h-4 text-blue-400" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/35 border border-blue-500/30 text-blue-300 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 shadow-sm font-sans select-none"
          title="Export Project Data to CSV, Markdown, or PDF"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <FileDown className="w-3.5 h-3.5 text-blue-400" />
          <span>Export</span>
          <ChevronDown className={`w-3 h-3 text-blue-300/80 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      )}

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-72 bg-[#091332] border border-slate-750 rounded-2xl shadow-2xl z-50 p-2 flex flex-col gap-1 font-sans text-left divide-y divide-slate-800/60"
            role="menu"
            aria-orientation="vertical"
          >
            {/* Header info badge */}
            <div className="px-3 py-2">
              <div className="text-[10px] font-mono font-extrabold uppercase text-blue-400 tracking-wider flex items-center justify-between">
                <span>Export Project Data</span>
                <span className="text-slate-500">{stats.totalReferences} sources</span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5 truncate font-bold">
                {project.name}
              </p>
            </div>

            {/* Markdown Formats Section */}
            <div className="pt-2 pb-1 flex flex-col gap-0.5">
              <span className="px-3 py-1 text-[9px] font-mono font-extrabold uppercase text-slate-400 flex items-center gap-1.5">
                <FileCode className="w-3 h-3 text-zinc-300" />
                <span>Markdown Format (.md)</span>
              </span>

              {/* Download Markdown */}
              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-white hover:bg-blue-600/20 transition-all cursor-pointer text-left group"
                role="menuitem"
              >
                <FileText className="w-4 h-4 text-zinc-300 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-sans">Export Markdown (.md)</span>
                    <span className="text-[9px] font-mono text-zinc-300 bg-zinc-800/80 border border-zinc-700/60 px-1 py-0.2 rounded">
                      .md
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-sans mt-0.5 leading-tight">
                    Comprehensive brief with notes, tasks & source catalog
                  </p>
                </div>
              </button>

              {/* Copy Markdown to Clipboard */}
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-blue-600/15 transition-all cursor-pointer text-left group text-xs"
                role="menuitem"
              >
                <div className="flex items-center gap-2">
                  {copiedKey === 'markdown' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-300" />
                  )}
                  <span className="font-sans font-medium text-[11px]">
                    {copiedKey === 'markdown' ? 'Copied to Clipboard!' : 'Copy Markdown to Clipboard'}
                  </span>
                </div>
                <span className="text-[9px] font-mono text-slate-500">Notion / Obsidian</span>
              </button>
            </div>

            {/* CSV Spreadsheets Section */}
            <div className="pt-2 pb-1 flex flex-col gap-0.5">
              <span className="px-3 py-1 text-[9px] font-mono font-extrabold uppercase text-slate-400 flex items-center gap-1.5">
                <Table className="w-3 h-3 text-emerald-400" />
                <span>CSV Spreadsheets (.csv)</span>
              </span>

              {/* Export References CSV */}
              <button
                type="button"
                onClick={handleDownloadReferencesCsv}
                className="w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-white hover:bg-blue-600/20 transition-all cursor-pointer text-left group"
                role="menuitem"
              >
                <BookOpen className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-sans">References Catalog (.csv)</span>
                    <span className="text-[9px] font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-800/40 px-1 py-0.2 rounded">
                      {stats.totalReferences} rows
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-sans mt-0.5 leading-tight">
                    URLs, canonical links, snippets, tags & metrics
                  </p>
                </div>
              </button>

              {/* Export Tasks CSV */}
              <button
                type="button"
                onClick={handleDownloadTasksCsv}
                className="w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-white hover:bg-blue-600/20 transition-all cursor-pointer text-left group"
                role="menuitem"
              >
                <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-sans">Tasks Checklist (.csv)</span>
                    <span className="text-[9px] font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-800/40 px-1 py-0.2 rounded">
                      {stats.totalTasks} tasks
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-sans mt-0.5 leading-tight">
                    Task IDs, descriptions and completion progress
                  </p>
                </div>
              </button>

              {/* Export Full Project Archive CSV */}
              <button
                type="button"
                onClick={handleDownloadFullCsv}
                className="w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-white hover:bg-blue-600/20 transition-all cursor-pointer text-left group"
                role="menuitem"
              >
                <Table className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-sans">Full Project Archive (.csv)</span>
                    <span className="text-[9px] font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-800/40 px-1 py-0.2 rounded">
                      All-in-One
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-sans mt-0.5 leading-tight">
                    Consolidated tabular overview, notes, tasks & pages
                  </p>
                </div>
              </button>
            </div>

            {/* Document PDF Option (preserved) */}
            {onExportPdf && (
              <div className="pt-2 pb-1 flex flex-col gap-0.5">
                <span className="px-3 py-1 text-[9px] font-mono font-extrabold uppercase text-slate-400 flex items-center gap-1.5">
                  <FileDown className="w-3 h-3 text-blue-400" />
                  <span>Document Format (.pdf)</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onExportPdf();
                  }}
                  className="w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-white hover:bg-blue-600/20 transition-all cursor-pointer text-left group"
                  role="menuitem"
                >
                  <FileDown className="w-4 h-4 text-blue-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold font-sans">Export PDF Document</span>
                      <span className="text-[9px] font-mono text-blue-300 bg-blue-950/60 border border-blue-800/40 px-1 py-0.2 rounded">
                        .pdf
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans mt-0.5 leading-tight">
                      Styled multi-page report for print & sharing
                    </p>
                  </div>
                </button>
              </div>
            )}

            {/* Preview & Customization Action */}
            <div className="pt-1.5">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setShowPreviewModal(true);
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-300 hover:text-white bg-blue-500/10 hover:bg-blue-600/30 rounded-xl transition-all cursor-pointer font-sans"
              >
                <Eye className="w-3.5 h-3.5 text-blue-400" />
                <span>Preview & Custom Export...</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Export & Code Preview Modal */}
      <AnimatePresence>
        {showPreviewModal && (
          <div role="dialog" aria-modal="true" aria-label="Export preview" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPreviewModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-[#091332] border border-slate-750 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-left z-10"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <FileDown className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-100 font-sans flex items-center gap-2">
                      Export Research Project
                    </h2>
                    <p className="text-xs text-slate-400 font-sans mt-0.5">
                      Export workspace data to Markdown or CSV formats for Obsidian, Notion, Excel, or data pipelines.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                  title="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Summary Pill Row */}
              <div className="px-6 py-2.5 bg-[#050b1e]/60 border-b border-slate-850 flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400">
                <span className="text-slate-300 font-bold font-sans">Project: {project.name}</span>
                <span className="text-slate-600">|</span>
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                  {stats.totalReferences} references
                </span>
                <span className="flex items-center gap-1">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                  {stats.completedTasks}/{stats.totalTasks} tasks ({stats.taskProgressPct}%)
                </span>
                <span className="flex items-center gap-1">
                  <Folder className="w-3.5 h-3.5 text-yellow-400" />
                  {stats.totalFolders} linked folders
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-zinc-300" />
                  {stats.notesWordCount} words in notebook
                </span>
              </div>

              {/* Format Switcher Tabs */}
              <div className="px-6 pt-4 pb-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex flex-wrap items-center gap-2 bg-[#040817] p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('markdown')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer font-sans ${
                      previewTab === 'markdown'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>Markdown Brief (.md)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewTab('references_csv')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer font-sans ${
                      previewTab === 'references_csv'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>References Catalog (.csv)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewTab('tasks_csv')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer font-sans ${
                      previewTab === 'tasks_csv'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Tasks Checklist (.csv)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewTab('full_csv')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer font-sans ${
                      previewTab === 'full_csv'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>Full Project Archive (.csv)</span>
                  </button>
                </div>

                {/* Quick actions for current preview */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCurrentPreview}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-all cursor-pointer font-sans"
                    title="Copy formatted text to clipboard"
                  >
                    {copiedKey === previewTab ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-300" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCurrentPreview}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow transition-all cursor-pointer font-sans"
                    title="Download file directly"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </button>
                </div>
              </div>

              {/* Code Preview Body */}
              <div className="flex-1 p-6 overflow-hidden flex flex-col">
                <div className="flex-1 bg-[#030614] border border-slate-800 rounded-2xl overflow-y-auto p-4 font-mono text-xs text-slate-300 leading-relaxed select-all whitespace-pre">
                  {previewContent || 'Generating export payload...'}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-[#050b1e]/90 border-t border-slate-800 flex items-center justify-between shrink-0">
                <span className="text-[11px] text-slate-500 font-sans">
                  Files are exported with UTF-8 encoding (and CSV includes BOM for Microsoft Excel & Google Sheets compatibility).
                </span>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer font-sans"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProjectExportMenu;
