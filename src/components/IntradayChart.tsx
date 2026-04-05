import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ScriptableContext,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface IntradayPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface IntradayChartProps {
  symbol: string;
  currencySymbol?: string;
}

export const IntradayChart: React.FC<IntradayChartProps> = ({ symbol, currencySymbol = '$' }) => {
  const [data, setData] = useState<IntradayPoint[]>([]);
  const [tradingDay, setTradingDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIntraday = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/intraday?symbol=${encodeURIComponent(symbol)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to fetch intraday data');
      setData(body.data || []);
      if (body.tradingDay) setTradingDay(body.tradingDay);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntraday();
    const intervalId = setInterval(fetchIntraday, 60 * 1000);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  if (loading && data.length === 0) {
    return (
      <div className="w-full bg-[#131313]/90 backdrop-blur-xl p-6 sm:p-8 rounded-[28px] border border-white/5 shadow-2xl h-[360px] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-[#8ff5ff] rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full bg-[#131313]/90 backdrop-blur-xl p-6 sm:p-8 rounded-[28px] border border-white/5 shadow-2xl h-[360px] flex items-center justify-center">
        <p className="text-[#ff716c] text-sm font-bold">{error}</p>
      </div>
    );
  }

  if (data.length === 0) return null;

  const isPositive = data[0].close <= data[data.length - 1].close;
  const colorHex = isPositive ? '#8ff5ff' : '#ff716c';

  const chartData = {
    labels: data.map((d) => {
        const date = new Date(d.date);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }),
    datasets: [
      {
        label: `${symbol} Intraday`,
        data: data.map((d) => d.close),
        borderColor: colorHex,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.1,
        fill: true,
        backgroundColor: (context: ScriptableContext<"line">) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, context.chart.height);
          if (isPositive) {
            gradient.addColorStop(0, 'rgba(143, 245, 255, 0.4)');
            gradient.addColorStop(1, 'rgba(143, 245, 255, 0)');
          } else {
            gradient.addColorStop(0, 'rgba(255, 113, 108, 0.4)');
            gradient.addColorStop(1, 'rgba(255, 113, 108, 0)');
          }
          return gradient;
        },
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: '#0e0e0e',
        titleColor: colorHex,
        bodyColor: '#ffffff',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
        callbacks: {
          label: (context: any) => {
            if (context.parsed.y !== null) {
              return `${currencySymbol}${context.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
            return '';
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false as any },
        ticks: {
          maxTicksLimit: 8,
          font: { size: 10 },
          color: '#a1a1aa',
        },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          font: { size: 10 },
          color: '#a1a1aa',
          callback: (value: any) => `${currencySymbol}${value}`,
        },
      },
    },
    interaction: { intersect: false, mode: 'index' as const },
  };

  return (
    <div className="w-full bg-[#131313]/90 backdrop-blur-xl p-6 sm:p-8 rounded-[28px] border border-white/5 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPositive ? 'bg-[#8ff5ff]' : 'bg-[#ff716c]'}`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isPositive ? 'bg-[#8ff5ff]' : 'bg-[#ff716c]'}`} />
          </span>
          Live Intraday
          {tradingDay && (
            <span className="text-[10px] font-bold text-zinc-500 normal-case tracking-normal ml-1">
              {new Date(tradingDay + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          )}
        </h3>
        {loading && <div className="w-3 h-3 border-2 border-white/20 border-t-[#8ff5ff] rounded-full animate-spin" />}
      </div>
      <div className="h-[270px]">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
};
