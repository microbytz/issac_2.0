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
  Maximize2
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

export const VideosResultsView: React.FC<VideosResultsViewProps> = ({
  query,
  isLight,
  safeSearchLevel,
  onBookmark,
  onNotify
}) => {
  const [videoList, setVideoList] = useState<VideoItem[]>([]);
  const [activeVideoModal, setActiveVideoModal] = useState<VideoItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const cleanQ = query.trim();
    if (!cleanQ) {
      setVideoList([]);
      return;
    }

    let cancelled = false;
    fetch(`${apiUrl('/api/search/videos')}?q=${encodeURIComponent(cleanQ)}`, {
      signal: AbortSignal.timeout(12000)
    })
      .then(res => (res.ok ? res.json() : []))
      .then((data: any) => {
        if (!cancelled) setVideoList(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setVideoList([]);
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
          <span>Video Results ({filteredVideos.length} videos)</span>
        </span>
        <span>SafeSearch: <strong className="capitalize text-slate-200">{safeSearchLevel}</strong></span>
      </div>

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
                />
              ) : (
                <div className="w-full h-full bg-slate-900" />
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
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveVideoModal(video)}
                    type="button"
                    className="px-2.5 py-1 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 font-bold text-[11px] cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Watch Preview</span>
                  </button>

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
                  className="text-slate-500 hover:text-slate-300 p-1"
                  title="Open externally"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredVideos.length === 0 && (
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
      {/* INLINE VIDEO MODAL (DuckDuckGo style inline video player)             */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {activeVideoModal && (
          <div
            ref={focusTrapRef} role="dialog" aria-modal="true" aria-label="Video player" className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) setActiveVideoModal(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-4xl rounded-2xl border overflow-hidden shadow-2xl ${
                isLight ? 'bg-white border-slate-300' : 'bg-[#090e24] border-slate-800'
              }`}
            >
              {/* Modal Top Bar */}
              <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 truncate">
                  <Video className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="font-bold text-sm truncate font-sans">{activeVideoModal.title}</span>
                </div>
                <button
                  onClick={() => setActiveVideoModal(null)}
                  type="button"
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Responsive Video Container */}
              <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
                <iframe
                  src={activeVideoModal.embedUrl || `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(activeVideoModal.title)}&autoplay=1`}
                  title={activeVideoModal.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              </div>

              {/* Video Info Footer */}
              <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-slate-800">
                <div>
                  <div className="text-sm font-bold font-sans">{activeVideoModal.channel}</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    {activeVideoModal.views} • Uploaded {activeVideoModal.uploadedAt} • Duration {activeVideoModal.duration}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={activeVideoModal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-xs"
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
