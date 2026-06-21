import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Sparkles, History, Globe, Database, HelpCircle, 
  Plus, Trash2, Link as LinkIcon, AlertCircle, Share2, 
  CheckCircle, Server, Activity, ArrowRight, Loader2, RefreshCw,
  Clock, Calendar, Settings, BookOpen, Mic, MicOff, Image as ImageIcon,
  ArrowUp, ThumbsUp, Folder, FolderPlus, FolderOpen, ChevronRight, ChevronDown, Bookmark, FileCode,
  Volume2, VolumeX, Keyboard, Command, Copy, Check, Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Interfaces
interface SearchCollection {
  id: string;
  name: string;
  description?: string;
  pages: PageItem[];
  created_at: string;
}

interface PageItem {
  id: string;
  url: string;
  title: string;
  snippet: string;
  backlinks?: number;
  indexed_at?: string;
  cache_hit?: boolean;
  likes?: number;
}

interface ImageItem {
  url: string;
  alt_text: string;
  source_url: string;
  title: string;
  dominant_color?: string;
}

interface GraphNode {
  id: string;
  url: string;
  title: string;
  size: number;
  backlinks: number;
  x: number;
  y: number;
  fx?: number;
  fy?: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

interface CrawlHistoryItem {
  id: string;
  start_url: string;
  status: string;
  pages_crawled: number;
  errors: number;
  triggered_by: string;
  timestamp: number;
  time_str: string;
}

// Default/Mock Seed Data
const DEFAULT_PAGES: PageItem[] = [
  {
    id: "page_wiki",
    url: "https://en.wikipedia.org/wiki/Search_engine",
    title: "Search engine - Wikipedia, the free encyclopedia",
    snippet: "An information retrieval software system designed to help find information stored on a computer network. Results are typically presented in a line of results, often referred to as search engine results pages.",
    backlinks: 18,
    indexed_at: "Tue Jun 16 01:48:00 2026",
    cache_hit: false,
    likes: 120
  },
  {
    id: "page_fastapi",
    url: "https://fastapi.tiangolo.com",
    title: "FastAPI - Modern, high-performance web framework",
    snippet: "FastAPI is a modern, fast (high-performance), web framework for building APIs with Python 3.8+ based on standard Python type hints. Features include key generation, auto swagger, and typing.",
    backlinks: 8,
    indexed_at: "Tue Jun 16 01:30:00 2026",
    cache_hit: true,
    likes: 180
  },
  {
    id: "page_firestore",
    url: "https://firebase.google.com/docs/firestore",
    title: "Cloud Firestore | Firebase Documentation",
    snippet: "Use Firebase Cloud Firestore to store and sync data for client- and server-side development. Cloud Firestore is a flexible, scalable database for mobile, web, and server development.",
    backlinks: 15,
    indexed_at: "Tue Jun 16 01:25:00 2026",
    cache_hit: false,
    likes: 95
  },
  {
    id: "page_whoosh",
    url: "https://whoosh.readthedocs.io",
    title: "Whoosh - Raw Python Search Engine Library",
    snippet: "Whoosh is a fast, pure-Python search engine library. It allows you to build full-text search systems easily with custom schema definition, tokenizers, highlights, and stemmers.",
    backlinks: 5,
    indexed_at: "Tue Jun 16 01:10:00 2026",
    cache_hit: true,
    likes: 45
  }
];

const SUGGESTION_POOL = [
  "fastapi firestore backend integration",
  "whoosh search engine python settings",
  "scrapy duplicate detection pipeline",
  "firebase storage index sync",
  "redis search cache ttl configurations",
  "d3 force directed graph visualization",
  "how respectful are spider crawlers"
];

const INITIAL_NODES: GraphNode[] = [
  { id: "page_wiki", url: "https://en.wikipedia.org/wiki/Search_engine", title: "Wikipedia: Search Engine", size: 22, backlinks: 18, x: 250, y: 150 },
  { id: "page_fastapi", url: "https://fastapi.tiangolo.com", title: "FastAPI Documentation", size: 14, backlinks: 8, x: 180, y: 260 },
  { id: "page_firestore", url: "https://firebase.google.com/docs/firestore", title: "Cloud Firestore Docs", size: 20, backlinks: 15, x: 380, y: 120 },
  { id: "page_whoosh", url: "https://whoosh.readthedocs.io", title: "Whoosh ReadTheDocs", size: 12, backlinks: 5, x: 350, y: 250 }
];

const INITIAL_EDGES: GraphEdge[] = [
  { source: "page_fastapi", target: "page_wiki" },
  { source: "page_firestore", target: "page_wiki" },
  { source: "page_whoosh", target: "page_fastapi" },
  { source: "page_firestore", target: "page_fastapi" }
];

const PALETTE_COLORS = [
  { name: 'red', label: 'Red', hex: '#EF4444', emoji: '🔴' },
  { name: 'orange', label: 'Orange', hex: '#F97316', emoji: '🟠' },
  { name: 'yellow', label: 'Yellow', hex: '#EAB308', emoji: '🟡' },
  { name: 'green', label: 'Green', hex: '#10B981', emoji: '🟢' },
  { name: 'teal', label: 'Teal', hex: '#14B8A6', emoji: '🌐' },
  { name: 'blue', label: 'Blue', hex: '#3B82F6', emoji: '🔵' },
  { name: 'purple', label: 'Purple', hex: '#8B5CF6', emoji: '🟣' },
  { name: 'pink', label: 'Pink', hex: '#EC4899', emoji: '🌸' },
  { name: 'brown', label: 'Brown', hex: '#78350F', emoji: '🟫' },
  { name: 'white', label: 'White', hex: '#FFFFFF', border: '#D1D5DB', emoji: '⚪' },
  { name: 'black', label: 'Black', hex: '#1F2937', emoji: '⚫' },
];

export default function App() {
  // Navigation & Search State
  const [activeTab, setActiveTab] = useState<'search' | 'crawler' | 'graph' | 'collections'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchResults, setSearchResults] = useState<PageItem[]>(() => [...DEFAULT_PAGES].sort((a, b) => (b.likes || 0) - (a.likes || 0)));
  const [currentPage, setCurrentPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [spellcheck, setSpellcheck] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [sessionId] = useState(() => uuidv4());

  // Search Collections States
  const [collections, setCollections] = useState<SearchCollection[]>(() => {
    const saved = localStorage.getItem('isaac_collections');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      {
        id: "col-ai",
        name: "AI",
        description: "Artificial Intelligence research papers & articles",
        created_at: "Wed Jun 17 01:00:00 2026",
        pages: [
          {
            id: "seed-tinygpt",
            url: "https://arxiv.org/abs/2305.tinygpt",
            title: "TinyGPT article",
            snippet: "Deep dive into TinyGPT, a 10M parameter language model optimized to run locally on low-power architectures. Includes training logs and benchmark reviews.",
            backlinks: 24,
            indexed_at: "Wed Jun 17 01:21:00 2026",
            likes: 310
          },
          {
            id: "seed-llm-paper",
            url: "https://arxiv.org/abs/2306.llmpaper",
            title: "LLM paper",
            snippet: "This technical paper describes a new architecture for large language models that drastically reduces inter-node training latency using sparse decentralized attention kernels.",
            backlinks: 45,
            indexed_at: "Tue Jun 16 22:15:00 2026",
            likes: 420
          },
          {
            id: "seed-training-guide",
            url: "https://github.com/guide/llm-training",
            title: "Training guide",
            snippet: "Step-by-step practical walk-through of fine-tuning Llama and Mistral model parameters using low-rank adaptation on a single consumer GPU card.",
            backlinks: 19,
            indexed_at: "Mon Jun 15 14:30:00 2026",
            likes: 185
          }
        ]
      },
      {
        id: "col-programming",
        name: "Programming",
        description: "Development manuals and framework documentation",
        created_at: "Wed Jun 17 01:05:00 2026",
        pages: [
          {
            id: "seed-rust-docs",
            url: "https://doc.rust-lang.org/book/",
            title: "Rust docs",
            snippet: "The official guide to the Rust programming language, covering memory safety fundamentals, cargo tooling, traits, lifetimes, and zero-cost abstractions.",
            backlinks: 150,
            indexed_at: "Wed Jun 17 08:00:00 2026",
            likes: 670
          },
          {
            id: "seed-python-tutorial",
            url: "https://docs.python.org/3/tutorial/",
            title: "Python tutorial",
            snippet: "Official tutorial introducing the basic concepts, data structures, control flow statements, modules, objects, and standard libraries of the Python 3 interpreter.",
            backlinks: 98,
            indexed_at: "Tue Jun 16 19:40:00 2026",
            likes: 240
          }
        ]
      }
    ];
  });

