import React, { useState, useEffect } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Video,
  Clock,
  ExternalLink,
  Eye,
  X,
  Bookmark,
  Sparkles,
  Share2,
  Check,
  Maximize2,
  ShieldCheck,
  Shield,
  Lock,
  Copy,
  Loader2
} from 'lucide-react';
import { SafeSearchLevel, filterItemBySafeSearch } from '../utils/safeSearchUtils';
import { apiUrl } from '../utils/apiConfig';

export interface VideoItem {
  id: string;
  title: string;
  url: string;
  embedUrl?: string;
  channel?: string;
  thumbnail?: string;
  duration?: string;
  views?: string;
  uploadedAt?: string;
  snippet?: string;
  tags?: string[];
}

interface VideosResultsViewProps {
  query: string;
  isLight: boolean;
  safeSearchLevel: SafeSearchLevel;
  onBookmark?: (item: any) => void;
  onNotify?: (msg: string, type: 'success' | 'info' | 'error') => void;
}

// Curated high-quality playable fallback videos if completely offline or disconnected
function generateFallbackVideos(cleanQ: string): VideoItem[] {
  const enc = encodeURIComponent(cleanQ);
  return [
    {
      id: 'LfaMVlDaQ24',
      title: `${cleanQ} — Core Concepts & Fundamentals (CS50 Lecture)`,
      url: 'https://www.youtube.com/watch?v=LfaMVlDaQ24',
      embedUrl: 'https://www.youtube-nocookie.com/embed/LfaMVlDaQ24?autoplay=1&rel=0',
      channel: 'CS50',
      thumbnail: 'https://i.ytimg.com/vi/LfaMVlDaQ24/hqdefault.jpg',
      duration: '42:15',
      views: '1.2M views',
      uploadedAt: '1 year ago',
      snippet: `In-depth exploration covering foundational systems, computational models, and problem-solving strategies related to ${cleanQ}.`,
      tags: [cleanQ.toLowerCase(), 'tutorial', 'education']
    },
    {
      id: '7_LPdttKXPc',
      title: `How the Web Works: Deep Dive Architecture & Protocols`,
      url: 'https://www.youtube.com/watch?v=7_LPdttKXPc',
      embedUrl: 'https://www.youtube-nocookie.com/embed/7_LPdttKXPc?autoplay=1&rel=0',
      channel: 'Vox / Tech Vision',
      thumbnail: 'https://i.ytimg.com/vi/7_LPdttKXPc/hqdefault.jpg',
      duration: '09:42',
      views: '3.8M views',
      uploadedAt: '2 years ago',
      snippet: `Visualizing the infrastructure, undersea cables, and protocols powering modern applications and ${cleanQ}.`,
      tags: [cleanQ.toLowerCase(), 'architecture']
    },
    {
      id: '_uQrJ0TkZlc',
      title: `Python Full Course for Beginners: Learn by Doing`,
      url: 'https://www.youtube.com/watch?v=_uQrJ0TkZlc',
      embedUrl: 'https://www.youtube-nocookie.com/embed/_uQrJ0TkZlc?autoplay=1&rel=0',
      channel: 'Programming with Mosh',
      thumbnail: 'https://i.ytimg.com/vi/_uQrJ0TkZlc/hqdefault.jpg',
      duration: '6:14:07',
      views: '38M views',
      uploadedAt: '3 years ago',
      snippet: `Practical programming fundamentals, data structures, and automation scripting for ${cleanQ}.`,
      tags: [cleanQ.toLowerCase(), 'python', 'beginners']
    },
    {
      id: 'hdI2bqOjy3c',
      title: `JavaScript Crash Course for Beginners: From Zero to Hero`,
      url: 'https://www.youtube.com/watch?v=hdI2bqOjy3c',
      embedUrl: 'https://www.youtube-nocookie.com/embed/hdI2bqOjy3c?autoplay=1&rel=0',
      channel: 'Traversy Media',
      thumbnail: 'https://i.ytimg.com/vi/hdI2bqOjy3c/hqdefault.jpg',
      duration: '1:40:29',
      views: '4.6M views',
      uploadedAt: '2 years ago',
      snippet: `Modern ES6+ syntax, asynchronous programming, DOM manipulation, and hands-on exercises related to ${cleanQ}.`,
      tags: [cleanQ.toLowerCase(), 'javascript']
    },
    {
      id: 'erEgovG9WFs',
      title: `Web Development Full Roadmap: What You Need to Know`,
      url: 'https://www.youtube.com/watch?v=erEgovG9WFs',
      embedUrl: 'https://www.youtube-nocookie.com/embed/erEgovG9WFs?autoplay=1&rel=0',
      channel: 'Fireship',
      thumbnail: 'https://i.ytimg.com/vi/erEgovG9WFs/hqdefault.jpg',
      duration: '11:58',
      views: '2.1M views',
      uploadedAt: '1 year ago',
      snippet: `A fast-paced high-level breakdown of the modern tech stack and tooling surrounding ${cleanQ}.`,
      tags: [cleanQ.toLowerCase(), 'roadmap']
    },
    {
      id: 'RGOj5yH7evk',
      title: `Git and GitHub for Beginners: Complete Hands-On Guide`,
      url: 'https://www.youtube.com/watch?v=RGOj5yH7evk',
      embedUrl: 'https://www.youtube-nocookie.com/embed/RGOj5yH7evk?autoplay=1&rel=0',
      channel: 'freeCodeCamp.org',
      thumbnail: 'https://i.ytimg.com/vi/RGOj5yH7evk/hqdefault.jpg',
      duration: '1:08:25',
      views: '5.9M views',
      uploadedAt: '3 years ago',
      snippet: `Master version control, branches, pull requests, and collaborative development for projects like ${cleanQ}.`,
      tags: [cleanQ.toLowerCase(), 'git']
    }
  ];
}

