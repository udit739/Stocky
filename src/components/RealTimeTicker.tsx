import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, TrendingUp, TrendingDown, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Building2 } from 'lucide-react';

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
  liquidity: number;
}

interface FundamentalsData {
  peRatio: number | null;
  forwardPE: number | null;
  divYield: number | null;
  marketCap: number | null;
  beta: number | null;
  eps: number | null;
  week52High: number | null;
  week52Low: number | null;
  sector: string | null;
  industry: string | null;
  rateLimited?: boolean;
}


interface RealTimeTickerProps {
  symbol: string;
  currencySymbol: string;
}

const REFRESH_INTERVAL = 60;

// ── Countdown Ring ─────────────────────────────────────────────────────────────
const CountdownRing: React.FC<{ seconds: number; total: number }> = ({ seconds, total }) => {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const dashoffset = circ * (1 - seconds / total);
  return (
    <svg width={36} height={36} className="rotate-[-90deg]">
      <circle cx={18} cy={18} r={r} fill="none" stroke="rgba(99,102,241,0.15)" strokeWidth={3} />
      <circle cx={18} cy={18} r={r} fill="none" stroke="#6366f1" strokeWidth={3} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={dashoffset}
        style={{ transition: 'stroke-dashoffset 1s linear' }} />
    </svg>
  );
};

