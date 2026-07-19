import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Sparkles, History, Globe, Database, HelpCircle, 
  Plus, Trash2, Link as LinkIcon, AlertCircle, Share2, 
  CheckCircle, Server, Activity, ArrowRight, Loader2, RefreshCw, ListFilter, Palette,
  Clock, Calendar, Settings, BookOpen, Mic, MicOff, Image as ImageIcon,
  ArrowUp, ThumbsUp, Folder, FolderPlus, FolderOpen, ChevronRight, ChevronDown, Bookmark, FileCode,
  Volume2, VolumeX, Keyboard, Command, Copy, Check, Mail, User, Tag, MoreVertical,
  Briefcase, ClipboardList, CheckSquare, Square, Edit3, FileText, Target, FileDown,
  Sun, Moon, Download, Sliders, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { exportProjectToPDF, exportSearchResultsToPDF } from './utils/pdfGenerator';
import { useNotebookAutosave } from './hooks/useNotebookAutosave';
import CommunityNotesSection from './components/CommunityNotesSection';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

// Interfaces
interface SearchCollection {
  id: string;
  name: string;
  description?: string;
  pages: PageItem[];
  created_at: string;
  notes?: string;
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
  author?: string;
  language?: string;
  tags?: string[];
}

interface ProjectTask {
  id: string;
  text: string;
  completed: boolean;
}

interface ResearchProject {
  id: string;
  name: string;
  description: string;
  status: 'planning' | 'in_progress' | 'review' | 'completed';
  created_at: string;
  target_date?: string;
  notes: string;
  tasks: ProjectTask[];
  collectionIds: string[];
  linkedPages?: PageItem[];
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
  language?: string;
  domain?: string;
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
  { id: "page_wiki", url: "https://en.wikipedia.org/wiki/Search_engine", title: "Wikipedia: Search Engine", size: 22, backlinks: 18, x: 250, y: 150, language: "en", domain: "wikipedia.org" },
  { id: "page_fastapi", url: "https://fastapi.tiangolo.com", title: "FastAPI Documentation", size: 14, backlinks: 8, x: 180, y: 260, language: "en", domain: "tiangolo.com" },
  { id: "page_firestore", url: "https://firebase.google.com/docs/firestore", title: "Cloud Firestore Docs", size: 20, backlinks: 15, x: 380, y: 120, language: "en", domain: "google.com" },
  { id: "page_whoosh", url: "https://whoosh.readthedocs.io", title: "Whoosh ReadTheDocs", size: 12, backlinks: 5, x: 350, y: 250, language: "en", domain: "readthedocs.io" }
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

interface HighlightTextProps {
  text: string;
  query: string;
  innerQuery?: string;
}

function HighlightText({ text, query, innerQuery = '' }: HighlightTextProps) {
  if (!text) return null;

  // Extract all searchable words/terms from query and innerQuery
  const termsSet = new Set<string>();

  const extractTerms = (q: string) => {
    if (!q) return;
    const words = q.split(/[\s,.\-\/()\[\]{}'"]+/).map(w => w.trim()).filter(Boolean);
    if (words.length === 1) {
      if (words[0].length >= 1) {
        termsSet.add(words[0].toLowerCase());
      }
    } else {
      words.forEach(w => {
        if (w.length >= 2) {
          termsSet.add(w.toLowerCase());
        }
      });
    }
  };

  extractTerms(query);
  extractTerms(innerQuery);

  const terms = Array.from(termsSet).filter(t => t.length > 0);

  if (terms.length === 0) {
    return <>{text}</>;
  }

  // Escape regex special characters
  const escapedTerms = terms.map(t => t.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
  // Sort by length descending to match longer strings first and prevent partial/overlapping matches
  escapedTerms.sort((a, b) => b.length - a.length);

  const regexPattern = `(${escapedTerms.join('|')})`;
  const regex = new RegExp(regexPattern, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, idx) => {
        const isMatch = termsSet.has(part.toLowerCase());
        return isMatch ? (
          <mark key={idx} className="bg-blue-500/25 text-blue-400 font-bold px-0.5 rounded-sm">
            {part}
          </mark>
        ) : (
          part
        );
      })}
    </>
  );
}

// Custom tooltip component for Recharts line chart
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-800 text-slate-100 p-3.5 rounded-2xl shadow-xl font-mono text-xs flex flex-col gap-1.5 min-w-[180px]">
        <p className="font-sans font-bold text-slate-300 border-b border-slate-800 pb-1 mb-1">
          {new Date(label).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.stroke || entry.color }}></span>
              <span className="text-slate-400 font-sans">{entry.name}:</span>
            </span>
            <span className="font-bold text-right" style={{ color: entry.stroke || entry.color }}>
              {entry.value}
            </span>
          </div>
        ))}
        {payload[0]?.payload?.run_count !== undefined && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-800/50 pt-1 mt-1 text-[10px] text-slate-500">
            <span>Runs Completed:</span>
            <span className="font-bold text-slate-300">{payload[0].payload.run_count}</span>
          </div>
        )}
      </div>
    );
  }
  return null;
}

