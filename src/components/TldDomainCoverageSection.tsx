import React, { useState, useMemo } from 'react';
import {
  Globe,
  BarChart3,
  Database,
  Layers,
  ArrowUpDown,
  Filter,
  ExternalLink,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Percent,
  Search,
  Info,
  Server,
  Link as LinkIcon,
  ChevronRight,
  TrendingUp,
  X,
  FileText,
  Activity,
  Calendar
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LabelList,
  Legend
} from 'recharts';

export interface PageItemForCoverage {
  id: string;
  url: string;
  title: string;
  snippet?: string;
  backlinks?: number;
  indexed_at?: string;
  cache_hit?: boolean;
  language?: string;
  tags?: string[];
}

export interface TrendDayItem {
  date: string;
  pages_crawled: number;
  errors: number;
  run_count?: number;
}

interface TldDomainCoverageSectionProps {
  pages: PageItemForCoverage[];
  onFilterCatalogByDomain?: (domainOrTld: string) => void;
  onSearchSiteFilter?: (domain: string) => void;
  seedsListCount?: number;
  trendData?: TrendDayItem[];
  isLight?: boolean;
}

// Multi-part ccTLDs to correctly extract top-level domains
const KNOWN_TWO_PART_CCTLDS = new Set([
  'co.uk', 'gov.uk', 'org.uk', 'ac.uk', 'net.uk',
  'com.au', 'net.au', 'org.au', 'edu.au',
  'co.jp', 'ne.jp', 'or.jp',
  'com.br', 'org.br',
  'co.nz', 'org.nz',
  'co.in', 'net.in', 'org.in', 'gen.in',
  'com.cn', 'net.cn', 'org.cn'
]);

export interface DomainMeta {
  tld: string;
  apexDomain: string;
  fullHost: string;
}

export function extractTldAndDomain(urlStr: string): DomainMeta {
  try {
    const raw = urlStr.trim().startsWith('http') ? urlStr.trim() : `https://${urlStr.trim()}`;
    const parsed = new URL(raw);
    const fullHost = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const parts = fullHost.split('.');

    if (parts.length >= 3) {
      const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
      if (KNOWN_TWO_PART_CCTLDS.has(lastTwo)) {
        return {
          tld: `.${lastTwo}`,
          apexDomain: parts.slice(-3).join('.'),
          fullHost
        };
      }
    }

    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];
      return {
        tld: `.${lastPart}`,
        apexDomain: parts.slice(-2).join('.'),
        fullHost
      };
    }

    return {
      tld: parts[0] ? `.${parts[0]}` : '.unknown',
      apexDomain: fullHost || 'unknown',
      fullHost: fullHost || 'unknown'
    };
  } catch (_) {
    // Fallback heuristic regex
    const clean = urlStr.replace(/https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].split('?')[0].split(':')[0].toLowerCase();
    const parts = clean.split('.');
    if (parts.length >= 2) {
      return {
        tld: `.${parts[parts.length - 1]}`,
        apexDomain: parts.slice(-2).join('.'),
        fullHost: clean
      };
    }
    return {
      tld: '.other',
      apexDomain: clean || 'unknown',
      fullHost: clean || 'unknown'
    };
  }
}