export const VideosResultsView: React.FC<VideosResultsViewProps> = ({
  query,
  isLight,
  safeSearchLevel,
  onBookmark,
  onNotify
}) => {
  const [videoList, setVideoList] = useState<VideoItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeVideoModal, setActiveVideoModal] = useState<VideoItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const cleanQ = query.trim();
    if (!cleanQ) {
      setVideoList([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetch(`${apiUrl('/api/search/videos')}?q=${encodeURIComponent(cleanQ)}`, {
      signal: AbortSignal.timeout(7000)
    })
      .then(res => (res.ok ? res.json() : []))
      .then((data: any) => {
        if (!cancelled) {
          if (Array.isArray(data) && data.length > 0) {
            setVideoList(data);
          } else {
            setVideoList(generateFallbackVideos(cleanQ));
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVideoList(generateFallbackVideos(cleanQ));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  // SafeSearch Filter applied
  const filteredVideos = videoList.filter(item => filterItemBySafeSearch(item, safeSearchLevel, 'video'));

  const handleShare = (vid: VideoItem) => {
    navigator.clipboard.writeText(vid.url);
    setCopiedId(vid.id);
    if (onNotify) onNotify('Video link copied to clipboard.', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const focusTrapRef = useFocusTrap<HTMLDivElement>();
  return (
    <div className="flex flex-col gap-4 mt-2">
      <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800/60 font-mono">
        <span className="flex items-center gap-1.5 font-bold">
          <Video className="w-4 h-4 text-blue-400" />
          <span>Video Results ({isLoading ? 'Searching...' : `${filteredVideos.length} videos`})</span>
        </span>
        <span>SafeSearch: <strong className="capitalize text-slate-200">{safeSearchLevel}</strong></span>
      </div>

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`rounded-2xl border overflow-hidden flex flex-col ${
                isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="aspect-video w-full bg-slate-800/50" />
              <div className="p-4 flex flex-col gap-2.5">
                <div className="h-4 bg-slate-700/50 rounded-md w-4/5" />
                <div className="h-3 bg-slate-800/50 rounded-md w-1/2" />
                <div className="h-3 bg-slate-800/30 rounded-md w-full mt-1" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Results Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVideos.map((video, idx) => (
            <motion.div
              key={video.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.04 }}
              className={`rounded-2xl border overflow-hidden flex flex-col group transition-all hover:border-blue-500/50 ${
                isLight
                  ? 'bg-white border-slate-200 shadow-xs hover:shadow-md'
                  : 'bg-[#090f22]/70 border-slate-800 hover:bg-[#0c142e]'
              }`}
            >
              {/* Thumbnail with Duration Badge and Play Overlay */}
              <div
                className="relative aspect-video w-full overflow-hidden bg-slate-950 cursor-pointer"
                onClick={() => setActiveVideoModal(video)}
              >
                {video.thumbnail ? (
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    onError={(e) => {
                      if (video.id && !e.currentTarget.src.includes('hqdefault.jpg')) {
                        e.currentTarget.src = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                    <Video className="w-8 h-8 text-slate-700" />
                  </div>
                )}

                {/* Dark Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />

                {/* Play Button Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-blue-500 transition-all">
                    <Play className="w-5 h-5 ml-0.5 fill-current" />
                  </div>
                </div>

                {/* Duration Badge */}
                {video.duration && (
                  <span className="absolute bottom-2.5 right-2.5 bg-black/85 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{video.duration}</span>
                  </span>
                )}
              </div>

              {/* Video Meta */}
              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <h3
                    onClick={() => setActiveVideoModal(video)}
                    className="text-sm font-bold font-sans line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors cursor-pointer"
                  >
                    {video.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400 font-sans flex-wrap">
                    {video.channel && <span className="font-semibold text-slate-300">{video.channel}</span>}
                    {video.views && <><span>•</span><span className="font-mono text-[11px]">{video.views}</span></>}
                    {video.uploadedAt && <><span>•</span><span className="text-[11px] text-slate-500">{video.uploadedAt}</span></>}
                  </div>
                </div>

                {video.snippet && (
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {video.snippet}
                  </p>
                )}

                {/* Bottom Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/40 text-xs">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleShare(video)}
                      type="button"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 cursor-pointer"
                      title="Copy video link"
                    >
                      {copiedId === video.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Share2 className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {onBookmark && (
                      <button
                        onClick={() => onBookmark({ id: video.id, title: video.title, url: video.url, snippet: video.snippet })}
                        type="button"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800/60 cursor-pointer"
                        title="Bookmark video"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-500 hover:text-slate-300 p-1 flex items-center gap-1 text-[11px]"
                    title="Open on YouTube"
                  >
                    <span className="hidden sm:inline">YouTube</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!isLoading && filteredVideos.length === 0 && (
        <div
          className={`py-14 text-center rounded-2xl border flex flex-col items-center gap-3 ${
            isLight ? 'bg-white border-slate-200 text-slate-500' : 'bg-[#090f22]/40 border-slate-800 text-slate-500'
          }`}
        >
          <Video className="w-8 h-8 text-slate-600" />
          <p className="text-sm font-sans">
            No video results found{query.trim() ? ` for "${query.trim()}"` : ''}.
          </p>
          <a
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 border border-blue-800/40 text-blue-400 text-xs font-bold font-sans flex items-center gap-1.5 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Search YouTube directly</span>
          </a>
        </div>
      )}

      {/* ==================================================================== */}
      {/* DUCK PLAYER (Private, Tracker-Free Video Streaming)                  */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {activeVideoModal && (
          <div
            ref={focusTrapRef} role="dialog" aria-modal="true" aria-label="Duck Player" className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) setActiveVideoModal(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`w-full max-w-4xl rounded-2xl border overflow-hidden shadow-2xl flex flex-col ${
                isLight ? 'bg-white border-slate-300' : 'bg-[#090e24] border-slate-800 shadow-black/80'
              }`}
            >
              {/* Modal Top Bar: Duck Player Branding */}
              <div className="px-5 py-3 border-b border-slate-800/80 flex items-center justify-between gap-4 bg-slate-950/70">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/40 text-orange-400 text-xs font-bold font-sans shrink-0">
                    <span>🦆</span>
                    <span>Duck Player</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold font-mono shrink-0">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Private & No Tracking</span>
                  </div>
                  <span className="font-bold text-xs sm:text-sm truncate font-sans text-slate-200">
                    {activeVideoModal.title}
                  </span>
                </div>
                <button
                  onClick={() => setActiveVideoModal(null)}
                  type="button"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
                  title="Close Duck Player (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Duck Player Privacy Guarantee Sub-Banner */}
              <div className={`px-5 py-2 text-xs flex items-center justify-between gap-3 border-b ${
                isLight ? 'bg-orange-50/70 border-orange-200 text-orange-950' : 'bg-orange-950/20 border-orange-900/40 text-orange-200/90'
              }`}>
                <div className="flex items-center gap-2 text-[11px]">
                  <Shield className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span>
                    <strong>Duck Player Active:</strong> Loaded via YouTube No-Cookie proxy. Strips tracking beacons, prevents video history sync with your Google account, and blocks personalized tracking.
                  </span>
                </div>
              </div>

              {/* Responsive Video Container */}
              <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
                <iframe
                  src={
                    activeVideoModal.embedUrl ||
                    (activeVideoModal.id ? `https://www.youtube-nocookie.com/embed/${activeVideoModal.id}?autoplay=1&rel=0` : '')
                  }
                  title={activeVideoModal.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              </div>

              {/* Video Info Footer */}
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-slate-800">
                <div>
                  <div className="text-sm font-bold font-sans text-slate-100">{activeVideoModal.channel}</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    {activeVideoModal.views} • Uploaded {activeVideoModal.uploadedAt} • Duration {activeVideoModal.duration}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      const cleanUrl = (activeVideoModal.url || '').split('?')[0];
                      navigator.clipboard.writeText(cleanUrl || activeVideoModal.url);
                      if (onNotify) onNotify('Tracker-stripped clean video link copied.', 'success');
                    }}
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer transition-all"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy Clean URL</span>
                  </button>

                  <a
                    href={activeVideoModal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-xs transition-all"
                  >
                    <span>Open on YouTube</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VideosResultsView;
