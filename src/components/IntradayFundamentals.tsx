import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Briefcase, BarChart, Percent, DollarSign, Activity, TrendingUp, Calendar } from 'lucide-react';

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
  earnings?: {
    financialsChart?: {
      quarterly?: { date: string; revenue: number; earnings: number }[];
      yearly?: { date: number; revenue: number; earnings: number }[];
    }
  };
  earningsTrend?: {
    trend?: {
      period: string;
      endDate: string | null;
      growth: number | null;
      earningsEstimate: { avg: number | null; low: number | null; high: number | null };
      revenueEstimate: { avg: number | null; low: number | null; high: number | null };
    }[];
  };
  trailingReturns?: {
    stock: { ytd: number|null; oneYear: number|null; threeYear: number|null; fiveYear: number|null; } | null;
    sp500: { ytd: number|null; oneYear: number|null; threeYear: number|null; fiveYear: number|null; } | null;
  };
  financialData?: {
    profitMargins: number | null;
    returnOnAssets: number | null;
    returnOnEquity: number | null;
    totalRevenue: number | null;
    totalCash: number | null;
    debtToEquity: number | null;
    freeCashflow: number | null;
  };
  defaultKeyStatistics?: {
    netIncomeToCommon: number | null;
    trailingEps: number | null;
  };
}

interface IntradayFundamentalsProps {
  symbol: string;
}

const formatLarge = (num: number | null) => {
  if (num === null) return 'N/A';
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  return num.toString();
};

