import React, { useState } from 'react';
import { SearchBar } from './components/SearchBar';
import { SymbolSearch } from './components/SymbolSearch';
import { StockChart } from './components/StockChart';
import { RsiChart } from './components/RsiChart';
import { VolumeChart } from './components/VolumeChart';
import { ArimaChart } from './components/ArimaChart';
import { PredictionCard } from './components/PredictionCard';
import { CompareView } from './components/CompareView';
import { RealTimeTicker } from './components/RealTimeTicker';
import { CurrencyBackground } from './components/CurrencyBackground';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { LineChart, BrainCircuit, Info, GitCompareArrows, BarChart2 } from 'lucide-react';

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
type AppMode = 'single' | 'compare';

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

const TICKER_CURRENCIES = [
  { symbol: '$', color: '#8ff5ff' },
  { symbol: '€', color: '#ac8aff' },
  { symbol: '£', color: '#ffd580' },
  { symbol: '¥', color: '#ff8c8c' },
  { symbol: '₹', color: '#80ffb4' },
  { symbol: '₩', color: '#ffb347' },
];

function TickerParticles() {
  const particles = React.useMemo(() => {
    return [...Array(20)].map((_, i) => {
      const cur = TICKER_CURRENCIES[Math.floor(Math.random() * TICKER_CURRENCIES.length)];
      return {
        id: i,
        symbol: cur.symbol,
        size: Math.random() * 0.7 + 0.5, // rem
        color: cur.color,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        xOffset: Math.random() > 0.5 ? 40 : -40,
        yOffset: Math.random() > 0.5 ? 20 : -20,
        duration: Math.random() * 6 + 4,
        delay: Math.random() * 2,
        rotate: Math.random() * 360,
      };
    });
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute font-black select-none"
          style={{
            fontSize: `${p.size}rem`,
            color: p.color,
            left: p.left,
            top: p.top,
            textShadow: `0 0 12px ${p.color}`,
          }}
          initial={{ rotate: p.rotate }}
          animate={{
            x: [0, p.xOffset],
            y: [0, p.yOffset],
            rotate: [p.rotate, p.rotate + 90],
            opacity: [0, 0.75, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut',
            delay: p.delay,
          }}
        >
          {p.symbol}
        </motion.span>
      ))}
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [mode, setMode] = useState<AppMode>('single');

  // ── Single mode state ──
  const [isLoadingSingle, setIsLoadingSingle] = useState(false);
  const [errorSingle, setErrorSingle] = useState<string | null>(null);
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [activeSymbol, setActiveSymbol] = useState('');

  // ── Scroll Parallax ──
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 1000], [0, 200]);
  const y2 = useTransform(scrollY, [0, 1000], [0, -150]);
  const opacityHeader = useTransform(scrollY, [0, 300], [1, 0]);

  // ── Compare mode state ──
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);
  const [errorCompare, setErrorCompare] = useState<string | null>(null);
  const [compareStocks, setCompareStocks] = useState<{ a: StockData; b: StockData } | null>(null);

  const handleSearch = async (symbol: string) => {
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
        </motion.header>
        {/* ── Marquee ticker strip ── */}
        <div className="relative overflow-hidden py-3 mb-10 rounded-2xl border border-white/10" style={{ background: '#000000' }}>
          <TickerParticles />
          {/* Scrolling track — two identical halves for seamless loop */}
          <div
            className="relative z-10 inline-flex whitespace-nowrap animate-[marqueeScroll_13s_linear_infinite] hover:[animation-play-state:paused] cursor-default select-none"
          >
            {[0, 1].map(set => (
              <span key={set} className="inline-flex items-center">
                {['STOCK', 'STOCK', 'STOCK', 'STOCK', 'STOCK', 'STOCK', 'STOCK', 'STOCK'].map((word, i) => (
                  <span key={i} className="inline-flex items-center gap-6 mr-10">
                    <span
                      className="font-black text-2xl md:text-3xl"
                      style={{
                        letterSpacing: '0.35em',
                        fontFamily: "'Space Grotesk', sans-serif",
                        color: i % 2 === 0 ? '#16e616ff' : '#ce27f0ff',
                        textShadow: i % 2 === 0
                          ? '0 0 18px rgba(143,245,255,0.35)'
                          : '0 0 18px rgba(199, 4, 4, 0.35)',
                        opacity: 0.75,
                      }}
                    >
                      {word}<span style={{ color: i % 2 === 0 ? '#75f071ff' : '#e54edeff' }}>Y</span>
                    </span>
                    <span className="text-white/20 font-bold select-none">✦</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>


        {/* ── Mode Switcher ── */}

        <motion.div
          initial={{ opacity: 0, y: -8, zZ: -50 }}
          animate={{ opacity: 1, y: 0, zIndex: 10 }}
          transition={{ delay: 0.25 }}
          className="flex justify-center mb-12 relative z-20"
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
          </div>
        </motion.div>

        {/* ── Search Section ── */}
        <AnimatePresence mode="wait">
          {mode === 'single' ? (
            <motion.div key="single-search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SearchBar onSearch={handleSearch} isLoading={isLoadingSingle} value={activeSymbol} />
            </motion.div>
          ) : (
            <motion.div key="compare-search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CompareSearchBar onCompare={handleCompare} isLoading={isLoadingCompare} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Results Section ── */}
        <AnimatePresence mode="wait">

          {/* Shared error display */}
          {(mode === 'single' ? errorSingle : errorCompare) && (
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
                <p className="text-sm opacity-80">{mode === 'single' ? errorSingle : errorCompare}</p>
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
              <div className="grid grid-cols-1 gap-8">
                <RealTimeTicker
                  symbol={stockData.symbol}
                  currencySymbol={stockData.currencySymbol}
                />
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
                </div>
              </div>
            </motion.div>
          )}

          {/* Compare results */}
          {mode === 'compare' && compareStocks && !isLoadingCompare && (
            <motion.div key="compare-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <CompareView stockA={compareStocks.a} stockB={compareStocks.b} />
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
              <p className="text-black font-semibold">Enter a ticker symbol above to get started.</p>
            </motion.div>
          )}

          {mode === 'compare' && !compareStocks && !isLoadingCompare && !errorCompare && (
            <motion.div
              key="empty-compare"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-20 text-center space-y-6"
            >

              <p className="text-black font-semibold">Enter two ticker symbols above to compare them.</p>
            </motion.div>
          )}

        </AnimatePresence>


      </div>

      {/* Fixed sliding drawer — always rendered, toggle via tab */}
      <SymbolSearch onSelectSymbol={handleSearch} isLoading={isLoading} />
    </div>
  );
}
