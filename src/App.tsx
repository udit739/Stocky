import { useState } from 'react';
import { SearchBar } from './components/SearchBar';
import { SymbolSearch } from './components/SymbolSearch';
import { StockChart } from './components/StockChart';
import { RsiChart } from './components/RsiChart';
import { VolumeChart } from './components/VolumeChart';
import { ArimaChart } from './components/ArimaChart';
import { PredictionCard } from './components/PredictionCard';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, BrainCircuit, Info } from 'lucide-react';

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

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [activeSymbol, setActiveSymbol] = useState('');

  const handleSearch = async (symbol: string) => {
    setIsLoading(true);
    setError(null);
    setStockData(null);
    setActiveSymbol(symbol);

    try {
      // Single fetch: stock data + technical prediction bundled together
      const stockResponse = await fetch(`/api/stock-data?symbol=${symbol}`);
      const text = await stockResponse.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || 'Server returned an invalid response');
      }

      if (!stockResponse.ok) {
        throw new Error(data.error || 'Failed to fetch stock data');
      }
      setStockData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const priceChangePercent = stockData
    ? ((stockData.latestPrice - stockData.previousPrice) / stockData.previousPrice) * 100
    : 0;

  return (
    <div className="min-h-screen bg-[#64748b] text-zinc-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-50 rounded-full blur-[120px] opacity-50" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-[120px] opacity-50" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 py-12 md:py-20">
        {/* Header */}
        <header className="text-center mb-16">
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

        {/* Search Section */}
        <SearchBar onSearch={handleSearch} isLoading={isLoading} value={activeSymbol} />

        {/* Results Section */}
        <AnimatePresence mode="wait">
          {error && (
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
                <h4 className="font-bold">Prediction Error</h4>
                <p className="text-sm opacity-80">{error}</p>
              </div>
            </motion.div>
          )}

          {stockData && !isLoading && (
            <motion.div
              key="results"
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

          {!stockData && !isLoading && !error && (
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
        </AnimatePresence>

        {/* Footer */}
        <footer className="mt-32 pt-8 border-t border-zinc-200/50 text-center">
          <p className="text-xs text-white font-medium uppercase tracking-widest">
            Powered by Alpha Vantage & Google Gemini AI
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
