import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error:', error, errorInfo);
    try {
      localStorage.setItem('isaac_last_crash', JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack || '',
        componentStack: errorInfo.componentStack || '',
        at: new Date().toISOString()
      }));
    } catch (_) {}
  }

  handleReset = () => {
    try {
      const PRESERVE_KEYS = [
        'isaac_last_crash',
        'isaac_theme',
        'isaac_server_url',
        'isaac_safesearch',
        'isaac_region_filter',
        'isaac_clear_history_on_exit',
        'isaac_clean_reading_mode',
        'isaac_open_in_new_tab',
        'isaac_results_density',
        'isaac_pagination_mode',
        'isaac_font_size',
        'isaac_reader_theme',
        'isaac_reader_font',
        'isaac_reader_font_size',
        'isaac_searxng_fallback_enabled',
        'isaac_searxng_auto_index',
        'isaac_auto_crawl_enabled',
        'isaac_fireplexity_auto_index',
        'blocked_domains'
      ];
      const saved: Record<string, string> = {};
      for (const key of PRESERVE_KEYS) {
        const val = localStorage.getItem(key);
        if (val !== null) saved[key] = val;
      }
      localStorage.clear();
      sessionStorage.clear();
      for (const [key, val] of Object.entries(saved)) {
        localStorage.setItem(key, val);
      }
    } catch (_) {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-zinc-100">Application Recovery</h2>
            {this.state.error?.name && (
              <p className="text-[11px] font-mono font-bold text-rose-400 leading-relaxed">
                {this.state.error.name}
              </p>
            )}
            <p className="text-xs text-zinc-400 leading-relaxed break-words">
              {this.state.error?.message || 'An unexpected state error occurred while rendering the workspace.'}
            </p>
            {this.state.error?.stack && (
              <p className="text-[10px] font-mono text-zinc-600 leading-relaxed break-all line-clamp-3">
                {this.state.error.stack.split('\n').slice(0, 3).join(' ')}
              </p>
            )}
            <button
              onClick={this.handleReset}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold border border-zinc-700 transition-colors cursor-pointer"
            >
              Reset Local Cache & Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);

