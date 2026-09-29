import React, { useEffect, useRef } from 'react';
import { TrendingUp, ExternalLink } from 'lucide-react';

interface TradingViewWidgetProps {
  symbol: string;
  companyName: string;
  isLight?: boolean;
}

export default function TradingViewWidget({
  symbol,
  companyName,
  isLight = false
}: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '320px';
    widgetDiv.style.width = '100%';
    container.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: isLight ? 'light' : 'dark',
      style: '1',
      locale: 'en',
      allow_symbol_change: true,
      calendar: false,
      support_host: 'https://www.tradingview.com'
    });

    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [symbol, isLight]);

  const cleanTicker = symbol.includes(':') ? symbol.split(':')[1] : symbol;

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all ${
        isLight
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-zinc-900/90 border-zinc-800 shadow-lg'
      }`}
    >
      <div
        className={`px-4 py-3 border-b flex items-center justify-between gap-3 ${
          isLight ? 'border-slate-200 bg-slate-50/70' : 'border-zinc-800/80 bg-zinc-950/60'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`p-1.5 rounded-lg border shrink-0 ${
              isLight
                ? 'bg-slate-100 border-slate-300 text-slate-700'
                : 'bg-zinc-800 border-zinc-700 text-zinc-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold tracking-tight truncate ${
                  isLight ? 'text-slate-900' : 'text-zinc-100'
                }`}
              >
                {companyName}
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                  isLight
                    ? 'bg-slate-100 text-slate-700 border-slate-300'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                }`}
              >
                {symbol}
              </span>
            </div>
            <p className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
              Live Interactive Market Chart • Auto-detected from query
            </p>
          </div>
        </div>

        <a
          href={`https://www.tradingview.com/symbols/${symbol.replace(':', '-')}/`}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-colors shrink-0 ${
            isLight
              ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
          }`}
        >
          <span>{cleanTicker} Quote</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div
        ref={containerRef}
        className="tradingview-widget-container w-full"
        style={{ height: '320px' }}
      />
    </div>
  );
}
