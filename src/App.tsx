import React, { useState, useEffect } from 'react';
import { SearchBar } from './components/SearchBar';
import { SymbolSearch } from './components/SymbolSearch';
import { StockChart } from './components/StockChart';
import { RsiChart } from './components/RsiChart';
import { VolumeChart } from './components/VolumeChart';
import { ArimaChart } from './components/ArimaChart';
import { PredictionCard } from './components/PredictionCard';
import { CompareView } from './components/CompareView';
import { CurrencyBackground } from './components/CurrencyBackground';
import { IntradayChart } from './components/IntradayChart';
import { IntradayFundamentals } from './components/IntradayFundamentals';
import { WatchlistView } from './components/WatchlistView';
import { MarketOverview } from './components/MarketOverview';
import { useToast } from './components/ToastManager';
import { useAlerts } from './hooks/useAlerts';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { Info, GitCompareArrows, BarChart2, Activity, Star, Menu, X, Globe } from 'lucide-react';

interface PredictionResult {
  trend: 'Bullish' | 'Bearish' | 'Neutral';
  prediction: string;
  confidence: number;
  signal: 'Buy' | 'Hold' | 'Sell';
  explanation: string;
}

interface StockData {
  symbol: string;
  currencySymbol: string;
  data: { date: string; open?: number; high?: number; low?: number; close: number; volume: number; rsi: number | null; ma7: number | null; ma20: number | null; ma50: number | null }[];
  latestPrice: number;
  previousPrice: number;
  latestRSI: number | null;
  arimaForecast: number[];
  prediction: PredictionResult;
}

// ── Mode types ──
type AppMode = 'single' | 'compare' | 'intraday' | 'watchlist' | 'market';

const WATCHLIST_KEY = 'stocky_watchlist_v1';

// ── Session-level cache (5-minute TTL) ──
const CACHE_TTL_MS = 5 * 60 * 1000;
const stockCache = new Map<string, { data: StockData; ts: number }>();

async function fetchStock(symbol: string): Promise<StockData> {
  const cached = stockCache.get(symbol);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    console.log(`[cache] HIT for ${symbol}`);
    return cached.data;
  }

  const response = await fetch(`/api/stock-data?symbol=${symbol}`);
  const text = await response.text();
  let data: StockData;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text || 'Server returned an invalid response');
  }
  if (!response.ok) {
    throw new Error((data as any).error || 'Failed to fetch stock data');
  }

  // Store in cache
  stockCache.set(symbol, { data, ts: Date.now() });
  return data;
}

// ── Compare Search Bar (two inputs side by side) ──
interface CompareSearchBarProps {
  onCompare: (symA: string, symB: string) => void;
  isLoading: boolean;
}

function CompareSearchBar({ onCompare, isLoading }: CompareSearchBarProps) {
  const [symA, setSymA] = useState('');
  const [symB, setSymB] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (symA.trim() && symB.trim()) {
      onCompare(symA.trim().toUpperCase(), symB.trim().toUpperCase());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto mb-8 relative z-20">
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-[#1a1919]/80 backdrop-blur-xl rounded-3xl border border-white/5 shadow-2xl">
        <div className="relative flex-1 group">
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#8ff5ff] uppercase tracking-widest pointer-events-none drop-shadow-[0_0_8px_rgba(143,245,255,0.5)]">A</span>
          <input
            type="text"
            value={symA}
            onChange={e => setSymA(e.target.value)}
            placeholder="AAPL"
            className="w-full pl-10 pr-4 py-3.5 bg-[#0e0e0e] border border-white/10 rounded-2xl shadow-inner focus:outline-none focus:ring-1 focus:ring-[#8ff5ff] focus:border-[#8ff5ff] transition-all text-white placeholder:text-zinc-600 text-center font-bold tracking-wider uppercase"
            disabled={isLoading}
          />
        </div>

        <div className="hidden sm:flex items-center justify-center">
          <span className="text-zinc-500 font-bold text-lg rotate-12">VS</span>
        </div>

        <div className="relative flex-1 group">
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#ac8aff] uppercase tracking-widest pointer-events-none drop-shadow-[0_0_8px_rgba(172,138,255,0.5)]">B</span>
          <input
            type="text"
            value={symB}
            onChange={e => setSymB(e.target.value)}
            placeholder="MSFT"
            className="w-full pl-10 pr-4 py-3.5 bg-[#0e0e0e] border border-white/10 rounded-2xl shadow-inner focus:outline-none focus:ring-1 focus:ring-[#ac8aff] focus:border-[#ac8aff] transition-all text-white placeholder:text-zinc-600 text-center font-bold tracking-wider uppercase"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !symA.trim() || !symB.trim()}
          className="sm:w-auto w-full px-8 py-3.5 bg-gradient-to-br from-[#8ff5ff] to-[#00deec] text-[#005d63] rounded-2xl font-bold tracking-wide hover:shadow-[0_0_20px_rgba(143,245,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 whitespace-nowrap"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-[#005d63]/30 border-t-[#005d63] rounded-full animate-spin" />
          ) : (
            <GitCompareArrows size={18} strokeWidth={2.5} />
          )}
          <span>COMPARE</span>
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-zinc-500 font-medium tracking-wide">
        Try <span className="text-[#8ff5ff] font-bold">AAPL</span> vs <span className="text-[#ac8aff] font-bold">MSFT</span>
      </p>
    </form>
  );
}



const playAlertSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    const now = ctx.currentTime;

    // First beep
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.05);
    gain.gain.linearRampToValueAtTime(0, now + 0.15);

    // Second beep
    osc.frequency.setValueAtTime(880, now + 0.2);
    gain.gain.setValueAtTime(0, now + 0.2);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.25);
    gain.gain.linearRampToValueAtTime(0, now + 0.35);

    osc.start(now);
    osc.stop(now + 0.4);
  } catch (e) {
    console.warn('Audio playback failed:', e);
  }
};

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [mode, setMode] = useState<AppMode>('single');
  const { addToast } = useToast();
  const { alerts, setAlertActive } = useAlerts();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // ── Native Browser Notification Request ──
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ── Background Alerts Polling ──
  useEffect(() => {
    const activeAlerts = alerts.filter(a => a.active);
    if (activeAlerts.length === 0) return;

    const checkAlerts = async () => {
      // Group alerts by symbol to minimize fetches
      const symbolsToCheck = Array.from(new Set(activeAlerts.map(a => a.symbol)));

      for (const symbol of symbolsToCheck) {
        try {
          const res = await fetch(`/api/realtime-quote?symbol=${encodeURIComponent(symbol)}`);
          if (!res.ok) continue;
          const { price } = await res.json();
          if (typeof price !== 'number') continue;

          const symbolAlerts = activeAlerts.filter(a => a.symbol === symbol);
          for (const alert of symbolAlerts) {
            let triggered = false;
            let msg = '';
            if (alert.direction === 'above' && price >= alert.targetPrice) {
              triggered = true;
              msg = `${symbol} has surged to $${price.toFixed(2)}, crossing above your target of $${alert.targetPrice.toFixed(2)}!`;
            } else if (alert.direction === 'below' && price <= alert.targetPrice) {
              triggered = true;
              msg = `${symbol} has dropped to $${price.toFixed(2)}, crossing below your target of $${alert.targetPrice.toFixed(2)}!`;
            }

            if (triggered) {
              // 1. In-app Toast
              addToast(`PRICE ALERT: ${symbol}`, msg, 'alert');
              // Play sound
              playAlertSound();
              // 2. Native Browser Notification
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(`Stocky Alert: ${symbol}`, {
                  body: msg,
                  icon: '/vite.svg'
                });
              }
              // 3. Deactivate alert
              setAlertActive(alert.id, false);
            }
          }
        } catch (e) {
          console.error(`Failed to poll ${symbol} for alerts`, e);
        }
      }
    };

    // Run immediately, then every 30 seconds
    checkAlerts();
    const interval = setInterval(checkAlerts, 30 * 1000);
    return () => clearInterval(interval);
  }, [alerts, addToast, setAlertActive]);

  // ── Single mode state ──
  const [isLoadingSingle, setIsLoadingSingle] = useState(false);
  const [errorSingle, setErrorSingle] = useState<string | null>(null);
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [activeSymbol, setActiveSymbol] = useState('');
  const [intradaySymbol, setIntradaySymbol] = useState('');

  // ── Scroll Parallax ──
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 1000], [0, 200]);
  const y2 = useTransform(scrollY, [0, 1000], [0, -150]);
  const opacityHeader = useTransform(scrollY, [0, 300], [1, 0]);

  // ── Compare mode state ──
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);
  const [errorCompare, setErrorCompare] = useState<string | null>(null);
  const [compareStocks, setCompareStocks] = useState<{ a: StockData; b: StockData } | null>(null);

  // ── Watchlist state (localStorage-persisted) ──
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]'); } catch { return []; }
  });

  const addToWatchlist = (symbol: string) => {
    setWatchlist(prev => {
      if (prev.includes(symbol)) return prev;
      const next = [...prev, symbol];
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
      return next;
    });
  };

  const removeFromWatchlist = (symbol: string) => {
    setWatchlist(prev => {
      const next = prev.filter(s => s !== symbol);
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearWatchlist = () => {
    setWatchlist([]);
    localStorage.removeItem(WATCHLIST_KEY);
  };

  const openFromWatchlist = (symbol: string) => {
    switchMode('single');
    handleSearch(symbol);
  };

  const handleSearch = async (symbol: string) => {
    if (mode === 'intraday') {
      setErrorSingle(null);
      setStockData(null);
      setActiveSymbol(symbol);
      setIntradaySymbol(symbol);
      return;
    }

    setIsLoadingSingle(true);
    setErrorSingle(null);
    setStockData(null);
    setActiveSymbol(symbol);
    try {
      const data = await fetchStock(symbol);
      setStockData(data);
    } catch (err: any) {
      setErrorSingle(err.message);
    } finally {
      setIsLoadingSingle(false);
    }
  };

  const handleCompare = async (symA: string, symB: string) => {
    setIsLoadingCompare(true);
    setErrorCompare(null);
    setCompareStocks(null);
    try {
      // Fetch sequentially to respect the 5-req/min rate limit.
      // If a symbol is already in the session cache the wait is skipped.
      const a = await fetchStock(symA);
      const bCached = stockCache.get(symB);
      const bIsFresh = bCached && Date.now() - bCached.ts < CACHE_TTL_MS;
      if (!bIsFresh) {
        // Small gap so we don't fire two real API calls in the same second
        await new Promise(r => setTimeout(r, 700));
      }
      const b = await fetchStock(symB);
      setCompareStocks({ a, b });
    } catch (err: any) {
      setErrorCompare(err.message);
    } finally {
      setIsLoadingCompare(false);
    }
  };


  const priceChangePercent = stockData
    ? ((stockData.latestPrice - stockData.previousPrice) / stockData.previousPrice) * 100
    : 0;

  const isLoading = mode === 'single' ? isLoadingSingle : isLoadingCompare;

  const switchMode = (m: AppMode) => {
    setMode(m);
    setErrorSingle(null);
    setErrorCompare(null);
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-zinc-300 font-sans selection:bg-[#00eefc]/30 selection:text-[#00eefc]">
      {/* Floating currency symbols background */}
      <CurrencyBackground />

      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none perspective-[1000px]">
        <motion.div style={{ y: y1 }} className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#8ff5ff] rounded-full blur-[160px] opacity-10" />
        <motion.div style={{ y: y2 }} className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#ac8aff] rounded-full blur-[160px] opacity-10" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-20 overflow-x-hidden">
        {/* Header */}
        <motion.header style={{ opacity: opacityHeader }} className="text-center mb-10">
          <motion.h1
            initial={{ opacity: 0, y: -10, rotateX: -10, letterSpacing: '0.55em' }}
            animate={{ opacity: 1, y: 0, rotateX: 0, letterSpacing: '-0.04em' }}
            transition={{
              opacity: { delay: 0.1, duration: 0.4 },
              y: { delay: 0.1, type: 'spring', damping: 20 },
              rotateX: { delay: 0.1, type: 'spring', damping: 20 },
              letterSpacing: { delay: 0.15, duration: 0.9, ease: [0.22, 1, 0.36, 1] },
            }}
            className="text-5xl md:text-7xl font-black text-white mb-6 drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            STOCK<span className="text-transparent bg-clip-text bg-gradient-to-br from-[#8ff5ff] to-[#00deec]">Y</span>
          </motion.h1>
        </motion.header>

        {/* ── Hamburger Menu Button ── */}
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="fixed top-6 left-6 z-50 p-3 bg-[#131313]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all outline-none"
        >
          <Menu size={24} />
        </button>

        {/* ── Sidebar Overlay & Menu ── */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
              />

              {/* Sidebar */}
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                className="fixed top-0 left-0 bottom-0 w-72 bg-[#0e0e0e]/95 backdrop-blur-2xl border-r border-white/5 z-[70] shadow-[30px_0_60px_-15px_rgba(0,0,0,0.8)] flex flex-col p-6"
              >
                <div className="flex justify-between items-center mb-10">
                  <h2 className="text-lg font-black text-white tracking-widest uppercase">Stocky <span className="text-[#8ff5ff]">Menu</span></h2>
                  <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-zinc-500 hover:text-white bg-white/5 rounded-xl border border-white/5">
                    <X size={18} />
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">Navigation</p>

                  <button
                    onClick={() => { switchMode('single'); setIsSidebarOpen(false); }}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-300 w-full ${mode === 'single'
                      ? 'bg-gradient-to-br from-[#1a1919] to-[#262626] text-[#8ff5ff] shadow-[0_0_20px_rgba(143,245,255,0.1)] border border-[#8ff5ff]/20'
                      : 'bg-white/5 text-zinc-400 hover:text-zinc-200 border border-transparent hover:border-white/10'
                      }`}
                  >
                    <BarChart2 size={18} className={mode === 'single' ? 'drop-shadow-[0_0_8px_rgba(143,245,255,0.6)]' : ''} />
                    Single Asset
                  </button>
                  <button
                    onClick={() => { switchMode('compare'); setIsSidebarOpen(false); }}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-300 w-full ${mode === 'compare'
                      ? 'bg-gradient-to-br from-[#1a1919] to-[#262626] text-[#ac8aff] shadow-[0_0_20px_rgba(172,138,255,0.1)] border border-[#ac8aff]/20'
                      : 'bg-white/5 text-zinc-400 hover:text-zinc-200 border border-transparent hover:border-white/10'
                      }`}
                  >
                    <GitCompareArrows size={18} className={mode === 'compare' ? 'drop-shadow-[0_0_8px_rgba(172,138,255,0.6)]' : ''} />
                    Compare Tool
                  </button>
                  <button
                    onClick={() => { switchMode('watchlist'); setIsSidebarOpen(false); }}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-300 w-full ${mode === 'watchlist'
                      ? 'bg-gradient-to-br from-[#1a1919] to-[#262626] text-[#ffd580] shadow-[0_0_20px_rgba(255,213,128,0.1)] border border-[#ffd580]/20'
                      : 'bg-white/5 text-zinc-400 hover:text-zinc-200 border border-transparent hover:border-white/10'
                      }`}
                  >
                    <Star size={18} className={mode === 'watchlist' ? 'drop-shadow-[0_0_8px_rgba(255,213,128,0.6)]' : ''} />
                    Watchlist & Alerts
                  </button>
                  <button
                    onClick={() => { switchMode('market'); setIsSidebarOpen(false); }}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-300 w-full ${mode === 'market'
                      ? 'bg-gradient-to-br from-[#1a1919] to-[#262626] text-[#00e676] shadow-[0_0_20px_rgba(0,230,118,0.1)] border border-[#00e676]/20'
                      : 'bg-white/5 text-zinc-400 hover:text-zinc-200 border border-transparent hover:border-white/10'
                      }`}
                  >
                    <Globe size={18} className={mode === 'market' ? 'drop-shadow-[0_0_8px_rgba(0,230,118,0.6)]' : ''} />
                    Market Overview
                  </button>
                </div>

                <div className="mt-auto pointer-events-none">
                  <div className="w-full aspect-square bg-[#8ff5ff] rounded-full blur-[140px] opacity-[0.03] absolute bottom-[-20%] left-[-20%]" />
                  <p className="text-xs text-zinc-600 font-medium text-center relative z-10">Stocky v1.1.0 Dashboard</p>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Mode Switcher (Desktop Inline - optional but kept for large screens, hidden if preferred!) ── */}
        <motion.div
          initial={{ opacity: 0, y: -8, zZ: -50 }}
          animate={{ opacity: 1, y: 0, zIndex: 10 }}
          transition={{ delay: 0.25 }}
          className="hidden md:flex justify-center mb-12 relative z-20"
        >
          <div className="inline-flex items-center bg-[#131313]/80 backdrop-blur-xl rounded-2xl border border-white/5 shadow-2xl p-1.5 gap-1 ring-1 ring-white/5">
            <button
              onClick={() => switchMode('single')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${mode === 'single'
                ? 'bg-gradient-to-br from-[#1a1919] to-[#262626] text-[#8ff5ff] shadow-[0_0_20px_rgba(143,245,255,0.1)] border border-[#8ff5ff]/20'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                }`}
            >
              <BarChart2 size={16} className={mode === 'single' ? 'drop-shadow-[0_0_8px_rgba(143,245,255,0.6)]' : ''} />
              Single Asset
            </button>
            <button
              onClick={() => switchMode('compare')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${mode === 'compare'
                ? 'bg-gradient-to-br from-[#1a1919] to-[#262626] text-[#ac8aff] shadow-[0_0_20px_rgba(172,138,255,0.1)] border border-[#ac8aff]/20'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                }`}
            >
              <GitCompareArrows size={16} className={mode === 'compare' ? 'drop-shadow-[0_0_8px_rgba(172,138,255,0.6)]' : ''} />
              Compare
            </button>
            <button
              onClick={() => switchMode('intraday')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${mode === 'intraday'
                ? 'bg-gradient-to-br from-[#1a1919] to-[#262626] text-[#80ffb4] shadow-[0_0_20px_rgba(128,255,180,0.1)] border border-[#80ffb4]/20'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                }`}
            >
              <Activity size={16} className={mode === 'intraday' ? 'drop-shadow-[0_0_8px_rgba(128,255,180,0.6)]' : ''} />
              Intraday
            </button>
            <button
              onClick={() => switchMode('watchlist')}
              className={`relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${mode === 'watchlist'
                ? 'bg-gradient-to-br from-[#1a1919] to-[#262626] text-[#ffd580] shadow-[0_0_20px_rgba(255,213,128,0.1)] border border-[#ffd580]/20'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                }`}
            >
              <Star size={16}
                className={mode === 'watchlist' ? 'fill-[#ffd580]/50 drop-shadow-[0_0_8px_rgba(255,213,128,0.6)]' : ''}
              />
              Watchlist
              {watchlist.length > 0 && (
                <span className={`absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black
                  ${mode === 'watchlist' ? 'bg-[#ffd580] text-[#3d2e00]' : 'bg-[#ffd580]/20 text-[#ffd580]'}`}>
                  {watchlist.length > 9 ? '9+' : watchlist.length}
                </span>
              )}
            </button>
          </div>
        </motion.div>

        {/* ── Search Section ── */}
        <AnimatePresence mode="wait">
          {mode === 'single' || mode === 'intraday' ? (
            <motion.div key="single-search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SearchBar onSearch={handleSearch} isLoading={isLoadingSingle} value={activeSymbol} />
            </motion.div>
          ) : mode === 'compare' ? (
            <motion.div key="compare-search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CompareSearchBar onCompare={handleCompare} isLoading={isLoadingCompare} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ── Results Section ── */}
        <AnimatePresence mode="wait">

          {/* Shared error display */}
          {((mode === 'single' || mode === 'intraday') ? errorSingle : errorCompare) && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mt-8 p-6 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 flex items-center gap-4 max-w-2xl mx-auto"
            >
              <div className="p-2 bg-rose-100 rounded-lg">
                <Info size={20} />
              </div>
              <div>
                <h4 className="font-bold">Error</h4>
                <p className="text-sm opacity-80">{(mode === 'single' || mode === 'intraday') ? errorSingle : errorCompare}</p>
              </div>
            </motion.div>
          )}

          {/* Single stock results */}
          {mode === 'single' && stockData && !isLoadingSingle && (
            <motion.div
              key="single-results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-12 space-y-8"
            >
              {/* Add to Watchlist button */}
              <div className="flex justify-end">
                <motion.button
                  onClick={() =>
                    watchlist.includes(stockData.symbol)
                      ? removeFromWatchlist(stockData.symbol)
                      : addToWatchlist(stockData.symbol)
                  }
                  whileTap={{ scale: 0.94 }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest border transition-all shadow-lg ${watchlist.includes(stockData.symbol)
                    ? 'bg-[#ffd580]/15 text-[#ffd580] border-[#ffd580]/30 shadow-[0_0_20px_rgba(255,213,128,0.2)]'
                    : 'bg-[#1a1919]/80 text-zinc-400 border-white/10 hover:text-[#ffd580] hover:border-[#ffd580]/30 hover:shadow-[0_0_15px_rgba(255,213,128,0.15)]'
                    }`}
                >
                  <Star
                    size={14}
                    strokeWidth={2.5}
                    className={watchlist.includes(stockData.symbol) ? 'fill-[#ffd580]' : ''}
                  />
                  {watchlist.includes(stockData.symbol) ? 'In Watchlist' : 'Add to Watchlist'}
                </motion.button>
              </div>

              <div className="grid grid-cols-1 gap-8">
                <PredictionCard
                  prediction={stockData.prediction}
                  symbol={stockData.symbol}
                  currencySymbol={stockData.currencySymbol}
                  currentPrice={stockData.latestPrice}
                  priceChange={priceChangePercent}
                  latestRSI={stockData.latestRSI}
                  stockData={stockData.data}
                  arimaForecast={stockData.arimaForecast}
                />

                <div className="space-y-4">
                  <>
                    <StockChart
                      data={stockData.data}
                      symbol={stockData.symbol}
                      currencySymbol={stockData.currencySymbol}
                    />
                    <RsiChart data={stockData.data} />
                    <VolumeChart data={stockData.data} />
                    <ArimaChart
                      data={stockData.data}
                      arimaForecast={stockData.arimaForecast}
                      symbol={stockData.symbol}
                      currencySymbol={stockData.currencySymbol}
                    />
                  </>
                </div>
              </div>
            </motion.div>
          )}

          {mode === 'intraday' && intradaySymbol && !errorSingle && (
            <motion.div
              key="intraday-results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-12 space-y-8"
            >
              {/* Add to Watchlist — intraday mode */}
              <div className="flex justify-end">
                <motion.button
                  onClick={() =>
                    watchlist.includes(intradaySymbol)
                      ? removeFromWatchlist(intradaySymbol)
                      : addToWatchlist(intradaySymbol)
                  }
                  whileTap={{ scale: 0.94 }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest border transition-all shadow-lg ${watchlist.includes(intradaySymbol)
                    ? 'bg-[#ffd580]/15 text-[#ffd580] border-[#ffd580]/30 shadow-[0_0_20px_rgba(255,213,128,0.2)]'
                    : 'bg-[#1a1919]/80 text-zinc-400 border-white/10 hover:text-[#ffd580] hover:border-[#ffd580]/30 hover:shadow-[0_0_15px_rgba(255,213,128,0.15)]'
                    }`}
                >
                  <Star
                    size={14}
                    strokeWidth={2.5}
                    className={watchlist.includes(intradaySymbol) ? 'fill-[#ffd580]' : ''}
                  />
                  {watchlist.includes(intradaySymbol) ? 'In Watchlist' : 'Add to Watchlist'}
                </motion.button>
              </div>
              <IntradayChart
                symbol={intradaySymbol}
                currencySymbol="$"
              />
              <IntradayFundamentals symbol={intradaySymbol} />
            </motion.div>
          )}

          {/* Compare results */}
          {mode === 'compare' && compareStocks && !isLoadingCompare && (
            <motion.div key="compare-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <CompareView stockA={compareStocks.a} stockB={compareStocks.b} />
            </motion.div>
          )}

          {/* Watchlist */}
          {mode === 'watchlist' && (
            <motion.div key="watchlist" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <WatchlistView
                watchlist={watchlist}
                onRemove={removeFromWatchlist}
                onOpen={openFromWatchlist}
                onClearAll={clearWatchlist}
              />
            </motion.div>
          )}

          {/* Market Overview */}
          {mode === 'market' && (
            <motion.div key="market" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <MarketOverview />
            </motion.div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-20 flex flex-col items-center gap-4"
            >
              <div className="w-10 h-10 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
              <p className="text-white font-semibold text-sm">
                {mode === 'compare' ? 'Fetching both stocks…' : 'Analysing stock…'}
              </p>
            </motion.div>
          )}

          {/* Empty state */}
          {mode === 'single' && !stockData && !isLoadingSingle && !errorSingle && (
            <motion.div
              key="empty"
              initial={{ opacity: 5 }}
              animate={{ opacity: 10 }}
              className="mt-20 text-center space-y-6"
            >
              <p className="text-cyan-200 font-semibold">Enter a ticker symbol above to get started.</p>
            </motion.div>
          )}

          {mode === 'intraday' && !intradaySymbol && !errorSingle && (
            <motion.div
              key="empty-intraday"
              initial={{ opacity: 5 }}
              animate={{ opacity: 10 }}
              className="mt-20 text-center space-y-6"
            >
              <p className="text-cyan-100 font-semibold">Enter a ticker symbol above to load the intraday chart.</p>
            </motion.div>
          )}

          {mode === 'compare' && !compareStocks && !isLoadingCompare && !errorCompare && (
            <motion.div
              key="empty-compare"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-20 text-center space-y-6"
            >
              <p className="text-cyan-200 font-semibold">Enter two ticker symbols above to compare them.</p>
            </motion.div>
          )}

        </AnimatePresence>


      </div>

      {/* Fixed sliding drawer — always rendered, toggle via tab */}
      <SymbolSearch onSelectSymbol={handleSearch} isLoading={isLoading} />
    </div>
  );
}
