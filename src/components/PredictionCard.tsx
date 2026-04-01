import React from 'react';
import { TrendingUp, TrendingDown, Minus, ShieldCheck, AlertCircle, Activity, FlaskConical } from 'lucide-react';
import { motion } from 'motion/react';

interface PredictionResult {
  trend: 'Bullish' | 'Bearish' | 'Neutral';
  prediction: string;
  confidence: number;
  signal: 'Buy' | 'Hold' | 'Sell';
  explanation: string;
}


interface StockDataPoint {
  date: string;
  close: number;
  volume: number;
}

interface PredictionCardProps {
  prediction: PredictionResult;
  symbol: string;
  currentPrice: number;
  priceChange: number;
  latestRSI?: number | null;
  stockData?: StockDataPoint[];
  arimaForecast?: number[];
  currencySymbol?: string;
}

function calcChange(data: StockDataPoint[], barsBack: number): number | null {
  if (data.length < barsBack + 1) return null;
  const past = data[data.length - 1 - barsBack].close;
  const now = data[data.length - 1].close;
  return ((now - past) / past) * 100;
}

const ChangePill: React.FC<{ label: string; pct: number | null }> = ({ label, pct }) => {
  if (pct === null) return null;
  const pos = pct >= 0;
  return (
    <div className={`flex flex-col items-center px-4 py-2 rounded-2xl border border-white/5 backdrop-blur-md ${pos ? 'bg-[#8ff5ff]/10 text-[#8ff5ff]' : 'bg-[#ff716c]/10 text-[#ff716c]'}`}>
      <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">{label}</span>
      <span className="text-sm font-black tracking-wider">{pos ? '+' : ''}{pct.toFixed(2)}%</span>
    </div>
  );
};