const DOMAIN_PALETTE = [
  { name: 'wikipedia.org', hex: '#38bdf8', border: 'border-sky-500/30', bg: 'bg-sky-500/10', text: 'text-sky-400' },
  { name: 'tiangolo.com', hex: '#34d399', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  { name: 'google.com', hex: '#f87171', border: 'border-rose-500/30', bg: 'bg-rose-500/10', text: 'text-rose-400' },
  { name: 'readthedocs.io', hex: '#c084fc', border: 'border-purple-500/30', bg: 'bg-purple-500/10', text: 'text-purple-400' },
  { name: 'Other: Group A', hex: '#fbbf24', border: 'border-amber-500/30', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  { name: 'Other: Group B', hex: '#f472b6', border: 'border-pink-500/30', bg: 'bg-pink-500/10', text: 'text-pink-400' },
  { name: 'Other: Group C', hex: '#2dd4bf', border: 'border-teal-500/30', bg: 'bg-teal-500/10', text: 'text-teal-400' },
  { name: 'Other: Group D', hex: '#a7f3d0', border: 'border-emerald-200/30', bg: 'bg-emerald-200/10', text: 'text-emerald-300' }
];

const LANGUAGE_PALETTE = [
  { name: 'English', hex: '#6366f1', langs: ['en', 'english', 'eng'], border: 'border-indigo-500/30', bg: 'bg-indigo-500/10', text: 'text-indigo-400' },
  { name: 'Spanish', hex: '#f43f5e', langs: ['es', 'spanish', 'español', 'spa'], border: 'border-rose-500/30', bg: 'bg-rose-500/10', text: 'text-rose-400' },
  { name: 'French', hex: '#0ea5e9', langs: ['fr', 'french', 'français', 'fre'], border: 'border-sky-500/30', bg: 'bg-sky-500/10', text: 'text-sky-400' },
  { name: 'German', hex: '#eab308', langs: ['de', 'german', 'deutsch', 'ger'], border: 'border-amber-500/30', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  { name: 'Japanese', hex: '#db2777', langs: ['ja', 'japanese', '日本語', 'jpn'], border: 'border-pink-500/30', bg: 'bg-pink-500/10', text: 'text-pink-400' },
  { name: 'Chinese', hex: '#dc2626', langs: ['zh', 'chinese', '中文', 'chi'], border: 'border-red-500/30', bg: 'bg-red-500/10', text: 'text-red-400' },
  { name: 'Other Langs', hex: '#a855f7', langs: [], border: 'border-purple-500/30', bg: 'bg-purple-500/10', text: 'text-purple-400' }
];

const getDomainOfUrl = (urlStr: string): string => {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.replace('www.', '');
  } catch (_) {
    const clean = urlStr.replace('https://', '').replace('http://', '').split('/')[0];
    return clean || 'unknown';
  }
};

const getDomainColorInfo = (domain: string) => {
  const normalized = domain.toLowerCase().trim();
  if (normalized.includes('wikipedia.org')) return DOMAIN_PALETTE[0];
  if (normalized.includes('tiangolo.com')) return DOMAIN_PALETTE[1];
  if (normalized.includes('google.com')) return DOMAIN_PALETTE[2];
  if (normalized.includes('readthedocs.io')) return DOMAIN_PALETTE[3];
  
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % 4 + 4; // Use index 4-7 for generic domains
  return {
    ...DOMAIN_PALETTE[idx],
    name: domain
  };
};

const getLanguageColorInfo = (lang?: string) => {
  if (!lang) return LANGUAGE_PALETTE[6];
  const normalized = lang.toLowerCase().trim();
  const matched = LANGUAGE_PALETTE.find(item => 
    item.langs.includes(normalized) || item.name.toLowerCase() === normalized
  );
  if (matched) return matched;
  
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % 6; // Cycle English to Chinese for custom language tags
  return {
    ...LANGUAGE_PALETTE[idx],
    name: lang.toUpperCase()
  };
};

export default function App() {
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('isaac_theme') as 'dark' | 'light') || 'dark';
  });
  const isLight = theme === 'light';
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('isaac_theme', newTheme);
  };

  // Navigation & Search State
  const [activeTab, setActiveTab] = useState<'search' | 'crawler' | 'graph' | 'collections' | 'projects'>('search');
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [selectedPaletteIndex, setSelectedPaletteIndex] = useState(0);
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

  // Research Projects State
  const [projects, setProjects] = useState<ResearchProject[]>(() => {
    const saved = localStorage.getItem('isaac_projects');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to load projects", e);
      }
    }
    return [
      {
        id: 'proj_default_1',
        name: 'Isaac Search Research Workspace',
        description: 'Analyze crawled data, index custom pages, organize collections, and prepare findings.',
        status: 'in_progress',
        created_at: new Date().toUTCString(),
        target_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: '### Project Notes\n\nWelcome to your Isaac Search project workspace! You can:\n- Check off tasks in your task list on the right.\n- Link search collections here.\n- Keep structured notes for your research.',
        tasks: [
          { id: 'task_1', text: 'Crawl key reference web pages using the Index & Crawler tab', completed: false },
          { id: 'task_2', text: 'Verify page details and update custom tags/authors', completed: false },
          { id: 'task_3', text: 'Group findings into search collections', completed: false },
          { id: 'task_4', text: 'Link collections to this project and summarize findings in notes', completed: false }
        ],
        collectionIds: ['col-ai']
      }
    ];
  });

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>('proj_default_1');
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectStatus, setNewProjectStatus] = useState<'planning' | 'in_progress' | 'review' | 'completed'>('planning');
  const [newProjectTargetDate, setNewProjectTargetDate] = useState('');
  const [newProjectSelectedColIds, setNewProjectSelectedColIds] = useState<string[]>([]);
  const [newProjectTaskText, setNewProjectTaskText] = useState('');

  // Persist projects to localStorage
  useEffect(() => {
    localStorage.setItem('isaac_projects', JSON.stringify(projects));
  }, [projects]);

  // Find currently active project notes to pass to the autosave hook
  const activeProjectNotes = useMemo(() => {
    const activeProj = projects.find(p => p.id === selectedProjectId);
    return activeProj ? activeProj.notes : '';
  }, [projects, selectedProjectId]);

  const {
    localNotes,
    setLocalNotes,
    lastSaved,
    isSaving
  } = useNotebookAutosave(selectedProjectId, activeProjectNotes, (notesText) => {
    if (selectedProjectId) {
      handleUpdateProjectNotes(selectedProjectId, notesText);
    }
  });

  const [activeSavePageId, setActiveSavePageId] = useState<string | null>(null);
  const [saveDropdownPosition, setSaveDropdownPosition] = useState<'top' | 'bottom'>('bottom');
  const [newFolderNameInline, setNewFolderNameInline] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>("col-ai");
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [collectionsViewMode, setCollectionsViewMode] = useState<'board' | 'tree'>('board');
  const [collectionsQuery, setCollectionsQuery] = useState('');
  const [folderNotes, setFolderNotes] = useState<string>('');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);
  const saveTimeoutRef = useRef<any>(null);

  // Sync folder notes when selected folder changes
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      setIsSavingNotes(false);
    }
    const activeFolder = collections.find(c => c.id === selectedCollectionId);
    if (activeFolder) {
      setFolderNotes(activeFolder.notes || '');
    } else {
      setFolderNotes('');
    }
  }, [selectedCollectionId]);

  const handleUpdateFolderNote = (text: string) => {
    setFolderNotes(text);
    setIsSavingNotes(true);
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    setCollections(prev => prev.map(col => {
      if (col.id === selectedCollectionId) {
        return { ...col, notes: text };
      }
      return col;
    }));

    saveTimeoutRef.current = setTimeout(() => {
      setIsSavingNotes(false);
    }, 1000);
  };

  // Drag and Drop States for Collections Board
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const [draggedPageSourceFolderId, setDraggedPageSourceFolderId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverPageId, setDragOverPageId] = useState<string | null>(null);

  const handleDropOnFolder = (targetFolderId: string) => {
    if (draggedFolderId) {
      if (draggedFolderId === targetFolderId) return;
      const dragIndex = collections.findIndex(c => c.id === draggedFolderId);
      const hoverIndex = collections.findIndex(c => c.id === targetFolderId);
      if (dragIndex !== -1 && hoverIndex !== -1) {
        const updated = [...collections];
        const [moved] = updated.splice(dragIndex, 1);
        updated.splice(hoverIndex, 0, moved);
        setCollections(updated);
        showToast("Reordered folder list", "info");
      }
      setDraggedFolderId(null);
      setDragOverFolderId(null);
    } else if (draggedPageId && draggedPageSourceFolderId) {
      if (draggedPageSourceFolderId === targetFolderId) return;
      const sourceCol = collections.find(c => c.id === draggedPageSourceFolderId);
      const targetCol = collections.find(c => c.id === targetFolderId);
      if (sourceCol && targetCol) {
        const pageToMove = sourceCol.pages.find(p => p.id === draggedPageId);
        if (pageToMove) {
          const pageAlreadyExists = targetCol.pages.some(p => p.url === pageToMove.url);
          const updatedCollections = collections.map(col => {
            if (col.id === draggedPageSourceFolderId) {
              return { ...col, pages: col.pages.filter(p => p.id !== draggedPageId) };
            }
            if (col.id === targetFolderId) {
              if (pageAlreadyExists) return col;
              return { ...col, pages: [...col.pages, pageToMove] };
            }
            return col;
          });
          setCollections(updatedCollections);
          setSelectedCollectionId(targetFolderId);
          showToast(`Moved "${pageToMove.title.substring(0, 20)}..." to ${targetCol.name}`, "success");
        }
      }
      setDraggedPageId(null);
      setDraggedPageSourceFolderId(null);
      setDragOverFolderId(null);
    }
  };

  const handleDropOnPage = (targetPageId: string, folderId: string) => {
    if (draggedPageId && draggedPageSourceFolderId === folderId) {
      const col = collections.find(c => c.id === folderId);
      if (col) {
        const dragIndex = col.pages.findIndex(p => p.id === draggedPageId);
        const hoverIndex = col.pages.findIndex(p => p.id === targetPageId);
        if (dragIndex !== -1 && hoverIndex !== -1) {
          const updatedPages = [...col.pages];
          const [moved] = updatedPages.splice(dragIndex, 1);
          updatedPages.splice(hoverIndex, 0, moved);
          
          setCollections(prev => prev.map(c => {
            if (c.id === folderId) {
              return { ...c, pages: updatedPages };
            }
            return c;
          }));
          showToast("Reordered bookmarks inside folder", "info");
        }
      }
    }
    setDraggedPageId(null);
    setDraggedPageSourceFolderId(null);
    setDragOverPageId(null);
  };
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const [searchWithinQuery, setSearchWithinQuery] = useState('');
  const [speakingPageId, setSpeakingPageId] = useState<string | null>(null);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const paletteInputRef = useRef<HTMLInputElement>(null);

  // Custom Site Actions (3-dot) states
  const [excludedDomains, setExcludedDomains] = useState<string[]>([]);
  const [blockedDomains, setBlockedDomains] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('blocked_domains');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [openThreeDotMenuPageId, setOpenThreeDotMenuPageId] = useState<string | null>(null);

  // Success toast notifications state & handler
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'info' | 'error' }>>([]);
  const [copiedPageId, setCopiedPageId] = useState<string | null>(null);

  const getDomainFromUrl = (urlStr: string): string => {
    try {
      const parsed = new URL(urlStr);
      return parsed.hostname.toLowerCase().replace('www.', '');
    } catch (e) {
      const match = urlStr.match(/^(?:https?:\/\/)?(?:www\.)?([^/:\?]+)/i);
      return match && match[1] ? match[1].toLowerCase() : urlStr.toLowerCase();
    }
  };

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
    const domainFiltered = searchResults.filter(p => {
      const dom = getDomainFromUrl(p.url);
      const isExcluded = excludedDomains.some(ex => dom.includes(ex) || ex.includes(dom));
      const isBlocked = blockedDomains.some(bl => dom.includes(bl) || bl.includes(dom));
      return !isExcluded && !isBlocked;
    });

    if (!searchWithinQuery.trim()) return domainFiltered;
    const innerQ = searchWithinQuery.toLowerCase().trim();
    return domainFiltered.filter(p => 
      p.title.toLowerCase().includes(innerQ) || 
      p.snippet.toLowerCase().includes(innerQ) || 
      p.url.toLowerCase().includes(innerQ)
    );
  }, [searchResults, searchWithinQuery, excludedDomains, blockedDomains]);

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
  const [sortBy, setSortBy] = useState<'likes_desc' | 'relevance' | 'date_desc' | 'date_asc' | 'backlinks_desc' | 'title_asc' | 'title_desc' | 'language_asc'>('likes_desc');
  const [showFilters, setShowFilters] = useState(false);
  
  // Crawler / Index Form State
  const [pagesList, setPagesList] = useState<PageItem[]>(DEFAULT_PAGES);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newSnippet, setNewSnippet] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newLanguage, setNewLanguage] = useState('');
  const [newTagsStr, setNewTagsStr] = useState('');
  const [indexError, setIndexError] = useState<string | null>(null);
  const [indexSuccess, setIndexSuccess] = useState(false);

  // In-place custom metadata editing states
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editAuthor, setEditAuthor] = useState('');
  const [editLanguage, setEditLanguage] = useState('');
  const [editTagsStr, setEditTagsStr] = useState('');
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [isSuggestingNewTags, setIsSuggestingNewTags] = useState(false);
  const [isSuggestingEditTags, setIsSuggestingEditTags] = useState(false);
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
  const [trendData, setTrendData] = useState<Array<{ date: string; pages_crawled: number; errors: number; run_count?: number }>>([]);
  const [isFetchingTrend, setIsFetchingTrend] = useState(false);

  // Common Crawl Open Data state
  const [ccDomain, setCcDomain] = useState('news.ycombinator.com');
  const [ccLimit, setCcLimit] = useState(50);
  const [ccResults, setCcResults] = useState<Array<{ url: string; timestamp: string; mime: string; status: string }>>([]);
  const [ccLoading, setCcLoading] = useState(false);
  const [ccError, setCcError] = useState<string | null>(null);
  const [ccSelectedUrls, setCcSelectedUrls] = useState<string[]>([]);
  const [ccImportStatus, setCcImportStatus] = useState<{ success: boolean; added: number; skipped: number } | null>(null);
  const [ccImporting, setCcImporting] = useState(false);
  const [ccFilterText, setCcFilterText] = useState('');
  const [seedsList, setSeedsList] = useState<Array<{ id: string; url: string; domain: string; source: string; created_at: number }>>([]);
  const [loadingSeeds, setLoadingSeeds] = useState(false);
  const [autoCrawlEnabled, setAutoCrawlEnabled] = useState(false);
  const [isUpdatingAutoCrawl, setIsUpdatingAutoCrawl] = useState(false);

  const filteredCcResults = useMemo(() => {
    if (!ccFilterText.trim()) return ccResults;
    const term = ccFilterText.toLowerCase();
    return ccResults.filter(r => r.url.toLowerCase().includes(term));
  }, [ccResults, ccFilterText]);

  // Graph Visualization State
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>(INITIAL_NODES);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [graphSearchQuery, setGraphSearchQuery] = useState('');
  const [graphColorMode, setGraphColorMode] = useState<'domain' | 'language'>('domain');
  const [graphLayout, setGraphLayout] = useState<'sandbox' | 'orbit' | 'starburst' | 'clusters'>('sandbox');
  const [minBacklinks, setMinBacklinks] = useState<number>(0);

  const filteredGraphNodes = useMemo(() => {
    return graphNodes.filter(node => node.backlinks >= minBacklinks);
  }, [graphNodes, minBacklinks]);

  const activeEdges = useMemo(() => {
    return graphEdges.filter(edge => {
      const hasSource = filteredGraphNodes.some(n => n.id === edge.source);
      const hasTarget = filteredGraphNodes.some(n => n.id === edge.target);
      return hasSource && hasTarget;
    });
  }, [graphEdges, filteredGraphNodes]);

  // Clean up selection and hover states if they are filtered out
  useEffect(() => {
    if (selectedNode && !filteredGraphNodes.some(n => n.id === selectedNode.id)) {
      setSelectedNode(null);
    }
    if (hoveredNode && !filteredGraphNodes.some(n => n.id === hoveredNode.id)) {
      setHoveredNode(null);
    }
  }, [filteredGraphNodes, selectedNode, hoveredNode]);

  const resolveNodeDomainAndLanguage = (node: GraphNode) => {
    const domain = node.domain || getDomainOfUrl(node.url);
    let language = node.language;
    if (!language) {
      const page = pagesList.find(p => p.id === node.id || p.url === node.url) || DEFAULT_PAGES.find(p => p.id === node.id || p.url === node.url);
      if (page && page.language) {
        language = page.language;
      }
    }
    return { domain, language: language || 'en' };
  };

  const matchedGraphNodes = useMemo(() => {
    const query = graphSearchQuery.trim().toLowerCase();
    if (!query) return [];
    const keywords = query.split(/\s+/).filter(Boolean);
    if (keywords.length === 0) return [];
    return filteredGraphNodes.filter(node => {
      const { domain, language } = resolveNodeDomainAndLanguage(node);
      return keywords.every(kw => 
        node.title.toLowerCase().includes(kw) ||
        node.url.toLowerCase().includes(kw) ||
        domain.toLowerCase().includes(kw) ||
        language.toLowerCase().includes(kw)
      );
    });
  }, [filteredGraphNodes, graphSearchQuery, pagesList]);

  const handleLayoutChange = (layout: 'sandbox' | 'orbit' | 'starburst' | 'clusters') => {
    setGraphLayout(layout);
    
    setGraphNodes(prev => {
      const n = prev.length;
      if (n === 0) return prev;
      
      const centerX = 320;
      const centerY = 200;
      
      if (layout === 'sandbox') {
        return prev.map(node => {
          const original = INITIAL_NODES.find(init => init.id === node.id);
          if (original) {
            return { ...node, x: original.x, y: original.y };
          }
          return node;
        });
      }
      
      if (layout === 'orbit') {
        const sorted = [...prev].sort((a, b) => b.backlinks - a.backlinks);
        const hubId = sorted[0]?.id;
        
        return prev.map((node, i) => {
          if (node.id === hubId) {
            return { ...node, x: centerX, y: centerY };
          }
          const angle = (i * 2 * Math.PI) / (n - 1);
          const radius = 120 + (i % 2) * 35;
          return {
            ...node,
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
          };
        });
      }
      
      if (layout === 'starburst') {
        const sorted = [...prev].sort((a, b) => b.backlinks - a.backlinks);
        return prev.map((node) => {
          const rank = sorted.findIndex(s => s.id === node.id);
          const angle = rank * 0.85;
          const radius = 45 + rank * 24;
          return {
            ...node,
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
          };
        });
      }
      
      if (layout === 'clusters') {
        const domains: string[] = Array.from(new Set(prev.map(node => resolveNodeDomainAndLanguage(node).domain || 'unknown')));
        const clusterCenters: Record<string, { x: number; y: number }> = {};
        
        domains.forEach((dom, idx) => {
          const angle = (idx * 2 * Math.PI) / (domains.length || 1);
          const dist = domains.length > 1 ? 130 : 0;
          clusterCenters[dom] = {
            x: centerX + Math.cos(angle) * dist,
            y: centerY + Math.sin(angle) * dist
          };
        });
        
        const domainCounts: Record<string, number> = {};
        return prev.map((node) => {
          const dom = resolveNodeDomainAndLanguage(node).domain || 'unknown';
          const center = clusterCenters[dom] || { x: centerX, y: centerY };
          const count = domainCounts[dom] || 0;
          domainCounts[dom] = count + 1;
          
          const angle = count * 1.2;
          const radius = count === 0 ? 0 : 35 + count * 5;
          return {
            ...node,
            x: center.x + Math.cos(angle) * radius,
            y: center.y + Math.sin(angle) * radius
          };
        });
      }
      
      return prev;
    });
  };


  const getNodeColor = (node: GraphNode, mode: 'domain' | 'language') => {
    const { domain, language } = resolveNodeDomainAndLanguage(node);
    if (mode === 'domain') {
      return getDomainColorInfo(domain).hex;
    } else {
      return getLanguageColorInfo(language).hex;
    }
  };

  const downloadGraphAsSVG = () => {
    if (!svgRef.current) return;
    try {
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svgRef.current);
      
      // Ensure appropriate standard namespaces are declared
      if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      if (!source.match(/^<svg[^>]+xmlns\:xlink="http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
        source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
      }
      
      source = '<?xml version="1.0" encoding="utf-8"?>\n' + source;
      
      const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      const downloadLink = document.createElement("a");
      downloadLink.href = url;
      downloadLink.download = `crawl_graph_${new Date().toISOString().slice(0, 10)}.svg`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      
      // Clean up the object URL and the created link
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to download SVG graph:', e);
    }
  };

  const downloadGraphAsJSON = () => {
    try {
      const data = {
        meta: {
          exporter: "Isaac Search Workspace - Visual Crawl Link Graph",
          timestamp: new Date().toISOString(),
          totalNodeCount: graphNodes.length,
          totalEdgeCount: graphEdges.length,
          filteredNodeCount: filteredGraphNodes.length,
          filteredEdgeCount: activeEdges.length,
          minBacklinksFilter: minBacklinks
        },
        nodes: filteredGraphNodes.map(node => ({
          id: node.id,
          url: node.url,
          title: node.title,
          size: node.size,
          backlinks: node.backlinks,
          x: node.x,
          y: node.y,
          fx: node.fx,
          fy: node.fy,
          language: node.language || resolveNodeDomainAndLanguage(node).language,
          domain: node.domain || resolveNodeDomainAndLanguage(node).domain
        })),
        edges: activeEdges
      };
      
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      const downloadLink = document.createElement("a");
      downloadLink.href = url;
      downloadLink.download = `crawl_graph_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
      
      showToast("Downloaded graph data as JSON successfully!", "success");
    } catch (e) {
      console.error('Failed to download JSON graph:', e);
      showToast("Failed to download graph data as JSON", "error");
    }
  };

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

      // 2. Ctrl+K or Cmd+K to toggle/open global search / command palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
        setPaletteQuery('');
        setSelectedPaletteIndex(0);
        return;
      }

      // 3. Escape key to dismiss modals/menus or blur input
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
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
        } else if (e.key === '5') {
          e.preventDefault();
          setActiveTab('projects');
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

  const DEFAULT_MOCK_SEEDS = [
    { id: 'seed-1', url: 'https://news.ycombinator.com', domain: 'news.ycombinator.com', source: 'common_crawl', created_at: Date.now() },
    { id: 'seed-2', url: 'https://en.wikipedia.org/wiki/Search_engine', domain: 'en.wikipedia.org', source: 'manual', created_at: Date.now() }
  ];

  const fetchSeeds = async () => {
    setLoadingSeeds(true);
    try {
      const res = await fetch(`${API_BASE}/crawler/seeds`);
      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setSeedsList(data || []);
        localStorage.setItem('isaac_crawler_seeds', JSON.stringify(data || []));
      } else {
        const stored = localStorage.getItem('isaac_crawler_seeds');
        if (stored) {
          try {
            setSeedsList(JSON.parse(stored));
          } catch (_) {
            setSeedsList(DEFAULT_MOCK_SEEDS);
          }
        } else {
          setSeedsList(DEFAULT_MOCK_SEEDS);
        }
      }
    } catch (_) {
      const stored = localStorage.getItem('isaac_crawler_seeds');
      if (stored) {
        try {
          setSeedsList(JSON.parse(stored));
        } catch (_) {
          setSeedsList(DEFAULT_MOCK_SEEDS);
        }
      } else {
        setSeedsList(DEFAULT_MOCK_SEEDS);
      }
    } finally {
      setLoadingSeeds(false);
    }
  };

  const handleDeleteSeed = async (id: string) => {
    let apiDeleted = false;
    try {
      const res = await fetch(`${API_BASE}/crawler/seeds/${id}`, {
        method: 'DELETE'
      });
      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        apiDeleted = true;
        fetchSeeds();
      }
    } catch (_) {}

    if (!apiDeleted) {
      try {
        const stored = localStorage.getItem('isaac_crawler_seeds');
        const currentList = stored ? JSON.parse(stored) : [...DEFAULT_MOCK_SEEDS];
        const updated = currentList.filter((s: any) => s.id !== id);
        localStorage.setItem('isaac_crawler_seeds', JSON.stringify(updated));
        setSeedsList(updated);
      } catch (_) {}
    }
  };

  const fetchAutoCrawlState = async () => {
    try {
      const res = await fetch(`${API_BASE}/crawler/auto-crawl`);
      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setAutoCrawlEnabled(data.enabled || false);
        localStorage.setItem('isaac_auto_crawl_enabled', JSON.stringify(data.enabled || false));
      } else {
        const stored = localStorage.getItem('isaac_auto_crawl_enabled');
        if (stored !== null) {
          setAutoCrawlEnabled(JSON.parse(stored));
        }
      }
    } catch (_) {
      const stored = localStorage.getItem('isaac_auto_crawl_enabled');
      if (stored !== null) {
        setAutoCrawlEnabled(JSON.parse(stored));
      }
    }
  };

  const toggleAutoCrawl = async () => {
    const nextVal = !autoCrawlEnabled;
    setAutoCrawlEnabled(nextVal);
    setIsUpdatingAutoCrawl(true);
    
    let apiSuccess = false;
    try {
      const res = await fetch(`${API_BASE}/crawler/auto-crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextVal })
      });
      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        apiSuccess = true;
        localStorage.setItem('isaac_auto_crawl_enabled', JSON.stringify(nextVal));
      }
    } catch (_) {}

    if (!apiSuccess) {
      localStorage.setItem('isaac_auto_crawl_enabled', JSON.stringify(nextVal));
    }
    setIsUpdatingAutoCrawl(false);
  };

  // Load Schedule and Crawl History
  const fetchScheduleAndHistory = async () => {
    setIsFetchingHistory(true);
    fetchSeeds();
    fetchAutoCrawlState();
    try {
      const schedRes = await fetch(`${API_BASE}/crawler/schedule`);
      const contentType = schedRes.headers.get("content-type");
      if (schedRes.ok && contentType && contentType.includes("application/json")) {
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
      const contentType = histRes.headers.get("content-type");
      if (histRes.ok && contentType && contentType.includes("application/json")) {
        const data = await histRes.json();
        setCrawlHistory(data);
      }
    } catch (_) {}

    setIsFetchingTrend(true);
    try {
      const trendRes = await fetch(`${API_BASE}/crawler/trend`);
      const contentType = trendRes.headers.get("content-type");
      if (trendRes.ok && contentType && contentType.includes("application/json")) {
        const data = await trendRes.json();
        setTrendData(data);
      }
    } catch (_) {}
    setIsFetchingTrend(false);

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

  const handleSearchCommonCrawl = async () => {
    if (!ccDomain.trim()) {
      setCcError('Please enter a valid domain to search.');
      return;
    }
    setCcLoading(true);
    setCcError(null);
    setCcResults([]);
    setCcSelectedUrls([]);
    setCcImportStatus(null);
    try {
      const response = await fetch(`${API_BASE}/crawler/common-crawl/search?domain=${encodeURIComponent(ccDomain)}&limit=${ccLimit}`);
      if (response.ok) {
        const data = await response.json();
        setCcResults(data.urls || []);
        // Select all by default to make it easy for the user
        setCcSelectedUrls((data.urls || []).map((item: any) => item.url));
        if (!data.urls || data.urls.length === 0) {
          setCcError('No HTML URLs found for this domain in Common Crawl latest index.');
        }
      } else {
        const errText = await response.text();
        setCcError(`CDX API query failed: ${errText || response.statusText}`);
      }
    } catch (e: any) {
      setCcError(`Network error querying CDX API: ${e.message || e}`);
    }
    setCcLoading(false);
  };

  const handleImportCommonCrawlSeeds = async () => {
    if (ccSelectedUrls.length === 0) {
      alert('Please select at least one URL to import.');
      return;
    }
    setCcImporting(true);
    setCcImportStatus(null);
    let apiSuccess = false;
    try {
      const response = await fetch(`${API_BASE}/crawler/common-crawl/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: ccSelectedUrls })
      });
      const contentType = response.headers.get("content-type");
      if (response.ok && contentType && contentType.includes("application/json")) {
        const data = await response.json();
        setCcImportStatus({
          success: true,
          added: data.added_count,
          skipped: data.skipped_count
        });
        apiSuccess = true;
        // Reload active seeds list
        fetchSeeds();
      }
    } catch (_) {
      // Quietly continue to fallback
    }

    if (!apiSuccess) {
      // Fallback local storage seeds import
      try {
        const stored = localStorage.getItem('isaac_crawler_seeds');
        const currentList = stored ? JSON.parse(stored) : [...DEFAULT_MOCK_SEEDS];
        let addedCount = 0;
        let skippedCount = 0;
        
        ccSelectedUrls.forEach(url => {
          if (currentList.some((s: any) => s.url === url)) {
            skippedCount++;
          } else {
            let domain = url;
            try {
              domain = new URL(url).hostname || url;
            } catch (_) {}
            
            currentList.push({
              id: `seed-local-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              url,
              domain,
              source: 'common_crawl',
              created_at: Date.now()
            });
            addedCount++;
          }
        });
        
        localStorage.setItem('isaac_crawler_seeds', JSON.stringify(currentList));
        setSeedsList(currentList);
        setCcImportStatus({
          success: true,
          added: addedCount,
          skipped: skippedCount
        });
      } catch (err) {
        setCcImportStatus({
          success: false,
          added: 0,
          skipped: 0
        });
      }
    }
    setCcImporting(false);
  };

  const handleToggleCcUrl = (url: string) => {
    setCcSelectedUrls(prev => 
      prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]
    );
  };

  const handleToggleSelectAllCcUrls = () => {
    const visibleUrls = filteredCcResults.map(r => r.url);
    const allVisibleSelected = visibleUrls.every(url => ccSelectedUrls.includes(url));
    
    if (allVisibleSelected) {
      // Deselect visible
      setCcSelectedUrls(prev => prev.filter(url => !visibleUrls.includes(url)));
    } else {
      // Select visible
      setCcSelectedUrls(prev => {
        const union = new Set([...prev, ...visibleUrls]);
        return Array.from(union);
      });
    }
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

  const handleSearch = async (queryStr: string = searchQuery, bypassState = false, overrideDomain?: string) => {
    if (!queryStr.trim()) return;
    setIsSearching(true);
    setShowSuggestions(false);
    setSearchWithinQuery('');
    fetchImages(queryStr);
    
    // Save to history
    saveToHistory(queryStr);

    let backendUrl = `${API_BASE}/search?q=${encodeURIComponent(queryStr)}&page=1&limit=10`;
    
    const domainToUse = overrideDomain !== undefined ? overrideDomain : filterDomain;
    if (domainToUse.trim()) {
      backendUrl += `&domain=${encodeURIComponent(domainToUse.trim())}`;
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
        const domainToUseClient = overrideDomain !== undefined ? overrideDomain : filterDomain;
        if (domainToUseClient.trim()) {
          const domLower = domainToUseClient.toLowerCase().trim();
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
        } else if (sortBy === 'title_asc') {
          filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        } else if (sortBy === 'title_desc') {
          filtered.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
        } else if (sortBy === 'language_asc') {
          filtered.sort((a, b) => {
            const langCompare = (a.language || '').localeCompare(b.language || '');
            if (langCompare !== 0) return langCompare;
            return (a.title || '').localeCompare(b.title || '');
          });
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
    let output = "Search Collections Map\n";
    filteredCollections.forEach((col) => {
      output += `${col.name}${col.description ? ` - ${col.description}` : ''}\n`;
      if (col.notes) {
        output += `   📝 Notes: ${col.notes.replace(/\n/g, '\n   ')}\n`;
      }
      if (col.pages.length === 0) {
        output += "   └─ (Empty folder)\n";
      } else {
        col.pages.forEach((page, pageIdx) => {
          const isLast = pageIdx === col.pages.length - 1;
          output += `   ${isLast ? '└─' : '├─'} ${page.title} (${page.url})\n`;
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

  // Suggest tags dynamically based on keyword extraction and semantic mapping
  const fetchTagSuggestions = async (snippetText: string): Promise<string[]> => {
    if (!snippetText || !snippetText.trim()) {
      return [];
    }
    try {
      const res = await fetch(`${API_BASE}/suggest-tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snippet: snippetText })
      });
      if (res.ok) {
        const data = await res.json();
        return data.suggested_tags || [];
      }
    } catch (e) {
      console.error("Error fetching tag suggestions:", e);
    }
    
    // Client-side fallback if backend is offline or errors
    const words = snippetText.toLowerCase().replace(/[^a-zA-Z\s]/g, '').split(/\s+/);
    const stopWords = new Set([
      "the", "and", "for", "with", "from", "that", "this", "your", "have", "you", "are", "but", "not", "they",
      "about", "their", "there", "more", "will", "can", "some", "one", "all", "our", "into", "has", "been", "its", "out", "was"
    ]);
    const counts: { [key: string]: number } = {};
    words.forEach(w => {
      if (w.length > 3 && !stopWords.has(w)) {
        counts[w] = (counts[w] || 0) + 1;
      }
    });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 5);
  };

  const handleSuggestTagsForNewPage = async () => {
    setIsSuggestingNewTags(true);
    const textToAnalyze = newSnippet || newTitle;
    if (!textToAnalyze) {
      showToast("Please provide a title or snippet description to suggest tags.", "info");
      setIsSuggestingNewTags(false);
      return;
    }
    const suggested = await fetchTagSuggestions(textToAnalyze);
    if (suggested.length > 0) {
      const currentTags = newTagsStr ? newTagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];
      const combined = Array.from(new Set([...currentTags, ...suggested]));
      setNewTagsStr(combined.join(', '));
      showToast(`Suggested ${suggested.length} tags based on metadata keywords.`, 'success');
    } else {
      showToast("Could not extract any meaningful tags from the text.", "info");
    }
    setIsSuggestingNewTags(false);
  };

  const handleSuggestTagsForEditPage = async (snippet: string) => {
    setIsSuggestingEditTags(true);
    if (!snippet) {
      showToast("No snippet or content available to suggest tags.", "info");
      setIsSuggestingEditTags(false);
      return;
    }
    const suggested = await fetchTagSuggestions(snippet);
    if (suggested.length > 0) {
      const currentTags = editTagsStr ? editTagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];
      const combined = Array.from(new Set([...currentTags, ...suggested]));
      setEditTagsStr(combined.join(', '));
      showToast(`Suggested ${suggested.length} tags based on content snippet.`, 'success');
    } else {
      showToast("Could not extract any tags from this page's description.", "info");
    }
    setIsSuggestingEditTags(false);
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

    const parsedTags = newTagsStr.trim() ? newTagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];
    const newPage: PageItem = {
      id: "manual_" + Math.random().toString(36).substr(2, 9),
      url: newUrl,
      title: newTitle || newUrl,
      snippet: newSnippet || "No description crawled yet for this custom URL address.",
      backlinks: 0,
      indexed_at: new Date().toUTCString(),
      likes: 0,
      author: newAuthor.trim() || undefined,
      language: newLanguage.trim() || undefined,
      tags: parsedTags.length > 0 ? parsedTags : undefined
    };

    try {
      const response = await fetch(`${API_BASE}/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPage)
      });
      if (response.ok) {
        setPagesList([newPage, ...pagesList]);
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

    // Auto-Crawl Trigger
    if (autoCrawlEnabled) {
      const newSeed = {
        id: "seed_" + Math.random().toString(36).substring(2, 11),
        url: newPage.url,
        domain: newUrl.replace('https://', '').replace('http://', '').split('/')[0],
        source: 'manual',
        created_at: Date.now()
      };
      
      try {
        const stored = localStorage.getItem('isaac_crawler_seeds');
        const currentList = stored ? JSON.parse(stored) : [...DEFAULT_MOCK_SEEDS];
        if (!currentList.some((s: any) => s.url === newPage.url)) {
          const updated = [newSeed, ...currentList];
          localStorage.setItem('isaac_crawler_seeds', JSON.stringify(updated));
          setSeedsList(updated);
        }
      } catch (_) {}
      
      if (crawlerStatus.status !== 'running') {
        triggerCrawl();
      }
    }

    // Clear form inputs
    setNewUrl('');
    setNewTitle('');
    setNewContent('');
    setNewSnippet('');
    setNewAuthor('');
    setNewLanguage('');
    setNewTagsStr('');
  };

  const handleSaveCustomMetadata = (pageId: string) => {
    const page = pagesList.find(p => p.id === pageId);
    if (!page) return;

    const parsedTags = editTagsStr.trim() ? editTagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

    const updatedPagesList = pagesList.map(p => {
      if (p.id === pageId) {
        return {
          ...p,
          author: editAuthor.trim() || undefined,
          language: editLanguage.trim() || undefined,
          tags: parsedTags.length > 0 ? parsedTags : undefined
        };
      }
      return p;
    });

    setPagesList(updatedPagesList);

    // Also update current search results so any matching result details are updated immediately!
    setSearchResults(prev => prev.map(p => {
      if (p.id === pageId) {
        return {
          ...p,
          author: editAuthor.trim() || undefined,
          language: editLanguage.trim() || undefined,
          tags: parsedTags.length > 0 ? parsedTags : undefined
        };
      }
      return p;
    }));

    // Update active collections to make sure any saved items reflect the upgraded metadata!
    setCollections(prev => prev.map(col => ({
      ...col,
      pages: col.pages.map(p => {
        if (p.id === pageId) {
          return {
            ...p,
            author: editAuthor.trim() || undefined,
            language: editLanguage.trim() || undefined,
            tags: parsedTags.length > 0 ? parsedTags : undefined
          };
        }
        return p;
      })
    })));

    setEditingPageId(null);
    showToast('Page metadata saved successfully!', 'success');
  };

  const startEditingMetadata = (page: PageItem) => {
    setEditingPageId(page.id);
    setEditAuthor(page.author || '');
    setEditLanguage(page.language || '');
    setEditTagsStr(page.tags ? page.tags.join(', ') : '');
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      showToast('Project name is required!', 'error');
      return;
    }
    const newProj: ResearchProject = {
      id: 'proj_' + Math.random().toString(36).substring(2, 9),
      name: newProjectName.trim(),
      description: newProjectDescription.trim() || 'No description provided.',
      status: newProjectStatus,
      created_at: new Date().toUTCString(),
      target_date: newProjectTargetDate || undefined,
      notes: `### ${newProjectName.trim()} Notes\n\nKeep track of your findings and summaries for this research project here.`,
      tasks: [],
      collectionIds: newProjectSelectedColIds
    };
    setProjects(prev => [...prev, newProj]);
    setSelectedProjectId(newProj.id);
    setShowCreateProjectModal(false);
    setNewProjectName('');
    setNewProjectDescription('');
    setNewProjectStatus('planning');
    setNewProjectTargetDate('');
    setNewProjectSelectedColIds([]);
    showToast(`Project "${newProj.name}" created!`, 'success');
  };

  const handleDeleteProject = (projId: string) => {
    const proj = projects.find(p => p.id === projId);
    if (!proj) return;
    setProjects(prev => prev.filter(p => p.id !== projId));
    if (selectedProjectId === projId) {
      const remaining = projects.filter(p => p.id !== projId);
      setSelectedProjectId(remaining.length > 0 ? remaining[0].id : null);
    }
    showToast(`Project "${proj.name}" deleted.`, 'info');
  };

  const handleAddTaskToProject = (projId: string) => {
    if (!newProjectTaskText.trim()) return;
    setProjects(prev => prev.map(p => {
      if (p.id === projId) {
        return {
          ...p,
          tasks: [
            ...p.tasks,
            { id: 'task_' + Math.random().toString(36).substring(2, 9), text: newProjectTaskText.trim(), completed: false }
          ]
        };
      }
      return p;
    }));
    setNewProjectTaskText('');
    showToast('Task added to project!', 'success');
  };

  const handleToggleTaskInProject = (projId: string, taskId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id === projId) {
        return {
          ...p,
          tasks: p.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
        };
      }
      return p;
    }));
  };

  const handleDeleteTaskFromProject = (projId: string, taskId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id === projId) {
        return {
          ...p,
          tasks: p.tasks.filter(t => t.id !== taskId)
        };
      }
      return p;
    }));
    showToast('Task removed from project.', 'info');
  };

  const handleUpdateProjectNotes = (projId: string, notesText: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id === projId) {
        return { ...p, notes: notesText };
      }
      return p;
    }));
  };

  const handleToggleLinkCollection = (projId: string, colId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id === projId) {
        const alreadyLinked = p.collectionIds.includes(colId);
        const updatedIds = alreadyLinked 
          ? p.collectionIds.filter(id => id !== colId)
          : [...p.collectionIds, colId];
        return { ...p, collectionIds: updatedIds };
      }
      return p;
    }));
    showToast('Project collections updated!', 'success');
  };

  const handleToggleLinkPageToProject = (projId: string, page: PageItem) => {
    let isLinked = false;
    setProjects(prev => prev.map(p => {
      if (p.id === projId) {
        const linkedPagesList = p.linkedPages || [];
        const alreadyLinked = linkedPagesList.some(item => item.url === page.url);
        isLinked = !alreadyLinked;
        const updatedPages = alreadyLinked
          ? linkedPagesList.filter(item => item.url !== page.url)
          : [...linkedPagesList, page];
        return { ...p, linkedPages: updatedPages };
      }
      return p;
    }));
    const proj = projects.find(p => p.id === projId);
    if (proj) {
      showToast(
        isLinked 
          ? `Linked page to project "${proj.name}"!` 
          : `Unlinked page from project "${proj.name}".`, 
        isLinked ? 'success' : 'info'
      );
    }
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

  // Focus command palette input on open
  useEffect(() => {
    if (showCommandPalette) {
      setTimeout(() => {
        if (paletteInputRef.current) {
          paletteInputRef.current.focus();
        }
      }, 50);
    }
  }, [showCommandPalette]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedPaletteIndex(0);
  }, [paletteQuery]);

  interface PaletteItem {
    id: string;
    type: 'tab' | 'action' | 'collection';
    title: string;
    description: string;
    shortcut?: string;
    keywords: string[];
    icon: React.ReactNode;
    action: () => void;
  }

  const paletteItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [
      // Tabs
      {
        id: 'tab-search',
        type: 'tab',
        title: 'Search Engine',
        description: 'Primary web search engine interface, live queries, and results.',
        shortcut: 'Alt + 1',
        keywords: ['search', 'engine', 'query', 'google', 'isaac', 'find', 'page', 'results'],
        icon: <Search className="w-4 h-4 text-indigo-400" />,
        action: () => setActiveTab('search')
      },
      {
        id: 'tab-crawler',
        type: 'tab',
        title: 'Index & Crawler',
        description: 'Scrape websites, submit new URLs, and monitor scraper settings.',
        shortcut: 'Alt + 2',
        keywords: ['crawler', 'index', 'scrape', 'site', 'scrapy', 'url', 'spider', 'web'],
        icon: <Database className="w-4 h-4 text-emerald-400" />,
        action: () => setActiveTab('crawler')
      },
      {
        id: 'tab-graph',
        type: 'tab',
        title: 'Crawl Graph',
        description: 'Interactive visualization of indexed node relationships and edges.',
        shortcut: 'Alt + 3',
        keywords: ['graph', 'crawl', 'map', 'links', 'nodes', 'edges', 'visual', 'interactive'],
        icon: <Activity className="w-4 h-4 text-cyan-400" />,
        action: () => setActiveTab('graph')
      },
      {
        id: 'tab-collections',
        type: 'tab',
        title: 'Collections',
        description: 'Saved page search collections, categorized folders, and custom tags.',
        shortcut: 'Alt + 4',
        keywords: ['collections', 'folders', 'saved', 'bookmarks', 'categories', 'tags'],
        icon: <Folder className="w-4 h-4 text-amber-400" />,
        action: () => setActiveTab('collections')
      },
      {
        id: 'tab-projects',
        type: 'tab',
        title: 'Projects',
        description: 'Multi-step research notebooks, summaries, and PDF export logs.',
        shortcut: 'Alt + 5',
        keywords: ['projects', 'notebook', 'summaries', 'pdf', 'export', 'research', 'logs'],
        icon: <Briefcase className="w-4 h-4 text-purple-400" />,
        action: () => setActiveTab('projects')
      },
      // Actions
      {
        id: 'act-theme',
        type: 'action',
        title: 'Toggle Theme',
        description: `Switch to ${isLight ? 'Dark Space Mode' : 'High-Contrast Light Mode'}.`,
        keywords: ['theme', 'dark', 'light', 'mode', 'color', 'toggle', 'switch', 'styling'],
        icon: isLight ? <Moon className="w-4 h-4 text-slate-400" /> : <Sun className="w-4 h-4 text-amber-400" />,
        action: () => toggleTheme()
      },
      {
        id: 'act-svg',
        type: 'action',
        title: 'Download Graph SVG',
        description: 'Export the current interactive canvas graph state as an SVG vector file.',
        keywords: ['download', 'svg', 'graph', 'export', 'save', 'vector', 'image'],
        icon: <Download className="w-4 h-4 text-indigo-400" />,
        action: () => downloadGraphAsSVG()
      },
      {
        id: 'act-json',
        type: 'action',
        title: 'Download Graph JSON',
        description: 'Export the current interactive canvas graph nodes and connections as a structured JSON file.',
        keywords: ['download', 'json', 'graph', 'export', 'save', 'data', 'structure'],
        icon: <FileCode className="w-4 h-4 text-emerald-400" />,
        action: () => downloadGraphAsJSON()
      },
      {
        id: 'act-shortcuts',
        type: 'action',
        title: 'Show Keyboard Shortcuts',
        description: 'Open the reference panel for all core system keyboard hotkeys.',
        shortcut: 'Shift + ?',
        keywords: ['shortcuts', 'keyboard', 'help', 'hotkeys', 'keys', 'reference'],
        icon: <Keyboard className="w-4 h-4 text-slate-400" />,
        action: () => setShowShortcutsHelp(true)
      },
      {
        id: 'act-clear-history',
        type: 'action',
        title: 'Clear Search History',
        description: 'Delete all locally cached historical search queries and resets.',
        keywords: ['clear', 'delete', 'history', 'reset', 'remove', 'cached'],
        icon: <History className="w-4 h-4 text-red-400" />,
        action: () => setShowClearHistoryConfirm(true)
      }
    ];

    // Add search collections if they exist
    if (collections && collections.length > 0) {
      collections.forEach(col => {
        items.push({
          id: `col-${col.id}`,
          type: 'collection',
          title: `Jump to Collection: ${col.name}`,
          description: col.description || `Search collection with ${col.pages.length} pages.`,
          keywords: ['collection', col.name.toLowerCase(), (col.description || '').toLowerCase(), 'saved', 'bookmark'],
          icon: <FolderOpen className="w-4 h-4 text-amber-500" />,
          action: () => setActiveTab('collections')
        });
      });
    }

    return items;
  }, [collections, isLight, theme]);

  const filteredItems = useMemo<PaletteItem[]>(() => {
    if (!paletteQuery.trim()) {
      return paletteItems;
    }
    const q = paletteQuery.toLowerCase().trim();
    return paletteItems.filter(item => 
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.keywords.some(k => k.includes(q))
    );
  }, [paletteItems, paletteQuery]);

  return (
    <div className={`min-h-screen font-sans flex flex-col justify-between relative overflow-x-hidden transition-colors duration-300 ${
      isLight 
        ? 'theme-light bg-slate-50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900' 
        : 'bg-[#03030d] text-slate-200 selection:bg-indigo-500/30 selection:text-indigo-200'
    }`}>
      {/* Decorative Atmospheric Glow Blobs */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none transition-opacity duration-300 ${isLight ? 'opacity-0' : 'opacity-100'}`} />
      <div className={`absolute top-[20%] right-[10%] w-[250px] h-[250px] bg-purple-500/5 rounded-full blur-[80px] pointer-events-none transition-opacity duration-300 ${isLight ? 'opacity-0' : 'opacity-100'}`} />

      {/* Theme Toggle Button */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          type="button"
          className={`flex items-center gap-2 px-3.5 py-2 rounded-full border transition-all cursor-pointer active:scale-95 shadow-md font-sans text-xs font-bold ${
            isLight
              ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 shadow-slate-100'
              : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 shadow-black/40'
          }`}
          title={isLight ? "Switch to Dark Mode" : "Switch to High-Contrast Light Mode"}
        >
          {isLight ? (
            <>
              <Moon className="w-4 h-4 text-indigo-600" />
              <span>Dark Mode</span>
            </>
          ) : (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span>High-Contrast Light</span>
            </>
          )}
        </button>
      </div>

      {/* Quick Jump / Command Palette Trigger */}
      <div className="absolute top-6 left-6 z-50 animate-fade-in">
        <button
          id="global-quick-jump-btn"
          onClick={() => {
            setShowCommandPalette(true);
            setPaletteQuery('');
            setSelectedPaletteIndex(0);
          }}
          type="button"
          className={`flex items-center gap-2 px-3.5 py-2 rounded-full border transition-all cursor-pointer active:scale-95 shadow-md font-sans text-xs font-bold ${
            isLight
              ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 shadow-slate-100'
              : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 shadow-black/40'
          }`}
          title="Open Command Palette (⌘K or Ctrl+K)"
        >
          <Command className="w-4 h-4 text-indigo-500" />
          <span className="hidden sm:inline">Quick Jump</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono leading-none ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-slate-800 text-slate-400'}`}>
            ⌘K
          </span>
        </button>
      </div>

      {/* Header Centered Layout */}
      <header className="py-8 px-6 text-center relative z-10">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-6">
          
          {/* Brand Logo and Title */}
          <div className="flex flex-col items-center gap-1 cursor-pointer select-none group" onClick={() => { setActiveTab('search'); setSearchQuery(''); setSearchResults(DEFAULT_PAGES); }}>
            <h1 className={`text-4xl sm:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent font-sans transition-all duration-300 ${
              isLight
                ? 'bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-800 drop-shadow-xs'
                : 'bg-gradient-to-r from-white via-slate-100 to-indigo-400 drop-shadow-[0_0_15px_rgba(99,102,241,0.35)]'
            }`}>
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
            <button 
              id="nav-projects-btn"
              onClick={() => setActiveTab('projects')}
              className={`p-5 rounded-[24px] border transition-all duration-300 flex flex-col items-center justify-center gap-2 w-28 h-28 sm:w-32 sm:h-32 select-none cursor-pointer relative ${
                activeTab === 'projects' 
                  ? 'border-indigo-500 bg-indigo-950/20 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.25)]' 
                  : 'border-slate-800 bg-[#070719]/40 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className={`p-2 rounded-full transition-colors ${activeTab === 'projects' ? 'bg-indigo-500/15 text-indigo-300' : 'bg-slate-900/60 text-slate-400'}`}>
                <Briefcase className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold leading-tight font-sans text-center">Projects</span>
              {projects.length > 0 && (
                <span className="absolute top-2 right-2 bg-indigo-500 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {projects.length}
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

                    {/* Excluded & Blocked Sites Management */}
                    {(excludedDomains.length > 0 || blockedDomains.length > 0) && (
                      <div className="pt-4 flex flex-col gap-3">
                        <div className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider">Site Exclusions & Blocks</div>
                        
                        <div className="flex flex-col gap-2">
                          {excludedDomains.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                              <span className="text-slate-500 font-medium">Excluded (this session):</span>
                              {excludedDomains.map(dom => (
                                <span key={dom} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/20 text-amber-400 border border-amber-900/60 font-mono text-[10px]">
                                  {dom}
                                  <button
                                    type="button"
                                    onClick={() => setExcludedDomains(prev => prev.filter(d => d !== dom))}
                                    className="text-amber-500 hover:text-amber-300 font-bold ml-1 cursor-pointer bg-transparent border-none outline-none"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                              <button
                                type="button"
                                onClick={() => setExcludedDomains([])}
                                className="text-[10px] text-red-400 hover:text-red-300 underline font-mono font-bold ml-1 cursor-pointer bg-transparent border-none outline-none"
                              >
                                Clear All
                              </button>
                            </div>
                          )}

                          {blockedDomains.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                              <span className="text-slate-500 font-medium">Permanently Blocked:</span>
                              {blockedDomains.map(dom => (
                                <span key={dom} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-950/20 text-red-400 border border-red-900/60 font-mono text-[10px]">
                                  {dom}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBlockedDomains(prev => {
                                        const updated = prev.filter(d => d !== dom);
                                        localStorage.setItem('blocked_domains', JSON.stringify(updated));
                                        return updated;
                                      });
                                    }}
                                    className="text-red-500 hover:text-red-300 font-bold ml-1 cursor-pointer bg-transparent border-none outline-none"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                              <button
                                type="button"
                                onClick={() => {
                                  setBlockedDomains([]);
                                  localStorage.removeItem('blocked_domains');
                                }}
                                className="text-[10px] text-red-400 hover:text-red-300 underline font-mono font-bold ml-1 cursor-pointer bg-transparent border-none outline-none"
                              >
                                Clear All
                              </button>
                            </div>
                          )}
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
                          <option value="title_asc">Alphabetical: A to Z</option>
                          <option value="title_desc">Alphabetical: Z to A</option>
                          <option value="language_asc">Language: A-Z</option>
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

                <div className="flex items-center justify-between text-xs text-slate-500 font-mono border-b border-slate-800/60 pb-3 flex-wrap gap-3">
                  {searchWithinQuery.trim() ? (
                    <span className="text-indigo-400 font-bold">Showing {filteredSearchResults.length} filtered entries of {searchResults.length} matches</span>
                  ) : (
                    <span>About {searchResults.length} results indexed in Firestore</span>
                  )}
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      disabled={filteredSearchResults.length === 0}
                      onClick={() => {
                        exportSearchResultsToPDF(searchQuery, filteredSearchResults);
                        showToast(`Downloaded PDF with ${filteredSearchResults.length} results`, "success");
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:text-white hover:bg-indigo-500/25 disabled:opacity-40 disabled:pointer-events-none transition-all font-sans text-[11px] font-bold active:scale-95 cursor-pointer shadow-md"
                      title="Download current search results as a structured PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Results</span>
                    </button>
                    <span>Page 1 of 1</span>
                  </div>
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

                        {/* Top persistent bookmark icon */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeSavePageId === item.id && saveDropdownPosition === 'top') {
                                setActiveSavePageId(null);
                              } else {
                                setActiveSavePageId(item.id);
                                setSaveDropdownPosition('top');
                              }
                            }}
                            className={`p-1.5 rounded-lg border cursor-pointer transition-all active:scale-95 text-xs font-bold font-sans flex items-center justify-center ${
                              collections.some(col => col.pages.some(p => p.url === item.url))
                                ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300'
                                : 'border-slate-800 bg-[#070719]/40 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                            }`}
                            title={collections.some(col => col.pages.some(p => p.url === item.url)) ? "Bookmarked (Click to manage)" : "Add to collection folder"}
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${collections.some(col => col.pages.some(p => p.url === item.url)) ? 'fill-indigo-400 text-indigo-400' : ''}`} />
                          </button>

                          {/* Top Dropdown Menu */}
                          <AnimatePresence>
                            {activeSavePageId === item.id && saveDropdownPosition === 'top' && (
                              <>
                                {/* Backdrop overlay to close */}
                                <div 
                                  className="fixed inset-0 z-40" 
                                  onClick={() => setActiveSavePageId(null)} 
                                />
                                <motion.div
                                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  className="absolute right-0 top-full mt-2 w-64 bg-[#090924] border border-slate-800 rounded-xl p-3 shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-50 flex flex-col gap-2.5 font-sans"
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
                                              : 'hover:bg-slate-900 border border-transparent text-slate-300'
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
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white p-1 rounded-md transition-all active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Three-dot options menu */}
                        <div className="relative">
                          <button
                            type="button"
                            id={`three-dot-btn-${item.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openThreeDotMenuPageId === item.id) {
                                setOpenThreeDotMenuPageId(null);
                              } else {
                                setOpenThreeDotMenuPageId(item.id);
                              }
                            }}
                            className={`p-1.5 rounded-lg border cursor-pointer transition-all active:scale-95 text-xs font-bold font-sans flex items-center justify-center ${
                              openThreeDotMenuPageId === item.id
                                ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300'
                                : 'border-slate-800 bg-[#070719]/40 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                            }`}
                            title="More options for this site"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          <AnimatePresence>
                            {openThreeDotMenuPageId === item.id && (
                              <>
                                {/* Backdrop overlay to close */}
                                <div 
                                  className="fixed inset-0 z-40" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenThreeDotMenuPageId(null);
                                  }} 
                                />
                                <motion.div
                                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  className="absolute right-0 top-full mt-2 w-64 bg-[#090924] border border-slate-800 rounded-xl p-3 shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-50 flex flex-col gap-1.5 font-sans"
                                >
                                  <div className="text-xs font-bold tracking-wider text-slate-400 uppercase border-b border-slate-800/60 pb-1.5 flex items-center justify-between mb-1">
                                    <span>Site Options</span>
                                    <Globe className="w-3.5 h-3.5 text-indigo-400" />
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const domain = getDomainFromUrl(item.url);
                                      setFilterDomain(domain);
                                      setShowFilters(true);
                                      handleSearch(searchQuery, false, domain);
                                      setOpenThreeDotMenuPageId(null);
                                      showToast(`Filtering results to only: ${domain}`, 'info');
                                    }}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-left text-slate-300 hover:bg-indigo-950/40 hover:text-indigo-300 transition-colors cursor-pointer border border-transparent"
                                  >
                                    Only include search from this site.
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const domain = getDomainFromUrl(item.url);
                                      setExcludedDomains(prev => {
                                        if (prev.includes(domain)) return prev;
                                        return [...prev, domain];
                                      });
                                      setOpenThreeDotMenuPageId(null);
                                      showToast(`Excluding ${domain} from search results`, 'info');
                                    }}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-left text-slate-300 hover:bg-amber-950/40 hover:text-amber-400 transition-colors cursor-pointer border border-transparent"
                                  >
                                    Search again without this site
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const domain = getDomainFromUrl(item.url);
                                      setBlockedDomains(prev => {
                                        if (prev.includes(domain)) return prev;
                                        const updated = [...prev, domain];
                                        localStorage.setItem('blocked_domains', JSON.stringify(updated));
                                        return updated;
                                      });
                                      setOpenThreeDotMenuPageId(null);
                                      showToast(`Blocked ${domain} from all future searches`, 'error');
                                    }}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-left text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors cursor-pointer border border-transparent mb-1"
                                  >
                                    Block this site from all searchs.
                                  </button>

                                  <div className="text-xs font-bold tracking-wider text-slate-400 uppercase border-t border-b border-slate-800/60 py-1.5 flex items-center justify-between mb-1 mt-1 font-mono">
                                    <span>Add to Project</span>
                                    <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                                  </div>

                                  <div className="flex flex-col gap-1 max-h-32 overflow-y-auto no-scrollbar py-0.5">
                                    {projects.map((proj) => {
                                      const isLinked = (proj.linkedPages || []).some(p => p.url === item.url);
                                      return (
                                        <button
                                          key={proj.id}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleLinkPageToProject(proj.id, item);
                                          }}
                                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium text-left transition-colors cursor-pointer ${
                                            isLinked
                                              ? 'bg-indigo-950/50 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-950/70'
                                              : 'hover:bg-slate-900 border border-transparent text-slate-300'
                                          }`}
                                        >
                                          <span className="truncate flex items-center gap-1.5">
                                            <Briefcase className={`w-3.5 h-3.5 shrink-0 ${isLinked ? 'text-indigo-400' : 'text-slate-500'}`} />
                                            {proj.name}
                                          </span>
                                          {isLinked && (
                                            <span className="text-[9px] font-bold bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-mono">
                                              Linked
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })}
                                    {projects.length === 0 && (
                                      <p className="text-[11px] text-slate-500 italic text-center py-2">No projects found. Create one in the Projects tab!</p>
                                    )}
                                  </div>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>

                    {/* Title hyperlink */}
                    <h3 className="text-lg font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1.5">
                        <HighlightText text={item.title} query={searchQuery} innerQuery={searchWithinQuery} />
                        <LinkIcon className="w-4 h-4 text-slate-500 group-hover:text-indigo-300 transition-colors" />
                      </a>
                    </h3>

                    {/* Extract Text Highlight Snippet */}
                    <p className="text-sm text-slate-300 leading-relaxed font-sans">
                      <HighlightText text={item.snippet} query={searchQuery} innerQuery={searchWithinQuery} />
                    </p>

                    {/* Custom Page Metadata (Author, Language, Tags) if they exist */}
                    {(item.author || item.language || (item.tags && item.tags.length > 0)) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 pb-1 text-xs">
                        {item.author && (
                          <span className="flex items-center gap-1 text-slate-400 font-sans">
                            <User className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Creator: <strong className="text-slate-200">{item.author}</strong></span>
                          </span>
                        )}
                        {item.language && (
                          <span className="flex items-center gap-1 text-slate-400 font-sans">
                            <Globe className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Lang: <strong className="text-slate-200">{item.language}</strong></span>
                          </span>
                        )}
                        {item.tags && item.tags.length > 0 && (
                          <span className="flex items-center gap-1.5 font-sans text-slate-400">
                            <Tag className="w-3 h-3 text-indigo-400" />
                            <span className="flex flex-wrap gap-1">
                              {item.tags.map((tag, idx) => (
                                <span key={idx} className="bg-indigo-950/40 border border-indigo-900/60 rounded px-1.5 py-0.2 text-[10px] text-indigo-300">
                                  #{tag}
                                </span>
                              ))}
                            </span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Community Notes Section */}
                    <CommunityNotesSection url={item.url} theme={theme} />

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

                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {/* Vote/Like Button */}
                        <button
                          type="button"
                          id={`like-btn-${item.id}`}
                          onClick={() => handleLikePage(item.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-500/20 bg-emerald-950/20 hover:bg-emerald-900/30 text-emerald-400 hover:text-white font-bold font-sans text-xs cursor-pointer transition-all active:scale-95"
                          title="Like / Upvote this page"
                        >
                          <ArrowUp className="w-3 h-3" />
                          <span>Upvote ({item.likes || 0})</span>
                        </button>

                        {/* Save to Collection Button with Dropdown */}
                        <div className="relative">
                          <button
                            type="button"
                            id={`save-col-btn-${item.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeSavePageId === item.id && saveDropdownPosition === 'bottom') {
                                setActiveSavePageId(null);
                              } else {
                                setActiveSavePageId(item.id);
                                setSaveDropdownPosition('bottom');
                              }
                            }}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border cursor-pointer transition-all active:scale-95 text-xs font-bold font-sans ${
                              activeSavePageId === item.id && saveDropdownPosition === 'bottom'
                                ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300'
                                : 'border-slate-800 bg-[#070719]/40 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                            }`}
                            title="Save to a search collection folder"
                          >
                            <Bookmark className="w-3 h-3" />
                            <span>Save</span>
                          </button>

                          {/* Dropdown Menu */}
                          <AnimatePresence>
                            {activeSavePageId === item.id && saveDropdownPosition === 'bottom' && (
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
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border cursor-pointer transition-all active:scale-95 text-xs font-bold font-sans ${
                            speakingPageId === item.id
                              ? 'border-red-500 bg-red-950/25 text-red-400 hover:bg-red-950/40 hover:border-red-400'
                              : 'border-slate-800 bg-[#070719]/40 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                          }`}
                          title={speakingPageId === item.id ? "Stop reading aloud" : "Read this result aloud"}
                        >
                          {speakingPageId === item.id ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                              <span>Stop</span>
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
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border cursor-pointer transition-all active:scale-95 text-xs font-bold font-sans ${
                            copiedPageId === item.id
                              ? 'border-emerald-500 bg-emerald-950/25 text-emerald-400'
                              : 'border-slate-800 bg-[#070719]/40 text-slate-400 hover:text-slate-200 hover:border-slate-700'
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
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        {/* Share via Email button */}
                        <button
                          type="button"
                          id={`email-share-btn-${item.id}`}
                          onClick={(e) => handleEmailShare(e, item)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-800 bg-[#070719]/40 text-slate-400 hover:text-slate-200 hover:border-slate-700 cursor-pointer transition-all active:scale-95 text-xs font-bold font-sans"
                          title="Share page details via Email"
                        >
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>Email</span>
                        </button>

                        <button
                          type="button"
                          id={`expand-btn-${item.id}`}
                          onClick={() => handleToggleExpand(item.id, item)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-800 bg-[#090924] hover:bg-slate-900 text-[#a5b4fc] hover:text-white font-bold font-sans cursor-pointer transition-all active:scale-95 text-xs"
                        >
                          {isPageLoading[item.id] ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                              <span>Fetching...</span>
                            </>
                          ) : expandedDocId === item.id ? (
                            <>
                              <ArrowRight className="w-3 h-3 rotate-90 text-indigo-400" />
                              <span>Collapse</span>
                            </>
                          ) : (
                            <>
                              <BookOpen className="w-3 h-3 text-indigo-400" />
                              <span>Preview</span>
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
                                  <HighlightText text={expandedPages[item.id].content || "No raw parsed body available in Firestore for this page."} query={searchQuery} innerQuery={searchWithinQuery} />
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

                  {/* Auto-Crawl Mode Toggle */}
                  <div className="bg-indigo-50/40 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-indigo-100/60 rounded-xl text-indigo-600 shrink-0">
                        <Sparkles className="w-4 h-4 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-slate-800 font-sans">Auto-Crawl Mode</h3>
                          {isUpdatingAutoCrawl && (
                            <span className="text-[9px] text-indigo-500 font-medium font-mono animate-pulse">saving...</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                          Trigger the crawl spider automatically in the background whenever a new URL is indexed.
                        </p>
                      </div>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer select-none">
                      <button
                        type="button"
                        onClick={toggleAutoCrawl}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-250 ease-in-out focus:outline-none ${
                          autoCrawlEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                        }`}
                        aria-pressed={autoCrawlEnabled}
                        title="Toggle Auto-Crawl"
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-250 ease-in-out ${
                            autoCrawlEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
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

                {/* 3. Common Crawl URL Discovery */}
                <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex flex-col gap-6 animate-fade-in" id="common-crawl-panel">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 font-sans">
                      <Database className="w-5 h-5 text-indigo-600" />
                      Common Crawl URL Discovery
                    </h2>
                    <p className="text-xs text-slate-400">
                      Query Common Crawl's CDX Open Data index. Discover and import real HTML pages for any domain as crawl seeds.
                    </p>
                  </div>

                  <div className="flex flex-col md:flex-row items-end gap-4 bg-slate-50 border border-slate-100 p-4.5 rounded-2xl">
                    <div className="flex-1 flex flex-col gap-1.5 w-full">
                      <label className="text-xs font-bold text-slate-600 font-mono">Target Domain / Prefix</label>
                      <input
                        type="text"
                        placeholder="e.g. news.ycombinator.com"
                        value={ccDomain}
                        onChange={(e) => setCcDomain(e.target.value)}
                        className="w-full border border-slate-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white rounded-xl p-2.5 text-xs outline-none font-mono"
                      />
                    </div>

                    <div className="w-full md:w-36 flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-600 font-mono">Limit</label>
                      <select
                        value={ccLimit}
                        onChange={(e) => setCcLimit(Number(e.target.value))}
                        className="w-full border border-slate-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white rounded-xl p-2.5 text-xs outline-none cursor-pointer text-slate-700 font-sans"
                      >
                        <option value={10}>10 URLs</option>
                        <option value={25}>25 URLs</option>
                        <option value={50}>50 URLs</option>
                        <option value={100}>100 URLs</option>
                        <option value={200}>200 URLs</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={handleSearchCommonCrawl}
                      disabled={ccLoading}
                      className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-all disabled:bg-slate-250 disabled:text-slate-500 flex items-center justify-center gap-2 shadow-sm"
                    >
                      {ccLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Querying CDX...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-3.5 h-3.5" />
                          <span>Search Index</span>
                        </>
                      )}
                    </button>
                  </div>

                  {ccError && (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-amber-850">Discovery Note</span>
                        <span className="text-xs text-amber-700">{ccError}</span>
                      </div>
                    </div>
                  )}

                  {ccImportStatus && (
                    <div className={`p-4 rounded-xl flex items-start gap-2.5 border ${
                      ccImportStatus.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                    }`}>
                      <CheckCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${ccImportStatus.success ? 'text-emerald-500' : 'text-red-500'}`} />
                      <div className="flex flex-col gap-0.5">
                        <span className={`text-xs font-bold ${ccImportStatus.success ? 'text-emerald-850' : 'text-red-850'}`}>
                          {ccImportStatus.success ? 'Import Complete!' : 'Import Failed'}
                        </span>
                        <span className={`text-xs ${ccImportStatus.success ? 'text-emerald-700' : 'text-red-700'}`}>
                          {ccImportStatus.success 
                            ? `Successfully added ${ccImportStatus.added} new crawl seeds. Skipped ${ccImportStatus.skipped} duplicate/already indexed links.`
                            : 'An error occurred during the seed database insertion payload transfer.'}
                        </span>
                      </div>
                    </div>
                  )}

                  {ccResults.length > 0 && (
                    <div className="flex flex-col gap-4 animate-fade-in">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-700 font-sans">
                            Discovered: <span className="text-indigo-650 font-mono">{ccResults.length} URLs</span>
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="text-xs text-slate-500">
                            Selected: <span className="font-mono text-slate-700 font-bold">{ccSelectedUrls.length}</span>
                          </span>
                        </div>

                        {/* Search filter within results */}
                        <div className="flex items-center gap-2.5">
                          <input
                            type="text"
                            placeholder="Filter found URLs..."
                            value={ccFilterText}
                            onChange={(e) => setCcFilterText(e.target.value)}
                            className="border border-slate-200 focus:ring-1 focus:ring-indigo-100 focus:border-indigo-400 bg-slate-50/50 rounded-lg px-2.5 py-1 text-[11px] outline-none max-w-[180px] font-sans"
                          />
                          <button
                            type="button"
                            onClick={handleImportCommonCrawlSeeds}
                            disabled={ccSelectedUrls.length === 0 || ccImporting}
                            className="bg-slate-900 hover:bg-slate-950 text-white font-bold py-1.5 px-3 rounded-lg text-[11px] transition-all disabled:bg-slate-200 disabled:text-slate-400 flex items-center gap-1.5"
                          >
                            {ccImporting ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Plus className="w-3 h-3" />
                            )}
                            <span>Import Seeds</span>
                          </button>
                        </div>
                      </div>

                      <div className="border border-slate-150 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-150 text-[10px] uppercase font-mono font-bold text-slate-450 tracking-wider">
                              <th className="p-3 w-10 text-center">
                                <input
                                  type="checkbox"
                                  checked={filteredCcResults.length > 0 && filteredCcResults.every(r => ccSelectedUrls.includes(r.url))}
                                  onChange={handleToggleSelectAllCcUrls}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-3.5 w-3.5"
                                />
                              </th>
                              <th className="p-3">HTML page url path</th>
                              <th className="p-3 w-28 text-center">Status</th>
                              <th className="p-3 w-32 text-right">MIME Type</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs font-mono">
                            {filteredCcResults.map((rec) => {
                              const isSelected = ccSelectedUrls.includes(rec.url);
                              return (
                                <tr 
                                  key={rec.url}
                                  className={`hover:bg-slate-50/50 transition-all ${isSelected ? 'bg-indigo-50/10' : ''}`}
                                >
                                  <td className="p-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => handleToggleCcUrl(rec.url)}
                                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-3.5 w-3.5"
                                    />
                                  </td>
                                  <td className="p-3 max-w-0 truncate text-slate-700 select-all" title={rec.url}>
                                    <div className="flex items-center gap-1.5">
                                      <Globe className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                      <a 
                                        href={rec.url} 
                                        target="_blank" 
                                        referrerPolicy="no-referrer"
                                        className="hover:text-indigo-600 hover:underline truncate"
                                      >
                                        {rec.url}
                                      </a>
                                    </div>
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 border border-emerald-150 text-emerald-700">
                                      HTTP {rec.status || '200'}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right text-slate-400 text-[11px]">
                                    {rec.mime || 'text/html'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Active Crawler Seeds Database */}
                <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex flex-col gap-6 animate-fade-in animate-duration-300" id="active-seeds-panel">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 font-sans">
                        <ListFilter className="w-5 h-5 text-indigo-600" />
                        Active Crawler Seeds
                      </h2>
                      <p className="text-xs text-slate-450">
                        URLs in this queue are crawled when you trigger a "Start Crawl" operation.
                      </p>
                    </div>
                    <span className="bg-indigo-50 border border-indigo-150 text-indigo-700 text-xs font-bold font-mono px-2.5 py-1 rounded-full">
                      {seedsList.length} Seeds
                    </span>
                  </div>

                  {loadingSeeds ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                    </div>
                  ) : seedsList.length === 0 ? (
                    <div className="border border-dashed border-slate-200 p-8 rounded-2xl text-center">
                      <Database className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-600">No active seeds imported yet</p>
                      <p className="text-[11px] text-slate-450 mt-1 max-w-xs mx-auto">
                        Search domains in the Common Crawl section above and import URLs to populate your active crawl queue.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-slate-150 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-150 text-[10px] uppercase font-mono font-bold text-slate-450 tracking-wider">
                            <th className="p-3">Seed URL</th>
                            <th className="p-3 w-28 text-center">Source</th>
                            <th className="p-3 w-16 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-mono">
                          {seedsList.map((seed) => (
                            <tr key={seed.id} className="hover:bg-slate-50/50 transition-all">
                              <td className="p-3 max-w-0 truncate text-slate-700" title={seed.url}>
                                <div className="flex items-center gap-1.5">
                                  <Globe className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                  <a href={seed.url} target="_blank" referrerPolicy="no-referrer" className="hover:text-indigo-600 hover:underline truncate">
                                    {seed.url}
                                  </a>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                  seed.source === 'common_crawl' 
                                    ? 'bg-indigo-50 border-indigo-150 text-indigo-700' 
                                    : 'bg-slate-50 border-slate-200 text-slate-600'
                                }`}>
                                  {seed.source === 'common_crawl' ? 'Common Crawl' : 'Seed'}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSeed(seed.id)}
                                  className="text-slate-400 hover:text-red-650 p-1.5 rounded-lg hover:bg-red-50/50 transition-colors"
                                  title="Remove seed"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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

                    {/* Optional Custom Metadata */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-600 font-mono">Author (Optional)</label>
                        <input 
                          type="text"
                          placeholder="e.g. John Doe"
                          value={newAuthor}
                          onChange={(e) => setNewAuthor(e.target.value)}
                          className="border border-slate-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-50/50 rounded-xl p-2.5 text-xs outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-600 font-mono">Language (Optional)</label>
                        <input 
                          type="text"
                          placeholder="e.g. English"
                          value={newLanguage}
                          onChange={(e) => setNewLanguage(e.target.value)}
                          className="border border-slate-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-50/50 rounded-xl p-2.5 text-xs outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-600 font-mono">Tags (Optional, comma-separated)</label>
                        <button
                          type="button"
                          onClick={handleSuggestTagsForNewPage}
                          disabled={isSuggestingNewTags}
                          className="text-[10px] text-indigo-600 hover:text-indigo-700 font-sans font-bold flex items-center gap-1 cursor-pointer disabled:text-slate-400"
                          title="Auto-extract suggested tags from snippet text"
                        >
                          {isSuggestingNewTags ? (
                            <>
                              <Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-500" />
                              <span>Suggesting...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-2.5 h-2.5 text-indigo-500 animate-pulse" />
                              <span>Suggest Tags</span>
                            </>
                          )}
                        </button>
                      </div>
                      <input 
                        type="text"
                        placeholder="e.g. tech, design, database"
                        value={newTagsStr}
                        onChange={(e) => setNewTagsStr(e.target.value)}
                        className="border border-slate-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-50/50 rounded-xl p-2.5 text-xs outline-none"
                      />
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

            {/* Indexed Page Catalog & Custom Metadata Editor */}
            <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 font-sans">
                    <Database className="w-5 h-5 text-indigo-600" />
                    Indexed Pages Catalog & Custom Metadata
                  </h2>
                  <p className="text-xs text-slate-400">View all indexed pages on your sandbox catalog. Click on any record to assign custom Authors, Languages or Comma-separated Tags.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-mono font-bold rounded-lg leading-none shrink-0">
                    {pagesList.length} pages in index
                  </span>
                </div>
              </div>

              {/* Filtering utility for catalog */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Filter indexed pages by title, URL or author..."
                  value={catalogSearchQuery}
                  onChange={(e) => setCatalogSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-50/50 rounded-xl text-xs outline-none font-sans"
                />
                {catalogSearchQuery && (
                  <button 
                    onClick={() => setCatalogSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 text-xs font-sans font-semibold cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* List of Pages */}
              <div className="flex flex-col gap-3 max-h-[460px] overflow-y-auto pr-1">
                {(() => {
                  const filtered = pagesList.filter(p => {
                    const q = catalogSearchQuery.toLowerCase().trim();
                    if (!q) return true;
                    return p.title.toLowerCase().includes(q) || 
                           p.url.toLowerCase().includes(q) ||
                           (p.author && p.author.toLowerCase().includes(q)) ||
                           (p.tags && p.tags.some(t => t.toLowerCase().includes(q))) ||
                           (p.language && p.language.toLowerCase().includes(q));
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-8 text-slate-400 font-sans border border-dashed border-slate-200 rounded-2xl bg-slate-50/20">
                        <Search className="w-8 h-8 mx-auto text-slate-350 mb-2" />
                        <p className="text-xs font-bold text-slate-600">No indexed pages found matching criteria.</p>
                      </div>
                    );
                  }

                  return filtered.map((page) => {
                    const isEditing = editingPageId === page.id;
                    return (
                      <div 
                        key={page.id} 
                        className={`border rounded-2xl p-4 transition-all ${
                          isEditing 
                            ? 'border-indigo-400 bg-indigo-50/10 shadow-sm' 
                            : 'border-slate-150 bg-slate-50/30 hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] text-indigo-500 font-mono select-all truncate block">{page.url}</span>
                            <h4 className="text-sm font-bold text-slate-800 font-sans mt-0.5">
                              <HighlightText text={page.title} query={catalogSearchQuery} />
                            </h4>
                            
                            {/* Tags and custom metadata display */}
                            <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 mt-2 text-xs">
                              <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-500 rounded font-mono px-1.5 py-0.2 shrink-0">
                                ID: {page.id}
                              </span>
                              
                              {page.author && (
                                <span className="flex items-center gap-1 text-slate-500 font-sans">
                                  <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                  <span>Author: <strong className="text-slate-700">{page.author}</strong></span>
                                </span>
                              )}
                              
                              {page.language && (
                                <span className="flex items-center gap-1 text-slate-500 font-sans">
                                  <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                  <span>Language: <strong className="text-slate-700">{page.language}</strong></span>
                                </span>
                              )}

                              {page.tags && page.tags.length > 0 && (
                                <span className="flex items-center gap-1.5 font-sans text-slate-500">
                                  <Tag className="w-3 h-3 text-indigo-400 shrink-0" />
                                  <span className="flex flex-wrap gap-1">
                                    {page.tags.map((tag, idx) => (
                                      <span key={idx} className="bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.2 text-[9px] text-indigo-600 font-bold leading-none">
                                        #{tag}
                                      </span>
                                    ))}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="shrink-0">
                            {isEditing ? (
                              <button
                                type="button"
                                onClick={() => setEditingPageId(null)}
                                className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-sans font-bold transition-all"
                              >
                                Cancel
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEditingMetadata(page)}
                                className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-sans font-bold transition-all"
                              >
                                Edit Metadata
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expanded inline in-place form for editing page metadata */}
                        {isEditing && (
                          <div className="mt-4 pt-4 border-t border-slate-200/60 grid grid-cols-1 md:grid-cols-3 gap-3.5">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-slate-650 font-mono">Author Name</label>
                              <input 
                                type="text"
                                placeholder="Edit author (e.g. Robin Hood)"
                                value={editAuthor}
                                onChange={(e) => setEditAuthor(e.target.value)}
                                className="w-full border border-slate-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white rounded-xl p-2 text-xs outline-none font-sans text-slate-800"
                              />
                            </div>
                            
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-slate-655 font-mono">Language</label>
                              <input 
                                type="text"
                                placeholder="Edit language (e.g. English)"
                                value={editLanguage}
                                onChange={(e) => setEditLanguage(e.target.value)}
                                className="w-full border border-slate-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white rounded-xl p-2 text-xs outline-none font-sans text-slate-800"
                              />
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-655 font-mono">Tags (comma-separated)</label>
                                <button
                                  type="button"
                                  onClick={() => handleSuggestTagsForEditPage(page.snippet)}
                                  disabled={isSuggestingEditTags}
                                  className="text-[10px] text-indigo-600 hover:text-indigo-700 font-sans font-bold flex items-center gap-1 cursor-pointer disabled:text-slate-400"
                                  title="Auto-extract suggested tags from snippet"
                                >
                                  {isSuggestingEditTags ? (
                                    <>
                                      <Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-500" />
                                      <span>Suggesting...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-2.5 h-2.5 text-indigo-500 animate-pulse" />
                                      <span>Suggest Tags</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <div className="flex gap-2">
                                <input 
                                  type="text"
                                  placeholder="e.g. news, documentation"
                                  value={editTagsStr}
                                  onChange={(e) => setEditTagsStr(e.target.value)}
                                  className="w-full border border-slate-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white rounded-xl p-2 text-xs outline-none font-sans text-slate-800"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveCustomMetadata(page.id)}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 rounded-xl text-xs transition-all shrink-0 cursor-pointer shadow-sm flex items-center justify-center whitespace-nowrap"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
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

            {/* 30-Day Crawl Activity Trend Line Chart Section */}
            <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 font-sans">
                    <Activity className="w-5 h-5 text-indigo-600" />
                    30-Day Crawl Activity Trend
                  </h2>
                  <p className="text-xs text-slate-400">
                    Pages successfully crawled vs. encountered faults/errors over the last 30 days. Syncs with Firestore collection <code className="bg-slate-50 border border-slate-100 rounded px-1 text-slate-605 font-mono">crawler_history</code>.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                    Live Firestore Sync
                  </span>
                </div>
              </div>

              {isFetchingTrend ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2">
                  <RefreshCw className="w-7 h-7 animate-spin text-indigo-600" />
                  <span className="text-xs text-slate-500 font-mono">Analyzing 30-day historical trends...</span>
                </div>
              ) : trendData.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-sans border border-dashed border-slate-200 rounded-2xl bg-slate-50/20">
                  <Activity className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold">No trend data available.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Crawl executions must occur over the last 30 days to build historical trend charts.
                  </p>
                </div>
              ) : (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={trendData}
                      margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#94A3B8"
                        fontSize={10}
                        fontFamily="JetBrains Mono"
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                        tickFormatter={(str) => {
                          try {
                            const parts = str.split('-');
                            if (parts.length === 3) {
                              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                              const mIdx = parseInt(parts[1], 10) - 1;
                              return `${months[mIdx]} ${parts[2]}`;
                            }
                            return str;
                          } catch (_) {
                            return str;
                          }
                        }}
                      />
                      <YAxis
                        stroke="#94A3B8"
                        fontSize={10}
                        fontFamily="JetBrains Mono"
                        tickLine={false}
                        axisLine={false}
                        dx={-5}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#334155'
                        }}
                      />
                      <Line
                        type="monotone"
                        name="Pages Crawled"
                        dataKey="pages_crawled"
                        stroke="#4F46E5"
                        strokeWidth={2.5}
                        dot={{ r: 3, stroke: '#4F46E5', strokeWidth: 1, fill: '#FFFFFF' }}
                        activeDot={{ r: 5, stroke: '#4F46E5', strokeWidth: 1.5, fill: '#4F46E5' }}
                      />
                      <Line
                        type="monotone"
                        name="Faults / Errors"
                        dataKey="errors"
                        stroke="#EF4444"
                        strokeWidth={2}
                        dot={{ r: 3, stroke: '#EF4444', strokeWidth: 1, fill: '#FFFFFF' }}
                        activeDot={{ r: 5, stroke: '#EF4444', strokeWidth: 1.5, fill: '#EF4444' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
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

              {/* Quick stats & Export Actions */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3 bg-[#070719]/80 border border-slate-800 p-2.5 rounded-xl font-mono text-xs text-slate-300 shadow-sm leading-none h-[38px]">
                  <span>Nodes: <strong className="text-indigo-400">{minBacklinks > 0 ? `${filteredGraphNodes.length}/${graphNodes.length}` : graphNodes.length}</strong></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-800/85"></span>
                  <span>Edges: <strong className="text-indigo-400">{minBacklinks > 0 ? `${activeEdges.length}/${graphEdges.length}` : graphEdges.length}</strong></span>
                </div>

                <button
                  type="button"
                  id="download-graph-svg-btn"
                  onClick={downloadGraphAsSVG}
                  className="flex items-center gap-2 px-3.5 bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/30 rounded-xl text-xs font-bold font-sans transition-all h-[38px] cursor-pointer shadow-lg shadow-indigo-950/40 active:scale-95"
                  title="Download Current Canvas State as SVG file"
                >
                  <Download className="w-4 h-4" />
                  <span>Download SVG</span>
                </button>

                <button
                  type="button"
                  id="download-graph-json-btn"
                  onClick={downloadGraphAsJSON}
                  className="flex items-center gap-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-xl text-xs font-bold font-sans transition-all h-[38px] cursor-pointer shadow-lg shadow-indigo-950/40 active:scale-95"
                  title="Download Current Graph Data as JSON file"
                >
                  <FileCode className="w-4 h-4 text-emerald-400" />
                  <span>Download JSON</span>
                </button>
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
                        {matchedGraphNodes.length} matches
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Search nodes by title or URL..."
                      value={graphSearchQuery}
                      onChange={(e) => setGraphSearchQuery(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 bg-[#02020a] border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-550 transition-all font-sans"
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
                    const matched = matchedGraphNodes;

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

                {/* Floating Map Legend & Mode Toggle Overlay */}
                <div className="absolute top-4 right-4 z-20 w-52 sm:w-60 bg-[#090924]/95 border border-slate-800/80 rounded-2xl p-3 shadow-[0_12px_45px_rgba(0,0,0,0.85)] backdrop-blur-md flex flex-col gap-2">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-xs font-bold text-slate-200 font-sans">Visual Classification</span>
                    </div>
                  </div>

                  {/* Segmented Control Mode Toggle */}
                  <div className="grid grid-cols-2 bg-[#02020a] p-1 rounded-xl border border-slate-800/60">
                    <button
                      type="button"
                      onClick={() => setGraphColorMode('domain')}
                      className={`text-[10px] font-sans font-bold py-1 px-1.5 rounded-lg transition-all ${
                        graphColorMode === 'domain'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Domain Origin
                    </button>
                    <button
                      type="button"
                      onClick={() => setGraphColorMode('language')}
                      className={`text-[10px] font-sans font-bold py-1 px-1.5 rounded-lg transition-all ${
                        graphColorMode === 'language'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Language
                    </button>
                  </div>

                  {/* Dynamic Color Legend List */}
                  <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Color Keys:</p>
                    <div className="flex flex-col gap-0.5">
                      {graphColorMode === 'domain' ? (
                        DOMAIN_PALETTE.map((d) => (
                          <div key={d.name} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-[#02020a]/40">
                            <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: d.hex }} />
                            <span className="text-[10px] text-slate-300 font-mono truncate" title={d.name}>
                              {d.name}
                            </span>
                          </div>
                        ))
                      ) : (
                        LANGUAGE_PALETTE.map((l) => (
                          <div key={l.name} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-[#02020a]/40">
                            <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: l.hex }} />
                            <span className="text-[10px] text-slate-300 font-mono truncate" title={l.name}>
                              {l.name}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Layout Preset Selector */}
                  <div className="border-t border-slate-800/60 pt-2.5 mt-1 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-[10px] font-bold text-slate-200 font-sans">Active Layout Presets</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { key: 'sandbox', label: 'Sandbox' },
                        { key: 'orbit', label: 'Orbit Ring' },
                        { key: 'starburst', label: 'Starburst' },
                        { key: 'clusters', label: 'Clusters' }
                      ].map((lay) => (
                        <button
                          key={lay.key}
                          type="button"
                          onClick={() => handleLayoutChange(lay.key as any)}
                          className={`text-[9.5px] font-sans font-bold py-1 px-1.5 rounded-lg border transition-all cursor-pointer text-center ${
                            graphLayout === lay.key
                              ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                              : 'bg-slate-950/60 text-slate-400 border-slate-800/85 hover:text-slate-200 hover:bg-[#02020a]'
                          }`}
                        >
                          {lay.label}
                        </button>
                      ))}
                    </div>
                  </div>
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
                  {activeEdges.map((edge, idx) => {
                    const sourceNode = filteredGraphNodes.find(n => n.id === edge.source);
                    const targetNode = filteredGraphNodes.find(n => n.id === edge.target);
                    if (!sourceNode || !targetNode) return null;

                    const isSearchingGraph = graphSearchQuery.trim() !== '';
                    let edgeOpacity = 0.4;
                    let strokeColor = "#6366f1";
                    let strokeWidthValue = "1.5";

                    if (isSearchingGraph) {
                      const sMatch = matchedGraphNodes.some(m => m.id === edge.source);
                      const tMatch = matchedGraphNodes.some(m => m.id === edge.target);
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

                    const isSourceDragged = draggedNode === edge.source;
                    const isTargetDragged = draggedNode === edge.target;
                    const isLineDragging = isSourceDragged || isTargetDragged;

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
                        className={isLineDragging ? "graph-dragging-element" : "graph-transition-element"}
                        style={{ transition: isLineDragging ? 'none' : 'stroke-opacity 0.25s, stroke 0.25s, stroke-width 0.25s' }}
                      />
                    );
                  })}

                  {/* Circles (Nodes) */}
                  {filteredGraphNodes.map((node) => {
                    const isSelected = selectedNode?.id === node.id;
                    const isSearchingGraph = graphSearchQuery.trim() !== '';
                    const isHighlighted = isSearchingGraph && matchedGraphNodes.some(m => m.id === node.id);
                    const nodeOpacity = isSearchingGraph ? (isHighlighted ? 1 : 0.15) : 1;
                    const isNodeDragged = draggedNode === node.id;
                    const transitionClass = isNodeDragged ? "graph-dragging-element" : "graph-transition-element";

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
                          className={`cursor-pointer ${transitionClass}`}
                          onMouseDown={() => handleNodeMouseDown(node.id)}
                        />
                        {/* Glow outline on selection */}
                        {isSelected && (
                          <>
                            {/* Inner breathing glow outline */}
                            <circle 
                              cx={node.x}
                              cy={node.y}
                              r={node.size + 6}
                              fill="none"
                              stroke="#818cf8"
                              strokeWidth="2.5"
                              filter="url(#glow)"
                              className={`animate-pulse ${transitionClass}`}
                            />
                            {/* Outer high-performance staggered scale pulse 1 */}
                            <circle 
                              cx={node.x}
                              cy={node.y}
                              r={node.size + 5}
                              fill="none"
                              stroke="#818cf8"
                              strokeWidth="2"
                              filter="url(#glow)"
                              className={`animate-selected-ripple ${transitionClass}`}
                              style={{ transformOrigin: `${node.x}px ${node.y}px` }}
                            />
                            {/* Outer high-performance staggered scale pulse 2 */}
                            <circle 
                              cx={node.x}
                              cy={node.y}
                              r={node.size + 5}
                              fill="none"
                              stroke="#a78bfa"
                              strokeWidth="1.5"
                              filter="url(#glow)"
                              className={`animate-selected-ripple ${transitionClass}`}
                              style={{ 
                                transformOrigin: `${node.x}px ${node.y}px`,
                                animationDelay: '1.1s'
                              }}
                            />
                          </>
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
                            className={`animate-spin ${transitionClass}`}
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
                            className={`animate-ping ${transitionClass}`}
                            style={{ transformOrigin: `${node.x}px ${node.y}px`, animationDuration: '3s' }}
                          />
                        )}
                        {/* Inner visible node */}
                        <circle 
                          cx={node.x}
                          cy={node.y}
                          r={node.size}
                          fill={getNodeColor(node, graphColorMode)}
                          className={`hover:brightness-125 cursor-pointer text-slate-100 ${transitionClass}`}
                          stroke={isSelected ? "#ffffff" : "rgba(255,255,255,0.2)"}
                          strokeWidth={isSelected ? 2.5 : 1}
                        />
                        {/* Small center pin */}
                        <circle 
                          cx={node.x}
                          cy={node.y}
                          r={3}
                          fill="#ffffff"
                          className={transitionClass}
                        />
                        {/* Floating Labels */}
                        <text
                          x={node.x}
                          y={node.y - node.size - 6}
                          textAnchor="middle"
                          fill={isHighlighted ? "#10b981" : "#94a3b8"}
                          fontSize="10"
                          fontWeight={isHighlighted ? "extrabold" : "bold"}
                          className={`pointer-events-none font-mono ${transitionClass}`}
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

                          {/* Categorization Badges row */}
                          <div className="flex flex-wrap gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[8.5px] px-1.5 py-0.5 rounded bg-slate-950/60 border border-slate-800 text-slate-300 font-mono">
                              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: getDomainColorInfo(resolveNodeDomainAndLanguage(hoveredNode).domain).hex }} />
                              {resolveNodeDomainAndLanguage(hoveredNode).domain}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[8.5px] px-1.5 py-0.5 rounded bg-slate-950/60 border border-slate-800 text-slate-300 font-mono">
                              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: getLanguageColorInfo(resolveNodeDomainAndLanguage(hoveredNode).language).hex }} />
                              Lang: {resolveNodeDomainAndLanguage(hoveredNode).language}
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
                    onClick={() => {
                      setGraphLayout('sandbox');
                      setGraphNodes(INITIAL_NODES);
                    }}
                    className="p-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    Reset Map
                  </button>
                </div>

              </div>

              {/* Node Inspector Details (Sidebar) */}
              <div className="lg:col-span-1 flex flex-col gap-4">
                {/* Graph Filters & Controls */}
                <div className="bg-[#070719]/90 border border-slate-800 p-5 rounded-3xl shadow-xl flex flex-col gap-3.5">
                  <div className="flex items-center gap-2 border-b border-slate-800/60 pb-2">
                    <Filter className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Graph Filters</h3>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-sans font-medium text-slate-400">Min Backlinks</span>
                      <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-950/40 border border-indigo-900/30 px-1.5 py-0.5 rounded-lg">
                        {minBacklinks === 0 ? "Show All" : `≥ ${minBacklinks}`}
                      </span>
                    </div>

                    <input 
                      type="range"
                      min="0"
                      max="18"
                      step="1"
                      value={minBacklinks}
                      onChange={(e) => setMinBacklinks(Number(e.target.value))}
                      className="w-full accent-indigo-500 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer border border-slate-800/80"
                    />

                    <div className="grid grid-cols-4 gap-1 mt-0.5">
                      {[0, 2, 5, 10].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setMinBacklinks(val)}
                          className={`text-[9.5px] font-sans font-bold py-1.5 px-1 rounded-lg border transition-all cursor-pointer text-center leading-none ${
                            minBacklinks === val
                              ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                              : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-[#02020a]'
                          }`}
                        >
                          {val === 0 ? 'All' : `${val}+`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

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

                      <div className="border-t border-slate-800/60 pt-4 flex flex-col gap-2.5">
                        <h5 className="text-xs font-bold text-slate-400 font-mono">Visual Categorization</h5>
                        <div className="flex flex-col gap-2 bg-slate-900/40 border border-slate-800/50 p-3 rounded-xl font-mono text-xs text-slate-300">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Domain:</span>
                            <span className="inline-flex items-center gap-1.5 font-bold text-slate-200">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getDomainColorInfo(resolveNodeDomainAndLanguage(selectedNode).domain).hex }} />
                              {resolveNodeDomainAndLanguage(selectedNode).domain}
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-t border-slate-800/40 pt-2">
                            <span className="text-slate-500">Language:</span>
                            <span className="inline-flex items-center gap-1.5 font-bold text-slate-200">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getLanguageColorInfo(resolveNodeDomainAndLanguage(selectedNode).language).hex }} />
                              {getLanguageColorInfo(resolveNodeDomainAndLanguage(selectedNode).language).name} ({resolveNodeDomainAndLanguage(selectedNode).language})
                            </span>
                          </div>
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
                          id="new-collection-name-input"
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
                        const isDragHovered = dragOverFolderId === col.id;
                        const isFolderDragging = draggedFolderId === col.id;
                        return (
                          <div
                            key={col.id}
                            id={`collection-folder-item-${col.id}`}
                            onClick={() => setSelectedCollectionId(col.id)}
                            draggable={true}
                            onDragStart={(e) => {
                              setDraggedFolderId(col.id);
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'folder', id: col.id }));
                            }}
                            onDragEnd={() => {
                              setDraggedFolderId(null);
                              setDragOverFolderId(null);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (draggedFolderId && draggedFolderId !== col.id) {
                                setDragOverFolderId(col.id);
                              } else if (draggedPageId && draggedPageSourceFolderId !== col.id) {
                                setDragOverFolderId(col.id);
                              }
                            }}
                            onDragLeave={() => {
                              setDragOverFolderId(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              handleDropOnFolder(col.id);
                            }}
                            className={`p-3.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing flex items-start justify-between gap-3 relative ${
                              isSelected
                                ? 'bg-indigo-950/20 border-indigo-505 border-indigo-500 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                                : 'bg-[#03030d] border-slate-800/80 hover:bg-slate-900/40 text-slate-300'
                            } ${
                              isDragHovered
                                ? 'border-dashed border-indigo-400 bg-indigo-950/45 scale-[1.03] shadow-md shadow-indigo-500/10'
                                : ''
                            } ${
                              isFolderDragging ? 'opacity-40 border-dashed border-slate-700' : ''
                            }`}
                            title="Drag folder to reorder, or drag search results here to move them"
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
                    
                    if (collections.length === 0) {
                      return (
                        <div className="bg-[#070719]/40 border border-dashed border-indigo-500/20 rounded-3xl p-16 text-center flex flex-col items-center justify-center gap-6 shadow-[0_4px_30px_rgba(0,0,0,0.4)] relative overflow-hidden group">
                          {/* Decorative glow elements */}
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />
                          
                          <div className="relative">
                            <div className="w-20 h-20 bg-indigo-950/45 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-indigo-400 shadow-xl group-hover:scale-105 transition-transform duration-300">
                              <FolderPlus className="w-10 h-10 animate-pulse text-indigo-400" />
                            </div>
                            <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500"></span>
                            </span>
                          </div>

                          <div className="max-w-md">
                            <h3 className="text-xl font-bold text-slate-100 font-sans tracking-tight">Create Your First Search Collection</h3>
                            <p className="text-sm text-slate-400 mt-2 font-sans leading-relaxed">
                              Folders allow you to organize your web findings, important research nodes, and search summaries in one centralized workspace. Bookmark websites on the go and access them instantly.
                            </p>
                          </div>

                          <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
                            <button
                              type="button"
                              onClick={() => {
                                const input = document.getElementById('new-collection-name-input');
                                if (input) {
                                  (input as HTMLInputElement).focus();
                                  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                              }}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition-all active:scale-95 cursor-pointer shadow-lg shadow-indigo-600/20"
                            >
                              Initialize Your First Folder
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveTab('search')}
                              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold py-2.5 px-6 rounded-xl text-xs transition-all active:scale-95 cursor-pointer"
                            >
                              Browse Search Directory
                            </button>
                          </div>
                        </div>
                      );
                    }

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

                        {/* Personal Folder Notes Card */}
                        <div className="bg-[#03030d] border border-slate-800/80 rounded-2xl p-4.5 flex flex-col gap-3.5 relative overflow-hidden transition-all duration-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
                          {/* Inner soft purple-indigo ambient light overlay */}
                          <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

                          <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-900">
                            <div className="flex items-center gap-2.5">
                              <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/15 shrink-0">
                                <FileText className="w-4 h-4 text-indigo-400" />
                              </span>
                              <div>
                                <h4 className="text-xs font-bold text-slate-200 tracking-tight flex items-center gap-1.5 font-sans">
                                  Folder Notes &amp; Scratchpad
                                </h4>
                                <p className="text-[10px] text-slate-500 font-sans mt-0.5">Auto-saved to device cache</p>
                              </div>
                            </div>

                            {/* Auto-save status indicator and toolbelt */}
                            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                              {/* Sync and Save Status */}
                              <div className="flex items-center gap-1.5 font-mono text-[9px] select-none">
                                {isSavingNotes ? (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                                    <span className="text-amber-400 font-bold">Saving...</span>
                                  </>
                                ) : folderNotes.trim() ? (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                    <span className="text-slate-400">Synced &amp; Saved</span>
                                  </>
                                ) : (
                                  <span className="text-slate-600">Start writing below</span>
                                )}
                              </div>

                              <div className="h-3.5 w-[1px] bg-slate-905 bg-slate-850/80 hidden sm:block" />

                              {/* Action Toolbelt */}
                              <div className="flex items-center gap-1.5">
                                {/* Copy Notes */}
                                <button
                                  type="button"
                                  disabled={!folderNotes.trim()}
                                  onClick={() => {
                                    navigator.clipboard.writeText(folderNotes);
                                    showToast("Notes copied to clipboard", "success");
                                  }}
                                  className={`p-1 px-2.5 text-[10px] rounded-lg border transition-all flex items-center gap-1 font-mono font-bold leading-none ${
                                    folderNotes.trim()
                                      ? 'border-slate-800 hover:border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200 cursor-pointer active:scale-95'
                                      : 'border-slate-900/60 bg-[#020207] text-slate-700 cursor-not-allowed'
                                  }`}
                                  title="Copy scratchpad notes"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span className="hidden sm:inline">Copy</span>
                                </button>

                                {/* Export Notes */}
                                <button
                                  type="button"
                                  disabled={!folderNotes.trim()}
                                  onClick={() => {
                                    const blob = new Blob([folderNotes], { type: 'text/plain;charset=utf-8' });
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = `${activeFolder.name.toLowerCase().replace(/\s+/g, '_')}_notes.txt`;
                                    link.click();
                                    URL.revokeObjectURL(url);
                                    showToast("Notes exported successfully", "success");
                                  }}
                                  className={`p-1 px-2.5 text-[10px] rounded-lg border transition-all flex items-center gap-1 font-mono font-bold leading-none ${
                                    folderNotes.trim()
                                      ? 'border-slate-800 hover:border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200 cursor-pointer active:scale-95'
                                      : 'border-slate-900/60 bg-[#020207] text-slate-700 cursor-not-allowed'
                                  }`}
                                  title="Export notes to a text file"
                                >
                                  <Download className="w-3 h-3" />
                                  <span className="hidden sm:inline">Export</span>
                                </button>

                                {/* Clear Notes */}
                                <button
                                  type="button"
                                  disabled={!folderNotes.trim()}
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to permanently clear notes for "${activeFolder.name}"? This action cannot be undone.`)) {
                                      handleUpdateFolderNote('');
                                      showToast("Notes cleared successfully", "info");
                                    }
                                  }}
                                  className={`p-1 px-2.5 text-[10px] rounded-lg border transition-all flex items-center gap-1 font-mono font-bold leading-none ${
                                    folderNotes.trim()
                                      ? 'border-red-950/40 bg-red-950/10 text-red-400 hover:bg-red-950/25 hover:text-red-300 cursor-pointer active:scale-95'
                                      : 'border-slate-900/60 bg-[#020207] text-slate-750 text-slate-700 cursor-not-allowed'
                                  }`}
                                  title="Clear notes content"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span className="hidden sm:inline">Clear</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="relative">
                            <textarea
                              value={folderNotes}
                              onChange={(e) => handleUpdateFolderNote(e.target.value)}
                              placeholder="Type research takeaways, key queries, reminders, or general scratch notes for this folder here... Your thoughts will be saved instantly!"
                              className="w-full h-32 min-h-[95px] max-h-[300px] bg-[#020208]/90 border border-slate-900/80 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-950 rounded-xl p-3 px-3.5 text-xs text-slate-200 placeholder-slate-650 placeholder-slate-600 outline-none transition-all resize-y font-sans leading-relaxed scrollbar-thin"
                            />
                          </div>

                          {/* Footer Counters and Security indicator */}
                          <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 select-none">
                            <div className="flex items-center gap-3">
                              <span>Words: <strong className="text-slate-400">{folderNotes.trim() ? folderNotes.trim().split(/\s+/).length : 0}</strong></span>
                              <span>Chars: <strong className="text-slate-400">{folderNotes.length}</strong></span>
                            </div>
                            <span className="flex items-center gap-1.5 text-[8.5px] text-slate-600 uppercase tracking-widest font-bold">
                              <span className="w-1 h-1 rounded-full bg-indigo-500/60" />
                              Secure Offline Storage
                            </span>
                          </div>
                        </div>

                        {/* List of saved pages */}
                        <div className="flex flex-col gap-4">
                          {activeFolder.pages.map((item) => {
                            const isPageDragging = draggedPageId === item.id;
                            const isPageDragHovered = dragOverPageId === item.id;
                            return (
                              <article
                                key={item.id}
                                draggable={true}
                                onDragStart={(e) => {
                                  setDraggedPageId(item.id);
                                  setDraggedPageSourceFolderId(activeFolder.id);
                                  e.dataTransfer.effectAllowed = "move";
                                  e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'page', pageId: item.id, folderId: activeFolder.id }));
                                }}
                                onDragEnd={() => {
                                  setDraggedPageId(null);
                                  setDraggedPageSourceFolderId(null);
                                  setDragOverPageId(null);
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  if (draggedPageId && draggedPageId !== item.id && draggedPageSourceFolderId === activeFolder.id) {
                                    setDragOverPageId(item.id);
                                  }
                                }}
                                onDragLeave={() => {
                                  setDragOverPageId(null);
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  handleDropOnPage(item.id, activeFolder.id);
                                }}
                                className={`bg-[#03030d] border p-4 rounded-2xl hover:shadow-[0_0_15px_rgba(99,102,241,0.1)] transition-all flex flex-col gap-2 relative group cursor-grab active:cursor-grabbing ${
                                  isPageDragging ? 'opacity-35 border-dashed border-slate-800' : 'border-slate-800 hover:border-indigo-500/40'
                                } ${
                                  isPageDragHovered ? 'border-indigo-400 bg-indigo-950/20 scale-[1.01]' : ''
                                }`}
                                title="Drag to reorder within folder, or drag to any left sidebar folder to move"
                              >
                              <div className="flex items-center justify-between gap-3 text-[11px] font-mono">
                                <span className="text-indigo-400 truncate max-w-xs sm:max-w-md">{item.url}</span>
                                <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-500 text-[9px]">
                                  Likes: {item.likes || 0}
                                </span>
                              </div>

                              <h4 className="text-sm font-bold text-slate-200 group-hover:text-indigo-300 transition-colors flex items-center gap-1.5 leading-tight">
                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1.5 font-sans">
                                  <HighlightText text={item.title} query={collectionsQuery} />
                                  <LinkIcon className="w-3.5 h-3.5 text-slate-505 text-slate-500" />
                                </a>
                              </h4>

                              <p className="text-xs text-slate-400 leading-relaxed font-sans line-clamp-2">
                                <HighlightText text={item.snippet} query={collectionsQuery} />
                              </p>

                              {/* Custom Page Metadata (Author, Language, Tags) if they exist */}
                              {(item.author || item.language || (item.tags && item.tags.length > 0)) && (
                                <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 pb-1 text-[11px]">
                                  {item.author && (
                                    <span className="flex items-center gap-1 text-slate-400 font-sans">
                                      <User className="w-3 h-3 text-indigo-400" />
                                      <span>Creator: <strong className="text-slate-300">{item.author}</strong></span>
                                    </span>
                                  )}
                                  {item.language && (
                                    <span className="flex items-center gap-1 text-slate-400 font-sans">
                                      <Globe className="w-3 h-3 text-indigo-400" />
                                      <span>Lang: <strong className="text-slate-300">{item.language}</strong></span>
                                    </span>
                                  )}
                                  {item.tags && item.tags.length > 0 && (
                                    <span className="flex items-center gap-1 font-sans text-slate-400">
                                      <Tag className="w-2.5 h-2.5 text-indigo-400" />
                                      <span className="flex flex-wrap gap-1">
                                        {item.tags.map((tag, idx) => (
                                          <span key={idx} className="bg-indigo-950/40 border border-indigo-900/60 rounded px-1.5 py-0.2 text-[9px] text-indigo-300">
                                            #{tag}
                                          </span>
                                        ))}
                                      </span>
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Footer Actions inside collection */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-800/50 pt-3 text-[10px] text-slate-500 font-mono mt-1">
                                <span>Saved on device cache</span>
                                <div className="flex flex-wrap items-center gap-1">
                                  
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
                                        <span>Read</span>
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
                                        <span>Copy</span>
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
                          );
                        })}

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

        {/* TAB 5: PROJECTS WORKSPACE */}
        {activeTab === 'projects' && (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar with Projects list */}
            <div className="w-full lg:w-80 shrink-0 flex flex-col gap-4">
              <div className="bg-[#090924]/80 border border-slate-800 p-5 rounded-3xl backdrop-blur-md">
                <div className="flex items-center justify-between mb-4 border-b border-slate-850 pb-3">
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 font-mono flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-indigo-400" />
                    My Projects
                  </h2>
                  <button
                    onClick={() => setShowCreateProjectModal(true)}
                    className="p-1.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-450 hover:text-white hover:bg-indigo-600 rounded-xl transition-all flex items-center justify-center cursor-pointer"
                    title="Create New Project"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {projects.map((proj) => {
                    const isSelected = selectedProjectId === proj.id;
                    const completedTasks = proj.tasks.filter(t => t.completed).length;
                    const totalTasks = proj.tasks.length;
                    const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                    return (
                      <div
                        key={proj.id}
                        onClick={() => setSelectedProjectId(proj.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-950/20 text-slate-100 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                            : 'border-slate-800/80 bg-[#070719]/40 text-slate-400 hover:border-slate-700 hover:bg-[#070719]/80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-sans font-extrabold text-xs truncate max-w-[170px]">
                            {proj.name}
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold font-mono leading-none shrink-0 ${
                            proj.status === 'completed' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                            proj.status === 'review' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                            proj.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                            'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                          }`}>
                            {proj.status.replace('_', ' ')}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-500 font-sans mt-1 line-clamp-2 leading-relaxed text-left">
                          {proj.description}
                        </p>

                        <div className="mt-3.5 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                            <span>Progress</span>
                            <span>{pct}% ({completedTasks}/{totalTasks})</span>
                          </div>
                          <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 rounded-full transition-all duration-300" 
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {/* Hover Action to Quick Delete */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Are you sure you want to delete project "${proj.name}"? This will wipe its summary, tasks and details.`)) {
                              handleDeleteProject(proj.id);
                            }
                          }}
                          className="absolute right-2 top-2 p-1 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 rounded transition-all cursor-pointer"
                          title="Delete Project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  {projects.length === 0 && (
                    <div className="text-center py-8 text-slate-500 italic text-xs border border-dashed border-slate-850 rounded-2xl bg-[#040410]/20">
                      No active projects. Click "+" to start!
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Main Panel for Active Project Details */}
            <div className="flex-1 flex flex-col gap-6">
              {(() => {
                const activeProj = projects.find(p => p.id === selectedProjectId);
                if (!activeProj) {
                  return (
                    <div className="bg-[#090924]/60 border border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-4 min-h-[400px]">
                      <Briefcase className="w-12 h-12 text-indigo-500/40 animate-pulse" />
                      <h3 className="text-lg font-bold text-slate-300">No Selected Project Workspace</h3>
                      <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                        Select a project from the left panel sidebar or create a fresh research workspace to begin planning your crawled results, bookmark folders and project summaries.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowCreateProjectModal(true)}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
                      >
                        <Plus className="w-4 h-4" />
                        Create Workspace
                      </button>
                    </div>
                  );
                }

                // Gather linked collections
                const linkedCols = collections.filter(col => activeProj.collectionIds.includes(col.id));

                return (
                  <div className="flex flex-col gap-6">
                    {/* Project Header Widget */}
                    <div className="bg-[#090924]/80 border border-slate-800 p-6 rounded-3xl backdrop-blur-md relative overflow-hidden text-left">
                      <div className="absolute -top-16 -right-16 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                      
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] text-indigo-400 font-mono uppercase tracking-widest font-extrabold flex items-center gap-1.5 mb-1.5">
                            <Target className="w-3.5 h-3.5 text-indigo-400" />
                            Research Workspace ID: {activeProj.id}
                          </span>
                          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight font-sans">
                            {activeProj.name}
                          </h1>
                          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed font-sans max-w-2xl">
                            {activeProj.description}
                          </p>
                        </div>

                        {/* Actions & Timings */}
                        <div className="flex flex-wrap items-center gap-3 shrink-0 self-start sm:self-auto">
                          {/* Export PDF Button */}
                          <button
                            type="button"
                            onClick={() => {
                              exportProjectToPDF(activeProj, linkedCols);
                              showToast('Generating project PDF report...', 'success');
                            }}
                            className="flex items-center gap-2 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 shadow-sm font-sans"
                            title="Export PDF Summary"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            <span>Export PDF</span>
                          </button>

                          {/* Status Dropdown */}
                          <div className="flex flex-col gap-1 text-left">
                            <label className="text-[9px] font-extrabold text-slate-500 font-mono uppercase">Status</label>
                            <select
                              value={activeProj.status}
                              onChange={(e) => {
                                const newStatus = e.target.value as any;
                                setProjects(prev => prev.map(p => p.id === activeProj.id ? { ...p, status: newStatus } : p));
                                showToast(`Project status is now: ${newStatus}`, 'success');
                              }}
                              className="bg-[#03030d] border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none cursor-pointer"
                            >
                              <option value="planning">Planning</option>
                              <option value="in_progress">In Progress</option>
                              <option value="review">Under Review</option>
                              <option value="completed">Completed</option>
                            </select>
                          </div>

                          {/* Target Date */}
                          <div className="flex flex-col gap-1 text-left">
                            <label className="text-[9px] font-extrabold text-slate-500 font-mono uppercase">Target Date</label>
                            <input
                              type="date"
                              value={activeProj.target_date || ''}
                              onChange={(e) => {
                                const newDate = e.target.value || undefined;
                                setProjects(prev => prev.map(p => p.id === activeProj.id ? { ...p, target_date: newDate } : p));
                              }}
                              className="bg-[#03030d] border border-[#1e293b] text-slate-300 text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Created metadata indicator */}
                      <div className="mt-4 pt-4 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-[11px] text-slate-500 font-mono gap-4">
                        <span>Created: <strong>{new Date(activeProj.created_at).toLocaleDateString()}</strong></span>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 border border-slate-800 rounded">
                            <Folder className="w-3.5 h-3.5 text-indigo-400" />
                            <strong>{activeProj.collectionIds.length}</strong> folders
                          </span>
                          <span className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 border border-slate-800 rounded">
                            <ClipboardList className="w-3.5 h-3.5 text-indigo-400" />
                            <strong>{activeProj.tasks.filter(t => t.completed).length}/{activeProj.tasks.length}</strong> tasks
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bento Grid: Notes on Left, Tasks and collections link on Right */}
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 text-left">
                      
                      {/* Left: Interactive Markdown / Text Notebook */}
                      <div className="xl:col-span-7 flex flex-col gap-4 bg-[#090924]/80 border border-slate-800 p-5 rounded-3xl backdrop-blur-md">
                        <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                          <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 font-mono flex items-center gap-2">
                            <FileText className="w-4 h-4 text-indigo-400" />
                            Project Synthesis Notebook
                          </h3>
                          <div className="flex items-center gap-2">
                            {isSaving ? (
                              <span className="text-[10px] text-indigo-400 font-mono flex items-center gap-1 bg-indigo-950/40 border border-indigo-900 px-1.5 py-0.5 rounded">
                                <Loader2 className="w-2.5 h-2.5 animate-spin" /> Saving...
                              </span>
                            ) : lastSaved ? (
                              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/30 border border-emerald-900/50 px-1.5 py-0.5 rounded" title="Auto-saved to LocalStorage every 5 seconds">
                                Saved at {lastSaved.toLocaleTimeString()}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-mono bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded" title="Auto-saves automatically every 5 seconds">
                                Auto-Save Active (5s)
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                          Draft custom research outlines, notes, logs or summaries. Text updates are saved instantly in local memory space.
                        </p>

                        <div className="flex-1 flex flex-col gap-2 min-h-[300px]">
                          <textarea
                            value={localNotes}
                            onChange={(e) => setLocalNotes(e.target.value)}
                            placeholder="Draft details or paste references here..."
                            className="w-full flex-1 min-h-[250px] bg-[#03030d]/50 border border-slate-800 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 rounded-2xl p-4 text-xs text-slate-200 outline-none font-sans leading-relaxed resize-y"
                          />
                        </div>
                      </div>

                      {/* Right: Tasks & Collections Link */}
                      <div className="xl:col-span-5 flex flex-col gap-6">
                        {/* Tasks Checklist */}
                        <div className="bg-[#090924]/80 border border-slate-800 p-5 rounded-3xl backdrop-blur-md flex flex-col gap-4">
                          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                            <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 font-mono flex items-center gap-2">
                              <ClipboardList className="w-4 h-4 text-indigo-400" />
                              Research Tasks List
                            </h3>
                          </div>

                          {/* Add task inline input */}
                          <form 
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleAddTaskToProject(activeProj.id);
                            }}
                            className="flex gap-2"
                          >
                            <input
                              type="text"
                              placeholder="Add checklist task item..."
                              value={newProjectTaskText}
                              onChange={(e) => setNewProjectTaskText(e.target.value)}
                              className="flex-1 bg-[#03030d]/50 border border-slate-800 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-200 rounded-xl px-3 py-2 text-xs outline-none font-sans"
                            />
                            <button
                              type="submit"
                              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 border border-indigo-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-sm active:scale-95 font-sans"
                            >
                              Add
                            </button>
                          </form>

                          {/* Task Checklist Items */}
                          <div className="flex flex-col gap-2.5 max-h-[200px] overflow-y-auto pr-1">
                            {activeProj.tasks.map((task) => (
                              <div 
                                key={task.id}
                                className="flex items-center justify-between gap-3 bg-[#03030d]/30 border border-slate-800/40 p-2.5 rounded-xl hover:border-slate-800 transition-all"
                              >
                                <div 
                                  onClick={() => handleToggleTaskInProject(activeProj.id, task.id)}
                                  className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none"
                                >
                                  {task.completed ? (
                                    <CheckSquare className="w-4 h-4 text-green-400 shrink-0" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-500 hover:text-indigo-400 shrink-0" />
                                  )}
                                  <span className={`text-xs truncate font-sans text-left ${task.completed ? 'text-slate-500 line-through decoration-slate-600' : 'text-slate-300'}`}>
                                    {task.text}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTaskFromProject(activeProj.id, task.id)}
                                  className="p-1 text-slate-600 hover:text-red-400 rounded transition-all cursor-pointer shrink-0"
                                  title="Remove Task"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}

                            {activeProj.tasks.length === 0 && (
                              <div className="text-center py-6 text-slate-500 italic text-xs font-sans">
                                No tasks found. Write one above to plan!
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Linked Collections Control Widget */}
                        <div className="bg-[#090924]/80 border border-slate-800 p-5 rounded-3xl backdrop-blur-md flex flex-col gap-4">
                          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                            <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 font-mono flex items-center gap-2">
                              <Folder className="w-4 h-4 text-indigo-400" />
                              Linked Bookmark Folders
                            </h3>
                          </div>
                          
                          <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                            Select search folders to include their indexed pages inside this workspace catalog automatically.
                          </p>

                          {/* Multi-Select Toggle Checklist of all Collections */}
                          <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                            {collections.map((col) => {
                              const isLinked = activeProj.collectionIds.includes(col.id);
                              return (
                                <div
                                  key={col.id}
                                  onClick={() => handleToggleLinkCollection(activeProj.id, col.id)}
                                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                                    isLinked
                                      ? 'border-indigo-500/50 bg-indigo-950/10 text-indigo-300'
                                      : 'border-slate-800/60 bg-transparent hover:border-slate-700 hover:bg-slate-900/10 text-slate-400'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Folder className={`w-3.5 h-3.5 ${isLinked ? 'text-indigo-400' : 'text-slate-550'}`} />
                                    <span className="text-xs font-bold font-sans truncate">{col.name}</span>
                                    <span className="text-[10px] text-slate-550 font-mono">({col.pages.length} records)</span>
                                  </div>
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                    isLinked ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-750 bg-[#03030d]'
                                  }`}>
                                    {isLinked && <Check className="w-3 h-3" />}
                                  </div>
                                </div>
                              );
                            })}

                            {collections.length === 0 && (
                              <div className="text-center py-4 text-slate-550 text-xs italic font-sans">
                                Create a collection first to link folders.
                              </div>
                            )}
                          </div>
                        </div>

                      </div>

                    </div>

                    {/* Linked Pages Catalog Sub-section */}
                    {(() => {
                      const directPages = (activeProj.linkedPages || []).map(p => ({ ...p, folderName: "Direct Link", isDirect: true }));
                      const folderPages = linkedCols.flatMap(col => col.pages.map(p => ({ ...p, folderName: col.name, isDirect: false })));
                      const allProjectPages = [...directPages, ...folderPages];

                      if (allProjectPages.length === 0) return null;

                      return (
                        <div className="bg-[#090924]/80 border border-slate-800 p-6 rounded-3xl backdrop-blur-md flex flex-col gap-4 text-left">
                          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                            <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 font-mono flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-indigo-400" />
                              Project Reference Catalog ({allProjectPages.length} items)
                            </h3>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {allProjectPages.map((page, idx) => (
                              <div 
                                key={`${page.id}-${idx}`}
                                className="border border-slate-800/85 bg-[#070719]/30 rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-slate-700 hover:bg-[#070719]/60 transition-all text-left relative group animate-fade-in"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center justify-between gap-2 text-[10px] text-indigo-400 font-mono uppercase tracking-wider mb-1.5">
                                    <span className={`flex items-center gap-1 px-1.5 py-0.5 border rounded ${
                                      page.isDirect 
                                        ? 'bg-indigo-950/60 border-indigo-500/30 text-indigo-300' 
                                        : 'bg-indigo-950/40 border-indigo-900/40'
                                    }`}>
                                      {page.isDirect ? <Briefcase className="w-3 h-3" /> : <Folder className="w-3 h-3" />}
                                      {page.folderName}
                                    </span>
                                    {page.language && <span className="bg-slate-900 px-1 py-0.5 rounded">{page.language}</span>}
                                  </div>
                                  <h4 className="text-xs font-bold text-slate-200 font-sans truncate pr-6" title={page.title}>
                                    {page.title}
                                  </h4>
                                  <span className="text-[9px] text-slate-500 block truncate font-mono select-all mt-0.5">{page.url}</span>
                                  <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed mt-2 font-sans">
                                    {page.snippet}
                                  </p>
                                </div>

                                <div className="flex items-center justify-between border-t border-slate-800/50 pt-2 text-[10px] text-slate-500 font-mono mt-1">
                                  <span>Likes: {page.likes || 0}</span>
                                  <div className="flex items-center gap-2">
                                    {page.isDirect && (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleLinkPageToProject(activeProj.id, page)}
                                        className="text-red-400 hover:text-red-300 transition-colors mr-2 cursor-pointer flex items-center justify-center p-0.5 rounded hover:bg-red-950/20"
                                        title="Unlink from Project"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <a 
                                      href={page.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-indigo-450 hover:text-indigo-300 hover:underline flex items-center gap-1 font-bold font-sans transition-all"
                                    >
                                      Open Page
                                      <ArrowRight className="w-3 h-3" />
                                    </a>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                );
              })()}
            </div>
          </div>
        )}

      </main>

        {/* Create Research Project Modal Overlay */}
        <AnimatePresence>
          {showCreateProjectModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCreateProjectModal(false)}
                className="fixed inset-0 bg-[#02020a]/80 backdrop-blur-sm"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="relative w-full max-w-lg bg-[#090924] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-[0_15px_40px_rgba(0,0,0,0.8)] overflow-hidden z-50 font-sans"
              >
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex items-center justify-between border-b border-slate-850 pb-4 mb-6">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-450">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-base font-extrabold text-slate-100 tracking-tight font-sans">Create Research Workspace</h3>
                      <p className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider">Group files, folders & summaries</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCreateProjectModal(false)}
                    className="p-1 text-slate-400 hover:text-white hover:bg-slate-900 rounded transition-all cursor-pointer"
                  >
                    <span className="text-xl font-bold font-mono">×</span>
                  </button>
                </div>

                <form onSubmit={handleCreateProject} className="flex flex-col gap-4 text-xs font-sans text-left">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-indigo-400 font-mono uppercase">Project Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. LLM Training & Parameters"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      className="bg-[#03030d] border border-slate-800 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl p-3 text-slate-200 outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-indigo-400 font-mono uppercase">Description</label>
                    <textarea
                      placeholder="Brief objective of this study..."
                      value={newProjectDescription}
                      onChange={(e) => setNewProjectDescription(e.target.value)}
                      className="bg-[#03030d] border border-slate-800 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl p-3 text-slate-200 outline-none h-20 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-indigo-400 font-mono uppercase">Initial Status</label>
                      <select
                        value={newProjectStatus}
                        onChange={(e) => setNewProjectStatus(e.target.value as any)}
                        className="bg-[#03030d] border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl p-3 outline-none cursor-pointer"
                      >
                        <option value="planning">Planning</option>
                        <option value="in_progress">In Progress</option>
                        <option value="review">Review</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-indigo-400 font-mono uppercase">Target Date</label>
                      <input
                        type="date"
                        value={newProjectTargetDate}
                        onChange={(e) => setNewProjectTargetDate(e.target.value)}
                        className="bg-[#03030d] border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl p-3 outline-none cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Pre-link search collections */}
                  <div className="flex flex-col gap-1.5 mt-2">
                    <label className="text-[11px] font-bold text-indigo-400 font-mono uppercase">Link Collections (Optional)</label>
                    <p className="text-[10px] text-slate-500 mb-1 leading-relaxed">Select folders to automatically display in this project's research catalog</p>
                    <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto bg-[#03030d]/50 border border-slate-800/80 rounded-xl p-3">
                      {collections.map((col) => {
                        const isSelected = newProjectSelectedColIds.includes(col.id);
                        return (
                          <button
                            type="button"
                            key={col.id}
                            onClick={() => {
                              setNewProjectSelectedColIds(prev =>
                                isSelected 
                                  ? prev.filter(id => id !== col.id)
                                  : [...prev, col.id]
                              );
                            }}
                            className={`px-2.5 py-1.5 rounded-lg border font-bold text-[10px] transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-650/25 border-indigo-500 text-indigo-350'
                                : 'bg-transparent border-slate-800 hover:border-slate-700 text-slate-400'
                            }`}
                          >
                            {col.name} ({col.pages.length})
                          </button>
                        );
                      })}
                      {collections.length === 0 && (
                        <span className="text-slate-600 italic text-[11px]">No collections created yet.</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-6 border-t border-slate-850 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowCreateProjectModal(false)}
                      className="px-4 py-2.5 border border-slate-800 bg-[#070719]/40 hover:bg-slate-900/60 text-slate-300 font-medium text-xs rounded-xl cursor-pointer transition-all active:scale-95"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs rounded-xl cursor-pointer transition-all active:scale-95 shadow-[0_0_15px_rgba(99,102,241,0.35)]"
                    >
                      Create Workspace
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

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

                    <div className="flex items-center justify-between bg-[#040410]/50 border border-slate-800/40 p-2.5 rounded-xl">
                      <span className="text-xs text-slate-300 font-sans">Research Projects</span>
                      <div className="flex items-center gap-1 font-mono">
                        <span className="text-[10px] text-slate-500 bg-slate-900 px-1 py-0.5 rounded border border-slate-800">Alt</span>
                        <span className="text-slate-600">+</span>
                        <span className="text-[10px] text-indigo-300 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-900 font-bold">5</span>
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

      {/* Global Command Palette / Search Overlay */}
      <AnimatePresence>
        {showCommandPalette && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 pb-4">
            {/* Dimmed backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCommandPalette(false)}
              className="fixed inset-0 bg-[#02020a]/80 backdrop-blur-md"
            />

            {/* Panel container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: -15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -15 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className={`relative w-full max-w-2xl border rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] overflow-hidden z-50 font-sans flex flex-col ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-800'
                  : 'bg-[#090924]/95 border-slate-800/80 text-slate-200'
              }`}
            >
              {/* Top ambient glow blobs in Dark mode */}
              {!isLight && (
                <>
                  <div className="absolute -top-32 -left-32 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
                </>
              )}

              {/* Header input block */}
              <div className={`flex items-center gap-4 px-6 py-4.5 border-b relative ${
                isLight ? 'border-slate-100 bg-slate-50/50' : 'border-slate-800/60 bg-[#06061c]/60'
              }`}>
                <Search className={`w-5 h-5 shrink-0 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
                <input
                  ref={paletteInputRef}
                  type="text"
                  value={paletteQuery}
                  onChange={(e) => setPaletteQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedPaletteIndex(prev => (prev + 1) % filteredItems.length);
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedPaletteIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (filteredItems[selectedPaletteIndex]) {
                        filteredItems[selectedPaletteIndex].action();
                        setShowCommandPalette(false);
                      }
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setShowCommandPalette(false);
                    }
                  }}
                  placeholder="Type a tab name, quick action, or category..."
                  className={`w-full bg-transparent border-0 p-0 text-sm font-sans focus:outline-none focus:ring-0 ${
                    isLight 
                      ? 'text-slate-900 placeholder-slate-400' 
                      : 'text-slate-100 placeholder-slate-500'
                  }`}
                />
                
                <div className="flex items-center gap-1.5 shrink-0 select-none">
                  <span className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded-md tracking-wider leading-none border ${
                    isLight 
                      ? 'bg-slate-100 text-slate-500 border-slate-200' 
                      : 'bg-slate-950/60 text-slate-400 border-slate-800'
                  }`}>
                    ESC
                  </span>
                </div>
              </div>

              {/* Items scroll list */}
              <div className="max-h-[50vh] overflow-y-auto p-2.5 flex flex-col gap-1 scrollbar-thin">
                {filteredItems.length === 0 ? (
                  <div className="py-12 text-center">
                    <AlertCircle className={`w-8 h-8 mx-auto mb-3 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
                    <p className={`text-xs font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>No matches found for "{paletteQuery}"</p>
                    <p className={`text-[10px] mt-1 ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>Try searching for "Search", "Crawler", "Graph", "Theme", etc.</p>
                  </div>
                ) : (
                  <>
                    {/* Render Navigation items */}
                    {filteredItems.some(i => i.type === 'tab') && (
                      <div className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        Navigation Tabs
                      </div>
                    )}
                    {filteredItems.filter(i => i.type === 'tab').map((item) => {
                      const absoluteIdx = filteredItems.indexOf(item);
                      const isSelected = absoluteIdx === selectedPaletteIndex;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            item.action();
                            setShowCommandPalette(false);
                          }}
                          onMouseEnter={() => setSelectedPaletteIndex(absoluteIdx)}
                          className={`w-full px-3.5 py-3 rounded-2xl border transition-all text-left flex items-center justify-between gap-4 cursor-pointer select-none ${
                            isSelected
                              ? isLight
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-950 shadow-xs'
                                : 'bg-indigo-500/10 border-indigo-500/30 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
                              : isLight
                                ? 'bg-transparent border-transparent hover:bg-slate-50 text-slate-700'
                                : 'bg-transparent border-transparent hover:bg-slate-900/50 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className={`p-2 rounded-xl border shrink-0 ${
                              isSelected
                                ? isLight
                                  ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                                  : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                                : isLight
                                  ? 'bg-slate-100 border-slate-200 text-slate-500'
                                  : 'bg-[#040412] border-slate-800 text-slate-400'
                            }`}>
                              {item.icon}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold leading-none tracking-tight">{item.title}</h4>
                              <p className={`text-[10px] mt-1 leading-snug truncate ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                                {item.description}
                              </p>
                            </div>
                          </div>
                          
                          {item.shortcut && (
                            <span className={`text-[10px] font-mono shrink-0 px-2 py-0.5 rounded border leading-none font-medium ${
                              isSelected
                                ? isLight
                                  ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                                  : 'bg-indigo-950/60 text-indigo-300 border-indigo-900/60'
                                : isLight
                                  ? 'bg-slate-100 text-slate-400 border-slate-200'
                                  : 'bg-slate-950/60 text-slate-500 border-slate-800'
                            }`}>
                              {item.shortcut}
                            </span>
                          )}
                        </button>
                      );
                    })}

                    {/* Render Quick Actions items */}
                    {filteredItems.some(i => i.type === 'action') && (
                      <div className={`px-3 py-1.5 mt-2.5 text-[9px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        Quick Commands
                      </div>
                    )}
                    {filteredItems.filter(i => i.type === 'action').map((item) => {
                      const absoluteIdx = filteredItems.indexOf(item);
                      const isSelected = absoluteIdx === selectedPaletteIndex;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            item.action();
                            setShowCommandPalette(false);
                          }}
                          onMouseEnter={() => setSelectedPaletteIndex(absoluteIdx)}
                          className={`w-full px-3.5 py-3 rounded-2xl border transition-all text-left flex items-center justify-between gap-4 cursor-pointer select-none ${
                            isSelected
                              ? isLight
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-950 shadow-xs'
                                : 'bg-indigo-500/10 border-indigo-500/30 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
                              : isLight
                                ? 'bg-transparent border-transparent hover:bg-slate-50 text-slate-700'
                                : 'bg-transparent border-transparent hover:bg-slate-900/50 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className={`p-2 rounded-xl border shrink-0 ${
                              isSelected
                                ? isLight
                                  ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                                  : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                                : isLight
                                  ? 'bg-slate-100 border-slate-200 text-slate-500'
                                  : 'bg-[#040412] border-slate-800 text-slate-400'
                            }`}>
                              {item.icon}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold leading-none tracking-tight">{item.title}</h4>
                              <p className={`text-[10px] mt-1 leading-snug truncate ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                                {item.description}
                              </p>
                            </div>
                          </div>
                          
                          {item.shortcut && (
                            <span className={`text-[10px] font-mono shrink-0 px-2 py-0.5 rounded border leading-none font-medium ${
                              isSelected
                                ? isLight
                                  ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                                  : 'bg-indigo-950/60 text-indigo-300 border-indigo-900/60'
                                : isLight
                                  ? 'bg-slate-100 text-slate-400 border-slate-200'
                                  : 'bg-slate-950/60 text-slate-500 border-slate-800'
                            }`}>
                              {item.shortcut}
                            </span>
                          )}
                        </button>
                      );
                    })}

                    {/* Render Saved Collections items */}
                    {filteredItems.some(i => i.type === 'collection') && (
                      <div className={`px-3 py-1.5 mt-2.5 text-[9px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        Search Collections
                      </div>
                    )}
                    {filteredItems.filter(i => i.type === 'collection').map((item) => {
                      const absoluteIdx = filteredItems.indexOf(item);
                      const isSelected = absoluteIdx === selectedPaletteIndex;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            item.action();
                            setShowCommandPalette(false);
                          }}
                          onMouseEnter={() => setSelectedPaletteIndex(absoluteIdx)}
                          className={`w-full px-3.5 py-3 rounded-2xl border transition-all text-left flex items-center justify-between gap-4 cursor-pointer select-none ${
                            isSelected
                              ? isLight
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-950 shadow-xs'
                                : 'bg-indigo-500/10 border-indigo-500/30 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
                              : isLight
                                ? 'bg-transparent border-transparent hover:bg-slate-50 text-slate-700'
                                : 'bg-transparent border-transparent hover:bg-slate-900/50 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className={`p-2 rounded-xl border shrink-0 ${
                              isSelected
                                ? isLight
                                  ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                                  : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                                : isLight
                                  ? 'bg-slate-100 border-slate-200 text-slate-500'
                                  : 'bg-[#040412] border-slate-800 text-slate-400'
                            }`}>
                              {item.icon}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold leading-none tracking-tight">{item.title}</h4>
                              <p className={`text-[10px] mt-1 leading-snug truncate ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                                {item.description}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Footer status bar */}
              <div className={`px-6 py-3.5 border-t text-[10px] font-mono flex items-center justify-between select-none ${
                isLight ? 'border-slate-100 bg-slate-50/50 text-slate-400' : 'border-slate-800/40 bg-slate-950/20 text-slate-500'
              }`}>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className={`px-1 py-0.5 rounded leading-none border ${isLight ? 'bg-white border-slate-200' : 'bg-[#040410] border-slate-800'}`}>↑↓</span> Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <span className={`px-1 py-0.5 rounded leading-none border ${isLight ? 'bg-white border-slate-200' : 'bg-[#040410] border-slate-800'}`}>↵</span> Select
                  </span>
                </div>
                <div>
                  {filteredItems.length} matching commands
                </div>
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