  const [activeSavePageId, setActiveSavePageId] = useState<string | null>(null);
  const [newFolderNameInline, setNewFolderNameInline] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>("col-ai");
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [collectionsViewMode, setCollectionsViewMode] = useState<'board' | 'tree'>('board');
  const [collectionsQuery, setCollectionsQuery] = useState('');
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const [searchWithinQuery, setSearchWithinQuery] = useState('');
  const [speakingPageId, setSpeakingPageId] = useState<string | null>(null);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Success toast notifications state & handler
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'info' | 'error' }>>([]);
  const [copiedPageId, setCopiedPageId] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  const handleCopyPageUrl = async (e: React.MouseEvent, item: PageItem) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(item.url);
      setCopiedPageId(item.id);
      showToast(`Copied search response link to clipboard!`, 'success');
      setTimeout(() => {
        setCopiedPageId(null);
      }, 2000);
    } catch (err) {
      showToast('Could not copy link to clipboard.', 'error');
    }
  };

  const handleEmailShare = (e: React.MouseEvent, item: PageItem) => {
    e.stopPropagation();
    const subject = encodeURIComponent(`Search Result: ${item.title}`);
    const body = encodeURIComponent(
      `Check out this search result from Isaac Search:\n\n` +
      `Title: ${item.title}\n` +
      `URL: ${item.url}\n` +
      `Description: ${item.snippet}\n\n` +
      `Sent via Isaac Search.`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    showToast(`Opening your email client to share!`, 'success');
  };

  const filteredSearchResults = useMemo(() => {
    if (!searchWithinQuery.trim()) return searchResults;
    const innerQ = searchWithinQuery.toLowerCase().trim();
    return searchResults.filter(p => 
      p.title.toLowerCase().includes(innerQ) || 
      p.snippet.toLowerCase().includes(innerQ) || 
      p.url.toLowerCase().includes(innerQ)
    );
  }, [searchResults, searchWithinQuery]);

  const filteredCollections = useMemo(() => {
    if (!collectionsQuery.trim()) return collections;
    const q = collectionsQuery.toLowerCase().trim();
    return collections.map(col => {
      const colNameMatches = col.name.toLowerCase().includes(q) || (col.description && col.description.toLowerCase().includes(q));
      const filteredPages = col.pages.filter(page => 
        page.title.toLowerCase().includes(q) || 
        page.snippet.toLowerCase().includes(q) ||
        (page.url && page.url.toLowerCase().includes(q))
      );
      
      if (colNameMatches || filteredPages.length > 0) {
        return {
          ...col,
          pages: filteredPages.length > 0 ? filteredPages : col.pages
        };
      }
      return null;
    }).filter((col): col is SearchCollection => col !== null);
  }, [collections, collectionsQuery]);

  // Voice Search states
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  // Search Mode & Image results states
  const [searchMode, setSearchMode] = useState<'all' | 'images'>('all');
  const [imageResults, setImageResults] = useState<ImageItem[]>([]);
  const [isImagesLoading, setIsImagesLoading] = useState(false);
  const [selectedColorFilter, setSelectedColorFilter] = useState<string | null>(null);

  // Advanced Filter state variables
  const [filterDomain, setFilterDomain] = useState('');
  const [filterDateRange, setFilterDateRange] = useState<'any' | '24h' | '7d' | '30d' | '365d' | 'custom'>('any');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterMinBacklinks, setFilterMinBacklinks] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'likes_desc' | 'relevance' | 'date_desc' | 'date_asc' | 'backlinks_desc'>('likes_desc');
  const [showFilters, setShowFilters] = useState(false);
  
  // Crawler / Index Form State
  const [pagesList, setPagesList] = useState<PageItem[]>(DEFAULT_PAGES);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newSnippet, setNewSnippet] = useState('');
  const [indexError, setIndexError] = useState<string | null>(null);
  const [indexSuccess, setIndexSuccess] = useState(false);
  const [crawlerStatus, setCrawlerStatus] = useState({
    status: 'idle',
    pages_crawled: 5,
    errors: 0,
    started_at: 'N/A'
  });

  // Image indexing state
  const [imgUrl, setImgUrl] = useState('');
  const [imgAlt, setImgAlt] = useState('');
  const [imgSrcUrl, setImgSrcUrl] = useState('');
  const [imgTitle, setImgTitle] = useState('');
  const [imgDominantColor, setImgDominantColor] = useState('');
  const [imgSuccess, setImgSuccess] = useState(false);

  // Scheduling system state
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleInterval, setScheduleInterval] = useState<'daily' | 'weekly'>('daily');
  const [scheduleStartUrl, setScheduleStartUrl] = useState('https://news.ycombinator.com');
  const [scheduleLastRun, setScheduleLastRun] = useState('N/A');
  const [scheduleNextRun, setScheduleNextRun] = useState('N/A');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isCFSTriggering, setIsCFSTriggering] = useState(false);
  const [crawlHistory, setCrawlHistory] = useState<CrawlHistoryItem[]>([]);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);

  // Graph Visualization State
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>(INITIAL_NODES);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [graphSearchQuery, setGraphSearchQuery] = useState('');

  // Load Search History on Mount
  useEffect(() => {
    const cachedHistory = localStorage.getItem('isaac_history');
    if (cachedHistory) {
      setSearchHistory(JSON.parse(cachedHistory));
    } else {
      const defaultHist = ['fastapi', 'firestore rules', 'scrapy pipelines'];
      setSearchHistory(defaultHist);
      localStorage.setItem('isaac_history', JSON.stringify(defaultHist));
    }
    fetchScheduleAndHistory();
  }, []);

  // Save Collections to LocalStorage
  useEffect(() => {
    localStorage.setItem('isaac_collections', JSON.stringify(collections));
  }, [collections]);

  // Clean up any speaking speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputActive = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        (activeEl as HTMLElement).isContentEditable
      );

      // 1. Focus search bar on '/'
      if (e.key === '/' && !isInputActive) {
        e.preventDefault();
        setActiveTab('search');
        // Small timeout to allow input rendering / state updates in React
        setTimeout(() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
            searchInputRef.current.select();
          }
        }, 80);
        return;
      }

      // 2. Ctrl+K or Cmd+K to toggle/open Collections tab
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveTab(prev => prev === 'collections' ? 'search' : 'collections');
        return;
      }

      // 3. Escape key to dismiss modals/menus or blur input
      if (e.key === 'Escape') {
        setShowShortcutsHelp(false);
        setShowClearHistoryConfirm(false);
        setShowSuggestions(false);
        setGraphSearchQuery('');
        if (isInputActive && activeEl instanceof HTMLElement) {
          activeEl.blur();
        }
        return;
      }

      // 4. Shift+? to show/toggle Keyboard Shortcuts modal (only when not typing in form)
      if (e.key === '?' && !isInputActive) {
        // Shift+? is '?'
        e.preventDefault();
        setShowShortcutsHelp(prev => !prev);
        return;
      }

      // 5. Alt + numbers to cycle/navigate core tabs
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === '1') {
          e.preventDefault();
          setActiveTab('search');
        } else if (e.key === '2') {
          e.preventDefault();
          setActiveTab('crawler');
        } else if (e.key === '3') {
          e.preventDefault();
          setActiveTab('graph');
        } else if (e.key === '4') {
          e.preventDefault();
          setActiveTab('collections');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Page expansion content state
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [expandedPages, setExpandedPages] = useState<Record<string, any>>({});
  const [isPageLoading, setIsPageLoading] = useState<Record<string, boolean>>({});

  const handleToggleExpand = async (docId: string, fallbackItem: PageItem) => {
    if (expandedDocId === docId) {
      setExpandedDocId(null);
      return;
    }

    setExpandedDocId(docId);

    // If already loaded in state, don't fetch again
    if (expandedPages[docId]) {
      return;
    }

    setIsPageLoading(prev => ({ ...prev, [docId]: true }));
    try {
      const response = await fetch(`${API_BASE}/pages/${docId}`);
      if (response.ok) {
        const data = await response.json();
        setExpandedPages(prev => ({ ...prev, [docId]: data }));
      } else {
        throw new Error('Not found in database.');
      }
    } catch (err) {
      console.warn('Firestore fetch failed, checking local fallback:', err);
      // Fallback: Check if we have the item in the local list
      const localItem = pagesList.find(p => p.id === docId) || fallbackItem;
      const mockDoc = {
        url: localItem.url,
        title: localItem.title,
        snippet: localItem.snippet,
        content: (localItem as any).content || localItem.snippet,
        backlinks: (localItem as any).backlinks || 0,
        indexed_at: localItem.indexed_at || new Date().toLocaleString(),
      };
      setExpandedPages(prev => ({ ...prev, [docId]: mockDoc }));
    } finally {
      setIsPageLoading(prev => ({ ...prev, [docId]: false }));
    }
  };

  // Sync state between backend (if running) and mock fallback gracefully
  const API_BASE = '/api';

  // Load Schedule and Crawl History
  const fetchScheduleAndHistory = async () => {
    setIsFetchingHistory(true);
    try {
      const schedRes = await fetch(`${API_BASE}/crawler/schedule`);
      if (schedRes.ok) {
        const data = await schedRes.json();
        setScheduleEnabled(data.enabled || false);
        setScheduleInterval(data.interval || 'daily');
        setScheduleStartUrl(data.start_url || 'https://news.ycombinator.com');
        setScheduleLastRun(data.last_run || 'N/A');
        setScheduleNextRun(data.next_run || 'N/A');
      }
    } catch (_) {}

    try {
      const histRes = await fetch(`${API_BASE}/crawler/history`);
      if (histRes.ok) {
        const data = await histRes.json();
        setCrawlHistory(data);
      }
    } catch (_) {}
    setIsFetchingHistory(false);
  };

  const handleSaveSchedule = async (enabledVal: boolean, intervalVal: 'daily' | 'weekly', startUrlVal: string) => {
    setIsSavingSchedule(true);
    try {
      const response = await fetch(`${API_BASE}/crawler/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: enabledVal,
          interval: intervalVal,
          start_url: startUrlVal
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.schedule) {
          setScheduleEnabled(data.schedule.enabled);
          setScheduleInterval(data.schedule.interval);
          setScheduleStartUrl(data.schedule.start_url);
          setScheduleLastRun(data.schedule.last_run);
          setScheduleNextRun(data.schedule.next_run);
        }
      }
    } catch (_) {}
    setIsSavingSchedule(false);
    fetchScheduleAndHistory();
  };

  const handleTestCloudFunction = async () => {
    setIsCFSTriggering(true);
    try {
      await fetch(`${API_BASE}/cloud-functions/scheduled-crawl`, { method: 'POST' });
    } catch (_) {}
    setTimeout(() => {
      setIsCFSTriggering(false);
      fetchScheduleAndHistory();
    }, 1500);
  };

  const fetchImages = async (queryStr: string) => {
    setIsImagesLoading(true);
    try {
      const response = await fetch(`${API_BASE}/search/images?q=${encodeURIComponent(queryStr)}`);
      if (response.ok) {
        const data = await response.json();
        setImageResults(data || []);
      } else {
        throw new Error('Image search endpoint unreached.');
      }
    } catch (err) {
      const lowerQ = queryStr.toLowerCase();
      let topic = "nature";
      if (lowerQ.includes("flower")) topic = "flower";
      else if (lowerQ.includes("cat")) topic = "cat";
      else if (lowerQ.includes("dog")) topic = "dog";
      else if (lowerQ.includes("space") || lowerQ.includes("planet") || lowerQ.includes("star") || lowerQ.includes("galaxy")) topic = "space";
      else if (lowerQ.includes("tech") || lowerQ.includes("code") || lowerQ.includes("computer") || lowerQ.includes("hardware") || lowerQ.includes("silicon")) topic = "tech";
      
      const topics: Record<string, {id: string, title: string, color: string}[]> = {
        flower: [
          {id: "1507525428034-b723cf961d3e", title: "Stunning Pink Cherry Blossoms", color: "pink"},
          {id: "1463936575829-25148e1db1b8", title: "Yellow Sunflower Fields", color: "yellow"},
          {id: "1526047932273-341f2a7631f9", title: "Red Roses Bloom", color: "red"},
          {id: "1518709268805-4e9042af9f23", title: "White Tulips in Spring", color: "white"},
          {id: "1561181286-d3fee7d55364", title: "Purple Lavender Fields", color: "purple"},
          {id: "1490730141103-6cac27aaab94", title: "Wildflowers in Meadows", color: "orange"}
        ],
        cat: [
          {id: "1514888286974-6c03e2ca1dba", title: "Playful Ginger Kitten", color: "orange"},
          {id: "1533738363-b7f9aef128ce", title: "Cute Cat with Glasses", color: "white"},
          {id: "1573865526739-10659fec78a5", title: "Fluffy Sleeping Tabby", color: "brown"}
        ],
        dog: [
          {id: "1543466835-00a7907e9de1", title: "Happy Golden Retriever", color: "yellow"},
          {id: "1583511655857-d19b40a7a54e", title: "Charming French Bulldog", color: "black"},
          {id: "1534361960057-19889db9621e", title: "Alert Beagle Puppy", color: "brown"}
        ],
        space: [
          {id: "1451187580459-43490279c0fa", title: "Deep Planetary Nebula", color: "purple"},
          {id: "1446776811953-b23d57bd21aa", title: "Earth Seen From Orbit", color: "blue"},
          {id: "1506318137071-a8e063b4bec0", title: "Starry Night Sky", color: "black"}
        ],
        tech: [
          {id: "1518770660439-4636190af475", title: "Silicon Microchip Circuitry", color: "green"},
          {id: "1555066931-4365d14bab8c", title: "Developer IDE Code Editor", color: "black"},
          {id: "1488590528505-98d2b5aba04b", title: "Modern Clean Workspace", color: "white"}
        ],
        nature: [
          {id: "1470071459604-3b5ec3a7fe05", title: "Misty Alpine Forest", color: "green"},
          {id: "1447752875215-b2761acb3c5d", title: "Rushing Autumn Waterfall", color: "teal"},
          {id: "1501785888041-af3ef285b470", title: "Serene Mountain Lake View", color: "blue"}
        ]
      };
      
      const activeItems = topics[topic] || topics["nature"];
      const mockImgs: ImageItem[] = activeItems.map(item => ({
        url: `https://images.unsplash.com/photo-${item.id}?auto=format&fit=crop&w=600&q=80`,
        alt_text: item.title,
        source_url: `https://unsplash.com/photos/${item.id}`,
        title: item.title,
        dominant_color: item.color
      }));
      setImageResults(mockImgs);
    } finally {
      setIsImagesLoading(false);
    }
  };

  const handleSearch = async (queryStr: string = searchQuery, bypassState = false) => {
    if (!queryStr.trim()) return;
    setIsSearching(true);
    setShowSuggestions(false);
    setSearchWithinQuery('');
    fetchImages(queryStr);
    
    // Save to history
    saveToHistory(queryStr);

    let backendUrl = `${API_BASE}/search?q=${encodeURIComponent(queryStr)}&page=1&limit=10`;
    
    if (filterDomain.trim()) {
      backendUrl += `&domain=${encodeURIComponent(filterDomain.trim())}`;
    }
    if (filterMinBacklinks > 0) {
      backendUrl += `&min_backlinks=${filterMinBacklinks}`;
    }
    if (sortBy !== 'relevance') {
      backendUrl += `&sort_by=${sortBy}`;
    }
    if (filterDateRange !== 'any') {
      const nowSec = Math.floor(Date.now() / 1000);
      let dateFromSec = 0;
      if (filterDateRange === '24h') dateFromSec = nowSec - 24 * 60 * 60;
      else if (filterDateRange === '7d') dateFromSec = nowSec - 7 * 24 * 60 * 60;
      else if (filterDateRange === '30d') dateFromSec = nowSec - 30 * 24 * 60 * 60;
      else if (filterDateRange === '365d') dateFromSec = nowSec - 365 * 24 * 60 * 60;
      else if (filterDateRange === 'custom') {
        if (filterStartDate) {
          dateFromSec = Math.floor(new Date(filterStartDate).getTime() / 1000);
        }
        if (filterEndDate) {
          const dateToSec = Math.floor(new Date(filterEndDate).getTime() / 1000);
          backendUrl += `&date_to=${dateToSec}`;
        }
      }
      
      if (dateFromSec > 0) {
        backendUrl += `&date_from=${dateFromSec}`;
      }
    }

    try {
      // Try hitting our python dev backend
      const response = await fetch(backendUrl);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
        setSpellcheck(null);
      } else {
        throw new Error('Backend unreached, using fast local search matching.');
      }
    } catch (e) {
      // Local Client Query Engine (Fallback)
      setTimeout(() => {
        const lowerQ = queryStr.toLowerCase();
        let filtered = pagesList.filter(p => 
          p.title.toLowerCase().includes(lowerQ) || 
          (p.content && p.content.toLowerCase().includes(lowerQ)) || 
          p.snippet.toLowerCase().includes(lowerQ) ||
          p.url.toLowerCase().includes(lowerQ)
        );
        
        // Apply domain filter client-side
        if (filterDomain.trim()) {
          const domLower = filterDomain.toLowerCase().trim();
          filtered = filtered.filter(p => p.url.toLowerCase().includes(domLower));
        }

        // Apply backlink threshold client-side
        if (filterMinBacklinks > 0) {
          filtered = filtered.filter(p => (p.backlinks || 0) >= filterMinBacklinks);
        }

        // Apply date range filter client-side
        if (filterDateRange !== 'any') {
          const nowMs = Date.now();
          let boundaryMs = 0;
          if (filterDateRange === '24h') boundaryMs = nowMs - 24 * 60 * 60 * 1000;
          else if (filterDateRange === '7d') boundaryMs = nowMs - 7 * 24 * 60 * 60 * 1000;
          else if (filterDateRange === '30d') boundaryMs = nowMs - 30 * 24 * 60 * 60 * 1000;
          else if (filterDateRange === '365d') boundaryMs = nowMs - 365 * 24 * 60 * 60 * 1000;
          else if (filterDateRange === 'custom') {
            const startVal = filterStartDate ? new Date(filterStartDate).getTime() : 0;
            const endVal = filterEndDate ? new Date(filterEndDate).getTime() : Infinity;
            filtered = filtered.filter(p => {
              const itemTime = p.indexed_at ? new Date(p.indexed_at).getTime() : 0;
              return itemTime >= startVal && itemTime <= endVal;
            });
          }

          if (filterDateRange !== 'custom' && boundaryMs > 0) {
            filtered = filtered.filter(p => {
              const itemTime = p.indexed_at ? new Date(p.indexed_at).getTime() : 0;
              return itemTime >= boundaryMs;
            });
          }
        }

        // Apply sorting client-side
        if (sortBy === 'likes_desc' || sortBy === 'relevance') {
          filtered.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        } else if (sortBy === 'date_desc') {
          filtered.sort((a, b) => {
            const timeA = a.indexed_at ? new Date(a.indexed_at).getTime() : 0;
            const timeB = b.indexed_at ? new Date(b.indexed_at).getTime() : 0;
            return timeB - timeA;
          });
        } else if (sortBy === 'date_asc') {
          filtered.sort((a, b) => {
            const timeA = a.indexed_at ? new Date(a.indexed_at).getTime() : 0;
            const timeB = b.indexed_at ? new Date(b.indexed_at).getTime() : 0;
            return timeA - timeB;
          });
        } else if (sortBy === 'backlinks_desc') {
          filtered.sort((a, b) => (b.backlinks || 0) - (a.backlinks || 0));
        }

        // Dynamic snippet generator highlighting search query
        const processedResults = filtered.map(item => {
          const hasCache = Math.random() > 0.4;
          return {
            ...item,
            cache_hit: hasCache
          };
        });

        setSearchResults(processedResults);
        
        // Simple Spellcheck generator
        if (queryStr === 'fastapdoc') {
          setSpellcheck('fastapi doc');
        } else if (queryStr === 'whereosh') {
          setSpellcheck('whoosh');
        } else if (queryStr === 'firestur') {
          setSpellcheck('firestore');
        } else {
          setSpellcheck(null);
        }
        setIsSearching(false);
      }, 500);
      return;
    }
    setIsSearching(false);
  };

  const saveToHistory = (queryStr: string) => {
    if (!searchHistory.includes(queryStr)) {
      const newHist = [queryStr, ...searchHistory.slice(0, 9)];
      setSearchHistory(newHist);
      localStorage.setItem('isaac_history', JSON.stringify(newHist));

      // Attempt backend call
      fetch(`${API_BASE}/history/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, query: queryStr })
      }).catch(() => {});
    }
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('isaac_history');
    fetch(`${API_BASE}/history?session_id=${sessionId}`, { method: 'DELETE' }).catch(() => {});
  };

  const handleReadAloud = (item: PageItem) => {
    if (speakingPageId === item.id) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setSpeakingPageId(null);
    } else {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        
        const cleanTitle = item.title ? item.title.trim() : "";
        const cleanSnippet = item.snippet ? item.snippet.trim() : "";
        const textToSpeak = `${cleanTitle}. ${cleanSnippet}`;
        
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        
        utterance.onend = () => {
          setSpeakingPageId(null);
        };
        utterance.onerror = () => {
          setSpeakingPageId(null);
        };
        
        setSpeakingPageId(item.id);
        window.speechSynthesis.speak(utterance);
      } else {
        alert('Speech Synthesis/Text-to-Speech is not supported in this browser.');
      }
    }
  };

  const handleLikePage = (id: string) => {
    // 1. Update overall pagesList
    setPagesList(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, likes: (p.likes || 0) + 1 };
      }
      return p;
    }));

    // 2. Update searchResults and sort if on likes_desc sorting (or by default)
    setSearchResults(prev => {
      const updated = prev.map(p => {
        if (p.id === id) {
          return { ...p, likes: (p.likes || 0) + 1 };
        }
        return p;
      });

      if (sortBy === 'likes_desc' || sortBy === 'relevance') {
        return [...updated].sort((a, b) => (b.likes || 0) - (a.likes || 0));
      }
      return updated;
    });

    // 3. Attempt firestore or backend persistence if needed
    fetch(`${API_BASE}/pages/${id}/like`, { method: 'POST' }).catch(() => {});
  };

  const handleCreateCollection = (name: string, description?: string) => {
    if (!name.trim()) return;
    const isDuplicate = collections.some(col => col.name.toLowerCase() === name.trim().toLowerCase());
    if (isDuplicate) return;
    
    const newCol: SearchCollection = {
      id: `col-${Date.now()}`,
      name: name.trim(),
      description: description?.trim() || "",
      created_at: new Date().toUTCString(),
      pages: []
    };
    
    setCollections(prev => [...prev, newCol]);
  };

  const handleDeleteCollection = (colId: string) => {
    setCollections(prev => prev.filter(col => col.id !== colId));
    if (selectedCollectionId === colId) {
      setSelectedCollectionId(null);
    }
  };

  const handleAddPageToCollection = (colId: string, page: PageItem) => {
    setCollections(prev => prev.map(col => {
      if (col.id === colId) {
        // Prevent duplicate pages in same collection
        const pageExists = col.pages.some(p => p.url === page.url);
        if (pageExists) return col;
        return {
          ...col,
          pages: [...col.pages, page]
        };
      }
      return col;
    }));
  };

  const handleRemovePageFromCollection = (colId: string, pageId: string) => {
    setCollections(prev => prev.map(col => {
      if (col.id === colId) {
        return {
          ...col,
          pages: col.pages.filter(p => p.id !== pageId)
        };
      }
      return col;
    }));
  };

  const getCollectionsTreeText = () => {
    let output = "Plain text\n";
    filteredCollections.forEach((col) => {
      output += `${col.name}\n`;
      if (col.pages.length === 0) {
        output += " └─ (Empty folder)\n";
      } else {
        col.pages.forEach((page, pageIdx) => {
          const isLast = pageIdx === col.pages.length - 1;
          output += ` ${isLast ? '└─' : '├─'} ${page.title}\n`;
        });
      }
      output += "\n";
    });
    return output.trim();
  };

  // Voice Search / Speech Recognition setup with robust ref pattern
  const handleSearchRef = useRef(handleSearch);
  useEffect(() => {
    handleSearchRef.current = handleSearch;
  }, [handleSearch]);

  const SpeechRecognition = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        setSearchQuery(transcript);
        handleSearchRef.current(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  const toggleListening = () => {
    if (!speechSupported || !recognitionRef.current) {
      alert("Voice search (Speech Recognition API) is not supported in this browser. Please try utilizing Google Chrome, Safari, or Chromium-based browsers.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Speech recognition start failed:", err);
      }
    }
  };

  // Autocomplete Suggestions
  const getSuggestionsList = () => {
    if (!searchQuery) return [];
    return SUGGESTION_POOL.filter(item => 
      item.toLowerCase().startsWith(searchQuery.toLowerCase())
    );
  };

  // Submit index manually
  const handleIndexSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIndexError(null);
    setIndexSuccess(false);

    if (!newUrl.startsWith('http')) {
      setIndexError('Please enter a valid absolute URL (starting with http:// or https://)');
      return;
    }

    const newPage: PageItem = {
      id: "manual_" + Math.random().toString(36).substr(2, 9),
      url: newUrl,
      title: newTitle || newUrl,
      snippet: newSnippet || "No description crawled yet for this custom URL address.",
      backlinks: 0,
      indexed_at: new Date().toUTCString(),
      likes: 0
    };

    try {
      const response = await fetch(`${API_BASE}/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPage)
      });
      if (response.ok) {
        setIndexSuccess(true);
      } else {
        throw new Error('API server unavailable. Added to sandbox environment.');
      }
    } catch (_) {
      // Offline fallback
      setPagesList([newPage, ...pagesList]);
      
      // Update site link graph with a new node representing this site
      const domain = newUrl.replace('https://', '').replace('http://', '').split('/')[0];
      const newNode: GraphNode = {
        id: newPage.id,
        url: newUrl,
        title: newTitle || domain,
        size: 10,
        backlinks: 0,
        x: 100 + Math.random() * 300,
        y: 100 + Math.random() * 200
      };
      setGraphNodes(prev => [...prev, newNode]);
      
      // Connect to wikipedia randomly for crawler viz representation
      setGraphEdges(prev => [...prev, { source: newNode.id, target: "page_wiki" }]);
      setIndexSuccess(true);
    }

    // Clear form inputs
    setNewUrl('');
    setNewTitle('');
    setNewContent('');
    setNewSnippet('');
  };

  // Submit image index
  const handleImageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImgSuccess(false);

    if (!imgUrl.startsWith('http') || !imgSrcUrl.startsWith('http')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/index/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: imgUrl,
          alt_text: imgAlt,
          source_url: imgSrcUrl,
          title: imgTitle,
          dominant_color: imgDominantColor || undefined
        })
      });
      if (response.ok) {
        setImgSuccess(true);
      } else {
        setImgSuccess(true); // fall-through success for preview sandbox
      }
    } catch (_) {
      setImgSuccess(true);
    }

    // Reset fields
    setImgUrl('');
    setImgAlt('');
    setImgSrcUrl('');
    setImgTitle('');
    setImgDominantColor('');
  };

  // Crawl starter trigger
  const triggerCrawl = async () => {
    setCrawlerStatus(prev => ({ ...prev, status: 'running', started_at: new Date().toLocaleTimeString() }));
    try {
      await fetch(`${API_BASE}/crawl/start`, { method: 'POST' });
    } catch (_) {}

    // Mock progress events for visuals
    setTimeout(() => {
      setCrawlerStatus(prev => ({ ...prev, pages_crawled: prev.pages_crawled + 3 }));
    }, 1500);
    setTimeout(() => {
      setCrawlerStatus(prev => ({ ...prev, pages_crawled: prev.pages_crawled + 4, status: 'idle' }));
      fetchScheduleAndHistory();
    }, 4000);
  };

  // Helper UUID function
  function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Interactive Graph drag-and-drop mechanics
  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggedNode || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setGraphNodes(prev => prev.map(n => 
      n.id === draggedNode ? { ...n, x, y } : n
    ));
  };

  const handleNodeMouseDown = (id: string) => {
    setDraggedNode(id);
    const node = graphNodes.find(n => n.id === id);
    if (node) setSelectedNode(node);
  };

  const handleSvgMouseUp = () => {
    setDraggedNode(null);
  };

  return (
    <div className="min-h-screen bg-[#03030d] text-slate-200 font-sans flex flex-col justify-between selection:bg-indigo-500/30 selection:text-indigo-200 relative overflow-x-hidden">
      {/* Decorative Atmospheric Glow Blobs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] right-[10%] w-[250px] h-[250px] bg-purple-500/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Header Centered Layout */}
      <header className="py-8 px-6 text-center relative z-10">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-6">
          
          {/* Brand Logo and Title */}
          <div className="flex flex-col items-center gap-1 cursor-pointer select-none group" onClick={() => { setActiveTab('search'); setSearchQuery(''); setSearchResults(DEFAULT_PAGES); }}>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-400 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(99,102,241,0.35)] font-sans">
              Isaac Search
            </h1>
          </div>

          {/* Navigation Controls (Circular and Rounder Cards) */}
          <nav className="flex items-center justify-center gap-4 sm:gap-6 mt-2">
            <button 
              id="nav-search-btn"
              onClick={() => setActiveTab('search')}
              className={`p-5 rounded-[24px] border transition-all duration-300 flex flex-col items-center justify-center gap-2 w-28 h-28 sm:w-32 sm:h-32 select-none cursor-pointer ${
                activeTab === 'search' 
                  ? 'border-indigo-500 bg-indigo-950/20 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.25)]' 
                  : 'border-slate-800 bg-[#070719]/40 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className={`p-2 rounded-full transition-colors ${activeTab === 'search' ? 'bg-indigo-500/15 text-indigo-300' : 'bg-slate-900/60 text-slate-400'}`}>
                <Search className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold leading-tight font-sans text-center">Search Engine</span>
            </button>
            <button 
              id="nav-crawler-btn"
              onClick={() => setActiveTab('crawler')}
              className={`p-5 rounded-[24px] border transition-all duration-300 flex flex-col items-center justify-center gap-2 w-28 h-28 sm:w-32 sm:h-32 select-none cursor-pointer ${
                activeTab === 'crawler' 
                  ? 'border-indigo-500 bg-indigo-950/20 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.25)]' 
                  : 'border-slate-800 bg-[#070719]/40 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className={`p-2 rounded-full transition-colors ${activeTab === 'crawler' ? 'bg-indigo-500/15 text-indigo-300' : 'bg-slate-900/60 text-slate-400'}`}>
                <Database className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold leading-tight font-sans text-center">Index & Crawler</span>
            </button>
            <button 
              id="nav-graph-btn"
              onClick={() => setActiveTab('graph')}
              className={`p-5 rounded-[24px] border transition-all duration-300 flex flex-col items-center justify-center gap-2 w-28 h-28 sm:w-32 sm:h-32 select-none cursor-pointer ${
                activeTab === 'graph' 
                  ? 'border-indigo-500 bg-indigo-950/20 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.25)]' 
                  : 'border-slate-800 bg-[#070719]/40 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className={`p-2 rounded-full transition-colors ${activeTab === 'graph' ? 'bg-indigo-500/15 text-indigo-300' : 'bg-slate-900/60 text-slate-400'}`}>
                <Activity className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold leading-tight font-sans text-center">Crawl Graph</span>
            </button>
            <button 
              id="nav-collections-btn"
              onClick={() => setActiveTab('collections')}
              className={`p-5 rounded-[24px] border transition-all duration-300 flex flex-col items-center justify-center gap-2 w-28 h-28 sm:w-32 sm:h-32 select-none cursor-pointer relative ${
                activeTab === 'collections' 
                  ? 'border-indigo-500 bg-indigo-950/20 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.25)]' 
                  : 'border-slate-800 bg-[#070719]/40 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className={`p-2 rounded-full transition-colors ${activeTab === 'collections' ? 'bg-indigo-500/15 text-indigo-300' : 'bg-slate-900/60 text-slate-400'}`}>
                <Folder className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold leading-tight font-sans text-center">Collections</span>
              {collections.length > 0 && (
                <span className="absolute top-2 right-2 bg-indigo-500 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {collections.reduce((acc, col) => acc + col.pages.length, 0)}
                </span>
              )}
            </button>
          </nav>



        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 relative z-10">
        
        {/* TAB 1: SEARCH INTERFACE */}
        {activeTab === 'search' && (
          <div className="max-w-3xl mx-auto flex flex-col gap-6 py-2">

            {/* Listening Indicator overlay */}
            <AnimatePresence>
              {isListening && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-indigo-900 text-white p-4 rounded-2xl flex items-center justify-between gap-4 shadow-xl border border-indigo-700 mx-auto w-full max-w-2xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 animate-pulse">
                      <Mic className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold tracking-tight">Listening closely...</div>
                      <div className="text-xs text-indigo-200 font-sans">Speak your search keywords clearly now</div>
                    </div>
                  </div>
                  
                  {/* Dynamic pulse CSS/SVG mock waveform style */}
                  <div className="flex items-end gap-1 h-5 shrink-0 px-2">
                    <span className="w-1 bg-red-400 rounded-full animate-pulse h-3" />
                    <span className="w-1 bg-red-400 rounded-full animate-pulse h-5" />
                    <span className="w-1 bg-red-400 rounded-full animate-pulse h-2" />
                    <span className="w-1 bg-red-400 rounded-full animate-pulse h-6" />
                    <span className="w-1 bg-red-400 rounded-full animate-pulse h-4" />
                  </div>

                  <button 
                    onClick={() => { if (recognitionRef.current) recognitionRef.current.stop(); }}
                    className="px-3 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-semibold font-mono tracking-wider transition-all uppercase"
                  >
                    Cancel
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Absolute Search Container */}
            <div className="relative">
              <div className="flex items-center bg-[#070719]/90 border border-slate-800 hover:border-slate-700/80 focus-within:ring-4 focus-within:ring-indigo-950/40 focus-within:border-indigo-500/80 transition-all rounded-full shadow-lg p-2 gap-2">
                <Search className="w-5 h-5 text-slate-500 ml-3 shrink-0" />
                <input 
                  ref={searchInputRef}
                  type="text"
                  placeholder="Ask anything or enter site queries (try 'fastapdoc', 'firestore', 'whoosh')..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  onFocus={() => setShowSuggestions(true)}
                  className="flex-1 bg-transparent border-none py-2 px-1 text-slate-100 text-base focus:outline-none placeholder:text-slate-500 min-w-0"
                />
                
                {/* Visual indicator of keyboard shortcut '/' to focus */}
                {!searchQuery && (
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold text-slate-500 bg-slate-900 border border-slate-800 rounded-lg select-none mr-1">
                    /
                  </span>
                )}
                
                {/* Voice Search Trigger Button */}
                <button
                  id="voice-search-btn"
                  onClick={toggleListening}
                  title={isListening ? "Stop listening" : "Search with your voice"}
                  className={`p-2.5 rounded-full transition-all relative flex items-center justify-center shrink-0 ${
                    isListening 
                      ? 'bg-red-950/40 text-red-400 ring-2 ring-red-900/50 animate-pulse' 
                      : speechSupported
                        ? 'text-slate-400 hover:text-indigo-400 hover:bg-slate-900/60' 
                        : 'text-slate-600 cursor-not-allowed opacity-55'
                  }`}
                  disabled={!speechSupported}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-5 h-5" />
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                    </>
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </button>

                {searchQuery && (
                  <button 
                    onClick={() => { setSearchQuery(''); setSearchResults(DEFAULT_PAGES); }}
                    className="p-1 px-3 bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 rounded-full text-xs font-medium transition-colors"
                  >
                    Clear
                  </button>
                )}

                <button 
                  onClick={() => handleSearch()}
                  disabled={isSearching}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold py-2 px-6 rounded-full text-sm transition-all duration-300 shadow-[0_0_15px_rgba(124,58,237,0.35)] flex items-center gap-1.5 shrink-0"
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Search</span>
                </button>
              </div>

              {/* Suggestions dropdown */}
              <AnimatePresence>
                {showSuggestions && searchQuery && getSuggestionsList().length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute left-0 right-0 mt-2 bg-[#09091f] border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-800/60"
                  >
                    {getSuggestionsList().map((item, idx) => (
                      <div 
                        key={idx}
                        onClick={() => {
                          setSearchQuery(item);
                          handleSearch(item);
                        }}
                        className="px-4 py-3 hover:bg-indigo-950/40 cursor-pointer flex items-center gap-2.5 text-sm text-slate-300 transition-all font-medium"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Compact Recent Search Pills */}
            {searchHistory.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 px-2 text-xs -mt-1 select-none">
                <span className="text-slate-500 font-mono font-bold flex items-center gap-1 shrink-0">
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  Recent:
                </span>
                <div className="flex flex-wrap items-center gap-1.5 overflow-hidden">
                  {searchHistory.map((hist, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSearchQuery(hist);
                        handleSearch(hist);
                      }}
                      className="px-2.5 py-1 bg-slate-900/60 border border-slate-800 text-slate-300 hover:text-indigo-400 hover:border-indigo-500/50 text-xs rounded-xl font-medium transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>{hist}</span>
                    </button>
                  ))}
                   <button 
                    onClick={() => setShowClearHistoryConfirm(true)}
                    className="text-[10px] font-bold text-red-400 hover:text-red-300 flex items-center gap-0.5 cursor-pointer ml-1 font-mono leading-none"
                    title="Clear recent searches"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>
            )}

            {/* Filter Toggle and Chip list */}
            <div className="flex flex-wrap items-center justify-between gap-3 -mt-2 px-2">
              <button
                id="toggle-filters-btn"
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 text-xs font-bold font-mono tracking-wider transition-colors ${
                  showFilters || filterDomain || filterMinBacklinks > 0 || filterDateRange !== 'any'
                    ? 'text-indigo-400 hover:text-indigo-300 font-bold' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{showFilters ? 'Hide Advanced Filters [-]' : 'Show Advanced Filters [+]'}</span>
                {(filterDomain || filterMinBacklinks > 0 || filterDateRange !== 'any' || (sortBy !== 'likes_desc' && sortBy !== 'relevance')) && (
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                )}
              </button>
              
              {/* Active Filter summary chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {filterDomain && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-950/40 text-indigo-300 border border-indigo-900/60 text-[10px] font-mono leading-none">
                    Site: {filterDomain}
                  </span>
                )}
                {filterMinBacklinks > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-950/40 text-indigo-300 border border-indigo-900/60 text-[10px] font-mono leading-none">
                    {filterMinBacklinks}+ backlinks
                  </span>
                )}
                {filterDateRange !== 'any' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-950/40 text-indigo-300 border border-indigo-900/60 text-[10px] font-mono leading-none">
                    Date: {filterDateRange === 'custom' ? 'Custom Range' : filterDateRange}
                  </span>
                )}
                {(sortBy !== 'likes_desc' && sortBy !== 'relevance') && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900/80 text-slate-300 border border-slate-800 text-[10px] font-mono leading-none font-medium">
                    Sort: {sortBy}
                  </span>
                )}
                {(filterDomain || filterMinBacklinks > 0 || filterDateRange !== 'any' || (sortBy !== 'likes_desc' && sortBy !== 'relevance')) && (
                  <button 
                    onClick={() => {
                      setFilterDomain('');
                      setFilterMinBacklinks(0);
                      setFilterDateRange('any');
                      setFilterStartDate('');
                      setFilterEndDate('');
                      setSortBy('likes_desc');
                      setTimeout(() => handleSearch(searchQuery), 10);
                    }}
                    className="text-[10px] font-mono text-red-400 hover:text-red-300 hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Advanced Filters Panel */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-[#070719]/95 border border-slate-805 rounded-2xl shadow-xl overflow-hidden -mt-4 border-slate-800"
                >
                  <div className="p-5 flex flex-col gap-4 divide-y divide-slate-800/60">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Domain Input */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-400 font-mono">Restricted Domain</label>
                        <input 
                          type="text"
                          placeholder="e.g. ycombinator.com"
                          value={filterDomain}
                          onChange={(e) => setFilterDomain(e.target.value)}
                          className="border border-slate-800 focus:ring-2 focus:ring-indigo-950 focus:border-indigo-500 bg-[#03030d] text-slate-200 rounded-xl p-2.5 text-xs outline-none"
                        />
                      </div>

                      {/* Date Range Dropdown */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-400 font-mono">Date Range Limit</label>
                        <select
                          value={filterDateRange}
                          onChange={(e) => setFilterDateRange(e.target.value as any)}
                          className="border border-slate-800 focus:ring-2 focus:ring-indigo-950 focus:border-indigo-500 bg-[#03030d] text-slate-200 rounded-xl p-2.5 text-xs outline-none font-sans"
                        >
                          <option value="any">Any time</option>
                          <option value="24h">Past 24 hours</option>
                          <option value="7d">Past week</option>
                          <option value="30d">Past month</option>
                          <option value="365d">Past year</option>
                          <option value="custom">Custom Range...</option>
                        </select>
                      </div>

                      {/* Min Backlinks threshold */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-400 font-mono">Minimum Backlinks</label>
                        <select
                          value={filterMinBacklinks}
                          onChange={(e) => setFilterMinBacklinks(Number(e.target.value))}
                          className="border border-slate-800 focus:ring-2 focus:ring-indigo-950 focus:border-indigo-500 bg-[#03030d] text-slate-200 rounded-xl p-2.5 text-xs outline-none"
                        >
                          <option value={0}>Any count (default)</option>
                          <option value={5}>Min 5 backlinks</option>
                          <option value={10}>Min 10 backlinks</option>
                          <option value={15}>Min 15 backlinks</option>
                        </select>
                      </div>
                    </div>

                    {/* Custom Date Inputs (Conditional) */}
                    {filterDateRange === 'custom' && (
                      <div className="grid grid-cols-2 gap-4 pt-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-slate-400 font-mono">Start Date</label>
                          <input 
                            type="date"
                            value={filterStartDate}
                            onChange={(e) => setFilterStartDate(e.target.value)}
                            className="border border-slate-800 focus:ring-2 focus:ring-indigo-950 focus:border-indigo-500 bg-[#03030d] text-slate-200 rounded-xl p-2 px-3 text-xs outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-slate-400 font-mono">End Date</label>
                          <input 
                            type="date"
                            value={filterEndDate}
                            onChange={(e) => setFilterEndDate(e.target.value)}
                            className="border border-slate-800 focus:ring-2 focus:ring-indigo-950 focus:border-indigo-500 bg-[#03030d] text-slate-200 rounded-xl p-2 px-3 text-xs outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Sort controls and Trigger Action */}
                    <div className="flex items-center justify-between gap-4 pt-4 text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 uppercase font-bold text-[10px]">Sorting:</span>
                        <select 
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as any)}
                          className="border border-slate-800 bg-[#03030d] p-1 px-2.5 rounded outline-none font-sans font-medium text-slate-300"
                        >
                          <option value="likes_desc">Likes: High to Low</option>
                          <option value="relevance">Relevance</option>
                          <option value="date_desc">Date: Newest First</option>
                          <option value="date_asc">Date: Oldest First</option>
                          <option value="backlinks_desc">Backlinks: High to Low</option>
                        </select>
                      </div>

                      <button 
                        onClick={() => handleSearch()}
                        className="bg-indigo-600 hover:bg-indigo-505 text-white font-mono font-bold px-4 py-2 rounded-xl transition-all hover:bg-indigo-500 shadow-lg shadow-indigo-950/40"
                      >
                        Apply Filters & Search
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Spell Correction Widget */}
            {spellcheck && (
              <div className="bg-amber-950/20 border border-amber-900/60 p-3.5 rounded-xl flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <span className="text-sm text-amber-300">
                  Did you mean:{' '}
                  <button 
                    onClick={() => { setSearchQuery(spellcheck); handleSearch(spellcheck); }}
                    className="font-bold underline text-indigo-400 hover:text-indigo-300"
                  >
                    {spellcheck}
                  </button>?
                </span>
              </div>
            )}

            {/* Search Tabs (All vs. Images) */}
            <div className="flex items-center gap-1.5 border-b border-slate-800/80 mt-2 pb-px select-none">
              <button
                id="search-mode-all-btn"
                onClick={() => setSearchMode('all')}
                type="button"
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-all relative cursor-pointer ${
                  searchMode === 'all'
                    ? 'border-indigo-505 text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <Search className="w-4 h-4" />
                <span>All Results</span>
                {searchMode === 'all' && (
                  <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-400" />
                )}
              </button>
              <button
                id="search-mode-images-btn"
                onClick={() => setSearchMode('images')}
                type="button"
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-all relative cursor-pointer ${
                  searchMode === 'images'
                    ? 'border-indigo-555 border-indigo-400 text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>Images</span>
                {searchMode === 'images' && (
                  <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-400" />
                )}
              </button>
            </div>

            {/* Conditional Results Segments */}
            {searchMode === 'all' ? (
              /* Search Results Segment */
              <div className="flex flex-col gap-6 mt-2">
                {/* Search within results input bar */}
                {searchResults.length > 0 && (
                  <div className="bg-[#070719]/40 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4 justify-between transition-all duration-300">
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 font-sans">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        Search within results
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest font-bold">
                        Detailed Inner Filter
                      </span>
                    </div>

                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <Search className="w-4 h-4 text-slate-500" />
                      </div>
                      <input
                        type="text"
                        placeholder="Type keywords to drill down on titles, snippets or URLs shown below..."
                        value={searchWithinQuery}
                        onChange={(e) => setSearchWithinQuery(e.target.value)}
                        className="w-full pl-9 pr-16 py-2.5 bg-[#03030d] border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-slate-200 placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-950 transition-all font-sans"
                      />
                      {searchWithinQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchWithinQuery('')}
                          className="absolute inset-y-0 right-3 flex items-center text-red-400 hover:text-red-300 transition-colors text-xs font-mono font-sans font-bold pr-1"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">
                        {searchWithinQuery.trim() ? "Matches" : "Total View"}
                      </span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-950/40 border border-indigo-500/20 text-indigo-400">
                        {filteredSearchResults.length} of {searchResults.length}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-slate-500 font-mono border-b border-slate-800/60 pb-3">
                  {searchWithinQuery.trim() ? (
                    <span className="text-indigo-400 font-bold">Showing {filteredSearchResults.length} filtered entries of {searchResults.length} matches</span>
                  ) : (
                    <span>About {searchResults.length} results indexed in Firestore</span>
                  )}
                  <span>Page 1 of 1</span>
                </div>

                {/* Empty state for main query */}
                {searchResults.length === 0 && (
                  <div className="text-center py-12 bg-[#070719]/40 border border-slate-800 rounded-2xl flex flex-col items-center gap-3">
                    <Globe className="w-12 h-12 text-slate-600 stroke-[1.5]" />
                    <p className="text-slate-400 font-medium">No results found for "{searchQuery}"</p>
                    <p className="text-xs text-slate-500 max-w-sm">Try searching another term, or crawl new pages in the Indexing panel.</p>
                  </div>
                )}

                {/* Empty state when original has results, but current inner query filters out everything */}
                {searchResults.length > 0 && filteredSearchResults.length === 0 && (
                  <div className="text-center py-12 bg-[#070719]/40 border border-slate-800 rounded-2xl flex flex-col items-center gap-3">
                    <Search className="w-12 h-12 text-indigo-500/80 stroke-[1.5] animate-pulse" />
                    <p className="text-slate-300 font-medium font-sans">No matching detail results for "{searchWithinQuery}"</p>
                    <p className="text-xs text-slate-500 max-w-sm">
                      We searched through all {searchResults.length} loaded matching results but found zero matches. Try clearing your query overlay or adjusting spelling.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSearchWithinQuery('')}
                      className="mt-2 px-4 py-2 text-xs font-sans font-bold text-indigo-300 bg-indigo-950/40 hover:bg-slate-900/60 border border-indigo-500/30 rounded-xl cursor-pointer hover:border-indigo-400 transition-all active:scale-95"
                    >
                      Reset Inner Search
                    </button>
                  </div>
                )}

                {/* Page Results Loop */}
                {filteredSearchResults.map((item) => (
                  <article 
                    key={item.id} 
                    className="bg-[#070719]/90 border border-slate-800 hover:border-indigo-500/50 p-5 rounded-2xl hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] transition-all flex flex-col gap-2.5 relative group"
                  >
                    {/* Cache and Metadata icons */}
                    <div className="flex items-center justify-between gap-2.5 text-xs">
                      <span className="text-indigo-400 font-mono truncate max-w-[280px] sm:max-w-md">{item.url}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.cache_hit && (
                          <span className="px-2 py-0.5 rounded bg-amber-950/20 text-amber-400 border border-amber-900/60 font-mono text-[10px] uppercase font-bold leading-none">
                            Redis Cached
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 font-mono text-[10px] leading-none">
                          BL: {item.backlinks || 0}
                        </span>
                      </div>
                    </div>

                    {/* Title hyperlink */}
                    <h3 className="text-lg font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1.5">
                        {item.title}
                        <LinkIcon className="w-4 h-4 text-slate-500 group-hover:text-indigo-300 transition-colors" />
                      </a>
                    </h3>

                    {/* Extract Text Highlight Snippet */}
                    <p className="text-sm text-slate-300 leading-relaxed font-sans">
                      {item.snippet}
                    </p>

                    {/* Footer Stats for detail */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-800/60 pt-3.5 mt-1 text-[11px] text-slate-500 font-mono">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5 text-slate-500" />
                          ID: {item.id}
                        </span>
                        <div className="w-1 h-1 rounded-full bg-slate-800"></div>
                        <span>Indexed: {item.indexed_at || "N/A"}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Vote/Like Button */}
                        <button
                          type="button"
                          id={`like-btn-${item.id}`}
                          onClick={() => handleLikePage(item.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-950/20 hover:bg-emerald-900/30 text-emerald-400 hover:text-white font-bold font-sans cursor-pointer transition-all active:scale-95"
                          title="Like / Upvote this page"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                          <span>Upvote ({item.likes || 0})</span>
                        </button>

                        {/* Save to Collection Button with Dropdown */}
                        <div className="relative">
                          <button
                            type="button"
                            id={`save-col-btn-${item.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSavePageId(activeSavePageId === item.id ? null : item.id);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-all active:scale-95 text-xs font-bold font-sans ${
                              activeSavePageId === item.id
                                ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300'
                                : 'border-slate-800 bg-[#070719]/40 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                            }`}
                            title="Save to a search collection folder"
                          >
                            <Bookmark className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>

                          {/* Dropdown Menu */}
                          <AnimatePresence>
                            {activeSavePageId === item.id && (
                              <>
                                {/* Backdrop overlay to close */}
                                <div 
                                  className="fixed inset-0 z-40" 
                                  onClick={() => setActiveSavePageId(null)} 
                                />
                                <motion.div
                                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  className="absolute right-0 bottom-full mb-2 w-64 bg-[#090924] border border-slate-800 rounded-xl p-3 shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-50 flex flex-col gap-2.5 font-sans"
                                >
                                  <div className="text-xs font-bold tracking-wider text-slate-400 uppercase border-b border-slate-800/60 pb-1.5 flex items-center justify-between">
                                    <span>Add to Collection</span>
                                    <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
                                  </div>
                                  
                                  <div className="flex flex-col gap-1 max-h-36 overflow-y-auto no-scrollbar py-0.5">
                                    {collections.map((col) => {
                                      const isSaved = col.pages.some(p => p.url === item.url);
                                      return (
                                        <button
                                          key={col.id}
                                          type="button"
                                          onClick={() => {
                                            if (isSaved) {
                                              handleRemovePageFromCollection(col.id, item.id);
                                            } else {
                                              handleAddPageToCollection(col.id, item);
                                            }
                                          }}
                                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium text-left transition-colors cursor-pointer ${
                                            isSaved
                                              ? 'bg-indigo-950/50 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-950/70'
                                              : 'hover:bg-slate-900 border border-transparent text-slate-305 text-slate-300'
                                          }`}
                                        >
                                          <span className="truncate flex items-center gap-1.5">
                                            <Folder className={`w-3.5 h-3.5 shrink-0 ${isSaved ? 'text-indigo-400' : 'text-slate-500'}`} />
                                            {col.name}
                                          </span>
                                          {isSaved && (
                                            <span className="text-[9px] font-bold bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-mono">
                                              Saved
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })}
                                    {collections.length === 0 && (
                                      <p className="text-[11px] text-slate-500 italic text-center py-2">No folders click below to make one!</p>
                                    )}
                                  </div>

                                  <div className="border-t border-slate-800/60 pt-2 flex flex-col gap-1.5 mt-1">
                                    <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider font-bold">New Folder Name</span>
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="text"
                                        placeholder="AI, Programming..."
                                        value={newFolderNameInline}
                                        onChange={(e) => setNewFolderNameInline(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (newFolderNameInline.trim()) {
                                              handleCreateCollection(newFolderNameInline);
                                              setNewFolderNameInline('');
                                            }
                                          }
                                        }}
                                        className="bg-[#03030d] border border-slate-800 rounded-md p-1 px-2 text-xs text-slate-200 outline-none w-full"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (newFolderNameInline.trim()) {
                                            handleCreateCollection(newFolderNameInline);
                                            setNewFolderNameInline('');
                                          }
                                        }}
                                        className="p-1 px-2 bg-indigo-600 hover:bg-indigo-550 border border-indigo-700/50 text-white font-bold rounded-md font-sans text-xs cursor-pointer active:scale-95 transition-all text-center shrink-0"
                                      >
                                        Create
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Read Aloud TTS button */}
                        <button
                          type="button"
                          id={`speak-btn-${item.id}`}
                          onClick={() => handleReadAloud(item)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-all active:scale-95 text-xs font-bold font-sans ${
                            speakingPageId === item.id
                              ? 'border-red-500 bg-red-950/25 text-red-400 hover:bg-red-950/40 hover:border-red-400'
                              : 'border-slate-800 bg-[#070719]/40 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                          }`}
                          title={speakingPageId === item.id ? "Stop reading aloud" : "Read this result aloud"}
                        >
                          {speakingPageId === item.id ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                              <span>Stop Reader</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                              <span>Read Aloud</span>
                            </>
                          )}
                        </button>

                        {/* Copy Share Link button */}
                        <button
                          type="button"
                          id={`copy-url-btn-${item.id}`}
                          onClick={(e) => handleCopyPageUrl(e, item)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-all active:scale-95 text-xs font-bold font-sans ${
                            copiedPageId === item.id
                              ? 'border-emerald-500 bg-emerald-950/25 text-emerald-400'
                              : 'border-slate-800 bg-[#070719]/40 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                          }`}
                          title="Copy reference webpage URL to clipboard"
                        >
                          {copiedPageId === item.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                              <span>Copied Link!</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="w-3.5 h-3.5 text-slate-400" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>

                        {/* Share via Email button */}
                        <button
                          type="button"
                          id={`email-share-btn-${item.id}`}
                          onClick={(e) => handleEmailShare(e, item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-[#070719]/40 text-slate-400 hover:text-slate-200 hover:border-slate-700 cursor-pointer transition-all active:scale-95 text-xs font-bold font-sans"
                          title="Share page details via Email"
                        >
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>Share Email</span>
                        </button>

                        <button
                          type="button"
                          id={`expand-btn-${item.id}`}
                          onClick={() => handleToggleExpand(item.id, item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-[#090924] hover:bg-slate-900 text-[#a5b4fc] hover:text-white font-bold font-sans cursor-pointer transition-all active:scale-95"
                        >
                          {isPageLoading[item.id] ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                              <span>Fetching details...</span>
                            </>
                          ) : expandedDocId === item.id ? (
                            <>
                              <ArrowRight className="w-3 h-3 rotate-90 text-indigo-400" />
                              <span>Collapse Preview</span>
                            </>
                          ) : (
                            <>
                              <BookOpen className="w-3 h-3 text-indigo-400" />
                              <span>Expand Preview</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Preview Section */}
                    <AnimatePresence initial={false}>
                      {expandedDocId === item.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0, marginTop: 0 }}
                          animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                          exit={{ height: 0, opacity: 0, marginTop: 0 }}
                          className="overflow-hidden border-t border-slate-800/60 pt-4 flex flex-col gap-3.5"
                        >
                          {isPageLoading[item.id] ? (
                            <div className="flex items-center justify-center py-6 gap-2 text-slate-500 font-mono text-xs">
                              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                              <span>Retrieving body text from Firestore...</span>
                            </div>
                          ) : expandedPages[item.id] ? (
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/40 border border-slate-800/85 p-3 rounded-xl font-mono text-[10px] text-slate-450 border-slate-800/60">
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-slate-500">CHARACTERS:</span>
                                  <span className="text-slate-200 font-bold">{(expandedPages[item.id].content || "").length}</span>
                                </div>
                                <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-800"></div>
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-slate-500">WORDS:</span>
                                  <span className="text-slate-200 font-bold">
                                    {(expandedPages[item.id].content || "").trim().split(/\s+/).filter(Boolean).length}
                                  </span>
                                </div>
                                <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-800"></div>
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-slate-500">BACKLINKS:</span>
                                  <span className="text-slate-200 font-bold">{expandedPages[item.id].backlinks || 0}</span>
                                </div>
                                <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-800"></div>
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-indigo-400">SOURCE:</span>
                                  <span className="font-bold text-indigo-300 bg-indigo-950/40 border border-indigo-900/60 rounded px-1.5 py-0.5 text-[8px]">
                                    FIRESTORE
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">Indexed Content Preview</span>
                                <div className="bg-[#02020e] border border-slate-800 text-slate-300 font-mono text-[11px] p-4 rounded-xl max-h-72 overflow-y-auto leading-relaxed shadow-inner whitespace-pre-wrap select-text">
                                  {expandedPages[item.id].content || "No raw parsed body available in Firestore for this page."}
                                </div>
                              </div>
                              
                              <div className="flex justify-end pt-1">
                                <button
                                  type="button"
                                  onClick={() => setExpandedDocId(null)}
                                  className="px-2.5 py-1 text-[10px] bg-[#090924] border border-slate-800 hover:bg-slate-900 text-slate-300 font-bold font-mono rounded-lg transition-all"
                                >
                                  COLLAPSE
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center p-4 bg-red-50 border border-red-100 rounded-xl gap-2 font-mono text-xs text-red-600">
                              <AlertCircle className="w-4 h-4 text-red-500" />
                              <span>Error loading page document from Firestore.</span>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </article>
                ))}
              </div>
            ) : (() => {
              const filteredImages = selectedColorFilter
                ? imageResults.filter(img => img.dominant_color === selectedColorFilter)
                : imageResults;

              return (
                /* Image Grid Segment */
                <div className="flex flex-col gap-6 mt-2">
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col gap-3.5 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 font-sans leading-none">
                            🎨 Dominant Color Filters
                          </h4>
                          {selectedColorFilter && (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-mono text-[9px] font-bold uppercase tracking-wider">
                              {selectedColorFilter} active
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed mt-1 font-sans">
                          Refine displayed search results by matching their extracted dominant metadata color palettes.
                        </p>
                      </div>
                      {selectedColorFilter && (
                        <button
                          type="button"
                          onClick={() => setSelectedColorFilter(null)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-all font-sans cursor-pointer active:scale-95 shrink-0 select-none"
                        >
                          Clear Selection
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedColorFilter(null)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer font-sans select-none ${
                          selectedColorFilter === null
                            ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        🌈 All ({imageResults.length})
                      </button>
                      {PALETTE_COLORS.map((col) => {
                        const count = imageResults.filter(img => img.dominant_color === col.name).length;
                        const isActive = selectedColorFilter === col.name;
                        return (
                          <button
                            key={col.name}
                            type="button"
                            onClick={() => setSelectedColorFilter(isActive ? null : col.name)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer font-sans select-none ${
                              isActive
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm ring-2 ring-indigo-100'
                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                            }`}
                            disabled={count === 0}
                            style={{ opacity: count === 0 ? 0.45 : 1 }}
                            title={`${col.label}: ${count} images`}
                          >
                            <span 
                              className="w-3.5 h-3.5 rounded-full inline-block shrink-0 shadow-xs" 
                              style={{ 
                                backgroundColor: col.hex, 
                                border: col.border ? `1px solid ${col.border}` : 'none' 
                              }} 
                            />
                            <span>{col.label}</span>
                            <span className={`text-[10px] ${isActive ? 'text-indigo-100' : 'text-slate-400'} font-mono`}>
                              ({count})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono border-b border-slate-800/80 pb-3">
                    <span>
                      {selectedColorFilter 
                        ? `Filtered: Showing ${filteredImages.length} of ${imageResults.length} images` 
                        : `Showing all ${imageResults.length} indexed image results`
                      }
                    </span>
                    <span>Page 1 of 1</span>
                  </div>

                  {isImagesLoading ? (
                    <div className="text-center py-24 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                      <p className="text-sm font-medium text-slate-400">Searching and compiling image records...</p>
                    </div>
                  ) : filteredImages.length === 0 ? (
                    <div className="text-center py-16 bg-[#070719]/40 border border-slate-800 rounded-2xl flex flex-col items-center gap-3.5 px-4">
                      {selectedColorFilter ? (
                        <>
                          <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                            <span className="text-xl">🎨</span>
                          </div>
                          <p className="text-slate-300 font-medium font-sans">No matching images found for the filter "{selectedColorFilter}"</p>
                          <p className="text-xs text-slate-500 max-w-sm font-sans">
                            Try choosing a different color palette, indexing some custom labeled `{selectedColorFilter}` assets in the crawl panel, or resetting your filter.
                          </p>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-12 h-12 text-slate-600 stroke-[1.5]" />
                          <p className="text-slate-400 font-medium">No image results found for "{searchQuery}"</p>
                          <p className="text-xs text-slate-500 max-w-sm font-sans">Try running a standard search or crawler, or index manual Image assets in the panel below.</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {filteredImages.map((img, idx) => {
                        const colMeta = PALETTE_COLORS.find(c => c.name === img.dominant_color);
                        return (
                          <motion.div
                            key={idx}
                            id={`image-result-${idx}`}
                            whileHover={{ scale: 1.02 }}
                            className="bg-[#070719]/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xs hover:shadow-[0_0_15px_rgba(99,102,241,0.15)] transition-all flex flex-col group relative cursor-pointer"
                            onClick={() => window.open(img.url, '_blank')}
                          >
                            <div className="aspect-square bg-slate-950 overflow-hidden relative">
                              <img 
                                src={img.url} 
                                alt={img.alt_text}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 font-sans"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                                <span className="text-[10px] text-white truncate font-sans max-w-full font-medium">
                                  {img.source_url ? "View source page" : "View photo"}
                                </span>
                              </div>
                            </div>
                            <div className="p-3 flex flex-col gap-1.5 text-left">
                              <div className="flex flex-col gap-0.5">
                                <h4 className="text-xs font-bold text-slate-200 line-clamp-1 group-hover:text-indigo-400 transition-colors" title={img.title}>
                                  {img.title || "Scraped Image"}
                                </h4>
                                <span className="text-[9px] text-indigo-400 truncate font-mono">
                                  {img.url}
                                </span>
                              </div>
                              {img.alt_text && (
                                <p className="text-[10px] text-slate-500 line-clamp-1 font-sans italic">
                                  "{img.alt_text}"
                                </p>
                              )}
                              {img.dominant_color && colMeta && (
                                <div className="border-t border-slate-800/60 pt-2.5 mt-1 flex items-center justify-between gap-1 w-full text-[9px] text-slate-500 font-sans uppercase tracking-wider font-bold">
                                  <span>Color Profile:</span>
                                  <div className="flex items-center gap-1 bg-slate-950/60 border border-slate-800 rounded px-1.5 py-0.5">
                                    <span 
                                      className="w-2 h-2 rounded-full inline-block shadow-xxs" 
                                      style={{ 
                                        backgroundColor: colMeta.hex,
                                        border: colMeta.border ? `1px solid ${colMeta.border}` : 'none'
                                      }} 
                                    />
                                    <span className="text-[8px] text-slate-400 font-mono tracking-normal leading-none font-bold">
                                      {img.dominant_color}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}



          </div>
        )}

        {/* TAB 2: INDEXER AND CRAWLER CONTROL PANEL */}
        {activeTab === 'crawler' && (
          <div className="max-w-6xl mx-auto flex flex-col gap-8 py-4">
            
            {/* Upper Grid Splitter: Left span 2 (Controls & Scheduler), Right span 1 (Forms) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left span 2: Controls and Advanced Recurring Scheduler */}
              <div className="lg:col-span-2 flex flex-col gap-8">
                
                {/* 1. Crawler Progress Dashboard */}
                <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex flex-col gap-6 animate-fade-in">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 font-sans">
                      <Activity className="w-5 h-5 text-indigo-600" />
                      Crawler Dashboard
                    </h2>
                    <p className="text-xs text-slate-400">Scrapy web_spider status & autothrottling configuration.</p>
                  </div>

                  {/* Status displays */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl flex flex-col gap-1 font-mono">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Process Status</span>
                      <span className={`text-xs font-bold uppercase ${
                        crawlerStatus.status === 'running' ? 'text-indigo-600' : 'text-slate-500'
                      }`}>
                        {crawlerStatus.status}
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl flex flex-col gap-1 font-mono">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Pages Crawled</span>
                      <span className="text-sm font-bold text-slate-900">{crawlerStatus.pages_crawled}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl flex flex-col gap-1 font-mono">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Fault Errors</span>
                      <span className="text-sm font-bold text-red-600">{crawlerStatus.errors}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl flex flex-col gap-1 font-mono">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Started At</span>
                      <span className="text-xs font-bold text-slate-700 truncate">{crawlerStatus.started_at}</span>
                    </div>
                  </div>

                  {/* Manual crawler start */}
                  <button 
                    onClick={triggerCrawl}
                    disabled={crawlerStatus.status === 'running'}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all disabled:bg-slate-200 disabled:text-slate-500 flex items-center justify-center gap-2.5 shadow-sm"
                  >
                    {crawlerStatus.status === 'running' ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Crawl spider actively running...</span>
                      </>
                    ) : (
                      <>
                        <Globe className="w-4 h-4" />
                        <span>Start Crawl (web_spider run)</span>
                      </>
                    )}
                  </button>

                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4 text-xs text-slate-450 font-mono text-[10px]">
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Respects robots.txt directives</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Autothrottling & concurrency safety rules</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Persists indices up to Storage</span>
                    </div>
                  </div>
                </div>

                {/* 2. Recurring Schedule Site Re-indexing Card */}
                <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex flex-col gap-6 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 font-sans">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                        Schedule Site Re-indexing
                      </h2>
                      <p className="text-xs text-slate-400">Configure recurring background crawl schedules powered by Google Cloud Scheduler & Cloud Functions.</p>
                    </div>
                    {/* Live indicator badge */}
                    <div className="self-start sm:self-center flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200">
                      <span className={`w-2 h-2 rounded-full ${scheduleEnabled ? 'bg-indigo-600 animate-pulse' : 'bg-slate-300'}`}></span>
                      <span className="text-[10px] uppercase font-mono font-bold text-slate-650">{scheduleEnabled ? 'Active Schedule' : 'Disabled'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Config inputs */}
                    <div className="flex flex-col gap-4">
                      {/* Toggle status control */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-bold text-slate-600 font-mono">Automatic Scheduler Status</span>
                        <div className="flex rounded-xl p-0.75 bg-slate-100 border border-slate-200 w-full relative">
                          <button
                            type="button"
                            onClick={() => handleSaveSchedule(true, scheduleInterval, scheduleStartUrl)}
                            className={`flex-1 text-center py-2 text-xs font-bold font-mono uppercase tracking-wider rounded-lg transition-all ${
                              scheduleEnabled 
                                ? 'bg-indigo-600 text-white shadow-sm' 
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            Enabled
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveSchedule(false, scheduleInterval, scheduleStartUrl)}
                            className={`flex-1 text-center py-2 text-xs font-bold font-mono uppercase tracking-wider rounded-lg transition-all ${
                              !scheduleEnabled 
                                ? 'bg-slate-400 text-white shadow-sm' 
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            Disabled
                          </button>
                        </div>
                      </div>

                      {/* Recurrence Selection */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-600 font-mono">Recurrence Interval</label>
                        <select
                          disabled={!scheduleEnabled}
                          value={scheduleInterval}
                          onChange={(e) => handleSaveSchedule(scheduleEnabled, e.target.value as 'daily' | 'weekly', scheduleStartUrl)}
                          className="border border-slate-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-50 rounded-xl p-2.5 text-xs outline-none disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 font-sans"
                        >
                          <option value="daily">Daily Crawl (Every 24 hours)</option>
                          <option value="weekly">Weekly Crawl (Every Sunday at 00:00)</option>
                        </select>
                      </div>

                      {/* Source/Seed Entry Point Url */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-600 font-mono">Scheduled Re-indexing Start URL</label>
                        <input
                          type="url"
                          disabled={!scheduleEnabled}
                          placeholder="e.g. https://news.ycombinator.com"
                          value={scheduleStartUrl}
                          onChange={(e) => setScheduleStartUrl(e.target.value)}
                          onBlur={() => handleSaveSchedule(scheduleEnabled, scheduleInterval, scheduleStartUrl)}
                          className="border border-slate-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-50 rounded-xl p-2.5 text-xs outline-none disabled:bg-slate-100 disabled:text-slate-400 text-slate-750 font-mono"
                        />
                      </div>
                    </div>

                    {/* Metadata summary and functional simulate scheduler play button */}
                    <div className="border border-slate-150 p-4.5 rounded-2xl bg-slate-50/50 flex flex-col justify-between gap-4 font-mono">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                          <Settings className="w-3.5 h-3.5 text-indigo-500" />
                          Scheduler Telemetry
                        </h3>
                        <div className="flex flex-col gap-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 uppercase text-[10px]">Cloud Target:</span>
                            <span className="font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-[9px]">GCP CLOUD FUNCTIONS</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 uppercase text-[10px]">Logs DB:</span>
                            <span className="font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-[9px]">FIRESTORE</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 uppercase text-[10px]">Last Triggered:</span>
                            <span className="font-bold text-indigo-650 text-[11px]">{scheduleLastRun}</span>
                          </div>
                          <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                            <span className="text-slate-400 uppercase text-[10px]">Next Expected Run:</span>
                            <span className="font-bold text-slate-700 text-[11px]">{scheduleNextRun}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={handleTestCloudFunction}
                          disabled={isCFSTriggering}
                          className="w-full bg-slate-900 hover:bg-slate-950 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-all disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-2.5 shadow-sm"
                        >
                          {isCFSTriggering ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-550" />
                              <span>Triggering cloud scheduled crawler...</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Execute Scheduled Cloud Function</span>
                            </>
                          )}
                        </button>
                        <p className="text-[10px] text-slate-400 leading-normal text-center font-sans">
                          Forces execution on REST trigger <code className="bg-slate-100 px-1 py-0.2 rounded text-[9px]">/cloud-functions/scheduled-crawl</code> to verify rule integrity.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right span 1: Manual Indexers */}
              <div className="lg:col-span-1 flex flex-col gap-8">
                
                {/* Manual text page indexer */}
                <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex flex-col gap-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 font-sans">
                      <Plus className="w-5 h-5 text-indigo-600" />
                      Add Page to Index
                    </h2>
                    <p className="text-xs text-slate-400">Index raw sites directly inside whoosh & Firebase.</p>
                  </div>

                  {/* Feedback banners */}
                  {indexError && (
                    <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-xs text-red-700">{indexError}</span>
                    </div>
                  )}
                  {indexSuccess && (
                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs text-emerald-700">Page successfully indexed in Whoosh index!</span>
                    </div>
                  )}

                  <form onSubmit={handleIndexSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-600 font-mono">Page URL *</label>
                      <input 
                        type="url"
                        required
                        placeholder="https://example.com/topic"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        className="border border-slate-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-50/50 rounded-xl p-2.5 text-xs outline-none font-mono"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-600 font-mono">Title</label>
                      <input 
                        type="text"
                        placeholder="Example Topic Title"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="border border-slate-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-50/50 rounded-xl p-2.5 text-xs outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-600 font-mono">Snippet Description</label>
                      <input 
                        type="text"
                        placeholder="Enter abstract description..."
                        value={newSnippet}
                        onChange={(e) => setNewSnippet(e.target.value)}
                        className="border border-slate-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-50/50 rounded-xl p-2.5 text-xs outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-600 font-mono">Raw Content</label>
                      <textarea
                        placeholder="Full page body parsed text..."
                        rows={3}
                        value={newContent}
                        onChange={(e) => setNewContent(e.target.value)}
                        className="border border-slate-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-50/50 rounded-xl p-2.5 text-xs outline-none font-mono text-[11px]"
                      ></textarea>
                    </div>

                    <button 
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Submit to Index</span>
                    </button>
                  </form>
                </div>

                {/* Index raw Images */}
                <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex flex-col gap-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 font-sans">
                      <Share2 className="w-5 h-5 text-indigo-600" />
                      Index Image Element
                    </h2>
                    <p className="text-xs text-slate-400">Save alt description tags in image collection.</p>
                  </div>

                  {imgSuccess && (
                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs text-emerald-700">Image metadata stored successfully!</span>
                    </div>
                  )}

                  <form onSubmit={handleImageSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-600 font-mono">Image Asset URL *</label>
                      <input 
                        type="url"
                        required
                        placeholder="https://example.com/banner.png"
                        value={imgUrl}
                        onChange={(e) => setImgUrl(e.target.value)}
                        className="border border-slate-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-50/50 rounded-xl p-2.5 text-xs outline-none font-mono"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-600 font-mono">Alt Description *</label>
                      <input 
                        type="text"
                        required
                        placeholder="e.g. Minimalist layout vector"
                        value={imgAlt}
                        onChange={(e) => setImgAlt(e.target.value)}
                        className="border border-slate-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-50/50 rounded-xl p-2.5 text-xs outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-600 font-mono">Parent Page URL *</label>
                      <input 
                        type="url"
                        required
                        placeholder="https://example.com/parent_page"
                        value={imgSrcUrl}
                        onChange={(e) => setImgSrcUrl(e.target.value)}
                        className="border border-slate-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-50/50 rounded-xl p-2.5 text-xs outline-none font-mono"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 font-sans">
                      <label className="text-xs font-bold text-slate-600 font-mono">Image Title Override</label>
                      <input 
                        type="text"
                        placeholder="e.g. Header Splash Banner"
                        value={imgTitle}
                        onChange={(e) => setImgTitle(e.target.value)}
                        className="border border-slate-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-50/50 rounded-xl p-2.5 text-xs outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 font-sans">
                      <label className="text-xs font-bold text-slate-600 font-mono">Dominant Color Metadata</label>
                      <select 
                        value={imgDominantColor}
                        onChange={(e) => setImgDominantColor(e.target.value)}
                        className="border border-slate-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-50/50 rounded-xl p-2.5 text-xs outline-none cursor-pointer text-slate-700 font-sans"
                      >
                        <option value="">🔮 Auto-detect / Infer dynamically</option>
                        <option value="red">🔴 Red</option>
                        <option value="orange">🟠 Orange</option>
                        <option value="yellow">🟡 Yellow</option>
                        <option value="green">🟢 Green</option>
                        <option value="teal">🌐 Teal</option>
                        <option value="blue">🔵 Blue</option>
                        <option value="purple">🟣 Purple</option>
                        <option value="pink">🌸 Pink</option>
                        <option value="brown">🟫 Brown</option>
                        <option value="white">⚪ White / Light</option>
                        <option value="black">⚫ Black / Dark</option>
                      </select>
                    </div>

                    <button 
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Index Image Node</span>
                    </button>
                  </form>
                </div>

              </div>
            </div>

            {/* Behind the scenes: Persistent Crawl History Logs section */}
            <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 font-sans">
                    <History className="w-5 h-5 text-indigo-600" />
                    Crawl Execution History
                  </h2>
                  <p className="text-xs text-slate-400">Persistent logs stored in the Firestore database collection <code className="bg-slate-50 border border-slate-100 rounded px-1 text-slate-605 font-mono">crawler_history</code>.</p>
                </div>
                <button
                  type="button"
                  onClick={fetchScheduleAndHistory}
                  disabled={isFetchingHistory}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 font-bold font-mono border border-slate-200 p-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetchingHistory ? 'animate-spin text-indigo-500' : ''}`} />
                  <span>Refresh Logs</span>
                </button>
              </div>

              {isFetchingHistory && crawlHistory.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-650" />
                  <span className="text-xs text-slate-500 ml-2 font-mono">Retrieving Firestore execution logs...</span>
                </div>
              ) : crawlHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-sans border border-dashed border-slate-200 rounded-2xl bg-slate-50/20">
                  <Server className="w-8 h-8 mx-auto text-slate-305 mb-2" />
                  <p className="text-sm font-bold">No previous crawler executions discovered.</p>
                  <p className="text-xs text-slate-400 mt-1">Start a web crawl or trigger the Cloud Function scheduled re-indexing task to generate logging records.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-150">
                  <table className="w-full text-left border-collapse font-sans text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase font-bold tracking-wider">
                        <th className="p-3.5">Trigger Entity / Origin</th>
                        <th className="p-3.5">Target Start URL</th>
                        <th className="p-3.5">Scheduled Date Time (UTC)</th>
                        <th className="p-3.5 text-center">Pages Crawled</th>
                        <th className="p-3.5 text-center">Faults/Errors</th>
                        <th className="p-3.5 text-right font-mono">Crawl Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-slate-600 text-xs">
                      {crawlHistory.map((run) => (
                        <tr key={run.id || Math.random().toString()} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5 font-sans font-bold text-slate-800 flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${run.triggered_by.includes('Scheduler') || run.triggered_by.includes('Function') ? 'bg-indigo-600' : 'bg-slate-400'}`}></span>
                            {run.triggered_by}
                          </td>
                          <td className="p-3.5 text-slate-550 max-w-[200px] truncate" title={run.start_url}>{run.start_url}</td>
                          <td className="p-3.5 text-sans text-slate-600 font-medium">{run.time_str || new Date(run.timestamp * 1000).toLocaleString()}</td>
                          <td className="p-3.5 text-center font-bold text-slate-900">{run.pages_crawled}</td>
                          <td className="p-3.5 text-center font-bold text-red-500">{run.errors}</td>
                          <td className="p-3.5 text-right uppercase font-bold text-[10px] font-sans">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.75 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                              {run.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 3: GRAPH VISUALIZATION */}
        {activeTab === 'graph' && (
          <div className="max-w-6xl mx-auto flex flex-col gap-6 py-4 relative">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-400" />
                  Visual Crawl Link Graph
                </h2>
                <p className="text-xs text-slate-400">Interactive link layout rendering. Hover nodes for live cache preview, click to select pages, drag physically to align.</p>
              </div>

              {/* Quick stats badge */}
              <div className="flex items-center gap-3 bg-[#070719]/80 border border-slate-800 p-2.5 rounded-xl font-mono text-xs text-slate-300 shadow-sm leading-none">
                <span>Nodes: <strong className="text-indigo-400">{graphNodes.length}</strong></span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-800/85"></span>
                <span>Edges: <strong className="text-indigo-400">{graphEdges.length}</strong></span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              
              {/* Graphic Stage SVG Canvas */}
              <div className="lg:col-span-3 bg-[#070719]/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl aspect-[4/3] sm:aspect-[16/10] relative">
                
                {/* Floating Map Search Overlay */}
                <div className="absolute top-4 left-4 z-20 w-72 sm:w-80 bg-[#090924]/95 border border-slate-800/80 rounded-2xl p-3.5 shadow-[0_12px_45px_rgba(0,0,0,0.85)] backdrop-blur-md flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-xs font-bold text-slate-200 font-sans">Filter Link Graph</span>
                    </div>
                    {graphSearchQuery.trim() && (
                      <span className="text-[9px] font-mono font-bold bg-[#04041a] text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-900/30">
                        {graphNodes.filter(n => 
                          n.title.toLowerCase().includes(graphSearchQuery.toLowerCase().toLowerCase()) ||
                          n.url.toLowerCase().includes(graphSearchQuery.toLowerCase().trim())
                        ).length} matches
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Search nodes by title or URL..."
                      value={graphSearchQuery}
                      onChange={(e) => setGraphSearchQuery(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 bg-[#02020a] border border-slate-800 rounded-xl text-xs text-slate-205 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-550 transition-all font-sans"
                    />
                    {graphSearchQuery ? (
                      <button 
                        onClick={() => setGraphSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-400 cursor-pointer text-xs font-mono font-bold"
                      >
                        ×
                      </button>
                    ) : (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-600 bg-[#02020a] px-1 rounded border border-slate-900 select-none pointer-events-none">
                        Filter
                      </span>
                    )}
                  </div>

                  {/* Tiny Quick Result list to inspect matched items instantly */}
                  {(() => {
                    const matched = graphSearchQuery.trim() ? graphNodes.filter(n => 
                      n.title.toLowerCase().includes(graphSearchQuery.toLowerCase().trim()) ||
                      n.url.toLowerCase().includes(graphSearchQuery.toLowerCase().trim())
                    ) : [];

                    if (matched.length > 0) {
                      return (
                        <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto pr-1 border-t border-slate-800/60 pt-2">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Matched Nodes (Click to select):</p>
                          <div className="flex flex-col gap-1">
                            {matched.map(n => (
                              <button
                                key={n.id}
                                type="button"
                                onClick={() => {
                                  setSelectedNode(n);
                                }}
                                className={`text-[10px] text-left truncate px-2 py-1 rounded bg-[#03030d] border border-slate-900 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/30 transition-all font-sans cursor-pointer ${selectedNode?.id === n.id ? 'border-indigo-500/40 text-indigo-400 bg-indigo-950/20' : ''}`}
                                title={n.title}
                              >
                                {n.title}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* SVG canvas stage overlay helper */}
                <svg 
                  ref={svgRef}
                  width="100%" 
                  height="100%"
                  onMouseMove={handleSvgMouseMove}
                  onMouseUp={handleSvgMouseUp}
                  className="select-none cursor-crosshair bg-slate-950"
                >
                  <defs>
                    <marker id="arrow" viewBox="0 0 10 10" refX="17" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#818cf8" opacity="0.6" />
                    </marker>
                    {/* Glow Filter */}
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* Lines (Edges) */}
                  {graphEdges.map((edge, idx) => {
                    const sourceNode = graphNodes.find(n => n.id === edge.source);
                    const targetNode = graphNodes.find(n => n.id === edge.target);
                    if (!sourceNode || !targetNode) return null;

                    const isSearchingGraph = graphSearchQuery.trim() !== '';
                    const lowerGraphQuery = graphSearchQuery.toLowerCase().trim();
                    let edgeOpacity = 0.4;
                    let strokeColor = "#6366f1";
                    let strokeWidthValue = "1.5";

                    if (isSearchingGraph) {
                      const sMatch = sourceNode.title.toLowerCase().includes(lowerGraphQuery) || sourceNode.url.toLowerCase().includes(lowerGraphQuery);
                      const tMatch = targetNode.title.toLowerCase().includes(lowerGraphQuery) || targetNode.url.toLowerCase().includes(lowerGraphQuery);
                      if (sMatch && tMatch) {
                        edgeOpacity = 0.85;
                        strokeColor = "#10b981"; // emerald-500
                        strokeWidthValue = "2.5";
                      } else if (sMatch || tMatch) {
                        edgeOpacity = 0.35;
                        strokeColor = "#818cf8";
                        strokeWidthValue = "1.5";
                      } else {
                        edgeOpacity = 0.05;
                      }
                    }

                    return (
                      <line 
                        key={idx}
                        x1={sourceNode.x}
                        y1={sourceNode.y}
                        x2={targetNode.x}
                        y2={targetNode.y}
                        stroke={strokeColor}
                        strokeWidth={strokeWidthValue}
                        strokeOpacity={edgeOpacity}
                        markerEnd="url(#arrow)"
                        style={{ transition: 'stroke-opacity 0.25s, stroke 0.25s, stroke-width 0.25s' }}
                      />
                    );
                  })}

                  {/* Circles (Nodes) */}
                  {graphNodes.map((node) => {
                    const isSelected = selectedNode?.id === node.id;
                    const isSearchingGraph = graphSearchQuery.trim() !== '';
                    const lowerGraphQuery = graphSearchQuery.toLowerCase().trim();
                    const isHighlighted = isSearchingGraph && (
                      node.title.toLowerCase().includes(lowerGraphQuery) ||
                      node.url.toLowerCase().includes(lowerGraphQuery)
                    );
                    const nodeOpacity = isSearchingGraph ? (isHighlighted ? 1 : 0.15) : 1;

                    return (
                      <g 
                        key={node.id}
                        onMouseEnter={() => setHoveredNode(node)}
                        onMouseLeave={() => setHoveredNode(prev => prev?.id === node.id ? null : prev)}
                        style={{ opacity: nodeOpacity, transition: 'opacity 0.25s ease-in-out' }}
                      >
                        {/* Shadow touch region */}
                        <circle 
                          cx={node.x}
                          cy={node.y}
                          r={node.size + 16}
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseDown={() => handleNodeMouseDown(node.id)}
                        />
                        {/* Glow outline on selection */}
                        {isSelected && (
                          <circle 
                            cx={node.x}
                            cy={node.y}
                            r={node.size + 6}
                            fill="none"
                            stroke="#818cf8"
                            strokeWidth="2"
                            filter="url(#glow)"
                            className="animate-pulse"
                          />
                        )}
                        {/* Pulse gold/emerald halo spinning around matched node */}
                        {isHighlighted && (
                          <circle 
                            cx={node.x}
                            cy={node.y}
                            r={node.size + 8}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="2.5"
                            strokeDasharray="4 2"
                            filter="url(#glow)"
                            className="animate-spin"
                            style={{ transformOrigin: `${node.x}px ${node.y}px`, animationDuration: '6s' }}
                          />
                        )}
                        {isHighlighted && (
                          <circle 
                            cx={node.x}
                            cy={node.y}
                            r={node.size + 4}
                            fill="none"
                            stroke="#34d399"
                            strokeWidth="1.5"
                            className="animate-ping"
                            style={{ transformOrigin: `${node.x}px ${node.y}px`, animationDuration: '3s' }}
                          />
                        )}
                        {/* Inner visible node */}
                        <circle 
                          cx={node.x}
                          cy={node.y}
                          r={node.size}
                          fill={isSelected ? "#818cf8" : (isHighlighted ? "#10b981" : "#4f46e5")}
                          className="transition-colors hover:fill-indigo-400 cursor-pointer"
                        />
                        {/* Small center pin */}
                        <circle 
                          cx={node.x}
                          cy={node.y}
                          r={3}
                          fill="#ffffff"
                        />
                        {/* Floating Labels */}
                        <text
                          x={node.x}
                          y={node.y - node.size - 6}
                          textAnchor="middle"
                          fill={isHighlighted ? "#10b981" : "#94a3b8"}
                          fontSize="10"
                          fontWeight={isHighlighted ? "extrabold" : "bold"}
                          className="pointer-events-none font-mono"
                        >
                          {node.title.length > 20 ? node.title.substring(0, 18) + '..' : node.title}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Animated Tooltip Preview Card */}
                <AnimatePresence>
                  {(() => {
                    if (!hoveredNode) return null;
                    const page = pagesList.find(p => p.id === hoveredNode.id) || DEFAULT_PAGES.find(p => p.id === hoveredNode.id);
                    const title = page?.title || hoveredNode.title;
                    const snippet = page?.snippet || "No additional cache context parsed in Firestore index.";
                    const backlinks = page?.backlinks || hoveredNode.backlinks || 0;
                    const url = page?.url || hoveredNode.url;

                    // Calculate safe horizontal coordinate bounds (clamped to prevent element spill-over)
                    let containerWidth = 600;
                    if (svgRef.current) {
                      containerWidth = svgRef.current.getBoundingClientRect().width;
                    }
                    const leftPosition = Math.max(160, Math.min(hoveredNode.x, containerWidth - 160));

                    // Flips orientation vertically depending on height closeness threshold
                    const isTooCloseToTop = hoveredNode.y < 160;
                    const topPosition = isTooCloseToTop ? hoveredNode.y + hoveredNode.size + 12 : hoveredNode.y - hoveredNode.size - 12;
                    const transformValue = isTooCloseToTop ? 'translateX(-50%)' : 'translate(-50%, -100%)';

                    return (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: isTooCloseToTop ? 5 : -5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: isTooCloseToTop ? 5 : -5 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 w-64 sm:w-72 bg-[#02020f]/95 border border-indigo-500/30 rounded-2xl p-4 shadow-[0_15px_30px_rgba(3,3,15,0.95)] shadow-indigo-950/70 backdrop-blur-md pointer-events-none text-left"
                        style={{
                          left: `${leftPosition}px`,
                          top: `${topPosition}px`,
                          transform: transformValue,
                        }}
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2 border-b border-slate-900 pb-1.5">
                            <span className="text-[9px] font-mono font-bold text-indigo-400 truncate max-w-[170px]">
                              {url}
                            </span>
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-800 font-mono text-[8px] font-bold text-emerald-400 leading-none">
                              BL: {backlinks}
                            </span>
                          </div>
                          
                          <h4 className="text-xs font-bold text-slate-100 font-sans tracking-tight leading-snug line-clamp-2">
                            {title}
                          </h4>
                          
                          <p className="text-[10px] text-slate-400 font-sans leading-relaxed line-clamp-3 italic">
                            "{snippet}"
                          </p>

                          <div className="flex items-center gap-1.5 text-[8.5px] font-mono text-slate-500 py-1 border-t border-slate-900/60 mt-0.5 leading-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>FIRESTORE HOVER CACHE ACTIVATED</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>

                {/* Instructions banner */}
                <div className="absolute bottom-4 left-4 right-4 bg-slate-900/95 border border-slate-800 text-slate-300 text-xs py-2 px-3 rounded-xl flex items-center justify-between gap-4 font-mono">
                  <span>Interactive Live Map: Click nodes to view data details, drag to adjust positions physically.</span>
                  <button 
                    onClick={() => setGraphNodes(INITIAL_NODES)}
                    className="p-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    Reset Map
                  </button>
                </div>

              </div>

              {/* Node Inspector Details (Sidebar) */}
              <div className="lg:col-span-1 flex flex-col gap-4">
                <div className="bg-[#070719]/90 border border-slate-800 p-5 rounded-3xl shadow-xl flex flex-col gap-4 flex-1">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest font-mono">Node Inspector</h3>

                  {selectedNode ? (
                    <div className="flex flex-col gap-4">
                      <div>
                        <h4 className="text-base font-bold text-slate-100 leading-tight">{selectedNode.title}</h4>
                        <span className="text-xs text-indigo-400 truncate block font-mono mt-1 select-all">{selectedNode.url}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5 border-t border-slate-800/60 pt-4">
                        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 font-mono text-center">
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">Backlinks</span>
                          <span className="text-lg font-bold text-indigo-400">{selectedNode.backlinks}</span>
                        </div>
                        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 font-mono text-center">
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">In-Degree Size</span>
                          <span className="text-lg font-bold text-indigo-400">{selectedNode.size}px</span>
                        </div>
                      </div>

                      <div className="border-t border-slate-800/60 pt-4">
                        <h5 className="text-xs font-bold text-slate-400 font-mono mb-1">Index Key References</h5>
                        <div className="bg-[#03030d] border border-slate-800/80 p-2.5 rounded-xl font-mono text-[11px] text-indigo-400 select-all shrink-0 break-all leading-tight">
                          {selectedNode.id}
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          setSearchQuery(selectedNode.title);
                          setActiveTab('search');
                          handleSearch(selectedNode.title);
                        }}
                        className="bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-500/30 text-indigo-300 font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>Query content in Isaac</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-12 flex flex-col items-center gap-2.5 my-auto">
                      <HelpCircle className="w-10 h-10 text-slate-600 stroke-[1.5]" />
                      <p className="text-slate-500 text-xs font-sans">No node selected. Click elements in the interactive graph viewport map to inspect link details.</p>
                    </div>
                  )}
                </div>

                {/* Legend Info */}
                <div className="bg-slate-900/60 border border-slate-800/60 p-4 rounded-2xl text-xs text-slate-400 flex flex-col gap-2 font-mono">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 block"></span>
                    <span>Node: Crawled web page</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-[1px] bg-indigo-500/50 block"></span>
                    <span>Edge: Trans-domain backlink path</span>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* TAB 4: SEARCH COLLECTIONS */}
        {activeTab === 'collections' && (
          <div className="max-w-6xl mx-auto flex flex-col gap-6 py-4 animate-fade-in">
            
            {/* Folder Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-indigo-400" />
                  Search Collections
                </h2>
                <p className="text-xs text-slate-400">Save and organize your search queries and crawled pages into categorized folders stored on your device.</p>
              </div>

              {/* View mode toggle */}
              <div className="flex items-center gap-2 bg-[#070719]/60 p-1 rounded-xl border border-slate-800 self-start sm:sm:self-auto font-mono text-xs">
                <button
                  onClick={() => setCollectionsViewMode('board')}
                  className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                    collectionsViewMode === 'board'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Workspace Board</span>
                </button>
                <button
                  onClick={() => setCollectionsViewMode('tree')}
                  className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                    collectionsViewMode === 'tree'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Interactive Tree View</span>
                </button>
              </div>
            </div>

            {/* Local Search Input for Collections/Pages */}
            <div className="bg-[#070719]/40 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-slate-500" />
                </div>
                <input
                  type="text"
                  placeholder="Filter folder names, page titles, or snippet details..."
                  value={collectionsQuery}
                  onChange={(e) => setCollectionsQuery(e.target.value)}
                  className="w-full pl-9 pr-9 py-2.5 bg-[#03030d] border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-slate-200 placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-950 transition-all font-sans"
                />
                {collectionsQuery && (
                  <button
                    type="button"
                    onClick={() => setCollectionsQuery('')}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors text-xs font-mono font-sans pr-1"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-mono text-slate-500 uppercase tracking-widest font-bold">
                  {collectionsQuery.trim() ? "Matches" : "Total Content"}
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-950/40 border border-indigo-500/20 text-indigo-400">
                  {filteredCollections.reduce((acc, col) => acc + col.pages.length, 0)} pages
                </span>
              </div>
            </div>

            {/* Render collectionsViewMode === 'board' */}
            {collectionsViewMode === 'board' ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left side: Folder listing and creator */}
                <div className="flex flex-col gap-6">
                  
                  {/* Create Custom Folder panel */}
                  <div className="bg-[#070719]/40 border border-slate-800 p-5 rounded-2xl flex flex-col gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 font-sans">
                        <FolderPlus className="w-4 h-4 text-indigo-400" />
                        Create New Folder
                      </h3>
                      <p className="text-[11px] text-slate-500">Group your search pages into a custom category</p>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (newCollectionName.trim()) {
                          handleCreateCollection(newCollectionName, newCollectionDesc);
                          setNewCollectionName('');
                          setNewCollectionDesc('');
                        }
                      }}
                      className="flex flex-col gap-3"
                    >
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-slate-400 font-mono">Folder Name</label>
                        <input
                          type="text"
                          required
                          value={newCollectionName}
                          onChange={(e) => setNewCollectionName(e.target.value)}
                          placeholder="e.g., Deep Learning, Web Scraping"
                          className="border border-slate-800 bg-[#03030d] text-slate-200 rounded-xl p-2.5 px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-950 focus:border-indigo-505 focus:border-indigo-500 transition-all font-sans"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-slate-400 font-mono">Description (Optional)</label>
                        <input
                          type="text"
                          value={newCollectionDesc}
                          onChange={(e) => setNewCollectionDesc(e.target.value)}
                          placeholder="Short summary of this group"
                          className="border border-slate-800 bg-[#03030d] text-slate-200 rounded-xl p-2.5 px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-950 focus:border-indigo-505 focus:border-indigo-500 transition-all font-sans"
                        />
                      </div>

                      <button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-550 border border-indigo-700/50 text-white font-mono font-bold py-2.5 px-4 rounded-xl text-xs transition-all active:scale-95 cursor-pointer mt-1"
                      >
                        + Initialize Folder
                      </button>
                    </form>
                  </div>

                  {/* Existing Folders Panel */}
                  <div className="bg-[#070719]/40 border border-slate-805 border-slate-800 p-5 rounded-2xl flex flex-col gap-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800/60 pb-1.5 flex items-center justify-between">
                      <span>Folders list ({filteredCollections.length})</span>
                      {collectionsQuery.trim() && (
                        <span className="text-[10px] text-indigo-400 font-normal normal-case font-sans">Filtered</span>
                      )}
                    </h3>

                    <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto no-scrollbar">
                      {filteredCollections.map((col) => {
                        const isSelected = selectedCollectionId === col.id;
                        return (
                          <div
                            key={col.id}
                            onClick={() => setSelectedCollectionId(col.id)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                              isSelected
                                ? 'bg-indigo-950/20 border-indigo-505 border-indigo-500 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                                : 'bg-[#03030d] border-slate-800/80 hover:bg-slate-900/40 text-slate-300'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <Folder className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold font-sans truncate">{col.name}</h4>
                                <p className="text-[10px] text-slate-500 truncate font-sans max-w-[160px]">{col.description || "No description"}</p>
                                <span className="text-[9px] font-mono text-indigo-400/80 block mt-1">
                                  {col.pages.length} {col.pages.length === 1 ? 'page saved' : 'pages saved'}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Are you sure you want to delete folder "${col.name}"? This cannot be undone.`)) {
                                  handleDeleteCollection(col.id);
                                }
                              }}
                              className="text-slate-600 hover:text-red-400 p-1 rounded-md hover:bg-red-950/20 transition-all cursor-pointer border border-transparent"
                              title="Delete collection folder"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}

                      {collections.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 flex flex-col items-center gap-2">
                          <Folder className="w-8 h-8 text-slate-700 stroke-[1.5]" />
                          <p className="text-xs font-sans">No folders created yet. Create a collection above to begin.</p>
                        </div>
                      ) : filteredCollections.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 flex flex-col items-center gap-2">
                          <Search className="w-8 h-8 text-indigo-500/80 stroke-[1.5]" />
                          <p className="text-xs font-sans text-slate-400">No matching folders or pages found.</p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                </div>

                {/* Right side: Pages in selected folder */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                  
                  {(() => {
                    const activeFolder = filteredCollections.find(c => c.id === selectedCollectionId);
                    if (!activeFolder) {
                      return (
                        <div className="bg-[#070719]/40 border border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-3.5 my-auto">
                          <Folder className="w-12 h-12 text-slate-600 stroke-[1.5]" />
                          <div>
                            <h3 className="text-slate-200 font-bold font-sans">No Folder Selected</h3>
                            <p className="text-xs text-slate-500 max-w-sm mt-1">Click on any directory in the folders column to inspect its bookmarks, or initialize a new one.</p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="bg-[#070719]/40 border border-slate-800 p-6 rounded-3xl flex flex-col gap-6 font-sans">
                        
                        {/* Folder Header Metadata */}
                        <div className="flex items-center justify-between gap-4 border-b border-slate-800/60 pb-4">
                          <div className="flex items-center gap-2.5">
                            <FolderOpen className="w-5 h-5 text-indigo-400 shrink-0" />
                            <div>
                              <h3 className="text-lg font-bold text-white font-sans">{activeFolder.name}</h3>
                              <p className="text-xs text-slate-400 font-sans">{activeFolder.description || "Collection folder to retrieve and recall saved websites."}</p>
                            </div>
                          </div>
                          <span className="text-xs font-mono font-bold px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-full text-slate-400">
                            Total: {activeFolder.pages.length}
                          </span>
                        </div>

                        {/* List of saved pages */}
                        <div className="flex flex-col gap-4">
                          {activeFolder.pages.map((item) => (
                            <article
                              key={item.id}
                              className="bg-[#03030d] border border-slate-800 hover:border-indigo-500/40 p-4 rounded-2xl hover:shadow-[0_0_15px_rgba(99,102,241,0.1)] transition-all flex flex-col gap-2 relative group"
                            >
                              <div className="flex items-center justify-between gap-3 text-[11px] font-mono">
                                <span className="text-indigo-400 truncate max-w-xs sm:max-w-md">{item.url}</span>
                                <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-500 text-[9px]">
                                  Likes: {item.likes || 0}
                                </span>
                              </div>

                              <h4 className="text-sm font-bold text-slate-200 group-hover:text-indigo-300 transition-colors flex items-center gap-1.5 leading-tight">
                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1.5 font-sans">
                                  {item.title}
                                  <LinkIcon className="w-3.5 h-3.5 text-slate-505 text-slate-500" />
                                </a>
                              </h4>

                              <p className="text-xs text-slate-400 leading-relaxed font-sans line-clamp-2">
                                {item.snippet}
                              </p>

                              {/* Footer Actions inside collection */}
                              <div className="flex items-center justify-between border-t border-slate-800/50 pt-3 text-[10px] text-slate-500 font-mono mt-1">
                                <span>Saved on device cache</span>
                                <div className="flex items-center gap-1.5">
                                  
                                  {/* Read Aloud TTS button representing compact action */}
                                  <button
                                    type="button"
                                    onClick={() => handleReadAloud(item)}
                                    className={`p-1 px-2.5 rounded-md border flex items-center gap-1 cursor-pointer transition-all ${
                                      speakingPageId === item.id
                                        ? 'border-red-500/40 bg-red-950/20 text-red-400 hover:bg-red-950/30'
                                        : 'border-slate-800 bg-[#070719]/40 text-slate-400 hover:text-slate-200'
                                    }`}
                                    title={speakingPageId === item.id ? "Stop reading aloud" : "Read this result aloud"}
                                  >
                                    {speakingPageId === item.id ? (
                                      <>
                                        <VolumeX className="w-3 h-3 text-red-500 animate-pulse" />
                                        <span>Stop</span>
                                      </>
                                    ) : (
                                      <>
                                        <Volume2 className="w-3 h-3 text-slate-450" />
                                        <span>Read Aloud</span>
                                      </>
                                    )}
                                  </button>

                                  {/* Copy Share Link button representing compact action */}
                                  <button
                                    type="button"
                                    onClick={(e) => handleCopyPageUrl(e, item)}
                                    className={`p-1 px-2.5 rounded-md border flex items-center gap-1 cursor-pointer transition-all ${
                                      copiedPageId === item.id
                                        ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-400'
                                        : 'border-slate-800 bg-[#070719]/40 text-slate-400 hover:text-slate-200'
                                    }`}
                                    title="Copy reference webpage URL to clipboard"
                                  >
                                    {copiedPageId === item.id ? (
                                      <>
                                        <Check className="w-3 h-3 text-emerald-400 animate-bounce" />
                                        <span>Copied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Share2 className="w-3 h-3 text-slate-400" />
                                        <span>Copy Link</span>
                                      </>
                                    )}
                                  </button>

                                  {/* Share via Email compact button */}
                                  <button
                                    type="button"
                                    onClick={(e) => handleEmailShare(e, item)}
                                    className="p-1 px-2.5 rounded-md border border-slate-800 bg-[#070719]/40 text-slate-400 hover:text-slate-200 hover:border-slate-700 flex items-center gap-1 cursor-pointer transition-all text-xs font-bold font-sans"
                                    title="Share page details via Email"
                                  >
                                    <Mail className="w-3 h-3 text-slate-400" />
                                    <span>Email</span>
                                  </button>

                                  {/* Upvote duplicate */}
                                  <button
                                    type="button"
                                    onClick={() => handleLikePage(item.id)}
                                    className="p-1 px-2.5 rounded-md border border-emerald-500/20 bg-emerald-950/10 hover:bg-emerald-900/20 text-emerald-400 hover:text-white flex items-center gap-1 cursor-pointer transition-all"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                    <span>Upvote ({item.likes || 0})</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleRemovePageFromCollection(activeFolder.id, item.id)}
                                    className="p-1 px-2.5 rounded-md border border-red-500/20 bg-red-955 bg-red-950/10 hover:bg-red-900/20 text-red-500 hover:text-white flex items-center gap-1 cursor-pointer transition-all"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Remove</span>
                                  </button>
                                </div>
                              </div>
                            </article>
                          ))}

                          {activeFolder.pages.length === 0 && (
                            <div className="text-center py-12 bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center gap-3">
                              <Bookmark className="w-10 h-10 text-slate-700 stroke-[1.5]" />
                              <div>
                                <p className="text-slate-400 text-xs font-bold font-sans">This folder is empty</p>
                                <p className="text-[11px] text-slate-505 text-slate-500 max-w-xs mt-1 leading-normal mx-auto font-sans">Go back to the Search tab, perform queries, and select "Save" on search items to populate this folder.</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setActiveTab('search')}
                                className="bg-indigo-950/65 hover:bg-indigo-900/40 border border-indigo-500/20 text-indigo-300 font-bold px-4 py-1.5 rounded-xl text-xs transition-all cursor-pointer font-sans"
                              >
                                Go Search Pages
                              </button>
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })()}

                </div>

              </div>
            ) : (
              /* TREE VIEW SYSTEM: satisfies example directly */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                
                {/* Left side: Pure output tree */}
                <div className="md:col-span-2 flex flex-col gap-4">
                  <div className="bg-[#02020a] border border-[#1b1c30] p-6 rounded-3xl font-mono text-xs flex flex-col gap-4 relative overflow-hidden">
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                      <span>plain_text</span>
                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                    </div>

                    <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/60" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/60" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[#10b981]/60" />
                        <span className="ml-2 font-mono text-[10px] text-slate-500">search_collections_tree.txt</span>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(getCollectionsTreeText());
                          alert("Tree text copied to clipboard successfully!");
                        }}
                        className="bg-slate-900/80 hover:bg-slate-850 border border-slate-850 px-3 py-1 rounded-md text-[10px] text-indigo-300 font-bold cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                      >
                        Copy Map
                      </button>
                    </div>

                    <pre className="bg-[#010105] border border-slate-950 p-4 rounded-xl text-indigo-300 overflow-x-auto leading-relaxed select-all">
                      {getCollectionsTreeText()}
                    </pre>
                  </div>
                </div>

                {/* Right side: Graphical representation of the Tree list */}
                <div className="flex flex-col gap-4">
                  <div className="bg-[#070719]/40 border border-slate-800 p-5 rounded-2xl flex flex-col gap-4">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Interactive Tree Navigator</h3>
                      <p className="text-[11px] text-slate-500 font-sans mt-0.5">Click any bookmark file inside folders to view it directly or delete it.</p>
                    </div>

                    <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto no-scrollbar py-2 font-sans text-xs">
                      {filteredCollections.map(col => (
                        <div key={col.id} className="flex flex-col">
                          {/* Folder Name Node */}
                          <div className="flex items-center gap-2 text-indigo-300 font-bold py-1.5 font-mono border-b border-slate-800/40">
                            <FolderOpen className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span className="truncate">{col.name}</span>
                            <span className="text-[9px] font-normal text-slate-500">({col.pages.length})</span>
                          </div>

                          {/* Pages Tree items list */}
                          <div className="flex flex-col pl-2 border-l border-slate-800 ml-2">
                            {col.pages.map((item, pageIdx) => {
                              const isLast = pageIdx === col.pages.length - 1;
                              return (
                                <div key={item.id} className="flex items-center justify-between group py-1.5 pl-2 hover:bg-slate-900/40 rounded transition-all">
                                  <div className="flex items-center gap-1.5 min-w-0 font-mono text-slate-300">
                                    <span className="text-slate-600 select-none">{isLast ? '└─' : '├─'}</span>
                                    <FileCode className="w-3.5 h-3.5 text-indigo-500/75 shrink-0" />
                                    <a
                                      href={item.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="truncate hover:underline hover:text-indigo-300 transition-all font-medium text-xs text-left"
                                      title={item.title}
                                    >
                                      {item.title}
                                    </a>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleRemovePageFromCollection(col.id, item.id)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-all text-slate-600 cursor-pointer"
                                    title="Unsave bookmark"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                            {col.pages.length === 0 && (
                              <div className="flex items-center gap-1.5 py-1.5 pl-2 font-mono text-slate-500 italic">
                                <span>└─</span>
                                <span>(Empty folder)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {collections.length === 0 ? (
                        <p className="text-slate-505 italic text-center py-4 text-slate-500">No tree mapping available. Add folders first!</p>
                      ) : filteredCollections.length === 0 ? (
                        <p className="text-indigo-400/80 italic text-center py-4 font-mono text-[11px]">No tree nodes match current query.</p>
                      ) : null}
                    </div>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

      </main>

      {/* Clear Search History Confirmation Modal */}
      <AnimatePresence>
        {showClearHistoryConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop with dynamic blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowClearHistoryConfirm(false)}
              className="fixed inset-0 bg-[#02020a]/80 backdrop-blur-sm"
            />
            
            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-[#090924] border border-slate-800 rounded-2xl p-6 shadow-[0_15px_40px_rgba(0,0,0,0.8)] overflow-hidden z-50 font-sans"
            >
              {/* Decorative background flare */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl text-red-400 shrink-0">
                  <Trash2 className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 font-sans">Clear Search History?</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Are you sure you want to delete your entire search history? This action is permanent and will wipe all recent queries from your local device cache and session registry.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 border-t border-slate-800/60 pt-4">
                <button
                  type="button"
                  onClick={() => setShowClearHistoryConfirm(false)}
                  className="px-4 py-2 border border-slate-800 bg-[#070719]/40 hover:bg-slate-900/60 text-slate-300 font-medium text-xs rounded-xl cursor-pointer transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearHistory();
                    setShowClearHistoryConfirm(false);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-550 border border-red-700/50 text-white font-bold text-xs rounded-xl cursor-pointer transition-all active:scale-95"
                >
                  Clear All
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Keyboard Shortcuts Trigger Badge */}
      <div className="fixed bottom-6 right-6 z-40 hidden sm:block">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowShortcutsHelp(true)}
          className="flex items-center gap-2 px-3 py-2 bg-[#090924]/90 border border-slate-800 text-slate-300 hover:text-indigo-400 hover:border-indigo-500/50 rounded-full text-xs font-mono font-bold shadow-[0_4px_24px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all cursor-pointer"
          title="Show Keyboard Shortcuts (Shift+?)"
        >
          <Keyboard className="w-4 h-4 text-indigo-400" />
          <span>Hotkeys</span>
          <span className="bg-[#03030d] border border-slate-800 text-slate-400 rounded px-1.5 py-0.5 text-[9px] font-bold">Shift+?</span>
        </motion.button>
      </div>

      {/* Keyboard Shortcuts Dialog Overlay */}
      <AnimatePresence>
        {showShortcutsHelp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Dimmed backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShortcutsHelp(false)}
              className="fixed inset-0 bg-[#02020a]/85 backdrop-blur-sm"
            />

            {/* Dialog Panel Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[#090927] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden z-50 font-sans"
            >
              <div className="absolute -top-32 -left-32 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

              {/* Title Header */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6 relative">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                    <Command className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-100 tracking-tight">Keyboard Shortcuts</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">Speedy Interface Commands</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowShortcutsHelp(false)}
                  className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
                >
                  <span className="text-lg font-bold font-mono">×</span>
                </button>
              </div>

              {/* Shortcuts content lists */}
              <div className="flex flex-col gap-6 relative text-sm">
                
                {/* Section 1: Navigation Core */}
                <div>
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider font-mono mb-3">Core Navigation</h4>
                  <div className="flex flex-col gap-2.5">
                    
                    <div className="flex items-center justify-between bg-[#040410]/50 border border-slate-800/40 p-2.5 rounded-xl">
                      <span className="text-xs text-slate-300 font-medium font-sans">Focus Main Search Input</span>
                      <kbd className="px-2 py-0.5 text-xs font-mono font-extrabold text-indigo-300 bg-indigo-950/40 border border-indigo-500/30 rounded shadow-sm">
                        /
                      </kbd>
                    </div>

                    <div className="flex items-center justify-between bg-[#040410]/50 border border-slate-800/40 p-2.5 rounded-xl">
                      <span className="text-xs text-slate-300 font-medium font-sans">Toggle Bookmark Folders / Collections</span>
                      <div className="flex items-center gap-1">
                        <kbd className="px-2 py-0.5 text-xs font-mono font-extrabold text-[#7e80a0] bg-slate-900 border border-slate-800 rounded shadow-sm">
                          Ctrl
                        </kbd>
                        <span className="text-slate-600 font-mono text-xs">+</span>
                        <kbd className="px-2 py-0.5 text-xs font-mono font-extrabold text-indigo-300 bg-indigo-950/40 border border-indigo-500/30 rounded shadow-sm">
                          K
                        </kbd>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-[#040410]/50 border border-slate-800/40 p-2.5 rounded-xl">
                      <span className="text-xs text-slate-300 font-medium font-sans">Toggle Shortcuts Assistant</span>
                      <kbd className="px-2 py-0.5 text-xs font-mono font-extrabold text-indigo-300 bg-indigo-950/40 border border-indigo-500/30 rounded shadow-sm">
                        Shift + ?
                      </kbd>
                    </div>

                    <div className="flex items-center justify-between bg-[#040410]/50 border border-slate-800/40 p-2.5 rounded-xl">
                      <span className="text-xs text-slate-300 font-medium font-sans">Dismiss dialogs & modals / Unfocus input</span>
                      <kbd className="px-2 py-0.5 text-xs font-mono font-extrabold text-[#7e80a0] bg-slate-900 border border-slate-800 rounded shadow-sm">
                        Esc
                      </kbd>
                    </div>

                  </div>
                </div>

                {/* Section 2: Tab Hoppings */}
                <div>
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider font-mono mb-3">Tab Navigation</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    
                    <div className="flex items-center justify-between bg-[#040410]/50 border border-slate-800/40 p-2.5 rounded-xl">
                      <span className="text-xs text-slate-300 font-sans">Search Engine</span>
                      <div className="flex items-center gap-1 font-mono">
                        <span className="text-[10px] text-slate-500 bg-slate-900 px-1 py-0.5 rounded border border-slate-800">Alt</span>
                        <span className="text-slate-600">+</span>
                        <span className="text-[10px] text-indigo-300 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-900 font-bold">1</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-[#040410]/50 border border-slate-800/40 p-2.5 rounded-xl">
                      <span className="text-xs text-slate-300 font-sans">Crawl & Index</span>
                      <div className="flex items-center gap-1 font-mono">
                        <span className="text-[10px] text-slate-500 bg-slate-900 px-1 py-0.5 rounded border border-slate-800">Alt</span>
                        <span className="text-slate-600">+</span>
                        <span className="text-[10px] text-indigo-300 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-900 font-bold">2</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-[#040410]/50 border border-slate-800/40 p-2.5 rounded-xl">
                      <span className="text-xs text-slate-300 font-sans">Visual Graph</span>
                      <div className="flex items-center gap-1 font-mono">
                        <span className="text-[10px] text-slate-500 bg-slate-900 px-1 py-0.5 rounded border border-slate-800">Alt</span>
                        <span className="text-slate-600">+</span>
                        <span className="text-[10px] text-indigo-300 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-900 font-bold">3</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-[#040410]/50 border border-slate-800/40 p-2.5 rounded-xl">
                      <span className="text-xs text-slate-300 font-sans">Collections</span>
                      <div className="flex items-center gap-1 font-mono">
                        <span className="text-[10px] text-slate-500 bg-slate-900 px-1 py-0.5 rounded border border-slate-800">Alt</span>
                        <span className="text-slate-600">+</span>
                        <span className="text-[10px] text-indigo-300 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-900 font-bold">4</span>
                      </div>
                    </div>

                  </div>
                </div>

              </div>

              {/* Confirm Bottom Action button */}
              <div className="flex items-center justify-end gap-3 mt-8 border-t border-slate-800/60 pt-5">
                <button
                  type="button"
                  onClick={() => setShowShortcutsHelp(false)}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs rounded-xl cursor-pointer transition-all active:scale-95 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                >
                  Got It!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Animated Toast Stack */}
      <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-2.5 max-w-xs sm:max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: -20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -25, scale: 0.85 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto px-4 py-3 rounded-2xl border flex items-center gap-3 shadow-[0_12px_45px_rgba(0,0,0,0.7)] backdrop-blur-md font-sans text-xs font-bold leading-tight ${
                toast.type === 'error'
                  ? 'border-red-500/30 bg-red-950/90 text-red-200'
                  : 'border-emerald-500/30 bg-emerald-950/90 text-emerald-200'
              }`}
            >
              {toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              ) : (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span>{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