export const PredictionCard: React.FC<PredictionCardProps> = ({
  prediction,
  symbol,
  currentPrice,
  priceChange,
  latestRSI,
  stockData,
  arimaForecast,
  currencySymbol = '$',
}) => {
  const isPositive = priceChange >= 0;
  const trendColor = {
    Bullish: 'text-[#8ff5ff] bg-[#8ff5ff]/5 border-[#8ff5ff]/20 shadow-[0_0_15px_rgba(143,245,255,0.05)]',
    Bearish: 'text-[#ff716c] bg-[#ff716c]/5 border-[#ff716c]/20 shadow-[0_0_15px_rgba(255,113,108,0.05)]',
    Neutral: 'text-[#ac8aff] bg-[#ac8aff]/5 border-[#ac8aff]/20 shadow-[0_0_15px_rgba(172,138,255,0.05)]',
  }[prediction.trend];

  const signalColor = {
    Buy: 'bg-gradient-to-br from-[#8ff5ff] to-[#00deec] text-[#005d63] shadow-[0_0_20px_rgba(143,245,255,0.4)]',
    Sell: 'bg-gradient-to-br from-[#ff716c] to-[#d7383b] text-[#490006] shadow-[0_0_20px_rgba(255,113,108,0.4)]',
    Hold: 'bg-gradient-to-br from-[#ac8aff] to-[#8455ef] text-[#280067] shadow-[0_0_20px_rgba(172,138,255,0.4)]',
  }[prediction.signal];

  const change5d = stockData ? calcChange(stockData, 5) : null;
  const change1m = stockData ? calcChange(stockData, 21) : null;

  // ARIMA badge
  const arimaTarget = arimaForecast && arimaForecast.length > 0
    ? arimaForecast[arimaForecast.length - 1]
    : null;
  const arimaChangePct = arimaTarget !== null
    ? ((arimaTarget - currentPrice) / currentPrice) * 100
    : null;
  const arimaIsUp = arimaChangePct !== null && arimaChangePct >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-6"
    >
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#1a1919]/80 backdrop-blur-xl p-8 rounded-[28px] border border-white/5 shadow-2xl">
        <div>
          <h2 className="text-5xl font-black text-white tracking-widest drop-shadow-md">{symbol}</h2>
          <p className="text-[#8ff5ff] font-medium tracking-wider uppercase text-xs mt-2 opacity-80">Market Analysis</p>
        </div>

        <div className="flex flex-col items-end gap-3">
          {/* Price & 1D change */}
          <div className="text-right">
            <div className="text-4xl font-black text-white mb-1">{currencySymbol}{currentPrice.toFixed(2)}</div>
            <div className={`flex items-center justify-end gap-1.5 font-bold tracking-wide ${isPositive ? 'text-[#8ff5ff]' : 'text-[#ff716c]'}`}>
              {isPositive ? <TrendingUp size={18} strokeWidth={3} /> : <TrendingDown size={18} strokeWidth={3} />}
              {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
            </div>
          </div>

          {/* Multi-period price change pills */}
          <div className="flex gap-2">
            <ChangePill label="1D" pct={priceChange} />
            <ChangePill label="5D" pct={change5d} />
            <ChangePill label="1M" pct={change1m} />
          </div>
        </div>
      </div>

      {/* Prediction Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Trend & Signal */}
        <div className="md:col-span-1 space-y-6">
          <div className={`p-8 rounded-[28px] border border-white/5 backdrop-blur-xl ${trendColor} flex flex-col items-center text-center`}>
            <span className="text-[10px] font-black uppercase tracking-widest mb-3 opacity-60">Trend</span>
            {prediction.trend === 'Bullish' && <TrendingUp size={40} className="mb-3" />}
            {prediction.trend === 'Bearish' && <TrendingDown size={40} className="mb-3" />}
            {prediction.trend === 'Neutral' && <Minus size={40} className="mb-3" />}
            <span className="text-3xl font-black tracking-widest uppercase">{prediction.trend}</span>
          </div>

          <div className="p-8 rounded-[28px] bg-[#0e0e0e] border border-white/5 backdrop-blur-xl flex flex-col items-center text-center shadow-inner">
            <span className="text-[10px] font-black uppercase tracking-widest mb-4 text-zinc-500">Signal</span>
            <div className={`px-8 py-2.5 rounded-full ${signalColor} font-black text-2xl tracking-widest uppercase mb-4`}>
              {prediction.signal}
            </div>
            <div className="flex items-center gap-2 text-zinc-400 font-medium text-sm">
              <ShieldCheck size={16} className="text-[#ac8aff]" />
              <span>{prediction.confidence}% Conviction</span>
            </div>
          </div>
        </div>

        {/* Explanation */}
        <div className="md:col-span-2 bg-[#131313]/90 backdrop-blur-xl p-6 sm:p-10 rounded-[28px] border border-white/5 shadow-2xl flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3 text-white">
              <AlertCircle size={22} className="text-[#ac8aff]" />
              <h3 className="font-extrabold text-xl tracking-wide">Neural Analysis</h3>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* ARIMA Badge */}
              {arimaTarget !== null && arimaChangePct !== null && (
                <div className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold ${arimaIsUp ? 'bg-[#ac8aff]/10 text-[#ac8aff]' : 'bg-[#ff716c]/10 text-[#ff716c]'
                  }`}>
                  <FlaskConical size={14} />
                  <span className="whitespace-nowrap">Forecast 7D: {currencySymbol}{arimaTarget.toFixed(2)}</span>
                  <span className="opacity-70 whitespace-nowrap">({arimaChangePct >= 0 ? '+' : ''}{arimaChangePct.toFixed(2)}%)</span>
                </div>
              )}

              {/* RSI Badge */}
              {latestRSI !== undefined && latestRSI !== null && (
                <div className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold ${latestRSI >= 70 ? 'bg-[#ff716c]/10 text-[#ff716c]' :
                  latestRSI <= 30 ? 'bg-[#8ff5ff]/10 text-[#8ff5ff]' :
                    'bg-white/5 text-zinc-400'
                  }`}>
                  <Activity size={14} />
                  <span className="whitespace-nowrap">RSI: {latestRSI.toFixed(1)}
                    {latestRSI >= 70 ? ' (OB)' : latestRSI <= 30 ? ' (OS)' : ''}</span>
                </div>
              )}
            </div>
          </div>
          <p className="text-zinc-300 text-lg leading-relaxed mb-8 italic font-light">
            "{prediction.prediction}"
          </p>
          <div className="mt-auto pt-8 border-t border-white/5">
            <h4 className="text-[10px] font-black text-[#00eefc] uppercase tracking-widest mb-4">Reasoning Subroutine</h4>
            <p className="text-zinc-400 text-sm font-medium leading-relaxed">
              {prediction.explanation}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
