import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, TrendingUp, TrendingDown, RefreshCw, Layers, DollarSign, Landmark, BarChart2 } from 'lucide-react';

interface MarketItem {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
}

interface SectorItem {
  name: string;
  etf: string;
  weight: number;
  changePct: number | null;
  price: number | null;
}

interface MarketData {
  worldIndices: { americas: MarketItem[]; europe: MarketItem[]; asia: MarketItem[] };
  commodities: MarketItem[];
  currencies: MarketItem[];
  bonds: MarketItem[];
  sectors: SectorItem[];
  updatedAt?: string;
}

const fmtPrice = (p: number | null) => {
  if (p === null) return '—';
  if (p > 10000) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (p > 100) return p.toFixed(2);
  return p.toFixed(4);
};

const fmtPct = (v: number | null) => {
  if (v === null) return '—';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
};

function ChangeCell({ v }: { v: number | null }) {
  if (v === null) return <span className="text-zinc-600">—</span>;
  const pos = v >= 0;
  return (
    <span className={`font-bold text-xs ${pos ? 'text-[#00e676]' : 'text-[#ff4c4c]'}`}>
      {fmtPct(v)}
    </span>
  );
}

function MarketTable({ items, title }: { items: MarketItem[]; title: string }) {
  return (
    <div className="flex-1 min-w-[220px]">
      <h4 className="text-sm font-black text-white mb-3 uppercase tracking-widest">{title}</h4>
      <div className="space-y-0">
        <div className="grid grid-cols-3 px-2 pb-2 border-b border-white/5">
          <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Symbol</span>
          <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest text-right">Price</span>
          <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest text-right">Change %</span>
        </div>
        {items.map((item, i) => (
          <motion.div
            key={item.symbol}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="grid grid-cols-3 px-2 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors rounded-lg"
          >
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[#8ff5ff] truncate max-w-[100px]">{item.name}</span>
            </div>
            <span className="text-xs font-bold text-white text-right self-center">
              {fmtPrice(item.price)}
            </span>
            <div className="text-right self-center">
              <ChangeCell v={item.changePct} />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SectorTreemap({ sectors }: { sectors: SectorItem[] }) {
  const maxWeight = Math.max(...sectors.map(s => s.weight));
  return (
    <div className="grid grid-cols-3 gap-1.5 h-72">
      {sectors.slice(0, 9).map((s) => {
        const pos = (s.changePct ?? 0) >= 0;
        const intensity = Math.min(1, Math.abs(s.changePct ?? 0) / 5);
        const bg = pos
          ? `rgba(0,${Math.round(80 + intensity * 120)},${Math.round(60 + intensity * 60)},0.6)`
          : `rgba(${Math.round(120 + intensity * 100)},${Math.round(20 + intensity * 10)},${Math.round(20 + intensity * 10)},0.6)`;
        const fontSize = s.weight > 10 ? 'text-sm' : s.weight > 5 ? 'text-xs' : 'text-[10px]';
        return (
          <div
            key={s.etf}
            className="relative rounded-xl border border-white/5 flex flex-col items-center justify-center p-2 cursor-pointer hover:ring-1 hover:ring-white/20 transition-all"
            style={{ background: bg, gridRow: s.weight > 15 ? 'span 2' : undefined }}
            title={`${s.name}: ${fmtPct(s.changePct)}`}
          >
            <span className={`${fontSize} font-black text-white text-center leading-tight`}>{s.name} <span className="text-white/50 text-[10px] block font-bold">{s.etf}</span></span>
            <ChangeCell v={s.changePct} />
          </div>
        );
      })}
    </div>
  );
}

type Tab = 'indices' | 'assets' | 'sectors';

export const MarketOverview: React.FC = () => {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('indices');

  const fetchData = async (bustCache = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = bustCache ? '/api/market-overview?nocache=1' : '/api/market-overview';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch market data');
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'indices', label: 'World Indices', icon: <Globe size={14} /> },
    { id: 'assets', label: 'Assets', icon: <Layers size={14} /> },
    { id: 'sectors', label: 'Sectors', icon: <BarChart2 size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-zinc-300 p-4 sm:p-6 md:p-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide">Markets Overview</h1>
          <p className="text-xs text-zinc-500 mt-1 font-medium">
            Live market data
            {data?.updatedAt && (
              <> · Last updated: <span className="text-zinc-400">{new Date(data.updatedAt).toLocaleTimeString()}</span></>
            )}
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={loading}
          className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white disabled:opacity-40 transition-all"
          title="Force refresh (bypasses cache)"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${
              tab === t.id
                ? 'bg-[#131313] border-[#8ff5ff]/30 text-[#8ff5ff] shadow-[0_0_12px_rgba(143,245,255,0.1)]'
                : 'bg-white/[0.03] border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-60">
          <div className="w-8 h-8 border-2 border-white/10 border-t-[#8ff5ff] rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="text-center py-20">
          <p className="text-rose-400 font-bold">{error}</p>
          <button onClick={fetchData} className="mt-4 text-xs text-zinc-500 underline hover:text-white">Retry</button>
        </div>
      )}

      {data && !loading && (
        <AnimatePresence mode="wait">
          {tab === 'indices' && (
            <motion.div key="indices" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#131313]/80 backdrop-blur-xl p-5 rounded-2xl border border-white/5">
                  <MarketTable items={data.worldIndices.americas} title="🇺🇸 Americas" />
                </div>
                <div className="bg-[#131313]/80 backdrop-blur-xl p-5 rounded-2xl border border-white/5">
                  <MarketTable items={data.worldIndices.europe} title="🇪🇺 Europe" />
                </div>
                <div className="bg-[#131313]/80 backdrop-blur-xl p-5 rounded-2xl border border-white/5">
                  <MarketTable items={data.worldIndices.asia} title="🌏 Asia" />
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'assets' && (
            <motion.div key="assets" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#131313]/80 backdrop-blur-xl p-5 rounded-2xl border border-white/5">
                  <MarketTable items={data.commodities} title="⛏ Commodities" />
                </div>
                <div className="bg-[#131313]/80 backdrop-blur-xl p-5 rounded-2xl border border-white/5">
                  <MarketTable items={data.currencies} title="💱 Currencies" />
                </div>
                <div className="bg-[#131313]/80 backdrop-blur-xl p-5 rounded-2xl border border-white/5">
                  <MarketTable items={data.bonds} title="🏛 US Treasury Bonds" />
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'sectors' && (
            <motion.div key="sectors" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sector List */}
                <div className="bg-[#131313]/80 backdrop-blur-xl p-5 rounded-2xl border border-white/5">
                  <h3 className="text-sm font-black text-white mb-4 uppercase tracking-widest">Select a Sector</h3>
                  <div>
                    <div className="grid grid-cols-3 px-3 pb-2 border-b border-white/5">
                      <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Sector</span>
                      <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest text-center">Market Weight</span>
                      <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest text-right">Daily Return</span>
                    </div>
                    {data.sectors.map((s, i) => (
                      <motion.div
                        key={s.etf}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="grid grid-cols-3 items-center px-3 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex-1 max-w-[120px]">
                            <span className="text-xs font-bold text-white block truncate">{s.name} <span className="text-zinc-500 font-normal">({s.etf})</span></span>
                            <div className="h-1 mt-1 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#8ff5ff] to-[#ac8aff]"
                                style={{ width: `${(s.weight / 30) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-zinc-400 text-center">{s.weight.toFixed(2)}%</span>
                        <div className="text-right"><ChangeCell v={s.changePct} /></div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Treemap */}
                <div className="bg-[#131313]/80 backdrop-blur-xl p-5 rounded-2xl border border-white/5">
                  <h3 className="text-sm font-black text-white mb-4 uppercase tracking-widest">All Sectors</h3>
                  <SectorTreemap sectors={data.sectors} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};
