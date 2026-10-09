import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  Upload,
  Link as LinkIcon,
  X,
  Search,
  Sparkles,
  Image as ImageIcon,
  Check,
  AlertCircle
} from 'lucide-react';

interface VisualSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPerformVisualSearch: (imageUrl: string, queryHint?: string) => void;
  isLight: boolean;
  onNotify?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const SAMPLE_PRESETS = [
  {
    title: 'James Webb Deep Space',
    url: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=600&auto=format&fit=crop',
    hint: 'galaxy universe space'
  },
  {
    title: 'Futuristic Microchip',
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop',
    hint: 'microchip semiconductor circuit'
  },
  {
    title: 'Neon Cyberpunk Architecture',
    url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop',
    hint: 'architecture skyscraper building'
  },
  {
    title: 'Robotics & AI Hand',
    url: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600&auto=format&fit=crop',
    hint: 'robotics technology robot'
  }
];

export const VisualSearchModal: React.FC<VisualSearchModalProps> = ({
  isOpen,
  onClose,
  onPerformVisualSearch,
  isLight,
  onNotify
}) => {
  const [imageInputUrl, setImageInputUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [searchHint, setSearchHint] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSelectFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      onNotify?.('Please select a valid image file (PNG, JPG, WebP, SVG).', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreviewUrl(result);
      // Derive a gentle hint from the filename
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
      setSearchHint(cleanName);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleUrlSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = imageInputUrl.trim();
    if (!clean) return;
    try {
      new URL(clean);
      setPreviewUrl(clean);
      // Infer query keywords from path
      const pathParts = clean.split('/').pop()?.split('?')[0] || '';
      const cleanPath = pathParts.replace(/[-_+]/g, ' ').replace(/\.[^.]+$/, '');
      if (cleanPath && !searchHint) {
        setSearchHint(cleanPath);
      }
    } catch {
      onNotify?.('Please enter a valid image URL starting with http:// or https://', 'error');
    }
  };

  const handleExecuteSearch = () => {
    if (!previewUrl) {
      onNotify?.('Please upload or provide an image URL first.', 'error');
      return;
    }
    onPerformVisualSearch(previewUrl, searchHint.trim());
    onClose();
  };

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reverse Image & Visual Search"
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className={`w-full max-w-xl rounded-2xl shadow-2xl border overflow-hidden transition-colors ${
            isLight
              ? 'bg-white border-slate-200 text-slate-800'
              : 'bg-[#080d1e] border-slate-800/90 text-slate-100 shadow-blue-950/20'
          }`}
        >
          {/* Header */}
          <div
            className={`px-6 py-5 border-b flex items-center justify-between ${
              isLight ? 'border-slate-200 bg-slate-50/80' : 'border-slate-800 bg-[#0c142b]/80'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl border ${
                  isLight
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                    : 'bg-indigo-950/60 border-indigo-800/60 text-indigo-400'
                }`}
              >
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold font-sans tracking-tight">Reverse Image & Visual Search</h2>
                <p className="text-xs text-slate-400">Search by image to find similar visuals, articles, and topic sources</p>
              </div>
            </div>

            <button
              onClick={onClose}
              type="button"
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isLight
                  ? 'hover:bg-slate-200/70 border-slate-200 text-slate-500 hover:text-slate-800'
                  : 'hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-slate-100'
              }`}
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto no-scrollbar">
            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : previewUrl
                  ? 'border-indigo-500/50 bg-indigo-950/20'
                  : isLight
                  ? 'border-slate-300 hover:border-indigo-400 bg-slate-50/70 hover:bg-slate-100/50'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleSelectFile(e.target.files[0]);
                  }
                }}
              />

              {previewUrl ? (
                <div className="flex flex-col items-center gap-3 w-full">
                  <div className="relative group max-h-48 rounded-xl overflow-hidden border border-indigo-500/40 shadow-md">
                    <img
                      src={previewUrl}
                      alt="Visual search input preview"
                      className="max-h-48 max-w-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewUrl(null);
                        setImageInputUrl('');
                        setSearchHint('');
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-black text-white text-xs cursor-pointer shadow-md"
                      title="Remove image"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-xs text-indigo-400 font-medium flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Image loaded successfully. Click below or replace image.</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-200">
                      Drag & drop any image here, or <span className="text-indigo-400 underline">browse file</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Supports PNG, JPG, WebP, GIF, SVG up to 10MB</p>
                  </div>
                </>
              )}
            </div>

            {/* Paste URL Option */}
            <form onSubmit={handleUrlSubmit} className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-400">Or paste an image URL:</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="url"
                    value={imageInputUrl}
                    onChange={(e) => setImageInputUrl(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs border outline-none font-sans ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500'
                        : 'bg-[#050a1a] border-slate-700 text-slate-100 focus:border-indigo-500'
                    }`}
                  />
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl text-xs font-bold border border-indigo-500/40 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 hover:text-white cursor-pointer transition-all shrink-0"
                >
                  Load
                </button>
              </div>
            </form>

            {/* Optional keywords or hint */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-400">
                  Context keywords / What to search for in this image:
                </label>
                <span className="text-[10px] text-indigo-400 font-medium">Auto-triggers dictionary & widgets</span>
              </div>
              <input
                type="text"
                value={searchHint}
                onChange={(e) => setSearchHint(e.target.value)}
                placeholder="e.g. galaxy, microchip, camera, architecture, apple, define telescope..."
                className={`w-full px-3 py-2 rounded-xl text-xs border outline-none font-sans ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500'
                    : 'bg-[#050a1a] border-slate-700 text-slate-100 focus:border-indigo-500'
                }`}
              />
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] text-slate-500 font-mono">Quick tags:</span>
                {['galaxy', 'microchip', 'architecture', 'robotics', 'camera', 'telescope', 'apple', 'nature', 'define'].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSearchHint(prev => prev ? `${prev} ${tag}` : tag)}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                      isLight
                        ? 'border-slate-300 bg-white hover:bg-slate-100 text-slate-600 hover:text-indigo-600'
                        : 'border-slate-800 hover:border-indigo-500/50 bg-[#070e24] hover:bg-indigo-950/40 text-slate-400 hover:text-indigo-300'
                    }`}
                  >
                    +{tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Example Presets */}
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 font-mono">
                Try Sample Images:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SAMPLE_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPreviewUrl(preset.url);
                      setImageInputUrl(preset.url);
                      setSearchHint(preset.hint);
                    }}
                    className={`p-2 rounded-xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                      previewUrl === preset.url
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : isLight
                        ? 'bg-slate-50 border-slate-200 hover:border-slate-300'
                        : 'bg-[#050a1a] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <img
                      src={preset.url}
                      alt={preset.title}
                      className="w-full h-16 object-cover rounded-lg"
                    />
                    <span className="text-[10px] font-semibold text-slate-300 truncate leading-tight">
                      {preset.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Extracts visuals & matches related pages</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteSearch}
                  disabled={!previewUrl}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white cursor-pointer transition-all active:scale-95 shadow-md flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Search by Image</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default VisualSearchModal;
