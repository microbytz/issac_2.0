import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  Star,
  Search,
  Trash2,
  ExternalLink,
  Plus,
  Check,
  X,
  Radio,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';

export interface SavedAlert {
  id: string;
  query: string;
  created_at: string;
  frequency: 'realtime' | 'daily' | 'weekly';
  notes?: string;
  lastChecked?: string;
  unreadCount?: number;
}

interface SavedQueriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentQuery: string;
  onRunQuery: (query: string) => void;
  isLight: boolean;
  onNotify?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const STORAGE_KEY = 'isaac_saved_alerts';

export const getSavedAlerts = (): SavedAlert[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Default initial starter alerts
      const initial: SavedAlert[] = [
        {
          id: 'alert_1',
          query: 'fastapi whoosh search',
          created_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
          frequency: 'daily',
          notes: 'Full-text search engine microservice updates',
          unreadCount: 2
        },
        {
          id: 'alert_2',
          query: 'quantum computing breakthroughs',
          created_at: new Date(Date.now() - 3600000 * 24 * 7).toISOString(),
          frequency: 'weekly',
          notes: 'Track major quantum hardware benchmarks',
          unreadCount: 5
        }
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const saveAlertsToStorage = (alerts: SavedAlert[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch (_) {}
};

export const SavedQueriesModal: React.FC<SavedQueriesModalProps> = ({
  isOpen,
  onClose,
  currentQuery,
  onRunQuery,
  isLight,
  onNotify
}) => {
  const [alerts, setAlerts] = useState<SavedAlert[]>([]);
  const [newQueryInput, setNewQueryInput] = useState(currentQuery || '');
  const [newNotesInput, setNewNotesInput] = useState('');
  const [newFrequency, setNewFrequency] = useState<'realtime' | 'daily' | 'weekly'>('daily');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAlerts(getSavedAlerts());
      if (currentQuery) {
        setNewQueryInput(currentQuery);
      }
    }
  }, [isOpen, currentQuery]);

  if (!isOpen) return null;

  const isCurrentQuerySaved = alerts.some(
    a => a.query.toLowerCase().trim() === currentQuery.toLowerCase().trim()
  );

  const handleAddAlert = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanQ = newQueryInput.trim();
    if (!cleanQ) {
      onNotify?.('Please provide a query keyword to monitor.', 'error');
      return;
    }

    if (alerts.some(a => a.query.toLowerCase().trim() === cleanQ.toLowerCase())) {
      onNotify?.(`Alert for "${cleanQ}" is already being monitored.`, 'info');
      return;
    }

    const newAlert: SavedAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      query: cleanQ,
      created_at: new Date().toISOString(),
      frequency: newFrequency,
      notes: newNotesInput.trim() || undefined,
      unreadCount: 1
    };

    const updated = [newAlert, ...alerts];
    setAlerts(updated);
    saveAlertsToStorage(updated);
    setIsAdding(false);
    setNewNotesInput('');
    onNotify?.(`Search alert created for "${cleanQ}". You will receive topic monitors!`, 'success');
  };

  const handleDeleteAlert = (id: string, q: string) => {
    const updated = alerts.filter(a => a.id !== id);
    setAlerts(updated);
    saveAlertsToStorage(updated);
    onNotify?.(`Removed search alert for "${q}".`, 'info');
  };

  const handleMarkAsRead = (id: string) => {
    const updated = alerts.map(a => (a.id === id ? { ...a, unreadCount: 0 } : a));
    setAlerts(updated);
    saveAlertsToStorage(updated);
  };

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Saved Search Alerts and Query Monitors"
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
                    ? 'bg-amber-50 border-amber-200 text-amber-600'
                    : 'bg-amber-950/60 border-amber-800/60 text-amber-400'
                }`}
              >
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold font-sans tracking-tight">Search Alerts & Monitors</h2>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border bg-amber-500/15 border-amber-500/30 text-amber-400">
                    {alerts.length} Active
                  </span>
                </div>
                <p className="text-xs text-slate-400">Subscribe to queries and track new discoveries & web mentions</p>
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

          {/* Body Content */}
          <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto no-scrollbar">
            {/* Quick action: Save Current Search */}
            {currentQuery.trim() && !isCurrentQuerySaved && (
              <div
                className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                  isLight
                    ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                    : 'bg-amber-950/20 border-amber-900/50 text-amber-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Star className="w-4 h-4 text-amber-500 shrink-0 fill-amber-500/30" />
                  <div className="text-xs">
                    <span className="font-semibold">Monitor current search: </span>
                    <span className="font-mono font-bold underline">"{currentQuery}"</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewQueryInput(currentQuery);
                    setIsAdding(true);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white cursor-pointer transition-all active:scale-95 shadow-xs shrink-0 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Subscribe</span>
                </button>
              </div>
            )}

            {/* Add New Alert Form */}
            {isAdding ? (
              <form
                onSubmit={handleAddAlert}
                className={`p-4 rounded-xl border space-y-3.5 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/40 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                    New Query Subscription
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Search Keywords</label>
                  <input
                    type="text"
                    value={newQueryInput}
                    onChange={(e) => setNewQueryInput(e.target.value)}
                    placeholder="e.g. quantum computing, next.js 15, cancer research"
                    className={`w-full px-3 py-2 rounded-lg text-xs border outline-none font-sans ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                        : 'bg-[#050a1a] border-slate-700 text-slate-100 focus:border-blue-500'
                    }`}
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Check Frequency</label>
                    <select
                      value={newFrequency}
                      onChange={(e) => setNewFrequency(e.target.value as any)}
                      className={`w-full px-3 py-2 rounded-lg text-xs border outline-none font-sans ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900'
                          : 'bg-[#050a1a] border-slate-700 text-slate-100'
                      }`}
                    >
                      <option value="realtime">⚡ Live Stream (Instant)</option>
                      <option value="daily">📅 Daily Digest</option>
                      <option value="weekly">🗓️ Weekly Summary</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Tag / Note (Optional)</label>
                    <input
                      type="text"
                      value={newNotesInput}
                      onChange={(e) => setNewNotesInput(e.target.value)}
                      placeholder="e.g. AI project, market watch"
                      className={`w-full px-3 py-2 rounded-lg text-xs border outline-none font-sans ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                          : 'bg-[#050a1a] border-slate-700 text-slate-100 focus:border-blue-500'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-all active:scale-95 shadow-sm flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Create Alert</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">
                  {alerts.length} search queries actively monitored
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setNewQueryInput(currentQuery || '');
                    setIsAdding(true);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-blue-500/30 bg-blue-950/30 hover:bg-blue-900/40 text-blue-400 hover:text-blue-300 text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Alert</span>
                </button>
              </div>
            )}

            {/* Alerts List */}
            {alerts.length === 0 ? (
              <div
                className={`p-8 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/30 border-slate-800'
                }`}
              >
                <Bell className="w-8 h-8 text-slate-500/40" />
                <div className="text-sm font-semibold text-slate-400">No Search Alerts Created</div>
                <p className="text-xs text-slate-500 max-w-sm">
                  Subscribe to topics or keywords to monitor new articles, blog posts, and research papers across the web.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      isLight
                        ? 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                        : 'bg-[#070e24]/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <button
                          type="button"
                          onClick={() => {
                            onRunQuery(alert.query);
                            handleMarkAsRead(alert.id);
                            onClose();
                          }}
                          className="font-bold text-sm text-blue-400 hover:underline flex items-center gap-1.5 text-left cursor-pointer truncate"
                          title="Execute search for this query"
                        >
                          <span>{alert.query}</span>
                          <Search className="w-3 h-3 text-slate-500 shrink-0" />
                        </button>

                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-md border font-semibold capitalize ${
                            alert.frequency === 'realtime'
                              ? 'bg-red-500/10 text-red-400 border-red-500/30'
                              : alert.frequency === 'daily'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                          }`}
                        >
                          {alert.frequency}
                        </span>

                        {(alert.unreadCount ?? 0) > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-black font-mono">
                            +{alert.unreadCount} new
                          </span>
                        )}
                      </div>

                      {alert.notes && (
                        <p className="text-xs text-slate-400 truncate font-sans">{alert.notes}</p>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Added {new Date(alert.created_at).toLocaleDateString()}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onRunQuery(alert.query);
                          handleMarkAsRead(alert.id);
                          onClose();
                        }}
                        className={`p-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                          isLight
                            ? 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200'
                            : 'bg-blue-950/40 hover:bg-blue-900/60 text-blue-400 border-blue-800/40'
                        }`}
                        title="Run search query now"
                      >
                        <Search className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteAlert(alert.id, alert.query)}
                        className={`p-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                          isLight
                            ? 'hover:bg-red-50 text-slate-400 hover:text-red-600 border-slate-200 hover:border-red-200'
                            : 'hover:bg-red-950/40 text-slate-500 hover:text-red-400 border-slate-800 hover:border-red-900/40'
                        }`}
                        title="Delete alert"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Informational Footer */}
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                isLight
                  ? 'bg-blue-50/40 border-blue-200/60 text-slate-600'
                  : 'bg-blue-950/20 border-blue-900/40 text-slate-400'
              }`}
            >
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-semibold text-slate-300">How Search Alerts work: </span>
                Isaac continuously checks newly indexed web pages, crawler discoveries, and live news for keywords matching your alerts. You can jump directly into any query feed with fresh results at any time.
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SavedQueriesModal;
