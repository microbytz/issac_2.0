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
  Share2,
  Key,
  QrCode,
  FileCode,
  Dices,
  Coins,
  FileText,
  RefreshCw,
  Sliders,
  Download,
  Bell,
  BellRing,
  ShieldCheck,
  Camera
} from 'lucide-react';

import {
  DictionaryEntry,
  extractDictionaryQuery,
  extractVisualCandidateWords,
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

import {
  generateSecurePassword,
  CHEATSHEETS,
  CheatsheetData,
  generateQrCodeSvg,
  generateLoremIpsum
} from '../utils/duckDuckGoUtilities';

export interface InstantAnswerProps {
  query: string;
  isLight: boolean;
  onSelectTag?: (tag: string) => void;
  activeVisualSearchImage?: string | null;
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

export const InstantAnswerWidget: React.FC<InstantAnswerProps> = ({
  query,
  isLight,
  onSelectTag,
  activeVisualSearchImage
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const isVisual = Boolean(activeVisualSearchImage);
  const candidateKeywords = useMemo(() => extractVisualCandidateWords(query), [query]);

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

  // 8. Password Generator State
  const [passwordLength, setPasswordLength] = useState<number>(16);
  const [includeUpper, setIncludeUpper] = useState<boolean>(true);
  const [includeLower, setIncludeLower] = useState<boolean>(true);
  const [includeNums, setIncludeNums] = useState<boolean>(true);
  const [includeSyms, setIncludeSyms] = useState<boolean>(true);
  const [pwSeed, setPwSeed] = useState<number>(0);

  // 9. QR Code Generator State
  const [qrInput, setQrInput] = useState<string>('');

  // 10. Developer Cheatsheet State
  const [cheatsheetFilter, setCheatsheetFilter] = useState<string>('');

  // 11. Countdown Timer State
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number>(300);
  const [timerTotalDuration, setTimerTotalDuration] = useState<number>(300);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  // 12. Coin Flip & Dice Roller State
  const [coinSide, setCoinSide] = useState<'HEADS' | 'TAILS'>('HEADS');
  const [diceVal, setDiceVal] = useState<number>(6);
  const [isFlippingRolling, setIsFlippingRolling] = useState(false);
  const [flipStats, setFlipStats] = useState({ heads: 0, tails: 0 });

  // 13. Lorem Ipsum Generator State
  const [loremParas, setLoremParas] = useState<number>(3);

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
    return extractDictionaryQuery(query, isVisual);
  }, [query, isVisual]);

  const handleInspectWord = (word: string) => {
    const immediate = getImmediateDictionaryEntry(word);
    if (immediate) {
      setDictData(immediate);
    } else {
      setDictLoading(true);
      lookupDictionaryWord(word).then(res => {
        if (res) setDictData(res);
      }).finally(() => {
        setDictLoading(false);
      });
    }
  };

  // Load offline entries immediately in 0ms without waiting for debounce
  useEffect(() => {
    if (!rawDictWord) {
      if (!isVisual) {
        setDictData(null);
      }
      return;
    }
    const immediate = getImmediateDictionaryEntry(rawDictWord);
    if (immediate) {
      setDictData(immediate);
    }
  }, [rawDictWord, isVisual]);

  const targetDictWord = useMemo(() => {
    return extractDictionaryQuery(debouncedQuery, isVisual);
  }, [debouncedQuery, isVisual]);

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

  // Visual Search fallback: ensure dictionary definition displays when searching by image
  useEffect(() => {
    if (isVisual && !dictData) {
      const bestWord = rawDictWord || targetDictWord || (candidateKeywords.length > 0 ? candidateKeywords[0] : 'image');
      if (bestWord) {
        handleInspectWord(bestWord);
      }
    }
  }, [isVisual, dictData, rawDictWord, targetDictWord, candidateKeywords]);

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

  // --------------------------------------------------------------------------
  // 9. Password Generator Check
  // --------------------------------------------------------------------------
  const passwordMatch = useMemo(() => {
    const m = qClean.match(/^(?:password|generate password|pw|random password)(?:\s+(\d+))?$/i);
    if (!m) return null;
    const len = m[1] ? parseInt(m[1], 10) : passwordLength;
    return { targetLength: Math.max(6, Math.min(64, len)) };
  }, [qClean, passwordLength]);

  const activePassword = useMemo(() => {
    if (!passwordMatch) return null;
    return generateSecurePassword({
      length: passwordMatch.targetLength,
      includeUppercase: includeUpper,
      includeLowercase: includeLower,
      includeNumbers: includeNums,
      includeSymbols: includeSyms
    });
  }, [passwordMatch, includeUpper, includeLower, includeNums, includeSyms, pwSeed]);

  // --------------------------------------------------------------------------
  // 10. QR Code Generator Check
  // --------------------------------------------------------------------------
  const qrCodeMatch = useMemo(() => {
    const m = debouncedQuery.match(/^(?:qr(?:\s*code)?)\s*(.*)$/i);
    if (!m) return null;
    return m[1].trim() || 'https://duckduckgo.com';
  }, [debouncedQuery]);

  useEffect(() => {
    if (qrCodeMatch) setQrInput(qrCodeMatch);
  }, [qrCodeMatch]);

  // --------------------------------------------------------------------------
  // 11. Developer Cheatsheet Check
  // --------------------------------------------------------------------------
  const cheatsheetMatch = useMemo(() => {
    for (const key of Object.keys(CHEATSHEETS)) {
      if (
        (qClean.includes(key) && (qClean.includes('cheat') || qClean.includes('sheet') || qClean.includes('reference'))) ||
        (qClean.startsWith('cheat') && qClean.includes(key))
      ) {
        return CHEATSHEETS[key];
      }
    }
    return null;
  }, [qClean]);

  // --------------------------------------------------------------------------
  // 12. Interactive Countdown Timer Check
  // --------------------------------------------------------------------------
  const countdownTimerMatch = useMemo(() => {
    const m = qClean.match(/^(?:timer|countdown)(?:\s+(\d+)\s*(m(?:in(?:ute)?s?)?|s(?:ec(?:ond)?s?)?|h(?:(?:ou)?rs?)?))?$/i);
    if (!m) return null;
    const val = m[1] ? parseInt(m[1], 10) : 5;
    const unit = m[2] ? m[2][0] : 'm';
    const totalSec = unit === 'h' ? val * 3600 : unit === 's' ? val : val * 60;
    return Math.max(5, Math.min(3600 * 24, totalSec));
  }, [qClean]);

  useEffect(() => {
    if (countdownTimerMatch) {
      setTimerTotalDuration(countdownTimerMatch);
      setTimerSecondsLeft(countdownTimerMatch);
      setTimerRunning(false);
    }
  }, [countdownTimerMatch]);

  useEffect(() => {
    let interval: any = null;
    if (timerRunning && timerSecondsLeft > 0) {
      interval = setInterval(() => {
        setTimerSecondsLeft(prev => {
          if (prev <= 1) {
            setTimerRunning(false);
            try {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(587.33, ctx.currentTime);
              osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
              gain.gain.setValueAtTime(0.3, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.6);
            } catch (_) {}
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning, timerSecondsLeft]);

  // --------------------------------------------------------------------------
  // 13. Coin Flip & Dice Roller Check
  // --------------------------------------------------------------------------
  const coinDiceMatch = useMemo(() => {
    if (/^(?:flip\s*a?\s*coin|coin\s*flip|coin\s*toss)$/i.test(qClean)) {
      return { type: 'coin' as const };
    }
    const dMatch = qClean.match(/^(?:roll\s*a?\s*die|roll\s*dice|roll\s*d(\d+))$/i);
    if (dMatch) {
      const sides = dMatch[1] ? parseInt(dMatch[1], 10) : 6;
      return { type: 'dice' as const, sides: Math.max(2, Math.min(100, sides)) };
    }
    return null;
  }, [qClean]);

  const handleFlipCoin = () => {
    setIsFlippingRolling(true);
    setTimeout(() => {
      const isHeads = Math.random() > 0.5;
      const res = isHeads ? 'HEADS' : 'TAILS';
      setCoinSide(res);
      setFlipStats(prev => ({
        heads: prev.heads + (isHeads ? 1 : 0),
        tails: prev.tails + (!isHeads ? 1 : 0)
      }));
      setIsFlippingRolling(false);
    }, 320);
  };

  const handleRollDice = (sides: number) => {
    setIsFlippingRolling(true);
    setTimeout(() => {
      const res = Math.floor(Math.random() * sides) + 1;
      setDiceVal(res);
      setIsFlippingRolling(false);
    }, 320);
  };

  // --------------------------------------------------------------------------
  // 14. Lorem Ipsum Generator Check
  // --------------------------------------------------------------------------
  const loremMatch = useMemo(() => {
    const m = qClean.match(/^(?:lorem\s*ipsum|dummy\s*text)(?:\s+(\d+))?$/i);
    if (!m) return null;
    return m[1] ? Math.max(1, Math.min(10, parseInt(m[1], 10))) : 3;
  }, [qClean]);

  useEffect(() => {
    if (loremMatch) setLoremParas(loremMatch);
  }, [loremMatch]);

  const loremText = useMemo(() => {
    if (!loremMatch) return '';
    return generateLoremIpsum(loremParas);
  }, [loremMatch, loremParas]);

  // Immediate dictionary readiness check - displays instantaneously when definition is available
  const isDictReady = Boolean(
    dictData && (isVisual || (rawDictWord && dictData.word.toLowerCase() === rawDictWord.toLowerCase()))
  );

  // If no instant answer matched, or user is still actively typing, render nothing
  const hasActiveWidget = Boolean(
    activeVisualSearchImage ||
    isDictReady ||
    (!isTyping && (
      mathResult ||
      convResult ||
      dictData ||
      wikiEntity ||
      weatherData ||
      timeCityMatch ||
      isStopwatchMatch ||
      colorMatch ||
      passwordMatch ||
      qrCodeMatch ||
      cheatsheetMatch ||
      countdownTimerMatch ||
      coinDiceMatch ||
      loremMatch
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
      {/* 0. VISUAL SEARCH & IMAGE MATCH CARD                                 */}
      {/* ==================================================================== */}
      {activeVisualSearchImage && (
        <div className={`p-5 border-b flex flex-col gap-4 ${
          isLight ? 'bg-indigo-50/70 border-indigo-100 text-slate-800' : 'bg-indigo-950/25 border-indigo-900/50 text-slate-200'
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider font-mono">
              <Camera className="w-3.5 h-3.5" />
              <span>Visual Search Analysis & Instant Lexicon</span>
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
              Image Target Active
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-20 h-20 rounded-xl overflow-hidden border border-indigo-500/40 shrink-0 shadow-md bg-black/40">
              <img
                src={activeVisualSearchImage}
                alt="Active visual search target"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400 font-sans">Visual Subject Definition:</span>
                <span className="text-sm font-bold text-indigo-300 uppercase tracking-wide bg-indigo-500/20 px-2.5 py-0.5 rounded-lg border border-indigo-500/30">
                  {dictData?.word || targetDictWord || rawDictWord || (candidateKeywords[0] || 'Image')}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans leading-relaxed">
                Displaying English lexicon definitions, parts of speech, and knowledge references matching this image.
              </p>

              {/* Related keyword pills */}
              {candidateKeywords.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[11px] text-slate-400 font-mono">Inspect terms:</span>
                  {candidateKeywords.map(term => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => handleInspectWord(term)}
                      className={`text-[11px] px-2.5 py-0.5 rounded-md border font-sans font-medium transition-all cursor-pointer ${
                        dictData?.word.toLowerCase() === term.toLowerCase()
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                          : isLight
                          ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                          : 'bg-slate-900/80 hover:bg-slate-800 text-indigo-300 border-indigo-900/60'
                      }`}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
                 aria-label="Convert from unit">
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
               aria-label="Value to convert" />
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
                 aria-label="Convert to unit">
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
               aria-label="Pick a color" />
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

      {/* ==================================================================== */}
      {/* 9. PASSWORD GENERATOR ZERO-CLICK ANSWER                              */}
      {/* ==================================================================== */}
      {passwordMatch && activePassword && (
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider font-mono">
              <Key className="w-3.5 h-3.5 text-blue-400" />
              <span>Password Generator</span>
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                activePassword.strength === 'very_strong'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : activePassword.strength === 'strong'
                  ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
              }`}>
                {activePassword.strength.replace('_', ' ').toUpperCase()} • {activePassword.entropyBits} bits
              </span>
            </div>
          </div>

          <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
          }`}>
            <div className="font-mono text-base sm:text-lg font-bold tracking-wider select-all break-all text-slate-100">
              {activePassword.password}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setPwSeed(prev => prev + 1)}
                type="button"
                className="p-2 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 cursor-pointer transition-all active:scale-95"
                title="Regenerate Password"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleCopy(activePassword.password, 'password')}
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer shadow-sm active:scale-95 transition-all"
              >
                {copiedKey === 'password' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Copied!</span>
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

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs pt-1 border-t border-slate-800/60 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-slate-400 font-mono">Length: <strong className="text-slate-200">{passwordLength}</strong></span>
              <input
                type="range"
                min="8"
                max="48"
                value={passwordLength}
                onChange={(e) => setPasswordLength(parseInt(e.target.value, 10))}
                className="w-28 sm:w-36 accent-blue-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 flex-wrap">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeUpper}
                  onChange={(e) => setIncludeUpper(e.target.checked)}
                  className="rounded accent-blue-500"
                />
                <span>A-Z</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeNums}
                  onChange={(e) => setIncludeNums(e.target.checked)}
                  className="rounded accent-blue-500"
                />
                <span>0-9</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSyms}
                  onChange={(e) => setIncludeSyms(e.target.checked)}
                  className="rounded accent-blue-500"
                />
                <span>!@#$</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 10. QR CODE GENERATOR ZERO-CLICK ANSWER                              */}
      {/* ==================================================================== */}
      {qrCodeMatch && (
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider font-mono">
              <QrCode className="w-3.5 h-3.5 text-blue-400" />
              <span>QR Code Generator</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500">Vector SVG Format</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div
              className="p-3 bg-white rounded-2xl shadow-md border border-slate-300 text-black flex items-center justify-center shrink-0"
              dangerouslySetInnerHTML={{ __html: generateQrCodeSvg(qrInput || qrCodeMatch, 160) }}
            />

            <div className="flex-1 w-full flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-slate-400 mb-1 block">Content / Target URL</label>
                <input
                  type="text"
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  placeholder="Enter text or URL..."
                  className={`w-full px-3 py-2 rounded-xl text-xs font-mono border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-slate-950 border-slate-800 text-slate-200'
                  }`}
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const svgData = generateQrCodeSvg(qrInput || qrCodeMatch, 256);
                    handleCopy(svgData, 'qr-svg');
                  }}
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer shadow-sm transition-all"
                >
                  {copiedKey === 'qr-svg' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>SVG Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy SVG Code</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    const svgData = generateQrCodeSvg(qrInput || qrCodeMatch, 512);
                    const blob = new Blob([svgData], { type: 'image/svg+xml' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'qrcode.svg';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download SVG</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 11. DEVELOPER CHEATSHEET ZERO-CLICK ANSWER                           */}
      {/* ==================================================================== */}
      {cheatsheetMatch && (
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5 uppercase tracking-wider font-mono">
              <FileCode className="w-3.5 h-3.5 text-purple-400" />
              <span>{cheatsheetMatch.title}</span>
            </span>
            <input
              type="text"
              value={cheatsheetFilter}
              onChange={(e) => setCheatsheetFilter(e.target.value)}
              placeholder="Filter commands..."
              className={`px-2.5 py-1 rounded-lg text-xs font-mono border focus:outline-none focus:ring-1 focus:ring-purple-500 w-36 sm:w-48 ${
                isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-slate-950 border-slate-800 text-slate-200'
              }`}
            />
          </div>

          <p className="text-xs text-slate-400">{cheatsheetMatch.description}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-1">
            {cheatsheetMatch.categories.map((cat, cIdx) => {
              const filteredItems = cat.items.filter(
                it => !cheatsheetFilter || 
                it.command.toLowerCase().includes(cheatsheetFilter.toLowerCase()) || 
                it.description.toLowerCase().includes(cheatsheetFilter.toLowerCase())
              );
              if (filteredItems.length === 0) return null;
              return (
                <div key={cIdx} className={`p-3.5 rounded-xl border flex flex-col gap-2.5 ${
                  isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-slate-950/40 border-slate-800/80'
                }`}>
                  <h4 className="text-xs font-bold text-purple-400 font-mono tracking-wide">{cat.category}</h4>
                  <div className="flex flex-col gap-2">
                    {filteredItems.map((item, iIdx) => (
                      <div key={iIdx} className="flex items-center justify-between gap-2 text-xs group">
                        <div className="min-w-0">
                          <code className="text-purple-300 font-mono font-bold block truncate">{item.command}</code>
                          <span className="text-[11px] text-slate-400 block truncate">{item.description}</span>
                        </div>
                        <button
                          onClick={() => handleCopy(item.command, `cheat-${cIdx}-${iIdx}`)}
                          type="button"
                          className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800/80 cursor-pointer shrink-0 transition-colors"
                          title="Copy command"
                        >
                          {copiedKey === `cheat-${cIdx}-${iIdx}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 12. COUNTDOWN TIMER ZERO-CLICK ANSWER                                */}
      {/* ==================================================================== */}
      {countdownTimerMatch && (
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider font-mono">
              <Bell className="w-3.5 h-3.5 text-blue-400" />
              <span>Countdown Timer</span>
            </span>
            <span className="text-xs font-mono text-slate-500">
              {timerRunning ? 'Running' : timerSecondsLeft === 0 ? 'Finished!' : 'Paused'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-baseline gap-2 font-mono">
              <span className={`text-4xl sm:text-5xl font-black ${
                timerSecondsLeft === 0 ? 'text-red-400 animate-pulse' : 'text-blue-400'
              }`}>
                {`${Math.floor(timerSecondsLeft / 60).toString().padStart(2, '0')}:${(timerSecondsLeft % 60).toString().padStart(2, '0')}`}
              </span>
              <span className="text-xs text-slate-500 uppercase tracking-widest font-sans font-bold">
                of {Math.floor(timerTotalDuration / 60)}m
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setTimerRunning(!timerRunning)}
                type="button"
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all active:scale-95 ${
                  timerRunning
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {timerRunning ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>{timerSecondsLeft === 0 ? 'Restart' : 'Start'}</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setTimerRunning(false);
                  setTimerSecondsLeft(timerTotalDuration);
                }}
                type="button"
                className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                title="Reset timer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 13. COIN FLIP & DICE ROLLER ZERO-CLICK ANSWER                        */}
      {/* ==================================================================== */}
      {coinDiceMatch && (
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider font-mono">
              {coinDiceMatch.type === 'coin' ? (
                <>
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>Coin Flipper</span>
                </>
              ) : (
                <>
                  <Dices className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Dice Roller (d{coinDiceMatch.sides})</span>
                </>
              )}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {coinDiceMatch.type === 'coin' ? (
                <div className={`w-16 h-16 rounded-full border-2 border-amber-400 bg-gradient-to-tr from-amber-600 to-yellow-400 text-white font-extrabold text-xs flex items-center justify-center shadow-lg transition-transform ${
                  isFlippingRolling ? 'animate-spin' : ''
                }`}>
                  {coinSide}
                </div>
              ) : (
                <div className={`w-16 h-16 rounded-2xl border-2 border-emerald-400 bg-gradient-to-tr from-emerald-700 to-teal-500 text-white font-black text-2xl flex items-center justify-center shadow-lg font-mono transition-transform ${
                  isFlippingRolling ? 'animate-bounce' : ''
                }`}>
                  {diceVal}
                </div>
              )}

              <div>
                <h4 className="text-base font-bold font-sans text-slate-100">
                  {coinDiceMatch.type === 'coin' ? `Result: ${coinSide}` : `Rolled: ${diceVal}`}
                </h4>
                {coinDiceMatch.type === 'coin' && (
                  <p className="text-xs text-slate-400 font-mono">
                    Heads: {flipStats.heads} • Tails: {flipStats.tails}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                if (coinDiceMatch.type === 'coin') handleFlipCoin();
                else handleRollDice(coinDiceMatch.sides);
              }}
              disabled={isFlippingRolling}
              type="button"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer shadow-md active:scale-95 transition-all disabled:opacity-50"
            >
              {coinDiceMatch.type === 'coin' ? 'Flip Again' : 'Roll Again'}
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 14. LOREM IPSUM ZERO-CLICK ANSWER                                    */}
      {/* ==================================================================== */}
      {loremMatch && (
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider font-mono">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>Lorem Ipsum Generator</span>
            </span>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">Paragraphs:</span>
              {[1, 2, 3, 5].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setLoremParas(p)}
                  className={`px-2 py-0.5 rounded text-xs font-mono font-bold cursor-pointer ${
                    loremParas === p
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => handleCopy(loremText, 'lorem')}
                type="button"
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer ml-1"
              >
                {copiedKey === 'lorem' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === 'lorem' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className={`p-4 rounded-xl border text-xs leading-relaxed max-h-56 overflow-y-auto whitespace-pre-line font-serif ${
            isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950/60 border-slate-800 text-slate-300'
          }`}>
            {loremText}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default InstantAnswerWidget;
