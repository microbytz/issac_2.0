import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Newspaper,
  ExternalLink,
  Volume2,
  VolumeX,
  Clock,
  Globe,
  Share2,
  Bookmark,
  Check,
  Sparkles,
  ArrowUpRight,
  BookOpen
} from 'lucide-react';
import { SafeSearchLevel, filterItemBySafeSearch } from '../utils/safeSearchUtils';
import { stopSpeechImmediately, playSpeech, isSpeechActive, SPEECH_STOP_EVENT } from '../utils/speechUtils';

function decodeEntities(text: string): string {
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
}

export interface NewsArticleItem {
  id: string;
  title: string;
  url: string;
  snippet: string;
  publisher: string;
  publishedAt: string;
  timeAgo: string;
  imageUrl?: string;
  tags?: string[];
}

interface NewsResultsViewProps {
  query: string;
  isLight: boolean;
  safeSearchLevel: SafeSearchLevel;
  onBookmark?: (item: any) => void;
  onNotify?: (msg: string, type: 'success' | 'info' | 'error') => void;
  onOpenStoryReader?: (article: NewsArticleItem) => void;
}

export const NewsResultsView: React.FC<NewsResultsViewProps> = ({
  query,
  isLight,
  safeSearchLevel,
  onBookmark,
  onNotify,
  onOpenStoryReader
}) => {
  const [newsList, setNewsList] = useState<NewsArticleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      const cleanQ = query.trim() || 'technology';
      const articles: NewsArticleItem[] = [];

      try {
        // Query Hacker News Algolia for real-time tech/world news
        const hnUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(cleanQ)}&tags=story&hitsPerPage=15`;
        const res = await fetch(hnUrl, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const data = await res.json();
          const hits = Array.isArray(data?.hits) ? data.hits : [];
          for (const hit of hits) {
            let publisher = 'Hacker News';
            let storyUrl = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
            try {
              if (hit.url) {
                const domain = new URL(hit.url).hostname.replace('www.', '');
                publisher = domain.charAt(0).toUpperCase() + domain.slice(1);
              }
            } catch (_) {}

            const createdMs = hit.created_at ? new Date(hit.created_at).getTime() : Date.now() - 3600000;
            const diffHours = Math.max(1, Math.round((Date.now() - createdMs) / 3600000));
            const timeAgo = diffHours < 24 ? `${diffHours}h ago` : `${Math.round(diffHours / 24)}d ago`;

            articles.push({
              id: `news_hn_${hit.objectID}`,
              title: decodeEntities(hit.title || 'Breaking Coverage on ' + cleanQ),
              url: storyUrl,
              snippet: hit.story_text
                ? decodeEntities(hit.story_text.replace(/<[^>]+>/g, '')).slice(0, 240)
                : `Latest discussion and coverage regarding ${hit.title || cleanQ} with ${hit.points || 12} community upvotes and ${hit.num_comments || 0} active perspectives.`,
              publisher,
              publishedAt: hit.created_at || new Date().toISOString(),
              timeAgo,
              tags: ['news', publisher.toLowerCase().slice(0, 15), cleanQ.toLowerCase().slice(0, 12)]
            });
          }
        }
      } catch (_) {}

      setNewsList(articles);
      setLoading(false);
    };

    fetchNews();
  }, [query]);

  // SafeSearch Filter applied
  const filteredArticles = newsList.filter(item => filterItemBySafeSearch(item, safeSearchLevel, 'text'));

  const [speakingArticleId, setSpeakingArticleId] = useState<string | null>(null);

  useEffect(() => {
    const handleGlobalSpeechStop = () => {
      setSpeakingArticleId(null);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(SPEECH_STOP_EVENT, handleGlobalSpeechStop);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(SPEECH_STOP_EVENT, handleGlobalSpeechStop);
      }
      stopSpeechImmediately();
    };
  }, []);

  const speakText = (article: NewsArticleItem) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const isCurrentlyThis = speakingArticleId === article.id;
      const isAnyActive = isSpeechActive() || speakingArticleId !== null;

      // Stop immediately the second the user clicks the active button
      if (isCurrentlyThis || (isAnyActive && !speakingArticleId)) {
        stopSpeechImmediately();
        setSpeakingArticleId(null);
        if (onNotify) onNotify('Stopped reading aloud', 'info');
        return;
      }

      if (isAnyActive) {
        stopSpeechImmediately();
        setSpeakingArticleId(null);
      }

      const textToSpeak = `${article.title}. ${article.snippet}`;
      playSpeech(textToSpeak, {
        onStart: () => setSpeakingArticleId(article.id),
        onEnd: () => setSpeakingArticleId(prev => (prev === article.id ? null : prev)),
        onError: () => setSpeakingArticleId(prev => (prev === article.id ? null : prev))
      });
      setSpeakingArticleId(article.id);
      if (onNotify) onNotify('Reading article aloud...', 'info');
    }
  };

  const handleShare = (article: NewsArticleItem) => {
    navigator.clipboard.writeText(article.url);
    setCopiedUrl(article.id);
    if (onNotify) onNotify('News link copied to clipboard.', 'success');
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="flex flex-col gap-4 mt-2">
      <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800/60 font-mono">
        <span className="flex items-center gap-1.5 font-bold">
          <Newspaper className="w-4 h-4 text-blue-400" />
          <span>News Coverage ({filteredArticles.length} stories)</span>
        </span>
        <span>SafeSearch: <strong className="capitalize text-slate-200">{safeSearchLevel}</strong></span>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-2">
          <Sparkles className="w-6 h-6 text-blue-400 animate-spin" />
          <span className="text-xs font-mono">Curating breaking coverage for "{query}"...</span>
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="py-12 text-center text-slate-500 font-mono text-xs">
          No news articles found matching "{query}" under {safeSearchLevel} SafeSearch.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredArticles.map((article, idx) => (
            <motion.article
              key={article.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between group hover:border-blue-500/50 ${
                isLight
                  ? 'bg-white border-slate-200 hover:shadow-md shadow-xs'
                  : 'bg-[#090f22]/70 border-slate-800 hover:bg-[#0c142e]'
              }`}
            >
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold font-sans text-blue-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <Globe className="w-3.5 h-3.5" />
                    <span>{article.publisher}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{article.timeAgo}</span>
                  </span>
                </div>

                {onOpenStoryReader ? (
                  <button
                    type="button"
                    onClick={() => onOpenStoryReader(article)}
                    className="text-base font-bold font-sans text-left group-hover:text-blue-400 transition-colors leading-snug flex items-start justify-between gap-2 cursor-pointer"
                  >
                    <span>{article.title}</span>
                    <BookOpen className="w-4 h-4 text-slate-500 group-hover:text-blue-400 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ) : (
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base font-bold font-sans group-hover:text-blue-400 transition-colors leading-snug flex items-start justify-between gap-2"
                  >
                    <span>{article.title}</span>
                    <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                )}

                <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                  {article.snippet}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-800/40 text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => speakText(article)}
                    type="button"
                    className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                      speakingArticleId === article.id
                        ? 'text-rose-400 bg-rose-950/40 hover:bg-rose-950/60'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                    title={speakingArticleId === article.id ? "Stop reading aloud" : "Read article aloud"}
                    aria-label={speakingArticleId === article.id ? "Stop reading aloud" : "Read article aloud"}
                  >
                    {speakingArticleId === article.id ? (
                      <VolumeX className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    onClick={() => handleShare(article)}
                    type="button"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 cursor-pointer transition-colors"
                    title="Copy article link"
                  >
                    {copiedUrl === article.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Share2 className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {onBookmark && (
                    <button
                      onClick={() => onBookmark({ id: article.id, title: article.title, url: article.url, snippet: article.snippet })}
                      type="button"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800/60 cursor-pointer transition-colors"
                      title="Save to Collection"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {onOpenStoryReader ? (
                    <button
                      type="button"
                      onClick={() => onOpenStoryReader(article)}
                      className="px-2.5 py-1 rounded-lg bg-blue-950/50 hover:bg-blue-900/60 border border-blue-500/30 hover:border-blue-400 text-blue-300 hover:text-white font-bold font-sans text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-xs"
                      title="Read the full story right here in the app"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                      <span>Read Story</span>
                    </button>
                  ) : (
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <span>Read full story</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 transition-colors"
                    title="Open in external browser (new tab)"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
};

export default NewsResultsView;