// ── Stat Chip ──────────────────────────────────────────────────────────────────
const StatChip: React.FC<{
  label: string;
  value: string;
  accent?: 'green' | 'red' | 'blue' | 'amber' | 'violet';
  sub?: string;
}> = ({ label, value, accent, sub }) => {
  const colours: Record<string, string> = {
    green: 'text-[#8ff5ff] drop-shadow-[0_0_8px_rgba(143,245,255,0.4)]',
    red: 'text-[#ff716c] drop-shadow-[0_0_8px_rgba(255,113,108,0.4)]',
    blue: 'text-[#00eefc]',
    amber: 'text-[#ac8aff]',
    violet: 'text-[#ac8aff]',
  };
  return (
    <div className="flex flex-col items-center justify-center bg-white/5 backdrop-blur-md rounded-2xl px-4 py-3 min-w-[96px] border border-white/5 gap-1">
      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{label}</span>
      <span className={`text-base font-black tracking-wider ${accent ? colours[accent] : 'text-zinc-200'}`}>{value}</span>
      {sub && <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{sub}</span>}
    </div>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[10px] font-black uppercase tracking-widest text-[#ac8aff] mb-3">{children}</p>
);

const Shimmer: React.FC = () => (
  <div className="animate-pulse space-y-4 p-5">
    <div className="h-9 w-44 bg-white/10 rounded-xl" />
    <div className="flex gap-3 flex-wrap">
      {[...Array(6)].map((_, i) => <div key={i} className="h-16 w-24 bg-white/5 rounded-2xl" />)}
    </div>
    <div className="flex gap-3 flex-wrap">
      {[...Array(4)].map((_, i) => <div key={i} className="h-16 w-24 bg-white/5 rounded-2xl" />)}
    </div>
  </div>
);

// ── Formatters ─────────────────────────────────────────────────────────────────
const fmtVol = (v: number) =>
  v >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(v);

const fmtMktCap = (v: number, cs: string) =>
  v >= 1e12 ? `${cs}${(v / 1e12).toFixed(2)}T`
    : v >= 1e9 ? `${cs}${(v / 1e9).toFixed(2)}B`
      : v >= 1e6 ? `${cs}${(v / 1e6).toFixed(2)}M`
        : `${cs}${v.toFixed(0)}`;

// ── Main Component ─────────────────────────────────────────────────────────────
export const RealTimeTicker: React.FC<RealTimeTickerProps> = ({ symbol, currencySymbol }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [fundamentals, setFundamentals] = useState<FundamentalsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetchedRef = useRef(false);
  const fundamentalsFetchedRef = useRef(false);

  // ── Fetch fundamentals from dedicated endpoint (2s delay to avoid AV rate limit)
  const fetchFundamentals = useCallback(async () => {
    if (!symbol || fundamentalsFetchedRef.current) return;
    fundamentalsFetchedRef.current = true;
    try {
      const res = await fetch(`/api/fundamentals?symbol=${encodeURIComponent(symbol)}`);
      const data = await res.json();
      if (res.ok) setFundamentals(data as FundamentalsData);
    } catch {
      // silently fail — fundamentals just stay null
    }
  }, [symbol]);

  const fetchQuote = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/realtime-quote?symbol=${encodeURIComponent(symbol)}`);
      const data = await res.json();
      if (!res.ok) throw new Error((data as any).error || 'Failed to fetch live quote');
      setQuote(data as QuoteData);
      setLastUpdated(new Date());
      setCountdown(REFRESH_INTERVAL);
      // Fetch fundamentals 2s after quote — avoids hitting AV 5-req/min limit
      setTimeout(fetchFundamentals, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [symbol, fetchFundamentals]);

  useEffect(() => {
    if (!isOpen) { clearInterval(countdownRef.current!); clearInterval(refreshRef.current!); return; }
    if (!hasFetchedRef.current) { fetchQuote(); hasFetchedRef.current = true; }
    countdownRef.current = setInterval(() => setCountdown(c => (c <= 1 ? REFRESH_INTERVAL : c - 1)), 1000);
    refreshRef.current = setInterval(fetchQuote, REFRESH_INTERVAL * 1000);
    return () => { clearInterval(countdownRef.current!); clearInterval(refreshRef.current!); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fetchQuote]);

  useEffect(() => {
    hasFetchedRef.current = false;
    fundamentalsFetchedRef.current = false;
    setQuote(null); setFundamentals(null); setError(null); setCountdown(REFRESH_INTERVAL);
    clearInterval(countdownRef.current!); clearInterval(refreshRef.current!);
    if (isOpen) {
      fetchQuote(); hasFetchedRef.current = true;
      countdownRef.current = setInterval(() => setCountdown(c => (c <= 1 ? REFRESH_INTERVAL : c - 1)), 1000);
      refreshRef.current = setInterval(fetchQuote, REFRESH_INTERVAL * 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const isPositive = (quote?.change ?? 0) >= 0;
  const changePct = quote ? parseFloat(quote.changePercent).toFixed(2) : '0.00';
  const fmtP = (v: number) => `${currencySymbol}${v.toFixed(2)}`;

  const hasFundamentals = fundamentals && (
    fundamentals.peRatio !== null || fundamentals.marketCap !== null ||
    fundamentals.divYield !== null || fundamentals.eps !== null || fundamentals.beta !== null
  );


  return (
    <div className="w-full">
      {/* ── Toggle Pill ── */}
      {/* ── Toggle Pill ── */}
      <button
        onClick={() => setIsOpen(p => !p)}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all shadow-lg border backdrop-blur-md
          ${isOpen
            ? 'bg-gradient-to-r from-[#8ff5ff] to-[#00deec] text-[#005d63] border-transparent shadow-[0_0_20px_rgba(143,245,255,0.4)]'
            : 'bg-[#1a1919]/80 text-[#8ff5ff] border-white/10 hover:border-[#8ff5ff]/50 hover:shadow-[0_0_15px_rgba(143,245,255,0.2)]'}`}
      >
        <span className="relative flex h-2.5 w-2.5">
          {isOpen && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOpen ? 'bg-white' : 'bg-[#8ff5ff]'}`} />
        </span>
        <Radio size={16} />
        Live Optics
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* ── Panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="ticker-panel"
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="overflow-hidden mt-4"
          >
            <div className="bg-[#131313]/90 backdrop-blur-2xl border border-white/5 rounded-[28px] shadow-2xl relative">
              <div className={`absolute top-0 left-0 right-0 h-1.5 rounded-t-[28px] opacity-80 bg-gradient-to-r ${isPositive ? 'from-[#8ff5ff] to-[#00deec] shadow-[0_0_15px_rgba(143,245,255,0.8)]' : 'from-[#ff716c] to-[#d7383b] shadow-[0_0_15px_rgba(255,113,108,0.8)]'}`} />

              {loading && !quote ? (
                <Shimmer />
              ) : error ? (
                <div className="flex items-center gap-3 p-8 text-[#ff716c]">
                  <AlertCircle size={20} />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              ) : quote ? (
                <div className="p-6 sm:p-8 space-y-8">

                  {/* ── Sector / Industry badge ── */}
                  {(fundamentals?.sector || fundamentals?.industry) && (
                    <div className="flex flex-wrap items-center gap-3">
                      {fundamentals.sector && (
                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#ac8aff]/10 border border-[#ac8aff]/20 text-[#ac8aff] text-xs font-black uppercase tracking-widest">
                          <Building2 size={14} />
                          {fundamentals.sector}
                        </span>
                      )}
                      {fundamentals.industry && (
                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-300 text-xs font-bold uppercase tracking-widest">
                          {fundamentals.industry}
                        </span>
                      )}
                    </div>
                  )}


                  {/* ── Price Row ── */}
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="flex items-end gap-4">
                      <motion.span
                        key={quote.price}
                        initial={{ opacity: 0.5, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-5xl font-black text-white tracking-tighter leading-none drop-shadow-lg"
                      >
                        {fmtP(quote.price)}
                      </motion.span>
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold tracking-wider
                        ${isPositive ? 'bg-[#8ff5ff]/10 text-[#8ff5ff]' : 'bg-[#ff716c]/10 text-[#ff716c]'}`}>
                        {isPositive ? <TrendingUp size={16} strokeWidth={3} /> : <TrendingDown size={16} strokeWidth={3} />}
                        {isPositive ? '+' : ''}{fmtP(quote.change)}&nbsp;({isPositive ? '+' : ''}{changePct}%)
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {lastUpdated && (
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest hidden sm:block">
                          SYNC {lastUpdated.toLocaleTimeString()}
                        </span>
                      )}
                      <button onClick={fetchQuote} disabled={loading} title="Refresh now"
                        className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                      </button>
                      <div className="relative flex items-center justify-center w-9 h-9">
                        <CountdownRing seconds={countdown} total={REFRESH_INTERVAL} />
                        <span className="absolute text-[9px] font-black text-indigo-500">{countdown}</span>
                      </div>
                    </div>
                  </div>

                  {/* ── Intraday Stats ── */}
                  <div>
                    <SectionLabel>Intraday</SectionLabel>
                    <div className="flex flex-wrap gap-2">
                      <StatChip label="Open" value={fmtP(quote.open)} />
                      <StatChip label="High" value={fmtP(quote.high)} accent="green" />
                      <StatChip label="Low" value={fmtP(quote.low)} accent="red" />
                      <StatChip label="Prev Close" value={fmtP(quote.previousClose)} />
                      <StatChip label="Volume" value={fmtVol(quote.volume)} />
                      <StatChip label="Date" value={quote.latestTradingDay} />
                    </div>
                  </div>

                  {/* ── Fundamentals ── */}
                  <div>
                    <SectionLabel>Fundamentals</SectionLabel>
                    <div className="flex flex-wrap gap-2">
                      {fundamentals ? (
                        <>
                          {fundamentals.peRatio !== null ? (
                            <StatChip label="P/E (TTM)" value={fundamentals.peRatio.toFixed(2)} accent="violet"
                              sub={fundamentals.forwardPE !== null ? `Fwd: ${fundamentals.forwardPE.toFixed(2)}` : undefined} />
                          ) : (
                            <StatChip label="P/E (TTM)" value="N/A" />
                          )}
                          {fundamentals.eps !== null ? (
                            <StatChip label="EPS" value={`${currencySymbol}${fundamentals.eps.toFixed(2)}`} accent="blue" />
                          ) : (
                            <StatChip label="EPS" value="N/A" />
                          )}
                          {fundamentals.divYield !== null ? (
                            <StatChip label="Div Yield"
                              value={fundamentals.divYield > 0 ? `${(fundamentals.divYield * 100).toFixed(2)}%` : 'None'}
                              accent={fundamentals.divYield > 0 ? 'amber' : undefined} />
                          ) : (
                            <StatChip label="Div Yield" value="N/A" />
                          )}
                          {fundamentals.marketCap !== null ? (
                            <StatChip label="Mkt Cap" value={fmtMktCap(fundamentals.marketCap, currencySymbol)} accent="blue" />
                          ) : (
                            <StatChip label="Mkt Cap" value="N/A" />
                          )}
                          <StatChip label="Liquidity" value={fmtMktCap(quote.liquidity, currencySymbol)} sub="Daily $ Vol" accent="violet" />
                          {fundamentals.beta !== null ? (
                            <StatChip label="Beta" value={fundamentals.beta.toFixed(2)}
                              accent={fundamentals.beta > 1.5 ? 'red' : fundamentals.beta < 0.8 ? 'green' : undefined} />
                          ) : (
                            <StatChip label="Beta" value="N/A" />
                          )}
                        </>
                      ) : (
                        // Still loading fundamentals — show shimmer chips
                        <>
                          {['P/E (TTM)', 'EPS', 'Div Yield', 'Mkt Cap', 'Liquidity', 'Beta'].map(label => (
                            <div key={label} className="flex flex-col items-center justify-center bg-zinc-50 rounded-xl px-3 py-2.5 min-w-[88px] border border-zinc-100 gap-0.5 animate-pulse">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">{label}</span>
                              <div className="h-4 w-10 bg-zinc-200 rounded mt-1" />
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                    {fundamentals && !hasFundamentals && (
                      <p className="text-[11px] text-zinc-400 mt-2">
                        ⚠ Fundamental data unavailable — Alpha Vantage free tier may be rate-limiting. Try refreshing after 1 min.
                      </p>
                    )}
                    {fundamentals?.rateLimited && (
                      <p className="text-[11px] text-amber-500 mt-2">
                        ⏳ Rate-limited — fundamentals will load on next refresh (1 min).
                      </p>
                    )}
                  </div>

                  {/* ── 52-Week Range ── */}
                  {fundamentals && fundamentals.week52High !== null && fundamentals.week52Low !== null && (
                    <div className="pt-2">
                      <SectionLabel>52-Week Range</SectionLabel>
                      <div className="flex flex-wrap gap-4 items-center">
                        <StatChip label="52W Low" value={fmtP(fundamentals.week52Low!)} accent="red" />
                        <div className="flex-1 min-w-[120px] px-2">
                          <div className="h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{
                                width: `${Math.min(100, Math.max(0,
                                  ((quote.price - fundamentals.week52Low!) / (fundamentals.week52High! - fundamentals.week52Low!)) * 100
                                ))}%`
                              }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                              className="h-full rounded-full bg-gradient-to-r from-[#ff716c] via-[#ac8aff] to-[#8ff5ff] shadow-[0_0_10px_rgba(143,245,255,0.5)]"
                            />
                          </div>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest text-center mt-2 font-bold">
                            Current position
                          </p>
                        </div>
                        <StatChip label="52W High" value={fmtP(fundamentals.week52High!)} accent="green" />
                      </div>
                    </div>
                  )}


                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
