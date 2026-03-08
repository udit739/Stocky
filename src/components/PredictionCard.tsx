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
    <div className={`flex flex-col items-center px-3 py-1.5 rounded-xl ${pos ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
      <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">{label}</span>
      <span className="text-sm font-black">{pos ? '+' : ''}{pct.toFixed(2)}%</span>
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
    Bullish: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    Bearish: 'text-rose-600 bg-rose-50 border-rose-100',
    Neutral: 'text-amber-600 bg-amber-50 border-amber-100',
  }[prediction.trend];

  const signalColor = {
    Buy: 'bg-emerald-500',
    Sell: 'bg-rose-500',
    Hold: 'bg-amber-500',
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
        <div>
          <h2 className="text-4xl font-bold text-zinc-900 tracking-tight">{symbol}</h2>
          <p className="text-zinc-500 font-medium">Market Analysis</p>
        </div>

        <div className="flex flex-col items-end gap-3">
          {/* Price & 1D change */}
          <div className="text-right">
            <div className="text-3xl font-bold text-zinc-900">{currencySymbol}{currentPrice.toFixed(2)}</div>
            <div className={`flex items-center justify-end gap-1 font-semibold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
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
          <div className={`p-6 rounded-2xl border ${trendColor} flex flex-col items-center text-center`}>
            <span className="text-xs font-bold uppercase tracking-widest mb-2 opacity-70">Trend</span>
            {prediction.trend === 'Bullish' && <TrendingUp size={32} className="mb-2" />}
            {prediction.trend === 'Bearish' && <TrendingDown size={32} className="mb-2" />}
            {prediction.trend === 'Neutral' && <Minus size={32} className="mb-2" />}
            <span className="text-2xl font-bold">{prediction.trend}</span>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900 text-white flex flex-col items-center text-center">
            <span className="text-xs font-bold uppercase tracking-widest mb-2 opacity-50">Signal</span>
            <div className={`px-6 py-2 rounded-full ${signalColor} text-white font-bold text-xl mb-2 shadow-lg shadow-emerald-500/20`}>
              {prediction.signal}
            </div>
            <div className="flex items-center gap-2 text-zinc-400 text-sm">
              <ShieldCheck size={14} />
              <span>{prediction.confidence}% Confidence</span>
            </div>
          </div>
        </div>

        {/* Explanation */}
        <div className="md:col-span-2 bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-zinc-900">
              <AlertCircle size={20} className="text-emerald-500" />
              <h3 className="font-bold text-lg">AI Analysis</h3>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* ARIMA Badge */}
              {arimaTarget !== null && arimaChangePct !== null && (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${arimaIsUp ? 'bg-violet-100 text-violet-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                  <FlaskConical size={12} />
                  ARIMA 7d: {currencySymbol}{arimaTarget.toFixed(2)}
                  <span className="opacity-70">({arimaChangePct >= 0 ? '+' : ''}{arimaChangePct.toFixed(2)}%)</span>
                </div>
              )}

              {/* RSI Badge */}
              {latestRSI !== undefined && latestRSI !== null && (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${latestRSI >= 70 ? 'bg-rose-100 text-rose-700' :
                  latestRSI <= 30 ? 'bg-emerald-100 text-emerald-700' :
                    'bg-zinc-100 text-zinc-700'
                  }`}>
                  <Activity size={12} />
                  RSI: {latestRSI.toFixed(1)}
                  {latestRSI >= 70 ? ' (Overbought)' : latestRSI <= 30 ? ' (Oversold)' : ' (Neutral)'}
                </div>
              )}
            </div>
          </div>
          <p className="text-zinc-600 leading-relaxed mb-6 italic">
            "{prediction.prediction}"
          </p>
          <div className="mt-auto pt-6 border-t border-zinc-50">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Reasoning</h4>
            <p className="text-zinc-700 text-sm leading-relaxed">
              {prediction.explanation}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
