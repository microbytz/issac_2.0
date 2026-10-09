import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  BookOpen,
  Volume2,
  VolumeX,
  Share2,
  Bookmark,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Globe,
  Sparkles,
  Type,
  Sun,
  Moon,
  AlignLeft,
  Maximize2,
  Minimize2,
  ArrowLeft,
  CheckCheck
} from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { apiUrl } from '../utils/apiConfig';
import { playSpeech, stopSpeechImmediately, isSpeechActive, SPEECH_STOP_EVENT } from '../utils/speechUtils';

export interface StoryReaderItem {
  id?: string;
  url: string;
  title: string;
  snippet?: string;
  content?: string;
  paragraphs?: string[];
  publisher?: string;
  author?: string;
  publishedAt?: string;
  readingTimeMinutes?: number;
  wordCount?: number;
  tags?: string[];
  imageUrl?: string;
  source?: string;
}

interface InAppStoryReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  story: StoryReaderItem | null;
  isLight: boolean;
  onSaveToCollection?: (story: StoryReaderItem) => void;
  onNotify?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  searchQuery?: string;
}

type ReaderTheme = 'oled' | 'dark' | 'sepia' | 'light';
type ReaderFont = 'sans' | 'serif' | 'mono';

export const InAppStoryReaderModal: React.FC<InAppStoryReaderModalProps> = ({
  isOpen,
  onClose,
  story,
  isLight: systemIsLight,
  onSaveToCollection,
  onNotify,
  searchQuery = ''
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  // Reader Preferences (persisted in localStorage)
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>(() => {
    try {
      const stored = localStorage.getItem('isaac_reader_theme');
      if (stored && ['oled', 'dark', 'sepia', 'light'].includes(stored)) {
        return stored as ReaderTheme;
      }
    } catch (_) {}
    return systemIsLight ? 'light' : 'dark';
  });

  const [readerFont, setReaderFont] = useState<ReaderFont>(() => {
    try {
      const stored = localStorage.getItem('isaac_reader_font');
      if (stored && ['sans', 'serif', 'mono'].includes(stored)) {
        return stored as ReaderFont;
      }
    } catch (_) {}
    return 'sans';
  });

  const [fontSizeLevel, setFontSizeLevel] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('isaac_reader_font_size');
      if (stored) return Number(stored);
    } catch (_) {}
    return 1; // 0 = Small, 1 = Normal, 2 = Large, 3 = XL
  });

  // Story state
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [fetchedParagraphs, setFetchedParagraphs] = useState<string[]>([]);
  const [activeStoryDetails, setActiveStoryDetails] = useState<{
    wordCount?: number;
    readingTimeMinutes?: number;
    byline?: string;
    publishedAt?: string;
  }>({});

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copiedStory, setCopiedStory] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Synchronize speech stop listener
  useEffect(() => {
    const handleSpeechStop = () => {
      setIsSpeaking(false);
    };
    window.addEventListener(SPEECH_STOP_EVENT, handleSpeechStop);
    return () => {
      window.removeEventListener(SPEECH_STOP_EVENT, handleSpeechStop);
    };
  }, []);

  // Fetch full readable story if needed when story changes
  useEffect(() => {
    if (!isOpen || !story) {
      stopSpeechImmediately();
      setIsSpeaking(false);
      setFetchedParagraphs([]);
      return;
    }

    // Initialize with existing content if available
    let initialParagraphs: string[] = [];
    if (story.paragraphs && story.paragraphs.length > 0) {
      initialParagraphs = story.paragraphs;
    } else if (story.content && story.content.length > 100) {
      initialParagraphs = story.content.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
    }

    setFetchedParagraphs(initialParagraphs);
    setActiveStoryDetails({
      wordCount: story.wordCount || (initialParagraphs.join(' ').split(/\s+/).filter(Boolean).length),
      readingTimeMinutes: story.readingTimeMinutes || Math.max(1, Math.ceil((initialParagraphs.join(' ').split(/\s+/).filter(Boolean).length) / 200)),
      byline: story.author || story.publisher,
      publishedAt: story.publishedAt
    });

    // If existing content has only 1 snippet or is short, fetch full story from API
    if (initialParagraphs.length <= 1 || (initialParagraphs.join(' ').length < 300)) {
      setIsLoadingContent(true);
      const params = new URLSearchParams({
        url: story.url,
        title: story.title || '',
        snippet: story.snippet || ''
      });

      fetch(apiUrl(`/api/reader?${params.toString()}`))
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && Array.isArray(data.paragraphs) && data.paragraphs.length > 0) {
            setFetchedParagraphs(data.paragraphs);
            setActiveStoryDetails({
              wordCount: data.wordCount,
              readingTimeMinutes: data.readingTimeMinutes,
              byline: data.byline || story.author || story.publisher,
              publishedAt: data.publishedAt || story.publishedAt
            });
          }
        })
        .catch(() => {})
        .finally(() => {
          setIsLoadingContent(false);
        });
    } else {
      setIsLoadingContent(false);
    }
  }, [isOpen, story]);

  // Track scroll progress
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const total = el.scrollHeight - el.clientHeight;
    if (total > 0) {
      setScrollProgress((el.scrollTop / total) * 100);
    }
  };

  const handleClose = () => {
    stopSpeechImmediately();
    setIsSpeaking(false);
    onClose();
  };

  const handleToggleReadAloud = () => {
    if (isSpeaking) {
      stopSpeechImmediately();
      setIsSpeaking(false);
      if (onNotify) onNotify('Stopped reading aloud', 'info');
      return;
    }

    if (!story) return;

    const allText = [
      story.title,
      story.snippet,
      ...fetchedParagraphs
    ].filter(Boolean).join('. ');

    const started = playSpeech(allText, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false)
    });

    if (started) {
      setIsSpeaking(true);
      if (onNotify) onNotify('Reading story aloud in app...', 'info');
    }
  };

  const handleCopyStory = () => {
    if (!story) return;
    const storyText = `${story.title}\nSource: ${story.url}\n\n${fetchedParagraphs.join('\n\n') || story.snippet || ''}`;
    navigator.clipboard.writeText(storyText);
    setCopiedStory(true);
    if (onNotify) onNotify('Full story copied to clipboard', 'success');
    setTimeout(() => setCopiedStory(false), 2500);
  };

  const handleSave = () => {
    if (story && onSaveToCollection) {
      onSaveToCollection(story);
      if (onNotify) onNotify(`Saved "${story.title.slice(0, 30)}..." to collection`, 'success');
    }
  };

  const handleThemeChange = (t: ReaderTheme) => {
    setReaderTheme(t);
    try {
      localStorage.setItem('isaac_reader_theme', t);
    } catch (_) {}
  };

  const handleFontChange = (f: ReaderFont) => {
    setReaderFont(f);
    try {
      localStorage.setItem('isaac_reader_font', f);
    } catch (_) {}
  };

  const handleFontSizeChange = (delta: number) => {
    const next = Math.max(0, Math.min(3, fontSizeLevel + delta));
    setFontSizeLevel(next);
    try {
      localStorage.setItem('isaac_reader_font_size', String(next));
    } catch (_) {}
  };

  if (!isOpen || !story) return null;

  // Theme-specific styling classes
  const themeClasses = {
    oled: {
      bg: 'bg-black text-slate-100',
      header: 'bg-black/90 border-zinc-800 text-zinc-300',
      card: 'bg-zinc-950 border-zinc-800 text-zinc-300',
      subtext: 'text-zinc-400',
      heading: 'text-zinc-100',
      accent: 'text-blue-400',
      quoteBg: 'bg-zinc-900 border-zinc-700 text-zinc-300',
      button: 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-200'
    },
    dark: {
      bg: 'bg-[#070e24] text-slate-100',
      header: 'bg-[#070e24]/95 border-slate-800 text-slate-300',
      card: 'bg-[#091332] border-slate-800 text-slate-300',
      subtext: 'text-slate-400',
      heading: 'text-slate-100',
      accent: 'text-blue-400',
      quoteBg: 'bg-slate-900/60 border-slate-700 text-slate-200',
      button: 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-200'
    },
    sepia: {
      bg: 'bg-[#fbf7ee] text-[#2c2523]',
      header: 'bg-[#fbf7ee]/95 border-[#e8dfcf] text-[#5c4f4a]',
      card: 'bg-[#f5eedf] border-[#e8dfcf] text-[#4a3f3a]',
      subtext: 'text-[#6e5d57]',
      heading: 'text-[#2c2523]',
      accent: 'text-[#9b4d2b]',
      quoteBg: 'bg-[#ede3d1] border-[#dfd2be] text-[#382f2c]',
      button: 'bg-[#ede3d1] hover:bg-[#e2d5bf] border-[#ded3bf] text-[#2c2523]'
    },
    light: {
      bg: 'bg-white text-slate-900',
      header: 'bg-white/95 border-slate-200 text-slate-700',
      card: 'bg-slate-50 border-slate-200 text-slate-700',
      subtext: 'text-slate-500',
      heading: 'text-slate-900',
      accent: 'text-blue-600',
      quoteBg: 'bg-slate-100 border-slate-300 text-slate-800',
      button: 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
    }
  }[readerTheme];

  const fontClasses = {
    sans: 'font-sans',
    serif: 'font-serif',
    mono: 'font-mono'
  }[readerFont];

  const fontSizeClasses = [
    'text-sm leading-relaxed',
    'text-base leading-relaxed',
    'text-lg leading-loose',
    'text-xl leading-loose'
  ][fontSizeLevel];

  const domain = (() => {
    try {
      return new URL(story.url).hostname.replace(/^www\./, '');
    } catch (_) {
      return story.publisher || 'Web';
    }
  })();

  const paragraphsToRender = fetchedParagraphs.length > 0
    ? fetchedParagraphs
    : story.snippet
      ? [story.snippet]
      : ['No additional content text available.'];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md"
        onClick={handleClose}
      >
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-4xl h-full sm:h-[92vh] sm:rounded-3xl border shadow-2xl flex flex-col overflow-hidden transition-colors ${themeClasses.bg} border-slate-800/80`}
        >
          {/* Scroll Progress Bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-transparent z-30">
            <div
              className="h-full bg-blue-500 transition-all duration-75"
              style={{ width: `${scrollProgress}%` }}
            />
          </div>

          {/* Sticky Header Bar */}
          <header className={`px-4 sm:px-6 py-3 border-b flex items-center justify-between gap-3 shrink-0 backdrop-blur-md z-20 ${themeClasses.header}`}>
            {/* Left: Publisher & In-App Reader Badge */}
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={handleClose}
                className={`p-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all active:scale-95 shrink-0 ${themeClasses.button}`}
                title="Back to search results"
                aria-label="Back to results"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </button>

              <div className="flex items-center gap-2 truncate">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                  Isaac Reader
                </span>
                <span className={`text-xs font-mono font-medium truncate hidden md:inline ${themeClasses.subtext}`}>
                  {domain}
                </span>
              </div>
            </div>

            {/* Right: Controls & Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Font Family Switcher */}
              <div className={`hidden sm:flex items-center rounded-xl border p-0.5 text-xs font-mono ${themeClasses.button}`}>
                <button
                  type="button"
                  onClick={() => handleFontChange('sans')}
                  className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${readerFont === 'sans' ? 'bg-blue-600 text-white font-bold' : ''}`}
                  title="Sans-serif font"
                >
                  Sans
                </button>
                <button
                  type="button"
                  onClick={() => handleFontChange('serif')}
                  className={`px-2 py-1 rounded-lg transition-colors cursor-pointer font-serif ${readerFont === 'serif' ? 'bg-blue-600 text-white font-bold' : ''}`}
                  title="Serif font"
                >
                  Serif
                </button>
                <button
                  type="button"
                  onClick={() => handleFontChange('mono')}
                  className={`px-2 py-1 rounded-lg transition-colors cursor-pointer font-mono ${readerFont === 'mono' ? 'bg-blue-600 text-white font-bold' : ''}`}
                  title="Monospace font"
                >
                  Mono
                </button>
              </div>

              {/* Font Size A- / A+ */}
              <div className={`flex items-center rounded-xl border p-0.5 text-xs font-mono ${themeClasses.button}`}>
                <button
                  type="button"
                  onClick={() => handleFontSizeChange(-1)}
                  disabled={fontSizeLevel === 0}
                  className="px-2 py-1 rounded-lg hover:bg-black/10 disabled:opacity-40 cursor-pointer font-bold"
                  title="Decrease font size"
                >
                  A-
                </button>
                <button
                  type="button"
                  onClick={() => handleFontSizeChange(1)}
                  disabled={fontSizeLevel === 3}
                  className="px-2 py-1 rounded-lg hover:bg-black/10 disabled:opacity-40 cursor-pointer font-bold"
                  title="Increase font size"
                >
                  A+
                </button>
              </div>

              {/* Theme Switcher Toggle */}
              <div className={`flex items-center rounded-xl border p-0.5 text-xs ${themeClasses.button}`}>
                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${readerTheme === 'dark' ? 'bg-blue-600 text-white' : ''}`}
                  title="Soft Dark Theme"
                >
                  <Moon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('sepia')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer text-amber-700 ${readerTheme === 'sepia' ? 'bg-amber-600 text-white' : ''}`}
                  title="Sepia Paper Theme"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${readerTheme === 'light' ? 'bg-blue-600 text-white' : ''}`}
                  title="Clean Light Theme"
                >
                  <Sun className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Listen / Read Aloud Instant Button */}
              <button
                type="button"
                onClick={handleToggleReadAloud}
                className={`p-2 rounded-xl border flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all active:scale-95 ${
                  isSpeaking
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-sm'
                    : themeClasses.button
                }`}
                title={isSpeaking ? "Stop reading aloud" : "Read story aloud"}
                aria-label={isSpeaking ? "Stop reading aloud" : "Read story aloud"}
              >
                {isSpeaking ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                    <span className="text-rose-300 hidden md:inline">Stop</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                    <span className="hidden md:inline">Listen</span>
                  </>
                )}
              </button>

              {/* Copy Story Button */}
              <button
                type="button"
                onClick={handleCopyStory}
                className={`p-2 rounded-xl border flex items-center justify-center cursor-pointer transition-all active:scale-95 ${themeClasses.button}`}
                title="Copy entire story"
              >
                {copiedStory ? (
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={handleClose}
                className={`p-2 rounded-xl border flex items-center justify-center cursor-pointer transition-all active:scale-95 text-slate-400 hover:text-white ${themeClasses.button}`}
                title="Close Reader (Esc)"
                aria-label="Close Reader"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Scrollable Story Body */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-5 sm:px-12 md:px-20 py-8 no-scrollbar scroll-smooth"
          >
            <div className="max-w-2xl mx-auto flex flex-col gap-6">
              {/* Story Metadata & Badges */}
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono border-b pb-4 border-slate-800/40">
                <span className="flex items-center gap-1.5 text-blue-400 font-bold">
                  <Globe className="w-3.5 h-3.5" />
                  <span>{domain}</span>
                </span>

                <span className={`flex items-center gap-1 ${themeClasses.subtext}`}>
                  <Clock className="w-3 h-3" />
                  <span>{activeStoryDetails.readingTimeMinutes || 2} min read</span>
                </span>

                {activeStoryDetails.wordCount ? (
                  <span className={`hidden sm:inline ${themeClasses.subtext}`}>
                    • {activeStoryDetails.wordCount} words
                  </span>
                ) : null}

                {activeStoryDetails.publishedAt ? (
                  <span className={`hidden md:inline ${themeClasses.subtext}`}>
                    • {activeStoryDetails.publishedAt}
                  </span>
                ) : null}
              </div>

              {/* Headline */}
              <h1 className={`text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight ${fontClasses} ${themeClasses.heading}`}>
                {story.title}
              </h1>

              {/* Byline / Source Details */}
              {activeStoryDetails.byline && (
                <div className={`text-xs font-mono ${themeClasses.subtext}`}>
                  Reported by <strong className={themeClasses.heading}>{activeStoryDetails.byline}</strong>
                </div>
              )}

              {/* Key Takeaways Callout Card */}
              {story.snippet && (
                <div className={`p-4 rounded-2xl border ${themeClasses.quoteBg} flex flex-col gap-1.5`}>
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-blue-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Key Summary</span>
                  </div>
                  <p className="text-sm leading-relaxed italic opacity-95">
                    "{story.snippet}"
                  </p>
                </div>
              )}

              {/* Live Loading Indicator */}
              {isLoadingContent && (
                <div className={`py-4 px-4 rounded-2xl border flex items-center gap-2.5 text-xs font-mono ${themeClasses.quoteBg}`}>
                  <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span>Retrieving full extended report from {domain}...</span>
                </div>
              )}

              {/* Story Paragraphs */}
              <div className={`flex flex-col gap-5 ${fontClasses} ${fontSizeClasses}`}>
                {paragraphsToRender.map((paragraph, idx) => (
                  <p key={idx} className="leading-relaxed select-text">
                    {paragraph}
                  </p>
                ))}
              </div>

              {/* Tags Section */}
              {story.tags && story.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-6 mt-4 border-t border-slate-800/40">
                  <span className={`text-xs font-mono mr-1 ${themeClasses.subtext}`}>TOPICS:</span>
                  {story.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-lg text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Bottom Actions Bar */}
              <div className={`p-5 rounded-2xl border mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${themeClasses.card}`}>
                <div className="flex flex-col gap-0.5">
                  <span className={`text-xs font-bold font-sans ${themeClasses.heading}`}>Finished reading?</span>
                  <span className={`text-[11px] font-mono ${themeClasses.subtext}`}>Save this story or return to your search results.</span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {onSaveToCollection && (
                    <button
                      type="button"
                      onClick={handleSave}
                      className="px-3 py-1.5 rounded-xl border border-blue-500/30 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 text-xs font-semibold font-sans flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>Save Story</span>
                    </button>
                  )}

                  <a
                    href={story.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold font-sans flex items-center gap-1.5 cursor-pointer transition-all ${themeClasses.button}`}
                    title="Open the external webpage in a new tab"
                  >
                    <span>Original Site</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                  </a>

                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold font-sans cursor-pointer transition-all active:scale-95 shadow-sm"
                  >
                    Done Reading
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default InAppStoryReaderModal;
