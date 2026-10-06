import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Calculator,
  BookOpen,
  ArrowRightLeft,
  Palette,
  Clock,
  Timer,
  Volume2,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  CloudSun,
  Droplets,
  Wind,
  CloudRain,
  MapPin,
  TrendingUp,
  Share2
} from 'lucide-react';

import {
  DictionaryEntry,
  extractDictionaryQuery,
  lookupDictionaryWord,
  getImmediateDictionaryEntry
} from '../utils/dictionaryService';

import {
  UnitCategory,
  ConversionResult,
  UNITS_REGISTRY,
  parseUnitConversion,
  executeConversion,
  findUnitByAlias
} from '../utils/unitConverterService';

import {
  WikiEntityInfobox,
  normalizeEntityQuery,
  getOfflineWikiEntity,
  lookupWikipediaEntity
} from '../utils/wikipediaService';

import {
  WeatherData,
  parseWeatherQuery,
  fetchCityWeather,
  getWeatherConditionInfo
} from '../utils/weatherService';

export interface InstantAnswerProps {
  query: string;
  isLight: boolean;
  onSelectTag?: (tag: string) => void;
}

// ----------------------------------------------------------------------------
// Math Evaluator & Calculator Helpers
// ----------------------------------------------------------------------------
function evaluateMathExpression(expr: string): number | null {
  try {
    let clean = expr
      .replace(/what is/gi, '')
      .replace(/calculate/gi, '')
      .replace(/calc/gi, '')
      .replace(/x/g, '*')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/π/g, 'Math.PI')
      .replace(/\bpi\b/gi, 'Math.PI')
      .replace(/\bsqrt\(([^)]+)\)/gi, 'Math.sqrt($1)')
      .trim();

    if (!/^[0-9+\-*/().\s^%MathPIsqrt,]+$/.test(clean)) {
      return null;
    }

    clean = clean.replace(/\^/g, '**');

    if (clean.includes('%')) {
      clean = clean.replace(/(\d+(?:\.\d+)?)\s*%\s*(?:of)?\s*(\d+(?:\.\d+)?)/gi, '($1/100)*$2');
      clean = clean.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)');
    }

    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${clean})`)();
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return Math.round(result * 100000000) / 100000000;
    }
  } catch (_) {}
  return null;
}

export const InstantAnswerWidget: React.FC<InstantAnswerProps> = ({ query, isLight, onSelectTag }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 1. Calculator State
  const [calcInput, setCalcInput] = useState<string>('');
  const [calcDisplay, setCalcDisplay] = useState<string>('');

  // 2. Unit Converter State
  const [convFromVal, setConvFromVal] = useState<number>(1);
  const [convResult, setConvResult] = useState<ConversionResult | null>(null);
  const [selectedFromUnitId, setSelectedFromUnitId] = useState<string>('');
  const [selectedToUnitId, setSelectedToUnitId] = useState<string>('');

  // 3. Dictionary State
  const [dictData, setDictData] = useState<DictionaryEntry | null>(null);
  const [dictLoading, setDictLoading] = useState(false);

  // 4. Wikipedia Entity InfoBox State
  const [wikiEntity, setWikiEntity] = useState<WikiEntityInfobox | null>(null);
  const [wikiLoading, setWikiLoading] = useState(false);

  // 5. Weather State
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');

  // 6. Stopwatch State
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const stopwatchInterval = useRef<any>(null);

  // 7. Color Picker State
  const [pickedColor, setPickedColor] = useState('#3b82f6');

  // Clipboard copy handler
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  // Text to speech speech synthesis
  const speakText = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(u);
    }
  };

  // --------------------------------------------------------------------------
  // Intelligent Typing Debounce (ultra-responsive 120ms response time)
  // --------------------------------------------------------------------------
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    // If empty or cleared, clear immediately
    if (!query.trim()) {
      setDebouncedQuery('');
      setIsTyping(false);
      return;
    }

    // If query ends with a trailing space, user is in the middle of typing the next word
    if (query.endsWith(' ')) {
      setIsTyping(true);
      return;
    }

    // Fast-path: if query matches an immediate offline dictionary entry, bypass debounce!
    const immediateWord = extractDictionaryQuery(query);
    if (immediateWord && getImmediateDictionaryEntry(immediateWord)) {
      setDebouncedQuery(query);
      setIsTyping(false);
      return;
    }

    setIsTyping(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setIsTyping(false);
    }, 120);

    return () => {
      clearTimeout(timer);
    };
  }, [query]);

  const qClean = debouncedQuery.trim().toLowerCase();

  // --------------------------------------------------------------------------
  // 1. Math / Calculator Check
  // --------------------------------------------------------------------------
  const mathResult = useMemo(() => {
    if (/^(calc|calculator)$/i.test(qClean)) {
      return { val: 0, isKeypadOpen: true, original: '0' };
    }
    if (/[\d]/.test(qClean) && /[\+\-\*\/\^%×÷]/.test(qClean)) {
      const res = evaluateMathExpression(debouncedQuery);
      if (res !== null) {
        return { val: res, isKeypadOpen: false, original: debouncedQuery };
      }
    }
    return null;
  }, [debouncedQuery, qClean]);

  useEffect(() => {
    if (mathResult) {
      setCalcDisplay(String(mathResult.val));
      setCalcInput(mathResult.original);
    }
  }, [mathResult]);

  // --------------------------------------------------------------------------
  // 2. Unit Converter Check & Two-way bindings
  // --------------------------------------------------------------------------
  const initialConversion = useMemo(() => {
    return parseUnitConversion(debouncedQuery);
  }, [debouncedQuery]);

  useEffect(() => {
    if (initialConversion) {
      setConvResult(initialConversion);
      setConvFromVal(initialConversion.fromValue);
      setSelectedFromUnitId(initialConversion.fromUnit.id);
      setSelectedToUnitId(initialConversion.toUnit.id);
    } else {
      setConvResult(null);
    }
  }, [initialConversion]);

  // Handle unit selector changes inside the widget
  const handleRecalculateUnits = (newFromVal: number, fromId: string, toId: string) => {
    const fromUnit = UNITS_REGISTRY.find(u => u.id === fromId);
    const toUnit = UNITS_REGISTRY.find(u => u.id === toId);
    if (fromUnit && toUnit) {
      const updated = executeConversion(newFromVal, fromUnit, toUnit);
      setConvResult(updated);
      setConvFromVal(newFromVal);
    }
  };

  const handleSwapUnits = () => {
    if (convResult) {
      const newFrom = convResult.toUnit.id;
      const newTo = convResult.fromUnit.id;
      setSelectedFromUnitId(newFrom);
      setSelectedToUnitId(newTo);
      handleRecalculateUnits(convResult.toValue, newFrom, newTo);
    }
  };

  // --------------------------------------------------------------------------
  // 3. Quick Dictionary Check (Instant 0ms for offline words + snappy 120ms for API)
  // --------------------------------------------------------------------------
  // Synchronous extraction directly from current query for zero-delay offline rendering
  const rawDictWord = useMemo(() => {
    return extractDictionaryQuery(query);
  }, [query]);

  // Load offline entries immediately in 0ms without waiting for debounce
  useEffect(() => {
    if (!rawDictWord) {
      setDictData(null);
      return;
    }
    const immediate = getImmediateDictionaryEntry(rawDictWord);
    if (immediate) {
      setDictData(immediate);
    }
  }, [rawDictWord]);

  const targetDictWord = useMemo(() => {
    return extractDictionaryQuery(debouncedQuery);
  }, [debouncedQuery]);

  useEffect(() => {
    if (!targetDictWord) {
      return;
    }

    // If already resolved via immediate offline database, no network fetch needed
    const immediate = getImmediateDictionaryEntry(targetDictWord);
    if (immediate) {
      setDictData(immediate);
      setDictLoading(false);
      return;
    }

    const abortController = new AbortController();
    setDictLoading(true);
    lookupDictionaryWord(targetDictWord, abortController.signal)
      .then(res => {
        if (!abortController.signal.aborted && res) {
          setDictData(res);
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setDictLoading(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [targetDictWord]);

  // --------------------------------------------------------------------------
  // 4. Wikipedia Entity InfoBox Check (with Typo-Tolerance e.g. "issac newton")
  // --------------------------------------------------------------------------
  useEffect(() => {
    // Only search Wikipedia if this isn't already a calculator, converter, dictionary, or weather query
    if (mathResult || initialConversion || targetDictWord || isTyping) {
      if (!isTyping) setWikiEntity(null);
      return;
    }

    // Check offline database first for instant zero-latency display
    const offlineItem = getOfflineWikiEntity(debouncedQuery);
    if (offlineItem) {
      setWikiEntity(offlineItem);
      return;
    }

    // Try dynamic Wikipedia Search API
    const isEntityCandidate =
      debouncedQuery.trim().length >= 3 &&
      !/^(calc|calculator|weather|time|convert|\d+)/i.test(debouncedQuery);

    if (isEntityCandidate) {
      const abortController = new AbortController();
      setWikiLoading(true);
      lookupWikipediaEntity(debouncedQuery)
        .then(res => {
          if (!abortController.signal.aborted) {
            setWikiEntity(res);
          }
        })
        .finally(() => {
          if (!abortController.signal.aborted) {
            setWikiLoading(false);
          }
        });

      return () => {
        abortController.abort();
      };
    } else {
      setWikiEntity(null);
    }
  }, [debouncedQuery, mathResult, initialConversion, targetDictWord, isTyping]);

  // --------------------------------------------------------------------------
  // 5. Weather Widget Check
  // --------------------------------------------------------------------------
  const weatherCityParsed = useMemo(() => {
    return parseWeatherQuery(debouncedQuery);
  }, [debouncedQuery]);

  useEffect(() => {
    if (!weatherCityParsed || isTyping) {
      if (!weatherCityParsed) setWeatherData(null);
      return;
    }

    const abortController = new AbortController();
    setWeatherLoading(true);
    fetchCityWeather(weatherCityParsed.city, abortController.signal)
      .then(data => {
        if (!abortController.signal.aborted) {
          setWeatherData(data);
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setWeatherLoading(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [weatherCityParsed, isTyping]);

  // --------------------------------------------------------------------------
  // 6. World Time Check
  // --------------------------------------------------------------------------
  const timeCityMatch = useMemo(() => {
    const match = qClean.match(/^(?:what is the )?time (?:in|at) ([a-z\s]+)$/i) || qClean.match(/^time ([a-z\s]+)$/i);
    if (!match) return null;
    const city = match[1].trim();
    const cityZones: Record<string, string> = {
      tokyo: 'Asia/Tokyo',
      japan: 'Asia/Tokyo',
      london: 'Europe/London',
      uk: 'Europe/London',
      'new york': 'America/New_York',
      nyc: 'America/New_York',
      paris: 'Europe/Paris',
      france: 'Europe/Paris',
      berlin: 'Europe/Berlin',
      sydney: 'Australia/Sydney',
      delhi: 'Asia/Kolkata',
      india: 'Asia/Kolkata',
      mumbai: 'Asia/Kolkata',
      'san francisco': 'America/Los_Angeles',
      california: 'America/Los_Angeles',
      dubai: 'Asia/Dubai',
      singapore: 'Asia/Singapore',
      toronto: 'America/Toronto'
    };
    const tz = cityZones[city] || (city.length > 2 ? 'UTC' : null);
    if (!tz) return null;
    return { city: city.charAt(0).toUpperCase() + city.slice(1), timeZone: tz };
  }, [qClean]);

  // --------------------------------------------------------------------------
  // 7. Stopwatch & Timer Check
  // --------------------------------------------------------------------------
  const isStopwatchMatch = useMemo(() => {
    return /^(stopwatch|timer|set timer)$/i.test(qClean);
  }, [qClean]);

  useEffect(() => {
    if (stopwatchRunning) {
      stopwatchInterval.current = setInterval(() => {
        setStopwatchTime(prev => prev + 10);
      }, 10);
    } else {
      if (stopwatchInterval.current) clearInterval(stopwatchInterval.current);
    }
    return () => {
      if (stopwatchInterval.current) clearInterval(stopwatchInterval.current);
    };
  }, [stopwatchRunning]);

  // --------------------------------------------------------------------------
  // 8. Color Picker Check
  // --------------------------------------------------------------------------
  const colorMatch = useMemo(() => {
    if (/^color picker$/i.test(qClean)) return '#3b82f6';
    const hex = qClean.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) return qClean;
    return null;
  }, [qClean]);

  useEffect(() => {
    if (colorMatch) {
      setPickedColor(colorMatch);
    }
  }, [colorMatch]);

  // Immediate dictionary readiness check - displays instantaneously when definition is available
  const isDictReady = Boolean(
    dictData && rawDictWord && dictData.word.toLowerCase() === rawDictWord.toLowerCase()
  );

  // If no instant answer matched, or user is still actively typing, render nothing
  const hasActiveWidget = Boolean(
    isDictReady ||
    (!isTyping && (
      mathResult ||
      convResult ||
      dictData ||
      wikiEntity ||
      weatherData ||
      timeCityMatch ||
      isStopwatchMatch ||
      colorMatch
    ))
  );

  if (!hasActiveWidget) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className={`w-full rounded-2xl border mb-6 overflow-hidden transition-all shadow-lg animate-fade-in ${
        isLight
          ? 'bg-white border-slate-200/90 shadow-slate-100 text-slate-800'
          : 'bg-[#090f20]/90 border-blue-900/40 shadow-black/40 backdrop-blur-sm text-slate-200'
      }`}
    >
      {/* ==================================================================== */}
      {/* 1. CALCULATOR / MATH ZERO-CLICK ANSWER                              */}
      {/* ==================================================================== */}
      {mathResult && (
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider font-mono">
              <Calculator className="w-3.5 h-3.5 text-blue-400" />
              <span>Instant Calculation</span>
            </span>
            <button
              onClick={() => handleCopy(calcDisplay, 'calc')}
              type="button"
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
            >
              {copiedKey === 'calc' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div
            className={`p-4 rounded-xl border flex flex-col gap-1 text-right font-mono ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
            }`}
          >
            <span className="text-xs text-slate-500 truncate">{calcInput || query}</span>
            <span className="text-3xl sm:text-4xl font-black text-blue-400 tracking-tight">
              {calcDisplay}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800/40">
            {['C', '(', ')', '/', '7', '8', '9', '*', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '%', '='].map(btn => (
              <button
                key={btn}
                onClick={() => {
                  if (btn === 'C') {
                    setCalcInput('');
                    setCalcDisplay('0');
                  } else if (btn === '=') {
                    const res = evaluateMathExpression(calcInput);
                    if (res !== null) setCalcDisplay(String(res));
                  } else {
                    const next = calcInput + btn;
                    setCalcInput(next);
                    const res = evaluateMathExpression(next);
                    if (res !== null) setCalcDisplay(String(res));
                  }
                }}
                type="button"
                className={`py-2 rounded-lg text-sm font-bold font-mono transition-all active:scale-95 cursor-pointer ${
                  btn === '='
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs'
                    : btn === 'C'
                    ? 'bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/40'
                    : isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800'
                }`}
              >
                {btn}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. UNIT & CURRENCY CONVERTER ZERO-CLICK ANSWER                      */}
      {/* ==================================================================== */}
      {convResult && (
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider font-mono">
              <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
              <span>Unit & Currency Converter • {convResult.category}</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono">
                {convResult.rateDescription}
              </span>
              <button
                onClick={handleSwapUnits}
                type="button"
                className="px-2 py-1 rounded-md text-xs font-bold bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors flex items-center gap-1 cursor-pointer"
                title="Swap units"
              >
                <span>⇄</span>
                <span>Swap</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            {/* From Input Card */}
            <div
              className={`p-4 rounded-xl border flex flex-col gap-2 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From</label>
                <select
                  value={selectedFromUnitId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedFromUnitId(newId);
                    handleRecalculateUnits(convFromVal, newId, selectedToUnitId);
                  }}
                  className={`text-xs font-bold font-sans rounded-md px-2 py-1 outline-none border ${
                    isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  {UNITS_REGISTRY.filter(u => u.category === convResult.category).map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.symbol})
                    </option>
                  ))}
                </select>
              </div>

              <input
                type="number"
                step="any"
                value={convFromVal}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setConvFromVal(val);
                  handleRecalculateUnits(val, selectedFromUnitId, selectedToUnitId);
                }}
                className="w-full text-2xl sm:text-3xl font-black bg-transparent outline-none font-mono text-slate-100"
              />
            </div>

            {/* To Result Card */}
            <div
              className={`p-4 rounded-xl border flex flex-col gap-2 ${
                isLight ? 'bg-blue-50/50 border-blue-200' : 'bg-blue-950/20 border-blue-800/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Converted Result</label>
                <select
                  value={selectedToUnitId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedToUnitId(newId);
                    handleRecalculateUnits(convFromVal, selectedFromUnitId, newId);
                  }}
                  className={`text-xs font-bold font-sans rounded-md px-2 py-1 outline-none border ${
                    isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  {UNITS_REGISTRY.filter(u => u.category === convResult.category).map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.symbol})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-black font-mono text-blue-400 truncate">
                  {convResult.toValue.toLocaleString()}
                </span>
                <span className="text-sm font-bold text-blue-300 ml-2 shrink-0">{convResult.toUnit.symbol}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 font-mono pt-1">
            <span>Formula: {convResult.formula}</span>
            <button
              onClick={() => handleCopy(`${convResult.fromValue} ${convResult.fromUnit.symbol} = ${convResult.toValue} ${convResult.toUnit.symbol}`, 'conv')}
              type="button"
              className="hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
            >
              {copiedKey === 'conv' ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. QUICK DICTIONARY ZERO-CLICK ANSWER                               */}
      {/* ==================================================================== */}
      {dictData && (
        <div className="p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider font-mono">
              <BookOpen className="w-3.5 h-3.5 text-blue-400" />
              <span>Quick Dictionary • English Lexicon</span>
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => speakText(dictData.word)}
                type="button"
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer transition-colors font-sans font-bold"
                title="Pronounce word audio"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Listen</span>
              </button>
              <button
                onClick={() => handleCopy(`${dictData.word} (${dictData.partOfSpeech}): ${dictData.definition}`, 'dict')}
                type="button"
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
              >
                {copiedKey === 'dict' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-2xl sm:text-3xl font-extrabold capitalize tracking-tight font-sans text-white">
              {dictData.word}
            </h2>
            {dictData.phonetic && (
              <span className="text-sm font-mono text-slate-400">{dictData.phonetic}</span>
            )}
            {dictData.partOfSpeech && (
              <span className="text-xs font-bold italic text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded-full bg-blue-500/10">
                {dictData.partOfSpeech}
              </span>
            )}
          </div>

          {/* Definitions List */}
          <div className="flex flex-col gap-1.5">
            {dictData.definitions && dictData.definitions.length > 1 ? (
              <ol className="list-decimal pl-5 space-y-1.5 text-sm sm:text-base leading-relaxed text-slate-300">
                {dictData.definitions.map((d, idx) => (
                  <li key={idx}>{d}</li>
                ))}
              </ol>
            ) : (
              <p className="text-sm sm:text-base leading-relaxed text-slate-300">
                {dictData.definition}
              </p>
            )}
          </div>

          {dictData.example && (
            <p className="text-xs text-slate-400 italic pl-3 border-l-2 border-blue-500/40">
              "{dictData.example}"
            </p>
          )}

          {/* Synonyms & Antonyms pills */}
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/40 text-xs">
            {dictData.synonyms && dictData.synonyms.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-500 font-bold">Synonyms:</span>
                {dictData.synonyms.map(syn => (
                  <button
                    key={syn}
                    onClick={() => onSelectTag?.(syn)}
                    type="button"
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-blue-300 transition-colors cursor-pointer"
                  >
                    {syn}
                  </button>
                ))}
              </div>
            )}
            {dictData.antonyms && dictData.antonyms.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-500 font-bold">Antonyms:</span>
                {dictData.antonyms.map(ant => (
                  <span key={ant} className="px-2 py-0.5 rounded-md bg-slate-900 text-slate-400">
                    {ant}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. WIKIPEDIA INFOBOX ZERO-CLICK ANSWER (Famous People/Things)        */}
      {/* ==================================================================== */}
      {wikiEntity && !dictData && (
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider font-mono">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Wikipedia InfoBox • {wikiEntity.category}</span>
            </span>

            <div className="flex items-center gap-3">
              <button
                onClick={() => speakText(`${wikiEntity.title}. ${wikiEntity.description}`)}
                type="button"
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer transition-colors font-sans font-bold"
                title="Read biography aloud"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Listen</span>
              </button>

              <a
                href={wikiEntity.wikiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors font-sans font-bold"
              >
                <span>Read on Wikipedia</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {wikiEntity.thumbnailUrl && (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shrink-0 border border-slate-700 bg-slate-900 shadow-md">
                <img
                  src={wikiEntity.thumbnailUrl}
                  alt={wikiEntity.title}
                  className="w-full h-full object-cover object-top"
                  loading="lazy"
                />
              </div>
            )}

            <div className="flex-1 flex flex-col gap-1.5">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans text-white">
                {wikiEntity.title}
              </h2>
              <p className="text-xs font-medium text-slate-400">{wikiEntity.subtitle}</p>

              <p className="text-sm leading-relaxed text-slate-300 mt-1">
                {wikiEntity.description}
              </p>
            </div>
          </div>

          {/* Quick Attributes Fact Table */}
          {wikiEntity.attributes && wikiEntity.attributes.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-3 border-t border-slate-800/40 text-xs">
              {wikiEntity.attributes.map(attr => (
                <div key={attr.label} className="flex items-baseline justify-between py-1 border-b border-slate-800/30">
                  <span className="text-slate-500 font-bold shrink-0 mr-2">{attr.label}</span>
                  <span className="font-semibold text-slate-200 text-right">{attr.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tags */}
          {wikiEntity.tags && wikiEntity.tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {wikiEntity.tags.map(t => (
                <span
                  key={t}
                  onClick={() => onSelectTag?.(t)}
                  className="text-[10px] font-bold text-slate-400 bg-slate-800/60 hover:bg-slate-700 px-2 py-0.5 rounded-full cursor-pointer transition-colors"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. WEATHER WIDGET ZERO-CLICK ANSWER                                  */}
      {/* ==================================================================== */}
      {weatherData && (
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider font-mono">
                <CloudSun className="w-3.5 h-3.5 text-amber-400" />
                <span>Weather Forecast</span>
              </span>
              {weatherData.isLive && (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800 text-emerald-400 text-[9px] font-bold font-mono">
                  Live
                </span>
              )}
            </div>

            {/* °C / °F Unit Toggle */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-bold font-mono">
              <button
                onClick={() => setTempUnit('C')}
                type="button"
                className={`px-2.5 py-0.5 rounded-md cursor-pointer transition-all ${
                  tempUnit === 'C' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                °C
              </button>
              <button
                onClick={() => setTempUnit('F')}
                type="button"
                className={`px-2.5 py-0.5 rounded-md cursor-pointer transition-all ${
                  tempUnit === 'F' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                °F
              </button>
            </div>
          </div>

          {/* Current Weather Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-slate-900/40 to-slate-950/40 border border-blue-900/30">
            <div className="flex items-center gap-4">
              <span className="text-4xl sm:text-5xl select-none" role="img" aria-label="weather icon">
                {getWeatherConditionInfo(weatherData.weatherCode).icon}
              </span>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <h3 className="text-xl sm:text-2xl font-black text-white font-sans">
                    {weatherData.city}
                  </h3>
                  {weatherData.country && (
                    <span className="text-xs text-slate-400 font-medium font-sans">
                      • {weatherData.country}
                    </span>
                  )}
                </div>
                <span className="text-sm font-semibold text-slate-300 font-sans">
                  {weatherData.condition}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Feels like {tempUnit === 'C' ? `${weatherData.feelsLikeC}°C` : `${weatherData.feelsLikeF}°F`}
                </span>
              </div>
            </div>

            <div className="flex items-baseline gap-1 self-end sm:self-auto font-mono">
              <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                {tempUnit === 'C' ? weatherData.tempC : weatherData.tempF}
              </span>
              <span className="text-xl font-bold text-blue-400">°{tempUnit}</span>
            </div>
          </div>

          {/* Key Weather Metrics (Humidity, Wind, Rain Chance) */}
          <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
            <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/50 flex flex-col items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[10px] text-slate-400 uppercase font-bold">Humidity</span>
              <span className="font-bold text-slate-200">{weatherData.humidity}%</span>
            </div>

            <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/50 flex flex-col items-center gap-1">
              <Wind className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-[10px] text-slate-400 uppercase font-bold">Wind Speed</span>
              <span className="font-bold text-slate-200">
                {tempUnit === 'C' ? `${weatherData.windSpeedKph} km/h` : `${weatherData.windSpeedMph} mph`}
              </span>
            </div>

            <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/50 flex flex-col items-center gap-1">
              <CloudRain className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] text-slate-400 uppercase font-bold">Precipitation</span>
              <span className="font-bold text-slate-200">{weatherData.precipitationChance}%</span>
            </div>
          </div>

          {/* 5-Day Daily Forecast Row */}
          {weatherData.forecast && weatherData.forecast.length > 0 && (
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/40">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                5-Day Forecast
              </span>
              <div className="grid grid-cols-5 gap-2">
                {weatherData.forecast.map((f, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-xl border text-center flex flex-col items-center gap-1 transition-all ${
                      idx === 0
                        ? 'border-blue-600/40 bg-blue-950/20'
                        : isLight
                        ? 'border-slate-200 bg-slate-50'
                        : 'border-slate-800/80 bg-slate-950/40'
                    }`}
                  >
                    <span className="text-[11px] font-bold text-slate-300 font-sans">{f.dayName}</span>
                    <span className="text-xl select-none" role="img" aria-label="forecast icon">
                      {getWeatherConditionInfo(f.weatherCode).icon}
                    </span>
                    <div className="text-xs font-mono font-bold text-slate-200">
                      {tempUnit === 'C' ? `${f.tempMaxC}°` : `${f.tempMaxF}°`}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      {tempUnit === 'C' ? `${f.tempMinC}°` : `${f.tempMinF}°`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick city switcher buttons */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] text-slate-400">
            <span className="font-bold font-mono">Popular Cities:</span>
            {['New York', 'London', 'Tokyo', 'Paris', 'San Francisco', 'Sydney', 'Delhi'].map(c => (
              <button
                key={c}
                onClick={() => {
                  fetchCityWeather(c).then(d => {
                    if (d) setWeatherData(d);
                  });
                }}
                type="button"
                className="px-2 py-0.5 rounded-md bg-slate-800/60 hover:bg-slate-700 text-blue-300 transition-colors cursor-pointer"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. COLOR PICKER ZERO-CLICK ANSWER                                    */}
      {/* ==================================================================== */}
      {colorMatch && (
        <div className="p-5 flex flex-col gap-4">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider font-mono">
            <Palette className="w-3.5 h-3.5 text-blue-400" />
            <span>Interactive Color Picker</span>
          </span>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div
              className="w-24 h-24 rounded-2xl border-2 border-white/20 shadow-inner flex items-center justify-center relative overflow-hidden"
              style={{ backgroundColor: pickedColor }}
            >
              <input
                type="color"
                value={pickedColor}
                onChange={(e) => setPickedColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Click to pick a color"
              />
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full font-mono text-xs">
              <div
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                }`}
                onClick={() => handleCopy(pickedColor, 'hex')}
              >
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">HEX</div>
                  <div className="font-bold text-slate-200">{pickedColor.toUpperCase()}</div>
                </div>
                <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
              </div>

              <div
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                }`}
                onClick={() => handleCopy(pickedColor, 'rgb')}
              >
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">RGB</div>
                  <div className="font-bold text-slate-200 truncate">
                    {`rgb(${parseInt(pickedColor.slice(1, 3), 16) || 0}, ${parseInt(pickedColor.slice(3, 5), 16) || 0}, ${parseInt(pickedColor.slice(5, 7), 16) || 0})`}
                  </div>
                </div>
                <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
              </div>

              <div
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                }`}
                onClick={() => handleCopy(pickedColor, 'swatch')}
              >
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Format</div>
                  <div className="font-bold text-emerald-400">
                    {copiedKey ? 'Copied!' : 'Click to Copy'}
                  </div>
                </div>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 7. WORLD TIME ZERO-CLICK ANSWER                                      */}
      {/* ==================================================================== */}
      {timeCityMatch && (
        <div className="p-5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider font-mono">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Current Time in {timeCityMatch.city}</span>
            </span>
            <div className="text-3xl sm:text-4xl font-black font-mono text-blue-400 tracking-tight">
              {new Date().toLocaleTimeString('en-US', { timeZone: timeCityMatch.timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-xs text-slate-400">
              {new Date().toLocaleDateString('en-US', { timeZone: timeCityMatch.timeZone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>

          <div
            className={`px-4 py-2.5 rounded-xl border text-xs font-mono ${
              isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950/60 border-slate-800 text-slate-300'
            }`}
          >
            <span>Timezone: </span>
            <span className="font-bold text-blue-400">{timeCityMatch.timeZone}</span>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 8. STOPWATCH & TIMER ZERO-CLICK ANSWER                               */}
      {/* ==================================================================== */}
      {isStopwatchMatch && (
        <div className="p-5 flex flex-col gap-4">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider font-mono">
            <Timer className="w-3.5 h-3.5 text-blue-400" />
            <span>Interactive Stopwatch</span>
          </span>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-4xl sm:text-5xl font-mono font-black text-blue-400 tracking-wider">
              {`${Math.floor(stopwatchTime / 60000).toString().padStart(2, '0')}:${Math.floor((stopwatchTime % 60000) / 1000).toString().padStart(2, '0')}.${Math.floor((stopwatchTime % 1000) / 10).toString().padStart(2, '0')}`}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setStopwatchRunning(!stopwatchRunning)}
                type="button"
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all active:scale-95 ${
                  stopwatchRunning
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30'
                }`}
              >
                {stopwatchRunning ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Start</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setStopwatchRunning(false);
                  setStopwatchTime(0);
                }}
                type="button"
                className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer active:scale-95 transition-all ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                }`}
                title="Reset stopwatch"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default InstantAnswerWidget;