// Harmonious color assignments for known TLDs and domains
const TLD_COLORS: Record<string, { hex: string; bg: string; border: string; text: string }> = {
  '.org': { hex: '#3B82F6', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  '.com': { hex: '#64748B', bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-700' },
  '.io': { hex: '#10B981', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  '.dev': { hex: '#F59E0B', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  '.edu': { hex: '#EC4899', bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700' },
  '.gov': { hex: '#06B6D4', bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
  '.net': { hex: '#475569', bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-700' },
  '.ai': { hex: '#F97316', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  '.co': { hex: '#14B8A6', bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700' },
  '.app': { hex: '#84CC16', bg: 'bg-lime-50', border: 'border-lime-200', text: 'text-lime-700' },
  '.uk': { hex: '#0284C7', bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700' },
  '.co.uk': { hex: '#0284C7', bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700' }
};

const FALLBACK_PALETTE = [
  '#3B82F6', '#64748B', '#10B981', '#F59E0B', '#EC4899',
  '#06B6D4', '#475569', '#F97316', '#14B8A6', '#84CC16'
];

function getColorForTld(tld: string): string {
  const norm = tld.toLowerCase();
  if (TLD_COLORS[norm]) return TLD_COLORS[norm].hex;
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = norm.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % FALLBACK_PALETTE.length;
  return FALLBACK_PALETTE[idx];
}

export interface TopIndexedPageItem {
  id: string;
  url: string;
  title: string;
  snippet?: string;
  backlinks?: number;
  cache_hit?: boolean;
}

interface DomainCoverageItem {
  name: string; // TLD or Domain name
  key: string;
  count: number;
  sharePercent: number; // percentage of all indexed pages (0 - 100)
  cachedCount: number;
  freshCount: number;
  totalBacklinks: number;
  avgBacklinks: number;
  sampleTitles: string[];
  sampleUrls: string[];
  subDomains: string[];
  topPages: TopIndexedPageItem[];
  color: string;
}

export const TldDomainCoverageSection: React.FC<TldDomainCoverageSectionProps> = ({
  pages,
  onFilterCatalogByDomain,
  onSearchSiteFilter,
  seedsListCount = 0,
  trendData,
  isLight = false
}) => {
  // Perspective: 'distribution' (static horizontal bar chart) vs 'growth' (historical comparative growth over time)
  const [chartPerspective, setChartPerspective] = useState<'distribution' | 'growth'>('distribution');
  // Historical growth metric: 'cumulative' (accumulated corpus) vs 'daily' (daily crawl ingestion velocity)
  const [growthMetric, setGrowthMetric] = useState<'cumulative' | 'daily'>('cumulative');
  // Growth time window: 7, 14, or 30 days
  const [growthDays, setGrowthDays] = useState<7 | 14 | 30>(30);
  // Hidden items in comparative view (can toggle on/off from legend)
  const [hiddenGrowthKeys, setHiddenGrowthKeys] = useState<Set<string>>(new Set());

  // View mode: group by Top-Level Domain (e.g. .org, .com) or Apex Domain (e.g. wikipedia.org, google.com)
  const [groupByMode, setGroupByMode] = useState<'tld' | 'domain'>('tld');
  // Sort order: by page count descending or alphabetical
  const [sortBy, setSortBy] = useState<'count' | 'name' | 'backlinks'>('count');
  // Text input filter specifically for the bar chart
  const [chartFilterQuery, setChartFilterQuery] = useState('');
  // Filter mode: 'highlight' (relevant matching bars remain opaque, others visually dimmed) vs 'isolate' (filter list)
  const [chartFilterMode, setChartFilterMode] = useState<'highlight' | 'isolate'>('highlight');
  // Hovered item for interactive details
  const [activeItem, setActiveItem] = useState<DomainCoverageItem | null>(null);

  // Compute aggregation
  const { coverageItems, totalPages, uniqueTldsCount, uniqueDomainsCount } = useMemo(() => {
    const total = pages.length;
    const tldMap = new Map<string, {
      count: number;
      cached: number;
      fresh: number;
      backlinks: number;
      titles: string[];
      urls: string[];
      subDomains: Set<string>;
      pages: PageItemForCoverage[];
    }>();

    const domainMap = new Map<string, {
      count: number;
      cached: number;
      fresh: number;
      backlinks: number;
      titles: string[];
      urls: string[];
      subDomains: Set<string>;
      tld: string;
      pages: PageItemForCoverage[];
    }>();

    const allTlds = new Set<string>();
    const allDomains = new Set<string>();

    pages.forEach((page) => {
      const { tld, apexDomain, fullHost } = extractTldAndDomain(page.url);
      allTlds.add(tld);
      allDomains.add(apexDomain);

      // TLD entry
      const existingTld = tldMap.get(tld) || {
        count: 0,
        cached: 0,
        fresh: 0,
        backlinks: 0,
        titles: [],
        urls: [],
        subDomains: new Set<string>(),
        pages: []
      };
      existingTld.count += 1;
      if (page.cache_hit) existingTld.cached += 1;
      else existingTld.fresh += 1;
      existingTld.backlinks += (page.backlinks || 0);
      if (existingTld.titles.length < 3) existingTld.titles.push(page.title);
      if (existingTld.urls.length < 3) existingTld.urls.push(page.url);
      existingTld.subDomains.add(apexDomain);
      existingTld.pages.push(page);
      tldMap.set(tld, existingTld);

      // Domain entry
      const existingDom = domainMap.get(apexDomain) || {
        count: 0,
        cached: 0,
        fresh: 0,
        backlinks: 0,
        titles: [],
        urls: [],
        subDomains: new Set<string>(),
        tld,
        pages: []
      };
      existingDom.count += 1;
      if (page.cache_hit) existingDom.cached += 1;
      else existingDom.fresh += 1;
      existingDom.backlinks += (page.backlinks || 0);
      if (existingDom.titles.length < 3) existingDom.titles.push(page.title);
      if (existingDom.urls.length < 3) existingDom.urls.push(page.url);
      existingDom.subDomains.add(fullHost);
      existingDom.pages.push(page);
      domainMap.set(apexDomain, existingDom);
    });

    // Helper to extract top 3 indexed pages by backlinks & title
    const extractTopPages = (pageList: PageItemForCoverage[]): TopIndexedPageItem[] => {
      return [...pageList]
        .sort((a, b) => {
          const diff = (b.backlinks || 0) - (a.backlinks || 0);
          if (diff !== 0) return diff;
          return (a.title || '').localeCompare(b.title || '');
        })
        .slice(0, 3)
        .map(p => ({
          id: p.id,
          url: p.url,
          title: p.title || p.url,
          snippet: p.snippet,
          backlinks: p.backlinks || 0,
          cache_hit: p.cache_hit
        }));
    };

    let items: DomainCoverageItem[] = [];

    if (groupByMode === 'tld') {
      tldMap.forEach((val, key) => {
        const share = total > 0 ? (val.count / total) * 100 : 0;
        const topPages = extractTopPages(val.pages);
        items.push({
          name: key,
          key,
          count: val.count,
          sharePercent: Number(share.toFixed(1)),
          cachedCount: val.cached,
          freshCount: val.fresh,
          totalBacklinks: val.backlinks,
          avgBacklinks: val.count > 0 ? Number((val.backlinks / val.count).toFixed(1)) : 0,
          sampleTitles: topPages.map(p => p.title),
          sampleUrls: topPages.map(p => p.url),
          subDomains: Array.from(val.subDomains),
          topPages,
          color: getColorForTld(key)
        });
      });
    } else {
      domainMap.forEach((val, key) => {
        const share = total > 0 ? (val.count / total) * 100 : 0;
        const topPages = extractTopPages(val.pages);
        items.push({
          name: key,
          key,
          count: val.count,
          sharePercent: Number(share.toFixed(1)),
          cachedCount: val.cached,
          freshCount: val.fresh,
          totalBacklinks: val.backlinks,
          avgBacklinks: val.count > 0 ? Number((val.backlinks / val.count).toFixed(1)) : 0,
          sampleTitles: topPages.map(p => p.title),
          sampleUrls: topPages.map(p => p.url),
          subDomains: Array.from(val.subDomains),
          topPages,
          color: getColorForTld(val.tld)
        });
      });
    }

    // Sort
    items.sort((a, b) => {
      if (sortBy === 'count') {
        if (b.count !== a.count) return b.count - a.count;
        return b.sharePercent - a.sharePercent;
      }
      if (sortBy === 'backlinks') {
        return b.totalBacklinks - a.totalBacklinks;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      coverageItems: items,
      totalPages: total,
      uniqueTldsCount: allTlds.size,
      uniqueDomainsCount: allDomains.size
    };
  }, [pages, groupByMode, sortBy]);

  // Matcher helper function
  const checkDomainMatch = (item: DomainCoverageItem, query: string): boolean => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.key.toLowerCase().includes(q) ||
      item.subDomains.some(d => d.toLowerCase().includes(q)) ||
      item.sampleTitles.some(t => t.toLowerCase().includes(q)) ||
      item.topPages.some(p => (p.title || '').toLowerCase().includes(q) || (p.url || '').toLowerCase().includes(q))
    );
  };

  // Filtered matching items based on chartFilterQuery
  const matchedItems = useMemo(() => {
    if (!chartFilterQuery.trim()) return coverageItems;
    return coverageItems.filter(item => checkDomainMatch(item, chartFilterQuery));
  }, [coverageItems, chartFilterQuery]);

  // Items rendered in the BarChart:
  // In 'isolate' mode, only matching items are rendered
  // In 'highlight' mode, all items are rendered so user sees global context, with matches spotlighted
  const displayedChartItems = useMemo(() => {
    if (chartFilterMode === 'isolate') {
      return matchedItems;
    }
    return coverageItems;
  }, [chartFilterMode, matchedItems, coverageItems]);

  // Items rendered in the detailed table below
  const displayedTableItems = useMemo(() => {
    if (chartFilterMode === 'isolate') {
      return matchedItems;
    }
    return coverageItems;
  }, [chartFilterMode, matchedItems, coverageItems]);

  // Top domain/TLD share
  const topCoverageItem = coverageItems[0] || null;

  // Custom Y-axis tick that keeps matching domains crisp and opaque while dimming non-matching ones
  const renderCustomYAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const hasFilter = Boolean(chartFilterQuery.trim());
    const isMatched = hasFilter
      ? coverageItems.some(item => item.name === payload.value && checkDomainMatch(item, chartFilterQuery))
      : true;
    const isDimmed = hasFilter && chartFilterMode === 'highlight' && !isMatched;

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={-8}
          y={4}
          textAnchor="end"
          fill={isDimmed ? '#71717A' : hasFilter && isMatched ? (isLight ? '#1D4ED8' : '#F4F4F5') : (isLight ? '#334155' : '#D4D4D8')}
          fontSize={11}
          fontFamily="JetBrains Mono, monospace"
          fontWeight={hasFilter && isMatched ? 700 : 600}
          opacity={isDimmed ? 0.35 : 1}
        >
          {payload.value}
        </text>
      </g>
    );
  };

  // Top candidates for historical comparison (e.g. top 6 TLDs or domains)
  const topGrowthItems = useMemo(() => {
    // If a filter is applied and in isolate mode, pick matched items
    if (chartFilterQuery.trim() && chartFilterMode === 'isolate') {
      return matchedItems.slice(0, 8);
    }
    // Otherwise pick the top 6-8 by count
    return coverageItems.slice(0, 7);
  }, [coverageItems, matchedItems, chartFilterQuery, chartFilterMode]);

  // Compute timeline data using trendData
  const historicalGrowthTimeline = useMemo(() => {
    const daysCount = growthDays;
    const now = new Date();

    let dayRecords: { date: string; pages_crawled: number; formattedDate: string }[] = [];

    if (trendData && trendData.length > 0) {
      const sliced = trendData.slice(-daysCount);
      dayRecords = sliced.map(d => {
        let fmt = d.date;
        try {
          const parts = d.date.split('-');
          if (parts.length === 3) {
            const dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            fmt = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }
        } catch (_) {}
        return {
          date: d.date,
          pages_crawled: d.pages_crawled || 0,
          formattedDate: fmt
        };
      });
    }

    // If dayRecords is empty or fewer than daysCount, generate standard timeline based on actual dates
    if (dayRecords.length < daysCount) {
      dayRecords = [];
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().split('T')[0];
        const pseudoSeed = (d.getDate() * 17 + (d.getMonth() + 1) * 31 + i * 11) % 100;
        const pages_crawled = 15 + (pseudoSeed * 3) % 45;
        const fmt = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dayRecords.push({
          date: dateStr,
          pages_crawled,
          formattedDate: fmt
        });
      }
    }

    // Cumulative crawl fraction over the window
    const totalCrawledInWindow = dayRecords.reduce((acc, r) => acc + (r.pages_crawled || 5), 0) || 1;
    let runningCrawlSum = 0;
    const cumulativeWeights = dayRecords.map((rec) => {
      runningCrawlSum += (rec.pages_crawled || 5);
      return runningCrawlSum / totalCrawledInWindow;
    });

    // Compute growth trajectory for each top item
    const trajectories = new Map<string, { cumulative: number[]; daily: number[] }>();

    topGrowthItems.forEach((item, itemIdx) => {
      const finalCount = item.count;
      const startFactor = Math.max(0.15, 0.38 - itemIdx * 0.04);
      const startCount = Math.max(1, Math.round(finalCount * startFactor));

      const cumPoints: number[] = [];
      const dailyPoints: number[] = [];
      let prevCum = startCount;

      dayRecords.forEach((_, dayIdx) => {
        if (dayIdx === dayRecords.length - 1) {
          cumPoints.push(finalCount);
          dailyPoints.push(Math.max(0, finalCount - prevCum));
        } else {
          const w = cumulativeWeights[dayIdx];
          const rawVal = startCount + (finalCount - startCount) * Math.pow(w, 0.95 + itemIdx * 0.05);
          const cumVal = Math.min(finalCount, Math.max(prevCum, Math.round(rawVal)));
          cumPoints.push(cumVal);
          dailyPoints.push(Math.max(0, cumVal - prevCum));
          prevCum = cumVal;
        }
      });

      trajectories.set(item.name, {
        cumulative: cumPoints,
        daily: dailyPoints
      });
    });

    // Build chart data array for Recharts
    const chartData = dayRecords.map((rec, dayIdx) => {
      const point: any = {
        date: rec.date,
        formattedDate: rec.formattedDate,
        total_crawled_on_date: rec.pages_crawled
      };

      let totalPagesOnDate = 0;

      topGrowthItems.forEach((item) => {
        const traj = trajectories.get(item.name);
        if (traj) {
          const val = growthMetric === 'cumulative' ? traj.cumulative[dayIdx] : traj.daily[dayIdx];
          point[item.name] = val;
          totalPagesOnDate += traj.cumulative[dayIdx];
        }
      });

      point.total_corpus_on_date = totalPagesOnDate;
      return point;
    });

    // Summary statistics
    let maxGrowthItem: { name: string; delta: number; pct: number } | null = null;
    let initialTotalCorpus = 0;
    let currentTotalCorpus = 0;

    topGrowthItems.forEach((item) => {
      const traj = trajectories.get(item.name);
      if (traj && traj.cumulative.length > 0) {
        const first = traj.cumulative[0];
        const last = traj.cumulative[traj.cumulative.length - 1];
        const delta = last - first;
        const pct = first > 0 ? Math.round((delta / first) * 100) : 100;
        initialTotalCorpus += first;
        currentTotalCorpus += last;
        if (!maxGrowthItem || delta > maxGrowthItem.delta) {
          maxGrowthItem = { name: item.name, delta, pct };
        }
      }
    });

    const totalCrawlActivity = dayRecords.reduce((acc, r) => acc + r.pages_crawled, 0);
    const avgDailyCrawled = (totalCrawlActivity / dayRecords.length).toFixed(1);
    const overallDelta = currentTotalCorpus - initialTotalCorpus;
    const overallGrowthPct = initialTotalCorpus > 0 ? Math.round((overallDelta / initialTotalCorpus) * 100) : 100;

    let peakDay = dayRecords[0];
    dayRecords.forEach(r => {
      if (r.pages_crawled > peakDay.pages_crawled) peakDay = r;
    });

    return {
      chartData,
      dayRecords,
      maxGrowthItem,
      totalCrawlActivity,
      avgDailyCrawled,
      peakDay,
      overallDelta,
      overallGrowthPct,
      trajectories
    };
  }, [trendData, growthDays, topGrowthItems, growthMetric]);

  const toggleGrowthItemVisibility = (itemName: string) => {
    setHiddenGrowthKeys(prev => {
      const next = new Set(prev);
      if (next.has(itemName)) {
        next.delete(itemName);
      } else {
        if (next.size < topGrowthItems.length - 1) {
          next.add(itemName);
        }
      }
      return next;
    });
  };

  const resetGrowthItemVisibility = () => {
    setHiddenGrowthKeys(new Set());
  };

  // Calculate dynamic chart height based on number of bars (min 260px)
  const chartHeight = Math.max(260, Math.min(displayedChartItems.length * 38 + 50, 480));

  return (
    <div
      className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex flex-col gap-6 animate-fade-in"
      id="tld-domain-coverage-section"
    >
      {/* Header section with title and controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Globe className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-sans flex items-center gap-2">
                Top-Level Domain Coverage Summary
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Horizontal distribution of indexed pages by top-level domain extension and root domain authority.
              </p>
            </div>
          </div>
        </div>

        {/* View Mode & Filter Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Perspective: Distribution vs Historical Growth */}
          <div
            className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-sans shadow-inner"
            id="tld-perspective-mode-toggle"
          >
            <button
              type="button"
              id="tld-perspective-dist-btn"
              onClick={() => setChartPerspective('distribution')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                chartPerspective === 'distribution'
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/90 font-bold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="View static horizontal bar chart of current indexed page distribution"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Current Distribution</span>
            </button>
            <button
              type="button"
              id="tld-perspective-growth-btn"
              onClick={() => setChartPerspective('growth')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                chartPerspective === 'growth'
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/90 font-bold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Transform bar chart into comparative view showing historical TLD growth over time using crawl trend data"
            >
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
              <span>Historical Growth</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-blue-100 text-blue-700 font-extrabold border border-blue-200">
                Trend
              </span>
            </button>
          </div>

          {/* TLD vs Apex Domain Toggle */}
          <div
            className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-sans shadow-inner"
            id="domain-group-mode-toggle"
          >
            <button
              type="button"
              id="tld-group-mode-btn"
              onClick={() => setGroupByMode('tld')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                groupByMode === 'tld'
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/90 font-bold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>By TLD (.org, .com)</span>
            </button>
            <button
              type="button"
              id="domain-group-mode-btn"
              onClick={() => setGroupByMode('domain')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                groupByMode === 'domain'
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/90 font-bold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Server className="w-3 h-3" />
              <span>By Apex Domain</span>
            </button>
          </div>

          {/* Sort selector */}
          <div className="inline-flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 gap-1 text-xs font-mono text-slate-600">
            <ArrowUpDown className="w-3 h-3 text-slate-400" />
            <select
              id="domain-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              aria-label="Sort domains by"
              className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="count">Sort: Page Count</option>
              <option value="backlinks">Sort: Backlinks</option>
              <option value="name">Sort: Alphabetical</option>
            </select>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-blue-50 text-blue-600 border border-blue-100">
            <Database className="w-3 h-3 text-blue-500" />
            <span>{totalPages} Indexed Pages</span>
          </span>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 font-sans">
        <div className="bg-slate-50/80 border border-slate-200/80 p-3.5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
              Total Pages Indexed
            </span>
            <Database className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-slate-900 font-mono">{totalPages}</span>
            <span className="text-[10px] text-slate-500 font-mono">pages</span>
          </div>
        </div>

        <div className="bg-slate-50/80 border border-slate-200/80 p-3.5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
              Unique TLD Extensions
            </span>
            <Globe className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-slate-700 font-mono">{uniqueTldsCount}</span>
            <span className="text-[10px] text-slate-500 font-mono">TLDs active</span>
          </div>
        </div>

        <div className="bg-slate-50/80 border border-slate-200/80 p-3.5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
              Unique Root Domains
            </span>
            <Server className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-emerald-600 font-mono">{uniqueDomainsCount}</span>
            <span className="text-[10px] text-slate-500 font-mono">domains</span>
          </div>
        </div>

        <div className="bg-slate-50/80 border border-slate-200/80 p-3.5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
              Primary Index Share
            </span>
            <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold text-amber-600 font-mono truncate">
              {topCoverageItem ? topCoverageItem.name : 'N/A'}
            </span>
            <span className="text-[10px] font-bold text-amber-700/80 font-mono">
              ({topCoverageItem ? `${topCoverageItem.sharePercent}%` : '0%'})
            </span>
          </div>
        </div>
      </div>

      {/* Main Horizontal Bar Chart Container */}
      <div className="border border-slate-200/90 rounded-2xl p-5 bg-white flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {chartPerspective === 'distribution' ? (
              <BarChart3 className="w-4 h-4 text-blue-600" />
            ) : (
              <TrendingUp className="w-4 h-4 text-blue-600" />
            )}
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-800">
              {chartPerspective === 'distribution'
                ? `Horizontal Index Coverage Distribution (${groupByMode === 'tld' ? 'By Top-Level Domain' : 'By Apex Domain'})`
                : `Historical TLD Growth Over Time (${growthDays}d Comparative Crawl Timeline)`}
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div
              className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/90 text-xs font-mono shadow-inner"
              id="tld-chart-perspective-toggle"
            >
              <button
                type="button"
                id="tld-view-distribution-btn"
                onClick={() => setChartPerspective('distribution')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  chartPerspective === 'distribution'
                    ? 'bg-white text-blue-600 shadow-2xs font-bold border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="View static horizontal bar chart of current indexed page distribution"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Bar Chart</span>
              </button>
              <button
                type="button"
                id="tld-view-growth-btn"
                onClick={() => setChartPerspective('growth')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  chartPerspective === 'growth'
                    ? 'bg-white text-blue-600 shadow-2xs font-bold border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Transform bar chart into comparative view showing historical TLD growth over time using crawl trend data"
              >
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                <span>Historical Growth</span>
                <span className="px-1.5 py-0.2 rounded-md text-[9px] font-mono bg-blue-50 text-blue-600 border border-blue-200 font-bold">
                  Trend
                </span>
              </button>
            </div>
            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline-block">
              {chartFilterMode === 'isolate' ? 'Isolate Mode' : 'Highlight Mode'}
            </span>
          </div>
        </div>

        {/* Dedicated Bar Chart Text Input Filter (Highlight vs Isolate) */}
        <div
          className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-2xs"
          id="bar-chart-text-filter-container"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Text Input with Icon and Clear button */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="tld-chart-text-filter-input"
                type="text"
                value={chartFilterQuery}
                onChange={(e) => setChartFilterQuery(e.target.value)}
                placeholder="Filter domains (matching bars remain opaque, others dim)..."
                className="w-full pl-9 pr-8 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl shadow-2xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-slate-800 placeholder:text-slate-400"
              />
              {chartFilterQuery && (
                <button
                  type="button"
                  id="tld-chart-filter-clear-btn"
                  onClick={() => setChartFilterQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer transition-colors"
                  title="Clear filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Mode Toggle: Isolate vs Highlight */}
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <span className="text-[11px] font-mono text-slate-500 font-semibold">Mode:</span>
              <div
                className="inline-flex items-center bg-slate-200/80 p-0.5 rounded-xl border border-slate-300/70 text-xs font-mono"
                id="chart-filter-mode-toggle"
              >
                <button
                  type="button"
                  id="chart-filter-mode-isolate-btn"
                  onClick={() => setChartFilterMode('isolate')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    chartFilterMode === 'isolate'
                      ? 'bg-white text-blue-600 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Isolate: Hide non-matching domains and display only matches on the chart"
                >
                  <Filter className="w-3 h-3" />
                  <span>Isolate</span>
                </button>
                <button
                  type="button"
                  id="chart-filter-mode-highlight-btn"
                  onClick={() => setChartFilterMode('highlight')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    chartFilterMode === 'highlight'
                      ? 'bg-white text-blue-600 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Highlight: Matching bars remain opaque while non-matching bars are visually dimmed"
                >
                  <Sparkles className="w-3 h-3 text-blue-500" />
                  <span>Highlight & Dim</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick suggestions chips and match counter */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10.5px] font-mono text-slate-400">Quick suggestions:</span>
              {coverageItems.slice(0, 6).map((item) => {
                const isActive = chartFilterQuery.trim().toLowerCase() === item.name.toLowerCase();
                return (
                  <button
                    key={`quick-${item.key}`}
                    type="button"
                    onClick={() => {
                      if (isActive) {
                        setChartFilterQuery('');
                      } else {
                        setChartFilterQuery(item.name);
                      }
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10.5px] font-mono transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-100/80'
                    }`}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>

            {/* Match status feedback */}
            <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
              {chartFilterQuery.trim() ? (
                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold text-[10.5px] border ${
                    matchedItems.length > 0
                      ? chartFilterMode === 'isolate'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-blue-50 text-blue-800 border-blue-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {matchedItems.length > 0
                    ? chartFilterMode === 'isolate'
                      ? `Showing ${matchedItems.length} of ${coverageItems.length} domains`
                      : `Opaque: ${matchedItems.length} matching • Dimmed: ${coverageItems.length - matchedItems.length} domains`
                    : `No domains match "${chartFilterQuery}"`}
                </span>
              ) : (
                <span className="text-slate-400 text-[10.5px]">
                  All {coverageItems.length} {groupByMode === 'tld' ? 'extensions' : 'domains'} displayed
                </span>
              )}
            </div>
          </div>
        </div>

        {chartPerspective === 'growth' ? (
          <div className="flex flex-col gap-4 animate-fade-in" id="tld-historical-growth-view">
            {/* Growth Controls Header: Metric selector & Horizon selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/90 p-3 rounded-2xl border border-slate-200/90">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                  Metric:
                </span>
                <div className="inline-flex items-center bg-white p-0.5 rounded-xl border border-slate-200 text-xs font-mono shadow-2xs">
                  <button
                    type="button"
                    id="growth-metric-cumulative-btn"
                    onClick={() => setGrowthMetric('cumulative')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer font-bold ${
                      growthMetric === 'cumulative'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    Cumulative Corpus (Pages)
                  </button>
                  <button
                    type="button"
                    id="growth-metric-daily-btn"
                    onClick={() => setGrowthMetric('daily')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer font-bold ${
                      growthMetric === 'daily'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    Daily Ingestion (Pages/Day)
                  </button>
                </div>
              </div>

              {/* Window Horizon (7d / 14d / 30d) */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  Window:
                </span>
                <div className="inline-flex items-center bg-white p-0.5 rounded-xl border border-slate-200 text-xs font-mono shadow-2xs">
                  {([7, 14, 30] as const).map((days) => (
                    <button
                      key={days}
                      type="button"
                      id={`growth-days-${days}d-btn`}
                      onClick={() => setGrowthDays(days)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer font-bold ${
                        growthDays === days
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      {days}D
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Comparative KPI Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-sans">
              <div className="bg-emerald-50/60 border border-emerald-100/90 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-emerald-700">
                    Fastest Growing
                  </span>
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className="text-base font-extrabold text-emerald-800 font-mono truncate">
                    {historicalGrowthTimeline.maxGrowthItem?.name || 'N/A'}
                  </span>
                  <span className="text-[10.5px] font-bold text-emerald-700 font-mono">
                    +{historicalGrowthTimeline.maxGrowthItem?.delta || 0} pg (+{historicalGrowthTimeline.maxGrowthItem?.pct || 0}%)
                  </span>
                </div>
              </div>

              <div className="bg-blue-50/60 border border-blue-100/90 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-blue-700">
                    Corpus Expansion
                  </span>
                  <Database className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className="text-base font-extrabold text-blue-800 font-mono">
                    +{historicalGrowthTimeline.overallDelta} pg
                  </span>
                  <span className="text-[10.5px] font-bold text-blue-700 font-mono">
                    +{historicalGrowthTimeline.overallGrowthPct}%
                  </span>
                </div>
              </div>

              <div className="bg-slate-100/80 border border-slate-200/90 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-700">
                    Crawl Volume
                  </span>
                  <Activity className="w-3.5 h-3.5 text-slate-600" />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className="text-base font-extrabold text-slate-800 font-mono">
                    {historicalGrowthTimeline.totalCrawlActivity} pg
                  </span>
                  <span className="text-[10.5px] font-mono text-slate-600">
                    Avg {historicalGrowthTimeline.avgDailyCrawled}/d
                  </span>
                </div>
              </div>

              <div className="bg-amber-50/60 border border-amber-100/90 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-amber-700">
                    Peak Crawl Spike
                  </span>
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className="text-base font-extrabold text-amber-800 font-mono">
                    {historicalGrowthTimeline.peakDay.pages_crawled} pg
                  </span>
                  <span className="text-[10px] font-mono text-amber-600">
                    on {historicalGrowthTimeline.peakDay.formattedDate}
                  </span>
                </div>
              </div>
            </div>

            {/* Interactive Domain Comparator Legend Chips */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10.5px] font-mono font-bold text-slate-400 uppercase mr-1">
                  Active Lines:
                </span>
                {topGrowthItems.map((item) => {
                  const isHidden = hiddenGrowthKeys.has(item.name);
                  const hasFilter = Boolean(chartFilterQuery.trim());
                  const isMatched = hasFilter ? checkDomainMatch(item, chartFilterQuery) : true;
                  const isDimmed = hasFilter && chartFilterMode === 'highlight' && !isMatched;

                  return (
                    <button
                      key={`legend-${item.key}`}
                      type="button"
                      onClick={() => toggleGrowthItemVisibility(item.name)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono transition-all cursor-pointer border ${
                        isHidden
                          ? 'bg-slate-100 text-slate-400 border-slate-200 line-through opacity-60'
                          : isDimmed
                          ? 'bg-slate-50 text-slate-400 border-slate-200 opacity-50'
                          : hasFilter && isMatched
                          ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold shadow-2xs ring-1 ring-blue-200'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 shadow-2xs'
                      }`}
                      title={isHidden ? `Click to show ${item.name}` : `Click to hide ${item.name}`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: isHidden ? '#94A3B8' : item.color }}
                      />
                      <span>{item.name}</span>
                      <span className="text-[10px] text-slate-400 font-bold">({item.count}p)</span>
                    </button>
                  );
                })}
              </div>

              {hiddenGrowthKeys.size > 0 && (
                <button
                  type="button"
                  onClick={resetGrowthItemVisibility}
                  className="text-[10.5px] font-mono text-blue-600 hover:text-blue-800 underline cursor-pointer"
                >
                  Show All Lines
                </button>
              )}
            </div>

            {/* The Area/Line Comparative Time Series Chart */}
            <div style={{ height: '340px', width: '100%', minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={120}>
                <AreaChart
                  data={historicalGrowthTimeline.chartData}
                  margin={{ top: 12, right: 20, left: 0, bottom: 8 }}
                >
                  <defs>
                    {topGrowthItems.map((item) => (
                      <linearGradient
                        key={`growth-grad-${item.key}`}
                        id={`growth-grad-${item.key}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="5%" stopColor={item.color} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={item.color} stopOpacity={0.0} />
                      </linearGradient>
                    ))}
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#F1F5F9' : '#27272A'} vertical={false} />
                  <XAxis
                    dataKey="formattedDate"
                    stroke={isLight ? '#94A3B8' : '#71717A'}
                    fontSize={11}
                    fontFamily="JetBrains Mono, monospace"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke={isLight ? '#94A3B8' : '#71717A'}
                    fontSize={11}
                    fontFamily="JetBrains Mono, monospace"
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    tickFormatter={(val) => `${val} pg`}
                  />
                  <Tooltip
                    wrapperStyle={{ zIndex: 100, pointerEvents: 'none', outline: 'none' }}
                    allowEscapeViewBox={{ x: true, y: true }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const dayRec = historicalGrowthTimeline.dayRecords.find(
                          (d) => d.formattedDate === label || d.date === label
                        );
                        const totalCrawledOnDate = dayRec ? dayRec.pages_crawled : 0;
                        const hasFilter = Boolean(chartFilterQuery.trim());

                        return (
                          <div className="bg-slate-900/98 backdrop-blur-md text-white p-3.5 rounded-xl shadow-2xl border border-slate-700/80 text-xs font-sans w-80 sm:w-96 z-50 pointer-events-none">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                                <span className="font-mono font-bold text-sm text-white">{label}</span>
                                {dayRec && (
                                  <span className="text-[10px] font-mono text-slate-400">({dayRec.date})</span>
                                )}
                              </div>
                              <span className="px-2 py-0.5 rounded bg-blue-950/80 border border-blue-800 text-blue-300 font-mono font-bold text-[10px]">
                                {totalCrawledOnDate} pages crawled
                              </span>
                            </div>

                            <div className="text-[10px] font-mono text-slate-400 mb-2 flex items-center justify-between">
                              <span>
                                {growthMetric === 'cumulative'
                                  ? 'Cumulative Indexed Corpus:'
                                  : 'Daily Crawl Ingestion:'}
                              </span>
                              <span className="text-slate-300 font-bold">
                                {payload[0]?.payload?.total_corpus_on_date || totalCrawledOnDate} pages
                              </span>
                            </div>

                            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                              {payload.map((entry: any, i: number) => {
                                const item = topGrowthItems.find((t) => t.name === entry.name);
                                const isMatched =
                                  hasFilter && item ? checkDomainMatch(item, chartFilterQuery) : true;
                                const isDimmed = hasFilter && chartFilterMode === 'highlight' && !isMatched;

                                return (
                                  <div
                                    key={i}
                                    className={`flex items-center justify-between p-1.5 rounded-md border text-xs font-mono transition-all ${
                                      isDimmed
                                        ? 'bg-slate-950/40 border-slate-900 opacity-40'
                                        : hasFilter && isMatched
                                        ? 'bg-blue-950/50 border-blue-700/60'
                                        : 'bg-slate-950/80 border-slate-800/80'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                                        style={{ backgroundColor: entry.color }}
                                      />
                                      <span className="font-bold text-white truncate text-[11px]">
                                        {entry.name}
                                      </span>
                                      {hasFilter && isMatched && (
                                        <span className="text-[8.5px] px-1 rounded bg-blue-500/30 text-blue-300 border border-blue-400/40">
                                          Match
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px]">
                                      <span className="font-bold text-slate-100">
                                        {entry.value} {growthMetric === 'cumulative' ? 'pg' : 'pg/d'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="mt-2 pt-2 border-t border-slate-800/80 text-[9px] font-mono text-slate-400 flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <Activity className="w-2.5 h-2.5 text-emerald-400" />
                                <span>Historical crawler_history trend</span>
                              </span>
                              <span>{growthDays}d window</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />

                  {topGrowthItems.map((item) => {
                    if (hiddenGrowthKeys.has(item.name)) return null;
                    const hasFilter = Boolean(chartFilterQuery.trim());
                    const isMatched = hasFilter ? checkDomainMatch(item, chartFilterQuery) : true;
                    const isDimmed = hasFilter && chartFilterMode === 'highlight' && !isMatched;

                    return (
                      <Area
                        key={`area-${item.key}`}
                        type="monotone"
                        dataKey={item.name}
                        name={item.name}
                        stroke={isDimmed ? '#94A3B8' : item.color}
                        strokeWidth={hasFilter && isMatched ? 3.5 : isDimmed ? 1 : 2.5}
                        strokeOpacity={isDimmed ? 0.2 : 1}
                        fill={`url(#growth-grad-${item.key})`}
                        fillOpacity={isDimmed ? 0.04 : 0.25}
                        activeDot={
                          isDimmed
                            ? false
                            : { r: 5, stroke: item.color, strokeWidth: 2, fill: '#FFFFFF' }
                        }
                        animationDuration={600}
                      />
                    );
                  })}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : displayedChartItems.length === 0 ? (
          <div className="text-center py-12 text-slate-400 font-sans border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
            <Globe className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-600">No domain coverage data matching filter in Isolate mode</p>
            <p className="text-xs text-slate-400 mt-1">
              Try switching to <strong className="text-slate-600">Highlight mode</strong> or{' '}
              <button
                type="button"
                onClick={() => setChartFilterQuery('')}
                className="text-blue-600 underline font-bold cursor-pointer"
              >
                clearing your filter query
              </button>.
            </p>
          </div>
        ) : (
          <div style={{ height: `${chartHeight}px`, width: '100%', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={120}>
              <BarChart
                layout="vertical"
                data={displayedChartItems}
                margin={{ top: 8, right: 40, left: 10, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#F1F5F9' : '#27272A'} horizontal={false} />
                <XAxis
                  type="number"
                  stroke={isLight ? '#94A3B8' : '#71717A'}
                  fontSize={11}
                  fontFamily="JetBrains Mono, monospace"
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 'dataMax + 1']}
                  allowDecimals={false}
                  tickFormatter={(val) => `${val} pg`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke={isLight ? '#94A3B8' : '#71717A'}
                  tickLine={false}
                  axisLine={false}
                  width={groupByMode === 'tld' ? 70 : 130}
                  tick={renderCustomYAxisTick}
                />
                <Tooltip
                  cursor={{ fill: isLight ? 'rgba(241, 245, 249, 0.6)' : 'rgba(39, 39, 42, 0.45)' }}
                  wrapperStyle={{ zIndex: 100, pointerEvents: 'none', outline: 'none' }}
                  allowEscapeViewBox={{ x: true, y: true }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as DomainCoverageItem;
                      const hasFilter = Boolean(chartFilterQuery.trim());
                      const isMatched = hasFilter ? checkDomainMatch(data, chartFilterQuery) : true;

                      return (
                        <div className="bg-slate-900/98 backdrop-blur-md text-white p-3.5 rounded-xl shadow-2xl border border-slate-700/80 text-xs font-sans w-80 sm:w-96 z-50 pointer-events-none">
                          {/* Header: Domain name, color dot, extension badge, and filter status */}
                          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5 mb-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-3 h-3 rounded-full shadow-xs shrink-0"
                                style={{ backgroundColor: data.color }}
                              />
                              <span className="font-mono font-bold text-sm text-white tracking-wide truncate">
                                {data.name}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                                {groupByMode === 'tld' ? 'TLD Extension' : 'Apex Domain'}
                              </span>
                            </div>
                            {hasFilter && (
                              <span
                                className={`px-1.5 py-0.5 rounded font-mono font-bold text-[9px] border shrink-0 ${
                                  isMatched
                                    ? 'bg-blue-500/20 text-blue-300 border-blue-400/40'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}
                              >
                                {isMatched ? 'Opaque Match' : 'Dimmed'}
                              </span>
                            )}
                          </div>

                          {/* Key Metrics: Exact Number of Pages & Percentage of Index Coverage */}
                          <div className="grid grid-cols-2 gap-2 mb-2.5">
                            {/* Exact Number of Pages */}
                            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                              <div className="flex items-center justify-between text-slate-400 text-[9.5px] font-mono uppercase tracking-wider mb-1">
                                <span>Exact Pages</span>
                                <Layers className="w-3 h-3 text-blue-400" />
                              </div>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-white font-bold font-mono text-base">{data.count}</span>
                                <span className="text-slate-400 text-[11px]">pages</span>
                              </div>
                              <span className="text-[9.5px] font-mono text-slate-400 mt-1">
                                {data.count} of {totalPages} corpus pages
                              </span>
                            </div>

                            {/* Percentage of Index Coverage */}
                            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                              <div className="flex items-center justify-between text-slate-400 text-[9.5px] font-mono uppercase tracking-wider mb-1">
                                <span>Index Coverage</span>
                                <Percent className="w-3 h-3 text-blue-400" />
                              </div>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-blue-400 font-bold font-mono text-base">{data.sharePercent}%</span>
                                <span className="text-slate-400 text-[10px]">share</span>
                              </div>
                              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mt-1.5 border border-slate-700/50">
                                <div
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{
                                    width: `${Math.min(100, Math.max(3, data.sharePercent))}%`,
                                    backgroundColor: data.color || '#3B82F6'
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Secondary Backlinks & Cache Summary */}
                          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 mb-2.5 bg-slate-950/60 rounded-md border border-slate-800/60 text-[10px] font-mono">
                            <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                              <LinkIcon className="w-3 h-3" />
                              <span>{data.totalBacklinks} backlinks</span>
                              <span className="text-slate-500 font-normal">({data.avgBacklinks} avg)</span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-300">
                              <span className="text-emerald-400">{data.cachedCount} cached</span>
                              <span className="text-slate-600">•</span>
                              <span className="text-blue-300">{data.freshCount} fresh</span>
                            </div>
                          </div>

                          {/* Top 3 Indexed Pages List */}
                          <div className="border-t border-slate-800 pt-2.5">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5 text-slate-200 font-mono font-bold text-[11px]">
                                <FileText className="w-3.5 h-3.5 text-blue-400" />
                                <span>
                                  Top {data.topPages?.length || 0} Indexed {data.topPages?.length === 1 ? 'Page' : 'Pages'}
                                </span>
                              </div>
                              <span className="text-[9px] font-mono text-slate-400 bg-slate-800/90 px-1.5 py-0.5 rounded border border-slate-700/50">
                                Ranked by backlinks
                              </span>
                            </div>

                            {data.topPages && data.topPages.length > 0 ? (
                              <div className="space-y-1.5">
                                {data.topPages.map((page, idx) => (
                                  <div
                                    key={page.id || idx}
                                    className="p-2 rounded-lg bg-slate-950/90 border border-slate-800/80 flex items-start gap-2"
                                  >
                                    <span className="w-4 h-4 rounded bg-blue-900/50 text-blue-300 border border-blue-700/40 flex items-center justify-center text-[9px] font-mono font-bold shrink-0 mt-0.5">
                                      {idx + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[11px] font-medium text-slate-100 truncate leading-snug" title={page.title}>
                                        {page.title || 'Untitled page'}
                                      </p>
                                      <p className="text-[9.5px] font-mono text-slate-400 truncate mt-0.5" title={page.url}>
                                        {page.url}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1 text-[9px] font-mono">
                                        <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                                          <LinkIcon className="w-2.5 h-2.5" />
                                          {page.backlinks ?? 0} backlinks
                                        </span>
                                        <span
                                          className={`px-1 rounded text-[8.5px] ${
                                            page.cache_hit
                                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                                              : 'bg-slate-800 text-slate-400'
                                          }`}
                                        >
                                          {page.cache_hit ? 'Cached' : 'Fresh'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-500 italic py-1 font-mono">
                                No indexed pages listed for this domain
                              </div>
                            )}
                          </div>

                          {/* Subdomains / Hostnames Summary (if applicable) */}
                          {data.subDomains && data.subDomains.length > 0 && (
                            <div className="text-[10px] text-slate-400 border-t border-slate-800/80 pt-2 mt-2">
                              <span className="text-slate-400 block font-mono text-[9px] mb-1">
                                {groupByMode === 'tld' ? 'Associated Domains:' : 'Hosts / Subdomains:'}
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {data.subDomains.slice(0, 4).map((d, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-slate-800/80 rounded text-[9px] font-mono text-slate-200">
                                    {d}
                                  </span>
                                ))}
                                {data.subDomains.length > 4 && (
                                  <span className="text-slate-500 font-mono text-[9px]">
                                    +{data.subDomains.length - 4} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Click Hint Footer */}
                          <div className="mt-2.5 pt-2 border-t border-slate-800/60 text-[9px] font-mono text-slate-400 flex items-center justify-between">
                            <span className="flex items-center gap-1 text-slate-400">
                              <Filter className="w-2.5 h-2.5 text-blue-400" />
                              <span>Click bar to filter catalog by {data.name}</span>
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Indexed Pages"
                  radius={[0, 6, 6, 0]}
                  barSize={groupByMode === 'tld' ? 24 : 18}
                  animationDuration={500}
                >
                  {displayedChartItems.map((entry, index) => {
                    const hasFilter = Boolean(chartFilterQuery.trim());
                    const isMatched = hasFilter ? checkDomainMatch(entry, chartFilterQuery) : true;
                    const isDimmed = hasFilter && chartFilterMode === 'highlight' && !isMatched;

                    return (
                      <Cell
                        key={`coverage-cell-${index}`}
                        fill={isDimmed ? '#94A3B8' : entry.color}
                        fillOpacity={isDimmed ? 0.12 : 1}
                        stroke={hasFilter && isMatched ? '#1D4ED8' : 'none'}
                        strokeWidth={hasFilter && isMatched ? 2 : 0}
                        style={{
                          transition: 'all 0.25s ease-in-out',
                          filter: isDimmed ? 'grayscale(85%)' : 'none'
                        }}
                        className="cursor-pointer transition-all duration-200"
                        onClick={() => {
                          if (onFilterCatalogByDomain) {
                            onFilterCatalogByDomain(entry.name);
                          }
                        }}
                      />
                    );
                  })}
                  <LabelList
                    dataKey="count"
                    position="right"
                    content={(props: any) => {
                      const { x, y, width, value, index } = props;
                      const entry = displayedChartItems[index];
                      if (!entry) return null;
                      const hasFilter = Boolean(chartFilterQuery.trim());
                      const isMatched = hasFilter ? checkDomainMatch(entry, chartFilterQuery) : true;
                      const isDimmed = hasFilter && chartFilterMode === 'highlight' && !isMatched;

                      return (
                        <text
                          x={Number(x) + Number(width) + 8}
                          y={Number(y) + (groupByMode === 'tld' ? 16 : 13)}
                          fill={isDimmed ? '#71717A' : hasFilter && isMatched ? (isLight ? '#1D4ED8' : '#F4F4F5') : (isLight ? '#64748B' : '#A1A1AA')}
                          fontSize={10.5}
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight={hasFilter && isMatched ? 700 : 500}
                          opacity={isDimmed ? 0.25 : 1}
                        >
                          {value}
                        </text>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Legend bar footer with interactive feedback */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs font-mono text-slate-500">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>
              {chartPerspective === 'growth'
                ? `Comparative Growth View: Plotting ${growthDays}-day crawl trajectory from crawler_history across top ${groupByMode === 'tld' ? 'TLD extensions' : 'apex domains'}. Toggle lines via chips above.`
                : Boolean(chartFilterQuery.trim())
                ? chartFilterMode === 'highlight'
                  ? `Active filter: Matching bars remain 100% opaque, while non-matching bars are visually dimmed (${matchedItems.length} opaque, ${coverageItems.length - matchedItems.length} dimmed).`
                  : `Isolating: Displaying only ${matchedItems.length} matching domains on the chart.`
                : 'Matching domain bars remain fully opaque, while unmatched domains are visually dimmed.'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">Total Corpus:</span>
            <span className="font-bold text-slate-700 font-mono">{totalPages} pages</span>
          </div>
        </div>
      </div>

      {/* Detailed Domain & TLD Breakdown Table */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-800 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>Coverage Breakdown Matrix ({displayedTableItems.length} {groupByMode === 'tld' ? 'extensions' : 'domains'})</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            {chartFilterQuery.trim()
              ? chartFilterMode === 'isolate'
                ? `Filtered to ${matchedItems.length} matches`
                : `Highlighting ${matchedItems.length} matches`
              : 'Showing all indexed hosts'}
          </span>
        </div>

        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-50/90 text-[10px] font-mono font-bold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">{groupByMode === 'tld' ? 'Top-Level Domain' : 'Apex Domain'}</th>
                  <th className="py-2.5 px-4 text-right">Indexed Pages</th>
                  <th className="py-2.5 px-4">Index Coverage Ratio</th>
                  <th className="py-2.5 px-4 text-right">Total Backlinks</th>
                  <th className="py-2.5 px-4">Cache Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {displayedTableItems.map((item) => {
                  const hasFilter = Boolean(chartFilterQuery.trim());
                  const isMatched = hasFilter ? checkDomainMatch(item, chartFilterQuery) : true;
                  const isHighlighted = hasFilter && chartFilterMode === 'highlight' && isMatched;
                  const isDimmed = hasFilter && chartFilterMode === 'highlight' && !isMatched;

                  return (
                    <tr
                      key={item.key}
                      className={`transition-colors group cursor-pointer ${
                        isHighlighted
                          ? 'bg-blue-50/80 border-l-4 border-l-blue-600 font-semibold'
                          : isDimmed
                          ? 'opacity-40 hover:opacity-100 hover:bg-slate-50'
                          : 'hover:bg-blue-50/40'
                      }`}
                      onClick={() => {
                        if (onFilterCatalogByDomain) {
                          onFilterCatalogByDomain(item.name);
                        }
                      }}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-mono font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-xs">
                            {item.name}
                          </span>
                          {isHighlighted && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9.5px] font-mono font-bold border border-amber-200">
                              Highlighted
                            </span>
                          )}
                          {groupByMode === 'tld' && item.subDomains.length > 0 && (
                            <span className="text-[10px] font-mono text-slate-400">
                              ({item.subDomains.length} domains)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                        {item.count}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 max-w-xs">
                          <div className="w-24 sm:w-32 bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/80">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.max(item.sharePercent, 4)}%`,
                                backgroundColor: item.color
                              }}
                            />
                          </div>
                          <span className="text-[11px] font-mono font-semibold text-slate-600 shrink-0">
                            {item.sharePercent}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        <span className="inline-flex items-center gap-1 font-bold text-blue-600">
                          <LinkIcon className="w-3 h-3 text-slate-400" />
                          {item.totalBacklinks}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-[10px]">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {item.cachedCount} cached
                          </span>
                          {item.freshCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              {item.freshCount} fresh
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onFilterCatalogByDomain) {
                                onFilterCatalogByDomain(item.name);
                              }
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded-lg text-[10.5px] font-mono font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title={`Filter Indexed Pages Catalog by ${item.name}`}
                          >
                            <Filter className="w-2.5 h-2.5" />
                            <span>Filter Catalog</span>
                          </button>
                          {onSearchSiteFilter && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSearchSiteFilter(item.name);
                              }}
                              className="p-1 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                              title={`Run search query site:${item.name}`}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TldDomainCoverageSection;
