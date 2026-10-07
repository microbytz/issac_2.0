import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings,
  Shield,
  History,
  Trash2,
  X,
  Check,
  Moon,
  Sun,
  AlertCircle,
  Info,
  Sparkles,
  Database,
  ExternalLink,
  Lock,
  Zap,
  Clock,
  Server,
  Smartphone,
  RefreshCw
} from 'lucide-react';
import {
  getBackendBaseUrl,
  getCustomServerUrl,
  setCustomServerUrl,
  isMobileOrNativeApp,
  DEFAULT_REMOTE_BACKEND_URL
} from '../utils/apiConfig';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clearHistoryOnExit: boolean;
  onToggleClearHistoryOnExit: () => void;
  searchHistory: string[];
  onClearHistoryNow: () => void;
  isLight: boolean;
  onToggleTheme?: () => void;
  sessionId?: string;
  onNotify?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  clearHistoryOnExit,
  onToggleClearHistoryOnExit,
  searchHistory,
  onClearHistoryNow,
  isLight,
  onToggleTheme,
  sessionId,
  onNotify
}) => {
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [lastSessionTerminationTest, setLastSessionTerminationTest] = useState<string | null>(null);

  const [serverUrlInput, setServerUrlInput] = useState<string>(() => {
    return getCustomServerUrl() || (isMobileOrNativeApp() ? DEFAULT_REMOTE_BACKEND_URL : '');
  });
  const [serverPingStatus, setServerPingStatus] = useState<{
    testing: boolean;
    success?: boolean;
    message?: string;
    latencyMs?: number;
  }>({ testing: false });

  const handleTestServer = async () => {
    const rawTarget = serverUrlInput.trim() || getBackendBaseUrl() || (isMobileOrNativeApp() ? DEFAULT_REMOTE_BACKEND_URL : '');
    const targetUrl = rawTarget.replace(/\/$/, '');
    setServerPingStatus({ testing: true });
    const start = performance.now();
    try {
      const endpoint = `${targetUrl}/api/suggest?q=test`;
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(4500) });
      const latency = Math.round(performance.now() - start);
      if (res.ok) {
        setServerPingStatus({
          testing: false,
          success: true,
          latencyMs: latency,
          message: `Connected (${latency}ms)`
        });
      } else {
        setServerPingStatus({
          testing: false,
          success: false,
          message: `Server returned HTTP ${res.status}`
        });
      }
    } catch (_) {
      setServerPingStatus({
        testing: false,
        success: false,
        message: 'Unreachable (App will auto-fallback to direct Wikipedia / Hacker News)'
      });
    }
  };

  const handleSaveServerUrl = () => {
    setCustomServerUrl(serverUrlInput);
    if (onNotify) {
      onNotify(serverUrlInput ? `Server URL updated to: ${serverUrlInput}` : 'Reset to default server connection.', 'success');
    }
  };

  const handleResetServerUrl = () => {
    setCustomServerUrl('');
    setServerUrlInput(isMobileOrNativeApp() ? DEFAULT_REMOTE_BACKEND_URL : '');
    if (onNotify) {
      onNotify('Server connection restored to default.', 'info');
    }
  };

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleManualClear = () => {
    onClearHistoryNow();
    setShowConfirmClear(false);
    if (onNotify) {
      onNotify('Search history cleared from localStorage and current session.', 'success');
    }
  };

  const handleSimulateTermination = () => {
    // Allows user to test/verify that localStorage search history is wiped
    localStorage.removeItem('isaac_history');
    sessionStorage.removeItem('isaac_history_session_cache');
    setLastSessionTerminationTest(new Date().toLocaleTimeString());
    if (onNotify) {
      onNotify('Simulated session termination: localStorage search history wiped clean.', 'info');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        id="settings-modal-backdrop"
        role="dialog" aria-modal="true" aria-label="Settings and privacy" className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <motion.div
          id="settings-modal-dialog"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={`w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden transition-colors ${
            isLight
              ? 'bg-white border-slate-200 text-slate-800'
              : 'bg-[#080d1e] border-slate-800/90 text-slate-100 shadow-blue-950/20'
          }`}
        >
          {/* Header */}
          <div
            className={`px-6 py-5 border-b flex items-center justify-between ${
              isLight ? 'border-slate-200 bg-slate-50/70' : 'border-slate-800 bg-[#0c142b]/80'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-xl border ${
                  isLight
                    ? 'bg-blue-50 border-blue-200 text-blue-600'
                    : 'bg-blue-950/60 border-blue-800/60 text-blue-400'
                }`}
              >
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold font-sans tracking-tight">Application Settings</h2>
                <p className="text-xs text-slate-500">Preferences, session storage, and privacy controls</p>
              </div>
            </div>

            <button
              id="settings-modal-close-btn"
              onClick={onClose}
              type="button"
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isLight
                  ? 'hover:bg-slate-200/70 border-slate-200 text-slate-500 hover:text-slate-800'
                  : 'hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-slate-100'
              }`}
              title="Close Settings (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body content */}
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto no-scrollbar">
            {/* Primary Section: Search History & Privacy */}
            <div
              className={`p-5 rounded-2xl border transition-all ${
                isLight
                  ? 'bg-slate-50/70 border-slate-200 shadow-xs'
                  : 'bg-[#0b1328]/50 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-sans">Search History & Privacy</h3>
                    <p className="text-xs text-slate-500">Manage query caching and browser termination behavior</p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    clearHistoryOnExit
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                  }`}
                >
                  {clearHistoryOnExit ? 'Wipe on Exit Active' : 'Standard Persistence'}
                </span>
              </div>

              {/* The "Clear History on Exit" Toggle Item */}
              <div
                id="clear-history-on-exit-setting-row"
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                  isLight
                    ? clearHistoryOnExit
                      ? 'bg-blue-50/50 border-blue-200/80'
                      : 'bg-white border-slate-200'
                    : clearHistoryOnExit
                    ? 'bg-blue-950/20 border-blue-500/30'
                    : 'bg-slate-900/40 border-slate-800/80'
                }`}
              >
                <div className="space-y-1 pr-2">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="clear-history-on-exit-toggle"
                      className="text-sm font-bold font-sans cursor-pointer select-none"
                    >
                      Clear History on Exit
                    </label>
                    <span
                      className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded border ${
                        clearHistoryOnExit
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 font-bold'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      localStorage
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Automatically purge all recent search history from <code className="text-[11px] font-mono px-1 py-0.5 rounded bg-black/20 text-blue-300">localStorage</code> when this browser session terminates or the window is closed.
                  </p>
                </div>

                {/* Custom Toggle Switch */}
                <div className="shrink-0 flex items-center gap-3">
                  <button
                    id="clear-history-on-exit-toggle"
                    role="switch"
                    aria-checked={clearHistoryOnExit}
                    onClick={onToggleClearHistoryOnExit}
                    type="button"
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      clearHistoryOnExit
                        ? 'bg-blue-600'
                        : isLight
                        ? 'bg-slate-300'
                        : 'bg-slate-700'
                    }`}
                  >
                    <span className="sr-only">Toggle Clear History on Exit</span>
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        clearHistoryOnExit ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Notice & Lifecycle Explanation */}
              <div
                className={`mt-3 p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  isLight
                    ? 'bg-blue-50/30 border-blue-200/60 text-slate-600'
                    : 'bg-blue-950/20 border-blue-900/40 text-slate-400'
                }`}
              >
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-semibold text-slate-300">How it works: </span>
                  While browsing, searches remain accessible for navigation. Once the browser session terminates (tab close, window exit, or browser restart), the application invokes the purge handler and clears cached queries from storage.
                </div>
              </div>

              {/* Current Storage Snapshot & Manual Clear Action */}
              <div className="mt-4 pt-4 border-t border-slate-800/60 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-slate-500" />
                    <span>Currently stored queries:</span>
                    <span className="font-mono font-bold text-slate-200">
                      {searchHistory.length} {searchHistory.length === 1 ? 'item' : 'items'}
                    </span>
                  </span>

                  {searchHistory.length > 0 && (
                    <button
                      id="settings-clear-history-now-btn"
                      onClick={() => setShowConfirmClear(true)}
                      type="button"
                      className="px-2.5 py-1 text-xs font-bold text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-900/40 border border-red-800/40 rounded-lg cursor-pointer transition-all flex items-center gap-1 active:scale-95"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Wipe History Now</span>
                    </button>
                  )}
                </div>

                {/* History Chips */}
                {searchHistory.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {searchHistory.map((query, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-mono border ${
                          isLight
                            ? 'bg-slate-100 border-slate-200 text-slate-700'
                            : 'bg-slate-900/80 border-slate-800 text-slate-300'
                        }`}
                      >
                        {query}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">No search history currently stored.</p>
                )}

                {/* Confirm Wipe Prompt */}
                {showConfirmClear && (
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs animate-fade-in ${
                      isLight ? 'bg-red-50 border-red-200 text-red-800' : 'bg-red-950/40 border-red-900 text-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>Erase all search history from localStorage immediately?</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleManualClear}
                        type="button"
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs"
                      >
                        Yes, Erase
                      </button>
                      <button
                        onClick={() => setShowConfirmClear(false)}
                        type="button"
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Secondary Section: System & Appearance */}
            <div
              className={`p-5 rounded-2xl border transition-all ${
                isLight
                  ? 'bg-slate-50/70 border-slate-200 shadow-xs'
                  : 'bg-[#0b1328]/50 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5 mb-4">
                <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Sun className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-sans">Theme & Display</h3>
                  <p className="text-xs text-slate-500">Color contrast and application appearance</p>
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                  isLight ? 'bg-white border-slate-200' : 'bg-slate-900/40 border-slate-800/80'
                }`}
              >
                <div>
                  <div className="text-sm font-bold font-sans">Theme Mode</div>
                  <p className="text-xs text-slate-400">
                    Currently set to <span className="font-semibold text-slate-200">{isLight ? 'High-Contrast Light' : 'Dark Mode'}</span>
                  </p>
                </div>

                {onToggleTheme && (
                  <button
                    onClick={onToggleTheme}
                    type="button"
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      isLight
                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                    }`}
                  >
                    {isLight ? (
                      <>
                        <Moon className="w-3.5 h-3.5" />
                        <span>Switch to Dark</span>
                      </>
                    ) : (
                      <>
                        <Sun className="w-3.5 h-3.5 text-amber-400" />
                        <span>Switch to Light</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Third Section: Backend Server & Mobile Connectivity */}
            <div
              className={`p-5 rounded-2xl border transition-all ${
                isLight
                  ? 'bg-slate-50/70 border-slate-200 shadow-xs'
                  : 'bg-[#0b1328]/50 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-sans">Server & Mobile Sync</h3>
                    <p className="text-xs text-slate-500">Cloud backend connection and mobile offline fallback</p>
                  </div>
                </div>

                {isMobileOrNativeApp() && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center gap-1">
                    <Smartphone className="w-3 h-3" />
                    <span>Android / Mobile</span>
                  </span>
                )}
              </div>

              <div
                className={`p-4 rounded-xl border flex flex-col gap-3 ${
                  isLight ? 'bg-white border-slate-200' : 'bg-slate-900/40 border-slate-800/80'
                }`}
              >
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Active Backend API Host
                  </label>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Used by search, live crawler, and Fireplexity AI. Mobile app connects to this host to fetch live uncrawled results.
                  </p>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={serverUrlInput}
                      onChange={(e) => setServerUrlInput(e.target.value)}
                      placeholder={isMobileOrNativeApp() ? DEFAULT_REMOTE_BACKEND_URL : 'Same Origin (/api)'}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-mono border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                        isLight
                          ? 'bg-slate-50 border-slate-300 text-slate-800'
                          : 'bg-slate-950 border-slate-700 text-slate-200'
                      }`}
                     aria-label="Server URL" />
                    <button
                      onClick={handleSaveServerUrl}
                      type="button"
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer active:scale-95 transition-all shadow-xs"
                    >
                      Save
                    </button>
                    {getCustomServerUrl() && (
                      <button
                        onClick={handleResetServerUrl}
                        type="button"
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 cursor-pointer"
                        title="Reset to default cloud server"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Connection Ping Tester */}
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <button
                    onClick={handleTestServer}
                    disabled={serverPingStatus.testing}
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${serverPingStatus.testing ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
                    <span>{serverPingStatus.testing ? 'Pinging...' : 'Test Connection'}</span>
                  </button>

                  {serverPingStatus.message && (
                    <span className={`text-[11px] font-mono flex items-center gap-1 ${
                      serverPingStatus.success ? 'text-emerald-400 font-bold' : 'text-amber-400'
                    }`}>
                      {serverPingStatus.success ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                      <span>{serverPingStatus.message}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Session Information */}
            <div className="flex items-center justify-between px-2 text-[11px] text-slate-500 font-mono">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-600" />
                <span>Session ID:</span>
                <span className="text-slate-400">{sessionId ? sessionId.slice(0, 12) + '...' : 'active-session'}</span>
              </span>
              <span>Storage Key: <code className="text-[10px] text-blue-400">isaac_history</code></span>
            </div>
          </div>

          {/* Footer */}
          <div
            className={`px-6 py-4 border-t flex items-center justify-between ${
              isLight ? 'border-slate-200 bg-slate-50/70' : 'border-slate-800 bg-[#0c142b]/80'
            }`}
          >
            <span className="text-xs text-slate-500">
              Settings persist locally in your browser.
            </span>

            <button
              id="settings-modal-done-btn"
              onClick={onClose}
              type="button"
              className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30 cursor-pointer active:scale-95 transition-all"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SettingsModal;
