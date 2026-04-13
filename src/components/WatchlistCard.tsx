import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, TrendingDown, X, ExternalLink, RefreshCw, Bell, BellRing, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useAlerts } from '../hooks/useAlerts';

interface WatchlistCardProps {
  symbol: string;
  onRemove: (symbol: string) => void;
  onOpen: (symbol: string) => void;
}

interface QuoteData {
  symbol: string;
  currencySymbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  change: number;
  changePercent: string;
  volume: number;
  latestTradingDay: string;
}

const REFRESH_MS = 60_000;

const fmtVol = (v: number) =>
  v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(v);

export const WatchlistCard: React.FC<WatchlistCardProps> = ({ symbol, onRemove, onOpen }) => {
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const prevPriceRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Alert State
  const { alerts, addAlert, removeAlert } = useAlerts();
  const [showAlertMenu, setShowAlertMenu] = useState(false);
  const [alertTarget, setAlertTarget] = useState<string>('');
  const [alertDir, setAlertDir] = useState<'above' | 'below'>('above');

  // Find if symbol has an active alert
  const activeAlert = alerts.find(a => a.symbol === symbol && a.active);

  const fetchQuote = useCallback(async () => {
    try {
      const res = await fetch(`/api/realtime-quote?symbol=${encodeURIComponent(symbol)}`);
      const data = await res.json();
      if (!res.ok) throw new Error((data as any).error || 'Failed');
      setQuote(data as QuoteData);
      setError(null);
      // Flash animation when price changes
      if (prevPriceRef.current !== null && prevPriceRef.current !== data.price) {
        setFlash(true);
        setTimeout(() => setFlash(false), 600);
      }
      prevPriceRef.current = data.price;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchQuote();
    timerRef.current = setInterval(fetchQuote, REFRESH_MS);
    return () => { clearInterval(timerRef.current!); };
  }, [fetchQuote]);

  const isPositive = (quote?.change ?? 0) >= 0;
  const changePct = quote ? parseFloat(quote.changePercent).toFixed(2) : '0.00';
  const cs = quote?.currencySymbol ?? '$';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.93, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.90, y: -10 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="relative group bg-[#131313]/90 backdrop-blur-2xl border border-white/5 rounded-[24px] overflow-hidden shadow-xl"
    >
      {/* Top glow bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 transition-all duration-500 ${
        loading ? 'bg-zinc-700' :
        error ? 'bg-rose-600' :
        isPositive ? 'bg-gradient-to-r from-[#8ff5ff] to-[#00deec]' : 'bg-gradient-to-r from-[#ff716c] to-[#d7383b]'
      }`} />

      {/* Flash overlay on price update */}
      <AnimatePresence>
        {flash && (
          <motion.div
            key="flash"
            initial={{ opacity: 0.25 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className={`absolute inset-0 pointer-events-none rounded-[24px] ${isPositive ? 'bg-[#8ff5ff]' : 'bg-[#ff716c]'}`}
          />
        )}
      </AnimatePresence>

      <div className="p-5 pt-6 space-y-4">
        {/* Symbol header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2 mt-0.5">
                {!loading && !error && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8ff5ff] opacity-40" />
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${loading ? 'bg-zinc-600' : error ? 'bg-rose-500' : 'bg-[#8ff5ff]'}`} />
              </span>
              <h3 className="text-base font-black tracking-wider text-white uppercase">{symbol}</h3>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Refresh icon */}
            <button
              onClick={fetchQuote}
              disabled={loading}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-all disabled:opacity-30"
              title="Refresh"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            {/* Alert Button */}
            <button
              onClick={() => setShowAlertMenu(!showAlertMenu)}
              className={`p-1.5 rounded-lg transition-all ${
                activeAlert
                  ? 'text-[#00e676] bg-[#00e676]/10 shadow-[0_0_10px_rgba(0,230,118,0.3)]'
                  : 'text-zinc-600 hover:text-white hover:bg-white/5 opacity-0 group-hover:opacity-100'
              }`}
              title={activeAlert ? `Alert set: ${activeAlert.direction} $${activeAlert.targetPrice}` : "Set Price Alert"}
            >
              {activeAlert ? <BellRing size={14} className="animate-pulse" /> : <Bell size={14} />}
            </button>
            {/* Remove button */}
            <button
              onClick={() => onRemove(symbol)}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-400/10 transition-all opacity-0 group-hover:opacity-100"
              title={`Remove ${symbol}`}
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Content */}
        {loading && !quote ? (
          <div className="animate-pulse space-y-3">
            <div className="h-8 w-32 bg-white/8 rounded-xl" />
            <div className="h-5 w-20 bg-white/5 rounded-lg" />
            <div className="grid grid-cols-3 gap-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 bg-white/5 rounded-xl" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="py-4 text-center">
            <p className="text-xs text-rose-400 font-medium">{error}</p>
            <button
              onClick={fetchQuote}
              className="mt-2 text-xs text-zinc-500 hover:text-zinc-300 underline transition-colors"
            >
              Retry
            </button>
          </div>
        ) : quote ? (
          <>
            {/* Price + change */}
            <div className="space-y-1">
              <motion.p
                key={quote.price}
                initial={{ opacity: 0.6 }}
                animate={{ opacity: 1 }}
                className="text-3xl font-black text-white tracking-tighter leading-none"
              >
                {cs}{quote.price.toFixed(2)}
              </motion.p>
              <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold tracking-wider ${
                isPositive ? 'bg-[#8ff5ff]/10 text-[#8ff5ff]' : 'bg-[#ff716c]/10 text-[#ff716c]'
              }`}>
                {isPositive ? <TrendingUp size={12} strokeWidth={3} /> : <TrendingDown size={12} strokeWidth={3} />}
                {isPositive ? '+' : ''}{cs}{Math.abs(quote.change).toFixed(2)} ({isPositive ? '+' : ''}{changePct}%)
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: 'HIGH', value: `${cs}${quote.high.toFixed(2)}`, color: 'text-[#8ff5ff]' },
                { label: 'LOW', value: `${cs}${quote.low.toFixed(2)}`, color: 'text-[#ff716c]' },
                { label: 'VOL', value: fmtVol(quote.volume), color: 'text-[#ac8aff]' },
              ].map(stat => (
                <div key={stat.label} className="flex flex-col items-center gap-1 bg-white/4 rounded-xl py-2.5 px-1 border border-white/5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{stat.label}</span>
                  <span className={`text-xs font-black ${stat.color}`}>{stat.value}</span>
                </div>
              ))}
            </div>

            {/* Prev Close bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                <span>Prev Close {cs}{quote.previousClose.toFixed(2)}</span>
                <span>{quote.latestTradingDay}</span>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(100, Math.max(0,
                      ((quote.price - quote.low) / ((quote.high - quote.low) || 1)) * 100
                    ))}%`
                  }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${isPositive ? 'bg-gradient-to-r from-[#8ff5ff] to-[#00deec]' : 'bg-gradient-to-r from-[#ff716c] to-[#d7383b]'}`}
                />
              </div>
            </div>
          </>
        ) : null}

        {/* Open button */}
        <button
          onClick={() => onOpen(symbol)}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold tracking-widest uppercase bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/5 hover:border-white/10 transition-all"
        >
          <ExternalLink size={12} strokeWidth={2.5} />
          Full Analysis
        </button>
      </div>

      {/* ── Alert Configuration Overlay ── */}
      <AnimatePresence>
        {showAlertMenu && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute inset-0 bg-[#0e0e0e]/95 backdrop-blur-3xl z-30 p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-[#ac8aff]" />
                  <h4 className="text-sm font-black text-white uppercase tracking-widest">Price Alert</h4>
                </div>
                <button onClick={() => setShowAlertMenu(false)} className="text-zinc-500 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              {activeAlert ? (
                <div className="bg-[#1a1919] p-4 rounded-2xl border border-white/5 text-center mt-4">
                  <BellRing size={24} className="text-[#00e676] mx-auto mb-2 animate-bounce" />
                  <p className="text-xs font-bold text-white uppercase tracking-widest mb-1">Alert is Active</p>
                  <p className="text-[10px] text-zinc-400">
                    Will notify if {symbol} goes <strong className="text-white">{activeAlert.direction} ${activeAlert.targetPrice}</strong>
                  </p>
                  <button
                    onClick={() => {
                      removeAlert(activeAlert.id);
                      setShowAlertMenu(false);
                    }}
                    className="mt-4 w-full py-2 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all uppercase tracking-widest"
                  >
                    Cancel Alert
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAlertDir('above')}
                      className={`flex-1 py-3 rounded-2xl border text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1 transition-all ${alertDir === 'above' ? 'bg-[#00e676]/10 border-[#00e676]/30 text-[#00e676]' : 'bg-[#1a1919] border-white/5 text-zinc-500'}`}
                    >
                      <ArrowUpRight size={14} /> Above
                    </button>
                    <button
                      onClick={() => setAlertDir('below')}
                      className={`flex-1 py-3 rounded-2xl border text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1 transition-all ${alertDir === 'below' ? 'bg-[#ff716c]/10 border-[#ff716c]/30 text-[#ff716c]' : 'bg-[#1a1919] border-white/5 text-zinc-500'}`}
                    >
                      <ArrowDownRight size={14} /> Below
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 pl-1">Target Price (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={alertTarget}
                      onChange={e => setAlertTarget(e.target.value)}
                      placeholder={quote?.price.toFixed(2) || '0.00'}
                      className="w-full mt-1 bg-[#1a1919] border border-white/10 rounded-2xl py-3 px-4 text-white text-sm font-black focus:outline-none focus:border-[#ac8aff]"
                    />
                  </div>
                </div>
              )}
            </div>

            {!activeAlert && (
              <button
                onClick={() => {
                  const p = parseFloat(alertTarget);
                  if (!isNaN(p) && p > 0) {
                    addAlert(symbol, p, alertDir);
                    setShowAlertMenu(false);
                  }
                }}
                disabled={!alertTarget || isNaN(parseFloat(alertTarget))}
                className="w-full py-3.5 bg-gradient-to-r from-[#ac8aff] to-[#8ff5ff] text-zinc-900 rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-30 transition-all hover:shadow-[0_0_15px_rgba(172,138,255,0.4)]"
              >
                Save Alert
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