export const IntradayFundamentals: React.FC<IntradayFundamentalsProps> = ({ symbol }) => {
  const [data, setData] = useState<FundamentalsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchFundamentals = async () => {
      try {
        const res = await fetch(`/api/fundamentals?symbol=${encodeURIComponent(symbol)}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (isMounted) setData(json);
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchFundamentals();
    return () => { isMounted = false; };
  }, [symbol]);

  if (loading) {
    return (
      <div className="w-full bg-[#131313]/90 backdrop-blur-xl p-8 rounded-[28px] border border-white/5 flex items-center justify-center h-[300px]">
         <div className="w-8 h-8 border-2 border-white/20 border-t-[#ac8aff] rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const currentQtr = data.earningsTrend?.trend?.find(t => t.period === '+0q') || data.earningsTrend?.trend?.[0];
  const nextQtr = data.earningsTrend?.trend?.find(t => t.period === '+1q') || data.earningsTrend?.trend?.[1];

  const renderReturn = (val: number | null) => {
    if (val === null || val === undefined) return <span className="text-zinc-600">--</span>;
    const isPos = val >= 0;
    return (
      <span className={`font-black ${isPos ? 'text-[#00e676]' : 'text-[#ff3b30]'}`}>
        {isPos ? '+' : '- '}{Math.abs(val).toFixed(2)}%
      </span>
    );
  };

  const todayStr = new Date().toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' });

  return (
    <div className="flex flex-col gap-8">
      {/* ── PERFORMANCE OVERVIEW (Full Width) ── */}
      {data.trailingReturns?.stock && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full bg-[#111111]/90 backdrop-blur-xl p-6 sm:p-8 rounded-[28px] border border-white/5 shadow-2xl"
        >
          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Performance Overview: <span className="uppercase">{symbol}</span></h2>
            <p className="text-sm text-zinc-400">
              Trailing total returns as of {todayStr}, which may include dividends or other distributions. Benchmark is <span className="text-[#8ff5ff]">S&P 500 (^GSPC)</span>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'YTD Return', stock: data.trailingReturns.stock.ytd, sp500: data.trailingReturns.sp500?.ytd },
              { label: '1-Year Return', stock: data.trailingReturns.stock.oneYear, sp500: data.trailingReturns.sp500?.oneYear },
              { label: '3-Year Return', stock: data.trailingReturns.stock.threeYear, sp500: data.trailingReturns.sp500?.threeYear },
              { label: '5-Year Return', stock: data.trailingReturns.stock.fiveYear, sp500: data.trailingReturns.sp500?.fiveYear },
            ].map((col, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-[#161616] border border-white/5 flex flex-col gap-4">
                <h4 className="text-lg font-bold text-white">{col.label}</h4>
                <div className="flex justify-between items-center text-sm">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-zinc-300 uppercase">{symbol}</span>
                    {renderReturn(col.stock)}
                  </div>
                  <div className="flex flex-col gap-1 text-right">
                    <span className="font-bold text-zinc-300">S&P 500 (^GSPC)</span>
                    {renderReturn(col.sp500)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* ── KEY STATISTICS (Previously Performance Overview) ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full bg-[#1a1919]/90 backdrop-blur-xl p-6 sm:p-8 rounded-[28px] border border-white/5 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#8ff5ff] rounded-full blur-[120px] opacity-[0.03] pointer-events-none" />

          <div className="flex items-center gap-3 mb-6">
            <Activity size={20} className="text-[#8ff5ff]" />
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Key Statistics</h3>
          </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-2">
               <Briefcase size={16} className="text-[#ac8aff]" />
               <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Sector</span>
            </div>
            <span className="text-sm font-bold text-white text-right">{data.sector || 'N/A'}</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#131313] border border-white/5 shadow-inner">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Market Cap</span>
            <span className="text-xl font-black text-white tracking-widest">{formatLarge(data.marketCap)}</span>
          </div>
          <div className="p-4 rounded-2xl bg-[#131313] border border-white/5 shadow-inner">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1">P/E Ratio</span>
            <span className="text-xl font-black text-white tracking-widest">{data.peRatio ? data.peRatio.toFixed(2) : 'N/A'}</span>
          </div>
          <div className="p-4 rounded-2xl bg-[#131313] border border-white/5 shadow-inner">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Trailing EPS</span>
            <span className="text-xl font-black text-[#8ff5ff] tracking-widest">${data.eps ? data.eps.toFixed(2) : 'N/A'}</span>
          </div>
          <div className="p-4 rounded-2xl bg-[#131313] border border-white/5 shadow-inner">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Beta</span>
            <span className="text-xl font-black text-white tracking-widest">{data.beta ? data.beta.toFixed(2) : 'N/A'}</span>
          </div>

          {data.week52Low !== null && data.week52High !== null && (
            <div className="col-span-2 p-5 rounded-2xl bg-white/[0.02] border border-white/5 mt-2 space-y-3">
              <div className="flex justify-between text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                  <span>52W Low: ${data.week52Low.toFixed(2)}</span>
                  <span>52W High: ${data.week52High.toFixed(2)}</span>
              </div>
              <div className="relative h-2 bg-[#0e0e0e] rounded-full overflow-hidden border border-white/5">
                  <div className="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-[#ff716c] via-[#ffd580] to-[#8ff5ff] opacity-40" />
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── EARNINGS TRENDS ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="w-full bg-[#1a1919]/90 backdrop-blur-xl p-6 sm:p-8 rounded-[28px] border border-white/5 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#ffd580] rounded-full blur-[120px] opacity-[0.03] pointer-events-none" />

        <div className="flex items-center gap-3 mb-6">
          <TrendingUp size={20} className="text-[#ffd580]" />
          <h3 className="text-sm font-black text-white uppercase tracking-widest">Earnings Trends</h3>
        </div>

        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#131313] to-[#1a1919] border border-white/5 shadow-inner">
            <div className="flex justify-between items-start mb-4">
               <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#ffd580] block mb-1">Current Quarter Est.</span>
                  <span className="text-2xl font-black text-white">${currentQtr?.earningsEstimate?.avg?.toFixed(2) || 'N/A'}</span>
               </div>
               <Calendar size={20} className="text-zinc-600" />
            </div>
            <div className="flex justify-between text-xs font-bold text-zinc-500">
               <span>Low: ${currentQtr?.earningsEstimate?.low?.toFixed(2) || '?'}</span>
               <span>High: ${currentQtr?.earningsEstimate?.high?.toFixed(2) || '?'}</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#131313] to-[#1a1919] border border-white/5 shadow-inner">
            <div className="flex justify-between items-start mb-4">
               <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#ac8aff] block mb-1">Next Quarter Est.</span>
                  <span className="text-2xl font-black text-white">${nextQtr?.earningsEstimate?.avg?.toFixed(2) || 'N/A'}</span>
               </div>
            </div>
            <div className="flex justify-between text-xs font-bold text-zinc-500">
               <span>Low: ${nextQtr?.earningsEstimate?.low?.toFixed(2) || '?'}</span>
               <span>High: ${nextQtr?.earningsEstimate?.high?.toFixed(2) || '?'}</span>
            </div>
          </div>

           {/* Mini revenue vs earnings historical visualization if available */}
          {data.earnings?.financialsChart?.quarterly && data.earnings.financialsChart.quarterly.length > 0 && (
            <div className="mt-6 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-6">Past 4 Qtrs (Earnings)</span>
              <div className="flex items-end justify-between h-20 gap-2">
                 {data.earnings.financialsChart.quarterly.slice(-4).map((q, i) => {
                    // Simple max normalization
                    const maxEarn = Math.max(...data.earnings!.financialsChart!.quarterly!.map(x => x.earnings || 1));
                    const hPct = Math.max(10, ((q.earnings || 0) / maxEarn) * 100);
                    return (
                       <div key={i} className="flex flex-col items-center flex-1 gap-2">
                          <span className="text-[9px] font-black text-white">${formatLarge(q.earnings)}</span>
                          <div className="w-full bg-[#131313] rounded-t-sm border border-white/5 flex items-end justify-center relative" style={{ height: '40px' }}>
                             <div className="w-full bg-gradient-to-t from-[#ffd580]/40 to-[#ffd580]" style={{ height: `${Math.max(15, hPct)}%` }} />
                          </div>
                          <span className="text-[9px] font-bold text-zinc-600">{q.date}</span>
                       </div>
                    );
                 })}
              </div>
            </div>
          )}

        </div>
      </motion.div>

      {/* ── FINANCIAL HIGHLIGHTS ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="w-full md:col-span-2 bg-[#1a1919]/90 backdrop-blur-xl p-6 sm:p-8 rounded-[28px] border border-white/5 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-1/2 w-64 h-64 bg-[#00e676] rounded-full blur-[150px] opacity-[0.02] pointer-events-none" />

        <div className="flex items-center gap-3 mb-6">
          <Activity size={20} className="text-[#00e676]" />
          <h3 className="text-sm font-black text-white uppercase tracking-widest">Financial Highlights</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
          {/* Profitability */}
          <div>
            <h4 className="text-sm font-black text-white mb-4 uppercase tracking-widest border-b border-white/10 pb-2">Profitability and Income Statement</h4>
            <div className="flex flex-col">
              <div className="flex justify-between items-center py-3 border-b border-white/5 text-sm">
                <span className="font-bold text-zinc-400">Profit Margin</span>
                <span className="font-black text-white">{data.financialData?.profitMargins ? (data.financialData.profitMargins * 100).toFixed(2) + '%' : 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/5 text-sm">
                <span className="font-bold text-zinc-400">Return on Assets (ttm)</span>
                <span className="font-black text-white">{data.financialData?.returnOnAssets ? (data.financialData.returnOnAssets * 100).toFixed(2) + '%' : 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/5 text-sm">
                <span className="font-bold text-zinc-400">Return on Equity (ttm)</span>
                <span className="font-black text-white">{data.financialData?.returnOnEquity ? (data.financialData.returnOnEquity * 100).toFixed(2) + '%' : 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/5 text-sm">
                <span className="font-bold text-zinc-400">Revenue (ttm)</span>
                <span className="font-black text-white">{formatLarge(data.financialData?.totalRevenue ?? null)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/5 text-sm">
                <span className="font-bold text-zinc-400">Net Income Avi to Common (ttm)</span>
                <span className="font-black text-white">{formatLarge(data.defaultKeyStatistics?.netIncomeToCommon ?? null)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-white/5 text-sm">
                <span className="font-bold text-zinc-400">Diluted EPS (ttm)</span>
                <span className="font-black text-white">{data.defaultKeyStatistics?.trailingEps?.toFixed(2) ?? 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Balance Sheet */}
          <div>
            <h4 className="text-sm font-black text-white mb-4 uppercase tracking-widest border-b border-white/10 pb-2">Balance Sheet and Cash Flow</h4>
            <div className="flex flex-col">
              <div className="flex justify-between items-center py-3 border-b border-white/5 text-sm">
                <span className="font-bold text-zinc-400">Total Cash (mrq)</span>
                <span className="font-black text-white">{formatLarge(data.financialData?.totalCash ?? null)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/5 text-sm">
                <span className="font-bold text-zinc-400">Total Debt/Equity (mrq)</span>
                <span className="font-black text-white">{data.financialData?.debtToEquity ? data.financialData.debtToEquity.toFixed(2) + '%' : 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-white/5 text-sm">
                <span className="font-bold text-zinc-400">Levered Free Cash Flow (ttm)</span>
                <span className="font-black text-white">{formatLarge(data.financialData?.freeCashflow ?? null)}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      </div>
    </div>
  );
};
