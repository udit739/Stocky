import React, { useState } from 'react';
import { SearchBar } from './components/SearchBar';
import { SymbolSearch } from './components/SymbolSearch';
import { StockChart } from './components/StockChart';
import { RsiChart } from './components/RsiChart';
import { VolumeChart } from './components/VolumeChart';
import { ArimaChart } from './components/ArimaChart';
import { PredictionCard } from './components/PredictionCard';
import { CompareView } from './components/CompareView';
import { motion, AnimatePresence } from 'motion/react';
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
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto mb-8">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-400 uppercase tracking-widest pointer-events-none">A</span>
          <input
            type="text"
            value={symA}
            onChange={e => setSymA(e.target.value)}
            placeholder="AAPL"
            className="w-full pl-8 pr-4 py-3 bg-white border-2 border-indigo-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all text-zinc-800 placeholder:text-zinc-400 text-center font-bold tracking-wider uppercase"
            disabled={isLoading}
          />
        </div>

        <div className="hidden sm:flex items-center justify-center">
          <span className="text-zinc-400 font-bold text-lg">vs</span>
        </div>

        <div className="relative flex-1 group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-amber-400 uppercase tracking-widest pointer-events-none">B</span>
          <input
            type="text"
            value={symB}
            onChange={e => setSymB(e.target.value)}
            placeholder="MSFT"
            className="w-full pl-8 pr-4 py-3 bg-white border-2 border-amber-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all text-zinc-800 placeholder:text-zinc-400 text-center font-bold tracking-wider uppercase"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !symA.trim() || !symB.trim()}
          className="sm:w-auto w-full px-6 py-3 bg-zinc-900 text-white rounded-2xl font-semibold hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <GitCompareArrows size={18} />
          )}
          <span>Compare</span>
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-white font-semibold">
        Try <span className="text-white">AAPL</span> vs <span className="text-white">MSFT</span>, or <span className="text-white">RELIANCE.BSE</span> vs <span className="text-white">TCS.BSE</span>
      </p>
    </form>
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
    <div className="min-h-screen bg-[#64748b] text-zinc-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-50 rounded-full blur-[120px] opacity-50" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-[120px] opacity-50" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-20 overflow-x-hidden">
        {/* Header */}
        <header className="text-center mb-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-50 border border-purple-900 text-teal-600 text-xs font-bold uppercase tracking-widest mb-6"
          >
            <BrainCircuit size={14} />
            Stateless AI Predictor
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-6xl font-black tracking-tight text-zinc-900 mb-6"
          >
            <span className="text-zinc-800">Stock</span><span className="text-purple-600">y</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 3, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-black text-lg max-w-xl mx-auto font-medium italic"
          >
            Enter a ticker symbol to get real-time historical analysis and AI-driven short-term predictions.
          </motion.p>
        </header>

        {/* ── Mode Switcher ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex justify-center mb-8"
        >
          <div className="inline-flex items-center bg-white rounded-2xl border border-zinc-200 shadow-sm p-1 gap-1">
            <button
              onClick={() => switchMode('single')}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${mode === 'single'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800'
                }`}
            >
              <BarChart2 size={15} />
              Single Stock
            </button>
            <button
              onClick={() => switchMode('compare')}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${mode === 'compare'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800'
                }`}
            >
              <GitCompareArrows size={15} />
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
              <div className="w-20 h-20 bg-white rounded-3xl border border-zinc-100 shadow-sm flex items-center justify-center mx-auto text-zinc-300">
                <LineChart size={40} />
              </div>
              <p className="text-black font-semibold">Waiting for your first symbol...</p>
            </motion.div>
          )}

          {mode === 'compare' && !compareStocks && !isLoadingCompare && !errorCompare && (
            <motion.div
              key="empty-compare"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-20 text-center space-y-6"
            >
              <div className="w-20 h-20 bg-white rounded-3xl border border-zinc-100 shadow-sm flex items-center justify-center mx-auto text-zinc-400">
                <GitCompareArrows size={40} />
              </div>
              <p className="text-black font-semibold">Enter two ticker symbols above to compare them.</p>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Footer */}
        <footer className="mt-32 pt-8 border-t border-zinc-200/50 text-center">
          <p className="text-xs text-white font-medium uppercase tracking-widest">
            Powered by Alpha Vantage &amp; Google Gemini AI
          </p>
          <p className="mt-4 text-[10px] text-white max-w-md mx-auto leading-relaxed">
            Disclaimer: This is a college project demo. Predictions are generated by AI and do not constitute financial advice. Always do your own research.
          </p>
        </footer>
      </div>

      {/* Fixed sliding drawer — always rendered, toggle via tab */}
      <SymbolSearch onSelectSymbol={handleSearch} isLoading={isLoading} />
    </div>
  );
}
