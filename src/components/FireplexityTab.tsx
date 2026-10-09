import React, { useState, useEffect, useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sparkles,
  Search,
  Globe,
  Newspaper,
  Image as ImageIcon,
  ArrowRight,
  CornerDownRight,
  Loader2,
  Copy,
  Check,
  Database,
  FolderPlus,
  Briefcase,
  ExternalLink,
  FileText,
  X,
  RotateCcw,
  Zap,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  BookOpen,
  Layers,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import TradingViewWidget from './TradingViewWidget';
import { apiUrl } from '../utils/apiConfig';
import {
  FireplexitySource,
  FireplexityNewsItem,
  FireplexityImageItem,
  FireplexityTurn,
  detectCompanyTicker
} from '../utils/fireplexityUtils';

interface FireplexityTabProps {
  isLight: boolean;
  pagesList: Array<{
    id: string;
    url: string;
    title: string;
    snippet: string;
    content?: string;
    tags?: string[];
  }>;
  collections: Array<{
    id: string;
    name: string;
    pages: any[];
  }>;
  projects: Array<{
    id: string;
    name: string;
  }>;
  onIndexSourcePage: (source: FireplexitySource) => void;
  onBulkIndexSources: (sources: FireplexitySource[]) => void;
  onSaveSourceToCollection: (source: FireplexitySource, collectionId: string) => void;
  onSaveSynthesisToProject: (turn: FireplexityTurn, projectId: string) => void;
  onIndexImageItem: (img: FireplexityImageItem) => void;
  onNotify: (message: string, type?: 'success' | 'info' | 'error') => void;
}

const STARTER_QUERIES = [
  {
    title: 'BM25 vs. Hybrid Vector Search Architecture',
    query: 'How does BM25 probabilistic ranking compare to hybrid dense-sparse vector search in modern search engines?',
    category: 'Search Engineering',
    icon: Database
  },
  {
    title: 'NVIDIA Stock & Blackwell AI Architecture',
    query: 'Analyze NVIDIA stock performance, data center revenue growth, and Blackwell GPU architecture advantages',
    category: 'Market + Live Ticker',
    icon: TrendingUp
  },
  {
    title: 'FastAPI vs. Starlette High-Throughput Benchmarks',
    query: 'Compare FastAPI and Starlette async Python performance, ASGI lifecycle, and Pydantic v2 serialization speed',
    category: 'Backend Benchmarks',
    icon: Zap
  },
  {
    title: 'Polite Distributed Web Crawlers & Common Crawl',
    query: 'How do large-scale distributed web crawlers enforce robots.txt politeness, deduplication, and markdown extraction?',
    category: 'Web Crawling',
    icon: Globe
  }
];

export default function FireplexityTab({
  isLight,
  pagesList,
  collections,
  projects,
  onIndexSourcePage,
  onBulkIndexSources,
  onSaveSourceToCollection,
  onSaveSynthesisToProject,
  onIndexImageItem,
  onNotify
}: FireplexityTabProps) {
  const focusTrapRef = useFocusTrap<HTMLDivElement>();
  const [turns, setTurns] = useState<FireplexityTurn[]>(() => {
    try {
      const saved = localStorage.getItem('isaac_fireplexity_turns');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((t: FireplexityTurn) => ({ ...t, isStreaming: false, statusMessage: null }));
        }
      }
    } catch (_) {}
    return [];
  });

  const [inputQuery, setInputQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [autoIndexScrapedPages, setAutoIndexScrapedPages] = useState<boolean>(() => {
    return localStorage.getItem('isaac_fireplexity_auto_index') === 'true';
  });

  // Active media sub-tab per turn ('web' | 'news' | 'images')
  const [activeMediaTabByTurn, setActiveMediaTabByTurn] = useState<Record<string, 'web' | 'news' | 'images'>>({});

  // Citation hover/click state
  const [activeCitationTooltip, setActiveCitationTooltip] = useState<{
    turnId: string;
    citationNum: number;
    source: FireplexitySource;
  } | null>(null);

  // Scraped Markdown Inspector Modal state
  const [inspectingSource, setInspectingSource] = useState<FireplexitySource | null>(null);

  // Image Lightbox Modal state
  const [lightboxImage, setLightboxImage] = useState<FireplexityImageItem | null>(null);

  // Dropdown states for saving to collection / project
  const [openProjectMenuTurnId, setOpenProjectMenuTurnId] = useState<string | null>(null);
  const [openCollectionMenuSourceUrl, setOpenCollectionMenuSourceUrl] = useState<string | null>(null);
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);

  // Environment capability state from /api/fireplexity/check-env
  const [envStatus, setEnvStatus] = useState<{
    hasFirecrawlKey: boolean;
    hasGroqKey: boolean;
    hasGeminiKey: boolean;
    activeSearchProvider: string;
    activeLlmProvider: string;
  }>({
    hasFirecrawlKey: false,
    hasGroqKey: false,
    hasGeminiKey: true,
    activeSearchProvider: 'firecrawl-v2',
    activeLlmProvider: 'groq-kimi-k2'
  });

  const threadEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('isaac_fireplexity_turns', JSON.stringify(turns));
    } catch (_) {}
  }, [turns]);

  useEffect(() => {
    localStorage.setItem('isaac_fireplexity_auto_index', String(autoIndexScrapedPages));
  }, [autoIndexScrapedPages]);

  useEffect(() => {
    fetch(apiUrl('/api/fireplexity/check-env'))
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data) setEnvStatus(data);
      })
      .catch(() => {});
  }, []);

  const isUrlIndexed = (url: string) => {
    const clean = url.replace(/\/$/, '').toLowerCase();
    return pagesList.some(p => p.url.replace(/\/$/, '').toLowerCase() === clean);
  };

  const handleRunSearch = async (rawQuery?: string) => {
    const q = (rawQuery ?? inputQuery).trim();
    if (!q || isSearching) return;

    setInputQuery('');
    setIsSearching(true);
    setActiveCitationTooltip(null);

    const turnId = `fp_turn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const detectedTicker = detectCompanyTicker(q);

    const newTurn: FireplexityTurn = {
      id: turnId,
      query: q,
      answer: '',
      sources: [],
      newsResults: [],
      imageResults: [],
      followUpQuestions: [],
      ticker: detectedTicker,
      statusMessage: 'Starting search...',
      isStreaming: true,
      error: null,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const previousMessages = turns.flatMap(t => [
      { role: 'user', content: t.query },
      { role: 'assistant', content: t.answer }
    ]);

    setTurns(prev => [...prev, newTurn]);
    setActiveMediaTabByTurn(prev => ({ ...prev, [turnId]: 'web' }));

    setTimeout(() => {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);

    try {
      const response = await fetch(apiUrl('/api/fireplexity/search'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          messages: [...previousMessages, { role: 'user', content: q }],
          localCatalogPages: pagesList.slice(0, 20)
        })
      });

      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || `Search request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const event = JSON.parse(trimmed);

            if (event.type === 'data-status') {
              setTurns(prev =>
                prev.map(t =>
                  t.id === turnId
                    ? { ...t, statusMessage: event.data?.message || 'Processing...' }
                    : t
                )
              );
            } else if (event.type === 'data-sources') {
              const incomingSources: FireplexitySource[] = event.data?.sources || [];
              const incomingNews: FireplexityNewsItem[] = event.data?.newsResults || [];
              const incomingImages: FireplexityImageItem[] = event.data?.imageResults || [];
              const providerInfo = event.data?.providerInfo;

              setTurns(prev =>
                prev.map(t =>
                  t.id === turnId
                    ? {
                        ...t,
                        sources: incomingSources,
                        newsResults: incomingNews,
                        imageResults: incomingImages,
                        providerInfo: providerInfo || t.providerInfo
                      }
                    : t
                )
              );

              if (autoIndexScrapedPages && incomingSources.length > 0) {
                onBulkIndexSources(incomingSources);
              }
            } else if (event.type === 'data-ticker') {
              const symbol = event.data?.symbol;
              const companyName = event.data?.companyName || symbol;
              if (symbol) {
                setTurns(prev =>
                  prev.map(t =>
                    t.id === turnId
                      ? { ...t, ticker: { ticker: symbol, companyName } }
                      : t
                  )
                );
              }
            } else if (event.type === 'text-reset') {
              // Server discarded a partial answer from a provider that failed mid-stream.
              setTurns(prev =>
                prev.map(t => (t.id === turnId ? { ...t, answer: '' } : t))
              );
            } else if (event.type === 'text-delta') {
              const delta = event.data?.textDelta || '';
              if (delta) {
                setTurns(prev =>
                  prev.map(t =>
                    t.id === turnId
                      ? {
                          ...t,
                          statusMessage: null,
                          answer: t.answer + delta
                        }
                      : t
                  )
                );
              }
            } else if (event.type === 'data-followup') {
              const questions: string[] = event.data?.questions || [];
              setTurns(prev =>
                prev.map(t =>
                  t.id === turnId
                    ? { ...t, followUpQuestions: questions }
                    : t
                )
              );
            } else if (event.type === 'data-error') {
              setTurns(prev =>
                prev.map(t =>
                  t.id === turnId
                    ? {
                        ...t,
                        error: event.data?.error || 'Search error occurred',
                        errorSuggestion: event.data?.suggestion || null,
                        statusMessage: null,
                        isStreaming: false
                      }
                    : t
                )
              );
            } else if (event.type === 'done') {
              setTurns(prev =>
                prev.map(t =>
                  t.id === turnId
                    ? { ...t, isStreaming: false, statusMessage: null }
                    : t
                )
              );
            }
          } catch (_) {
            // Ignore malformed NDJSON line
          }
        }
      }

      setTurns(prev =>
        prev.map(t =>
          t.id === turnId ? { ...t, isStreaming: false, statusMessage: null } : t
        )
      );
    } catch (err: any) {
      setTurns(prev =>
        prev.map(t =>
          t.id === turnId
            ? {
                ...t,
                isStreaming: false,
                statusMessage: null,
                error: err?.message || 'Failed to complete Fireplexity search'
              }
            : t
        )
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleCopyAnswer = async (turn: FireplexityTurn) => {
    const citationsBlock =
      turn.sources.length > 0
        ? '\n\n### Citations\n' +
          turn.sources.map((s, i) => `[${i + 1}] ${s.title} - ${s.url}`).join('\n')
        : '';
    try {
      await navigator.clipboard.writeText(`# ${turn.query}\n\n${turn.answer}${citationsBlock}`);
      setCopiedTurnId(turn.id);
      onNotify('Copied synthesized answer and citations to clipboard!', 'success');
      setTimeout(() => setCopiedTurnId(null), 2000);
    } catch (_) {
      onNotify('Could not copy to clipboard', 'error');
    }
  };

  /**
   * Transform inline [1], [2] markers into markdown links with a custom scheme `#citation-1`
   * so ReactMarkdown renders them as interactive citation pills without breaking markdown syntax.
   */
  const preprocessMarkdownCitations = (markdown: string) => {
    if (!markdown) return '';
    return markdown.replace(/\[(\d{1,2})\](?!\()/g, '[$1](#citation-$1)');
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 py-2 text-left">
      {/* Top Architecture & Control Bar */}
      <div
        className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
          isLight
            ? 'bg-white border-slate-200 shadow-xs'
            : 'bg-zinc-900/90 border-zinc-800 shadow-lg'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
              isLight
                ? 'bg-slate-100 border-slate-300 text-slate-700'
                : 'bg-zinc-800 border-zinc-700 text-zinc-200'
            }`}
          >
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                className={`text-base font-extrabold tracking-tight ${
                  isLight ? 'text-slate-900' : 'text-zinc-100'
                }`}
              >
                Fireplexity v2 Live AI Search
              </h2>
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                  isLight
                    ? 'bg-slate-100 text-slate-700 border-slate-300'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                }`}
              >
                Web • News • Images • Citations
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
              Real-time multi-source markdown scraping with grounded inline citations, stock ticker charts, and 1-click Isaac catalog indexing.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {/* Auto-Index Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !autoIndexScrapedPages;
              setAutoIndexScrapedPages(next);
              onNotify(
                next
                  ? 'Auto-Index enabled: Scraped Fireplexity sources will automatically sync to Isaac Catalog'
                  : 'Auto-Index disabled: Sources can still be indexed manually per card',
                'info'
              );
            }}
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold flex items-center gap-2 cursor-pointer transition-all ${
              autoIndexScrapedPages
                ? isLight
                  ? 'bg-slate-800 border-slate-700 text-white'
                  : 'bg-zinc-800 border-zinc-600 text-zinc-100'
                : isLight
                  ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            title="Automatically index scraped web sources into your Isaac Search Whoosh catalog"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Auto-Index to Catalog: {autoIndexScrapedPages ? 'ON' : 'OFF'}</span>
          </button>

          {turns.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setTurns([]);
                localStorage.removeItem('isaac_fireplexity_turns');
                onNotify('Cleared Fireplexity conversation thread', 'info');
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>New Thread</span>
            </button>
          )}
        </div>
      </div>

      {/* Zero-State Hero & Starter Queries when no turns exist */}
      {turns.length === 0 && (
        <div className="flex flex-col gap-6 py-6">
          <div className="text-center max-w-2xl mx-auto flex flex-col gap-2">
            <h3
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                isLight ? 'text-slate-900' : 'text-zinc-100'
              }`}
            >
              What do you want to research today?
            </h3>
            <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
              Ask any technical, market, or deep research question. Fireplexity scrapes live web pages, news, and images, extracts high-signal Markdown, and streams a cited answer.
            </p>
          </div>

          {/* Primary Search Input Box */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleRunSearch();
            }}
            className={`max-w-3xl w-full mx-auto rounded-2xl border p-1.5 sm:p-2 flex items-center gap-1.5 sm:gap-2 transition-all shadow-xl ${
              isLight
                ? 'bg-white border-slate-300 focus-within:border-slate-500 focus-within:ring-4 focus-within:ring-slate-200'
                : 'bg-zinc-900/90 border-zinc-800 focus-within:border-zinc-600 focus-within:ring-4 focus-within:ring-zinc-800/40'
            }`}
          >
            <Search className={`w-4 h-4 sm:w-5 sm:h-5 ml-2 sm:ml-3 shrink-0 ${isLight ? 'text-slate-400' : 'text-zinc-500'}`} />
            <input
              ref={inputRef}
              type="text"
              value={inputQuery}
              onChange={e => setInputQuery(e.target.value)}
              placeholder="Ask any research question..."
              className={`flex-1 min-w-0 bg-transparent border-none py-2 sm:py-2.5 px-2 text-sm sm:text-base focus:outline-none ${
                isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-zinc-100 placeholder:text-zinc-500'
              }`}
             aria-label="Ask any research question (e.g., NVIDIA architecture, Whoosh BM25)" />
            <button
              type="submit"
              disabled={!inputQuery.trim() || isSearching}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 shrink-0 shadow-md border ${
                isLight
                  ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700'
              }`}
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              <span className="hidden sm:inline">Deep Search</span>
              <span className="sm:hidden">Search</span>
            </button>
          </form>

          {/* Starter Queries Grid */}
          <div className="max-w-3xl w-full mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {STARTER_QUERIES.map((item, idx) => {
              const IconComponent = item.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleRunSearch(item.query)}
                  className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2.5 cursor-pointer group ${
                    isLight
                      ? 'bg-white border-slate-200 hover:border-slate-400 hover:shadow-md'
                      : 'bg-zinc-900/80 border-zinc-800/90 hover:border-zinc-600 hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        isLight
                          ? 'bg-slate-100 text-slate-700 border-slate-300'
                          : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                      }`}
                    >
                      {item.category}
                    </span>
                    <IconComponent
                      className={`w-4 h-4 group-hover:translate-x-0.5 transition-transform ${
                        isLight ? 'text-slate-500 group-hover:text-slate-800' : 'text-zinc-400 group-hover:text-zinc-200'
                      }`}
                    />
                  </div>
                  <div>
                    <h4
                      className={`text-sm font-bold tracking-tight ${
                        isLight ? 'text-slate-900' : 'text-zinc-100'
                      }`}
                    >
                      {item.title}
                    </h4>
                    <p
                      className={`text-xs mt-1 line-clamp-2 leading-relaxed ${
                        isLight ? 'text-slate-500' : 'text-zinc-400'
                      }`}
                    >
                      {item.query}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Conversation Turns */}
      {turns.length > 0 && (
        <div className="flex flex-col gap-8">
          {turns.map((turn, turnIdx) => {
            const activeMediaTab = activeMediaTabByTurn[turn.id] || 'web';

            return (
              <div
                key={turn.id}
                className={`rounded-3xl border p-5 sm:p-7 flex flex-col gap-6 transition-all ${
                  isLight
                    ? 'bg-white border-slate-200 shadow-sm'
                    : 'bg-zinc-900/85 border-zinc-800 shadow-xl'
                }`}
              >
                {/* Turn Query Header & Workspace Actions */}
                <div
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 ${
                    isLight ? 'border-slate-200' : 'border-zinc-800/70'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`px-2.5 py-1 rounded-lg border font-mono text-xs font-bold shrink-0 mt-0.5 ${
                        isLight
                          ? 'bg-slate-100 border-slate-300 text-slate-700'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-200'
                      }`}
                    >
                      Q{turnIdx + 1}
                    </span>
                    <div className="min-w-0">
                      <h3
                        className={`text-lg sm:text-xl font-extrabold tracking-tight leading-snug ${
                          isLight ? 'text-slate-900' : 'text-zinc-100'
                        }`}
                      >
                        {turn.query}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-zinc-500 flex-wrap">
                        <span>{turn.createdAt}</span>
                        <span>•</span>
                        <span>{turn.sources.length} web sources</span>
                        <span>•</span>
                        <span>{turn.newsResults.length} news</span>
                        <span>•</span>
                        <span>{turn.imageResults.length} images</span>
                        {turn.providerInfo && (
                          <>
                            <span>•</span>
                            <span className={isLight ? 'text-slate-600' : 'text-zinc-400'}>
                              {turn.providerInfo.searchProvider} + {turn.providerInfo.llmProvider}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons for this Turn */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {turn.sources.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onBulkIndexSources(turn.sources)}
                        className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                          isLight
                            ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
                        }`}
                        title="Index all scraped web sources from this search into your Isaac Search Catalog"
                      >
                        <Database className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Index All ({turn.sources.length})</span>
                      </button>
                    )}

                    {/* Save Synthesis to Research Project */}
                    {turn.answer && projects.length > 0 && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenProjectMenuTurnId(prev => (prev === turn.id ? null : turn.id))
                          }
                          className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                            isLight
                              ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
                          }`}
                        >
                          <Briefcase className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Save to Project</span>
                        </button>

                        {openProjectMenuTurnId === turn.id && (
                          <div
                            className={`absolute right-0 mt-1.5 w-60 rounded-xl border p-1.5 shadow-2xl z-30 ${
                              isLight
                                ? 'bg-white border-slate-200'
                                : 'bg-zinc-900 border-zinc-800'
                            }`}
                          >
                            <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400 border-b border-zinc-800/60 mb-1">
                              Append to Project Notebook
                            </div>
                            {projects.map(proj => (
                              <button
                                key={proj.id}
                                type="button"
                                onClick={() => {
                                  onSaveSynthesisToProject(turn, proj.id);
                                  setOpenProjectMenuTurnId(null);
                                }}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between cursor-pointer ${
                                  isLight
                                    ? 'hover:bg-slate-100 text-slate-800'
                                    : 'hover:bg-zinc-800 text-zinc-200'
                                }`}
                              >
                                <span className="truncate">{proj.name}</span>
                                <Plus className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {turn.answer && (
                      <button
                        type="button"
                        onClick={() => handleCopyAnswer(turn)}
                        className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                          isLight
                            ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
                        }`}
                      >
                        {copiedTurnId === turn.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-zinc-200" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Transient Status Banner */}
                {turn.statusMessage && (
                  <div
                    className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
                      isLight
                        ? 'bg-slate-100 border-slate-300 text-slate-700'
                        : 'bg-zinc-950/80 border-zinc-800 text-zinc-300'
                    }`}
                  >
                    <Loader2 className="w-4 h-4 text-zinc-400 animate-spin shrink-0" />
                    <span className="text-xs font-mono font-semibold">
                      {turn.statusMessage}
                    </span>
                  </div>
                )}

                {/* Error Display */}
                {turn.error && (
                  <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-rose-300">{turn.error}</div>
                      {turn.errorSuggestion && (
                        <div className="text-xs text-rose-200/80 mt-1">{turn.errorSuggestion}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Auto-Detected Stock Chart Widget (TradingView) */}
                {turn.ticker && (
                  <TradingViewWidget
                    symbol={turn.ticker.ticker}
                    companyName={turn.ticker.companyName}
                    isLight={isLight}
                  />
                )}

                {/* Multi-Modal Sources Strip: Web Sources | News | Images */}
                {(turn.sources.length > 0 ||
                  turn.newsResults.length > 0 ||
                  turn.imageResults.length > 0) && (
                  <div className="flex flex-col gap-3">
                    {/* Media Mode Selector Tabs */}
                    <div
                      className={`flex items-center gap-2 border-b pb-2 ${
                        isLight ? 'border-slate-200' : 'border-zinc-800/70'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMediaTabByTurn(prev => ({ ...prev, [turn.id]: 'web' }))
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                          activeMediaTab === 'web'
                            ? isLight
                              ? 'bg-slate-200/80 text-slate-900 border border-slate-400'
                              : 'bg-zinc-800 text-zinc-100 border border-zinc-600'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Web Sources ({turn.sources.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setActiveMediaTabByTurn(prev => ({ ...prev, [turn.id]: 'news' }))
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                          activeMediaTab === 'news'
                            ? isLight
                              ? 'bg-slate-200/80 text-slate-900 border border-slate-400'
                              : 'bg-zinc-800 text-zinc-100 border border-zinc-600'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <Newspaper className="w-3.5 h-3.5" />
                        <span>News ({turn.newsResults.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setActiveMediaTabByTurn(prev => ({ ...prev, [turn.id]: 'images' }))
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                          activeMediaTab === 'images'
                            ? isLight
                              ? 'bg-slate-200/80 text-slate-900 border border-slate-400'
                              : 'bg-zinc-800 text-zinc-100 border border-zinc-600'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Images ({turn.imageResults.length})</span>
                      </button>
                    </div>

                    {/* TAB 1: WEB SOURCES */}
                    {activeMediaTab === 'web' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {turn.sources.map((src, idx) => {
                          const citationNum = idx + 1;
                          const alreadyIndexed = isUrlIndexed(src.url);
                          const hostname =
                            src.siteName ||
                            (() => {
                              try {
                                return new URL(src.url).hostname.replace('www.', '');
                              } catch (_) {
                                return src.url;
                              }
                            })();

                          return (
                            <div
                              key={`${src.url}-${idx}`}
                              className={`rounded-2xl border p-3.5 flex flex-col justify-between gap-2.5 transition-all ${
                                isLight
                                  ? 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                                  : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'
                              }`}
                            >
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className={`px-1.5 py-0.5 rounded border font-mono text-[10px] font-bold shrink-0 ${
                                        isLight
                                          ? 'bg-slate-200 border-slate-300 text-slate-800'
                                          : 'bg-zinc-800 border-zinc-700 text-zinc-200'
                                      }`}
                                    >
                                      [{citationNum}]
                                    </span>
                                    <img
                                      src={
                                        src.favicon ||
                                        `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
                                      }
                                      alt=""
                                      className="w-3.5 h-3.5 rounded-xs shrink-0"
                                      onError={e => {
                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                    <span className="text-[11px] font-mono text-zinc-400 truncate">
                                      {hostname}
                                    </span>
                                  </div>

                                  <a
                                    href={src.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-zinc-400 hover:text-zinc-100 transition-colors shrink-0"
                                    title="Open source URL"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                </div>

                                <a
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`text-xs font-bold line-clamp-2 hover:underline ${
                                    isLight ? 'text-slate-900' : 'text-zinc-100'
                                  }`}
                                >
                                  {src.title}
                                </a>

                                {src.description && (
                                  <p
                                    className={`text-[11px] line-clamp-2 leading-relaxed ${
                                      isLight ? 'text-slate-600' : 'text-zinc-400'
                                    }`}
                                  >
                                    {src.description}
                                  </p>
                                )}
                              </div>

                              {/* Source Card Footer Controls */}
                              <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-zinc-800/50">
                                <button
                                  type="button"
                                  onClick={() => setInspectingSource(src)}
                                  className="px-2 py-1 rounded-lg bg-zinc-800/70 hover:bg-zinc-800 text-zinc-300 font-mono text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                                  title="Inspect scraped Markdown content"
                                >
                                  <FileText className="w-3 h-3 text-zinc-400" />
                                  <span>Markdown</span>
                                </button>

                                <div className="flex items-center gap-1">
                                  {/* Save to Collection Dropdown */}
                                  {collections.length > 0 && (
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setOpenCollectionMenuSourceUrl(prev =>
                                            prev === src.url ? null : src.url
                                          )
                                        }
                                        className="px-2 py-1 rounded-lg bg-zinc-800/70 hover:bg-zinc-800 text-zinc-300 font-mono text-[10px] flex items-center gap-1 cursor-pointer"
                                        title="Bookmark source to Collection"
                                      >
                                        <FolderPlus className="w-3 h-3 text-zinc-400" />
                                      </button>
                                      {openCollectionMenuSourceUrl === src.url && (
                                        <div
                                          className={`absolute right-0 bottom-full mb-1 w-48 rounded-xl border p-1.5 shadow-xl z-30 ${
                                            isLight
                                              ? 'bg-white border-slate-200'
                                              : 'bg-zinc-900 border-zinc-800'
                                          }`}
                                        >
                                          {collections.map(col => (
                                            <button
                                              key={col.id}
                                              type="button"
                                              onClick={() => {
                                                onSaveSourceToCollection(src, col.id);
                                                setOpenCollectionMenuSourceUrl(null);
                                              }}
                                              className="w-full text-left px-2 py-1 rounded-lg text-[11px] hover:bg-zinc-800 text-zinc-200 truncate block cursor-pointer"
                                            >
                                              {col.name}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => onIndexSourcePage(src)}
                                    disabled={alreadyIndexed}
                                    className={`px-2 py-1 rounded-lg font-mono text-[10px] font-semibold flex items-center gap-1 transition-all ${
                                      alreadyIndexed
                                        ? 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/60 cursor-default'
                                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 cursor-pointer'
                                    }`}
                                    title={
                                      alreadyIndexed
                                        ? 'Already in Isaac Search Catalog'
                                        : 'Index this scraped page into Isaac Search'
                                    }
                                  >
                                    {alreadyIndexed ? (
                                      <>
                                        <CheckCircle className="w-3 h-3" />
                                        <span>Indexed</span>
                                      </>
                                    ) : (
                                      <>
                                        <Database className="w-3 h-3" />
                                        <span>+Index</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* TAB 2: NEWS RESULTS */}
                    {activeMediaTab === 'news' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {turn.newsResults.length === 0 ? (
                          <div className="col-span-full py-6 text-center text-xs font-mono text-zinc-500">
                            No recent news items found for this query.
                          </div>
                        ) : (
                          turn.newsResults.map((news, idx) => (
                            <a
                              key={`${news.url}-${idx}`}
                              href={news.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`rounded-2xl border p-3.5 flex flex-col justify-between gap-2 transition-all group ${
                                isLight
                                  ? 'bg-slate-50 border-slate-200 hover:border-slate-400'
                                  : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-600'
                              }`}
                            >
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-zinc-400">
                                  <span className={`truncate font-bold ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                                    {news.source || 'News Feed'}
                                  </span>
                                  {news.publishedDate && <span>{news.publishedDate}</span>}
                                </div>
                                <h4
                                  className={`text-xs font-bold line-clamp-2 group-hover:underline ${
                                    isLight ? 'text-slate-900' : 'text-zinc-100'
                                  }`}
                                >
                                  {news.title}
                                </h4>
                                {news.description && (
                                  <p
                                    className={`text-[11px] line-clamp-2 leading-relaxed ${
                                      isLight ? 'text-slate-600' : 'text-zinc-400'
                                    }`}
                                  >
                                    {news.description}
                                  </p>
                                )}
                              </div>
                              <div className={`flex items-center justify-end text-[10px] font-mono pt-1 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                                <span>Read Article →</span>
                              </div>
                            </a>
                          ))
                        )}
                      </div>
                    )}

                    {/* TAB 3: IMAGE RESULTS */}
                    {activeMediaTab === 'images' && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {turn.imageResults.length === 0 ? (
                          <div className="col-span-full py-6 text-center text-xs font-mono text-zinc-500">
                            No visual media found for this query.
                          </div>
                        ) : (
                          turn.imageResults.map((img, idx) => (
                            <div
                              key={`${img.thumbnail}-${idx}`}
                              onClick={() => setLightboxImage(img)}
                              className={`group relative rounded-2xl overflow-hidden border aspect-video cursor-pointer ${
                                isLight ? 'border-slate-200 bg-slate-100' : 'border-zinc-800 bg-zinc-900'
                              }`}
                            >
                              <img
                                src={img.thumbnail}
                                alt={img.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2.5 flex flex-col justify-end">
                                <div className="text-[11px] font-bold text-white line-clamp-1">
                                  {img.title}
                                </div>
                                <div className="text-[10px] font-mono text-zinc-300 truncate">
                                  {img.source}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Synthesized AI Grounded Answer with Interactive Citations */}
                {turn.answer && (
                  <div className="relative pt-2">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className={`w-4 h-4 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`} />
                      <span className={`text-xs font-mono font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                        Grounded Synthesis
                      </span>
                    </div>

                    {/* Floating Citation Preview Card when a user clicks or hovers a citation pill */}
                    <AnimatePresence>
                      {activeCitationTooltip && activeCitationTooltip.turnId === turn.id && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          className={`mb-4 rounded-2xl border p-4 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isLight
                              ? 'bg-slate-100 border-slate-300 text-slate-900'
                              : 'bg-zinc-900/95 border-zinc-700 text-zinc-100'
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <span
                              className={`px-2 py-0.5 rounded border font-mono text-xs font-bold shrink-0 ${
                                isLight
                                  ? 'bg-slate-800 border-slate-700 text-white'
                                  : 'bg-zinc-800 border-zinc-700 text-zinc-100'
                              }`}
                            >
                              [{activeCitationTooltip.citationNum}]
                            </span>
                            <div className="min-w-0">
                              <a
                                href={activeCitationTooltip.source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-bold hover:underline block truncate"
                              >
                                {activeCitationTooltip.source.title}
                              </a>
                              <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5">
                                {activeCitationTooltip.source.description}
                              </p>
                              <span className="text-[10px] font-mono text-zinc-400 block truncate mt-1">
                                {activeCitationTooltip.source.url}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setInspectingSource(activeCitationTooltip.source)}
                              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-mono cursor-pointer"
                            >
                              View Markdown
                            </button>
                            <button
                              type="button"
                              onClick={() => onIndexSourcePage(activeCitationTooltip.source)}
                              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-[11px] font-mono font-bold cursor-pointer"
                            >
                              +Index
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveCitationTooltip(null)}
                              className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div
                      className={`prose max-w-none text-sm leading-relaxed space-y-3 ${
                        isLight ? 'text-slate-800' : 'text-zinc-200'
                      }`}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ children }) => (
                            <h1 className="text-lg font-extrabold tracking-tight mt-4 mb-2">
                              {children}
                            </h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-base font-bold tracking-tight mt-4 mb-2">
                              {children}
                            </h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-sm font-bold mt-3 mb-1.5">{children}</h3>
                          ),
                          p: ({ children }) => <p className="leading-relaxed mb-3">{children}</p>,
                          ul: ({ children }) => (
                            <ul className="list-disc pl-5 space-y-1.5 mb-3">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal pl-5 space-y-1.5 mb-3">{children}</ol>
                          ),
                          pre: ({ children }) => (
                            <pre className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-xs overflow-x-auto my-3">
                              {children}
                            </pre>
                          ),
                          code: ({ className, children }) => {
                            const isBlock = Boolean(className);
                            return isBlock ? (
                              <code className="font-mono text-xs">{children}</code>
                            ) : (
                              <code className="px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-200 font-mono text-xs">
                                {children}
                              </code>
                            );
                          },
                          a: ({ href, children }) => {
                            if (href && href.startsWith('#citation-')) {
                              const num = parseInt(href.replace('#citation-', ''), 10);
                              const matchedSource = turn.sources[num - 1];
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (matchedSource) {
                                      setActiveCitationTooltip(prev =>
                                        prev &&
                                        prev.turnId === turn.id &&
                                        prev.citationNum === num
                                          ? null
                                          : {
                                              turnId: turn.id,
                                              citationNum: num,
                                              source: matchedSource
                                            }
                                      );
                                    }
                                  }}
                                  onMouseEnter={() => {
                                    if (matchedSource) {
                                      setActiveCitationTooltip({
                                        turnId: turn.id,
                                        citationNum: num,
                                        source: matchedSource
                                      });
                                    }
                                  }}
                                  className={`inline-flex items-center justify-center px-1.5 py-0.2 mx-0.5 text-[11px] font-mono font-bold rounded border transition-colors cursor-pointer align-baseline ${
                                    isLight
                                      ? 'bg-slate-200 hover:bg-slate-700 text-slate-800 hover:text-white border-slate-300'
                                      : 'bg-zinc-800 hover:bg-zinc-600 text-zinc-200 hover:text-white border-zinc-700'
                                  }`}
                                  title={
                                    matchedSource
                                      ? `${matchedSource.title} (${matchedSource.url})`
                                      : `Citation [${num}]`
                                  }
                                >
                                  [{children}]
                                </button>
                              );
                            }
                            return (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`underline ${
                                  isLight ? 'text-slate-700 hover:text-slate-950' : 'text-zinc-300 hover:text-white'
                                }`}
                              >
                                {children}
                              </a>
                            );
                          }
                        }}
                      >
                        {preprocessMarkdownCitations(turn.answer)}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* Follow-Up Questions Section */}
                {turn.followUpQuestions.length > 0 && (
                  <div className="pt-4 border-t border-zinc-800/70 flex flex-col gap-2.5">
                    <div className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <CornerDownRight className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Suggested Follow-Up Questions</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {turn.followUpQuestions.map((q, qIdx) => (
                        <button
                          key={qIdx}
                          type="button"
                          disabled={isSearching}
                          onClick={() => handleRunSearch(q)}
                          className={`px-3.5 py-2.5 rounded-xl border text-left text-xs font-medium flex items-center justify-between gap-3 cursor-pointer transition-all group ${
                            isLight
                              ? 'bg-slate-50 border-slate-200 hover:border-slate-400 text-slate-800'
                              : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-600 text-zinc-200 hover:bg-zinc-900'
                          }`}
                        >
                          <span>{q}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-zinc-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div ref={threadEndRef} />

          {/* Sticky / Bottom Follow-Up Input Bar */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleRunSearch();
            }}
            className={`sticky bottom-4 rounded-2xl border p-2 flex items-center gap-2 shadow-2xl backdrop-blur-md ${
              isLight
                ? 'bg-white/95 border-slate-300'
                : 'bg-zinc-900/95 border-zinc-700/80'
            }`}
          >
            <Sparkles className="w-5 h-5 ml-3 text-zinc-400 shrink-0" />
            <input
              type="text"
              value={inputQuery}
              onChange={e => setInputQuery(e.target.value)}
              placeholder="Ask a follow-up question or start a new deep search..."
              className={`flex-1 bg-transparent border-none py-2 px-2 text-sm focus:outline-none ${
                isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-zinc-100 placeholder:text-zinc-500'
              }`}
             aria-label="Ask a follow-up question or start a new deep search" />
            <button
              type="submit"
              disabled={!inputQuery.trim() || isSearching}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shrink-0 border ${
                isLight
                  ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700'
              }`}
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              <span>Ask Follow-Up</span>
            </button>
          </form>
        </div>
      )}

      {/* Scraped Markdown Inspector Modal */}
      <AnimatePresence>
        {inspectingSource && (
          <div ref={focusTrapRef} role="dialog" aria-modal="true" aria-label="Scraped content inspector" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInspectingSource(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className={`relative w-full max-w-3xl max-h-[80vh] rounded-3xl border p-6 flex flex-col gap-4 z-50 overflow-hidden ${
                isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-zinc-950 border-zinc-800 text-zinc-100'
              }`}
            >
              <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">
                    Scraped Markdown Source
                  </span>
                  <h3 className="text-base font-bold truncate mt-0.5">{inspectingSource.title}</h3>
                  <a
                    href={inspectingSource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-zinc-400 hover:text-zinc-200 truncate block"
                  >
                    {inspectingSource.url}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectingSource(null)}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto rounded-2xl bg-zinc-900/80 border border-zinc-800 p-4 font-mono text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {inspectingSource.markdown ||
                  inspectingSource.content ||
                  inspectingSource.description ||
                  'No markdown content extracted.'}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onIndexSourcePage(inspectingSource);
                    setInspectingSource(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Index Page into Isaac Catalog</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Lightbox Modal */}
      <AnimatePresence>
        {lightboxImage && (
          <div ref={focusTrapRef} role="dialog" aria-modal="true" aria-label="Image viewer" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLightboxImage(null)}
              className="fixed inset-0 bg-black/85 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-3xl rounded-3xl bg-zinc-950 border border-zinc-800 p-5 flex flex-col gap-4 z-50 shadow-2xl"
            >
              <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-zinc-100 truncate">{lightboxImage.title}</h4>
                  <span className="text-xs font-mono text-zinc-400 truncate block">
                    {lightboxImage.source || lightboxImage.url}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="rounded-2xl overflow-hidden bg-black flex items-center justify-center max-h-[60vh]">
                <img
                  src={lightboxImage.thumbnail}
                  alt={lightboxImage.title}
                  className="max-h-[60vh] w-auto object-contain"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <a
                  href={lightboxImage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-zinc-300 hover:underline flex items-center gap-1"
                >
                  <span>Visit Source Page</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    onIndexImageItem(lightboxImage);
                    setLightboxImage(null);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Add to Isaac Image Index</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
