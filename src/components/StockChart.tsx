import React, { useRef, useEffect, useState } from 'react';
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

interface StockDataPoint {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  ma7: number | null;
  ma20: number | null;
  ma50: number | null;
}

interface StockChartProps {
  data: StockDataPoint[];
  symbol: string;
  currencySymbol?: string;
}

// ── Candlestick Canvas Renderer ──────────────────────────────────────────────
interface CandleChartProps {
  data: StockDataPoint[];
  currencySymbol: string;
}

const CandleChart: React.FC<CandleChartProps> = ({ data, currencySymbol }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number; y: number;
    date: string; open: number; high: number; low: number; close: number;
  } | null>(null);

  // Store candle rects for hit testing
  const candleRectsRef = useRef<
    { x: number; w: number; idx: number }[]
  >([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;

      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);

      const PAD_L = 55;
      const PAD_R = 12;
      const PAD_T = 12;
      const PAD_B = 28;

      const chartW = W - PAD_L - PAD_R;
      const chartH = H - PAD_T - PAD_B;

      // price range
      const highs = data.map(d => d.high ?? d.close);
      const lows = data.map(d => d.low ?? d.close);
      const priceMin = Math.min(...lows) * 0.998;
      const priceMax = Math.max(...highs) * 1.002;
      const priceRange = priceMax - priceMin;

      const toY = (price: number) =>
        PAD_T + ((priceMax - price) / priceRange) * chartH;

      const n = data.length;
      const totalGap = chartW * 0.15;
      const candleW = Math.max(2, Math.floor((chartW - totalGap) / n));
      const gap = Math.max(1, Math.floor(totalGap / n));
      const stepX = candleW + gap;
      const startX = PAD_L + (chartW - stepX * n + gap) / 2;

      // Y-axis grid + labels
      const yTicks = 5;
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      for (let i = 0; i <= yTicks; i++) {
        const price = priceMin + (priceRange * i) / yTicks;
        const y = toY(price);
        ctx.strokeStyle = 'rgba(0,0,0,0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD_L, y);
        ctx.lineTo(W - PAD_R, y);
        ctx.stroke();
        ctx.fillStyle = '#71717a';
        ctx.fillText(`${currencySymbol}${price.toFixed(2)}`, PAD_L - 4, y + 3.5);
      }

      // X-axis labels (every ~15 candles)
      ctx.textAlign = 'center';
      ctx.fillStyle = '#71717a';
      const labelInterval = Math.max(1, Math.floor(n / 6));
      for (let i = 0; i < n; i += labelInterval) {
        const x = startX + i * stepX + candleW / 2;
        const d = data[i].date.slice(5); // MM-DD
        ctx.fillText(d, x, H - PAD_B + 16);
      }

      // Candles
      candleRectsRef.current = [];
      for (let i = 0; i < n; i++) {
        const d = data[i];
        const open = d.open ?? d.close;
        const high = d.high ?? d.close;
        const low = d.low ?? d.close;
        const close = d.close;
        const bullish = close >= open;

        const x = startX + i * stepX;
        const bodyTop = toY(Math.max(open, close));
        const bodyBot = toY(Math.min(open, close));
        const bodyH = Math.max(1, bodyBot - bodyTop);
        const wickX = x + candleW / 2;

        // Wick
        ctx.strokeStyle = bullish ? '#10b981' : '#ef4444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wickX, toY(high));
        ctx.lineTo(wickX, toY(low));
        ctx.stroke();

        // Body
        ctx.fillStyle = bullish ? '#10b981' : '#ef4444';
        ctx.fillRect(x, bodyTop, candleW, bodyH);

        // Hollow body for bullish (optional modern look)
        if (bullish && bodyH > 3) {
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.fillRect(x + 1, bodyTop + 1, candleW - 2, bodyH - 2);
        }

        candleRectsRef.current.push({ x, w: candleW, idx: i });
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => ro.disconnect();
  }, [data, currencySymbol]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const hit = candleRectsRef.current.find(
      c => mouseX >= c.x && mouseX <= c.x + c.w
    );
    if (hit) {
      const d = data[hit.idx];
      setTooltip({
        x: mouseX,
        y: mouseY,
        date: d.date,
        open: d.open ?? d.close,
        high: d.high ?? d.close,
        low: d.low ?? d.close,
        close: d.close,
      });
    } else {
      setTooltip(null);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 bg-zinc-900 text-white text-[11px] rounded-lg px-3 py-2 shadow-xl border border-zinc-700 min-w-[130px]"
          style={{
            left: tooltip.x + 14,
            top: Math.max(8, tooltip.y - 60),
          }}
        >
          <p className="font-semibold text-zinc-300 mb-1">{tooltip.date}</p>
          <p><span className="text-zinc-400">O</span> {currencySymbol}{tooltip.open.toFixed(2)}</p>
          <p><span className="text-zinc-400">H</span> {currencySymbol}{tooltip.high.toFixed(2)}</p>
          <p><span className="text-zinc-400">L</span> {currencySymbol}{tooltip.low.toFixed(2)}</p>
          <p><span className="text-zinc-400">C</span> {currencySymbol}{tooltip.close.toFixed(2)}</p>
        </div>
      )}
    </div>
  );
};

// ── Main Chart Component ─────────────────────────────────────────────────────
export const StockChart: React.FC<StockChartProps> = ({ data, symbol, currencySymbol = '$' }) => {
  const [chartType, setChartType] = useState<'line' | 'candle'>('line');

  const hasOHLC = data.length > 0 && data[0].open !== undefined;

  const lineChartData = {
    labels: data.map((d) => d.date),
    datasets: [
      {
        label: `${symbol} Closing Price`,
        data: data.map((d) => d.close),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.3,
        fill: true,
        order: 4,
      },
      {
        label: `MA (7)`,
        data: data.map((d) => d.ma7),
        borderColor: '#f59e0b',
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0.3,
        fill: false,
        spanGaps: true,
        order: 3,
      },
      {
        label: `MA (20)`,
        data: data.map((d) => d.ma20),
        borderColor: '#3b82f6',
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0.3,
        fill: false,
        spanGaps: true,
        order: 2,
      },
      {
        label: `MA (50)`,
        data: data.map((d) => d.ma50),
        borderColor: '#8b5cf6',
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0.3,
        fill: false,
        spanGaps: true,
        order: 1,
      },
    ],
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: '#18181b',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context: any) => {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              label += `${currencySymbol}${context.parsed.y.toLocaleString()}`;
            }
            return label;
          },
        },
      },
    },
    scales: {
      x: { display: false },
      y: {
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        ticks: {
          font: { size: 10 },
          callback: (value: any) => `${currencySymbol}${value}`,
        },
      },
    },
    interaction: { intersect: false, mode: 'index' as const },
  };

  return (
    <div className="w-full bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">
          Price History {chartType === 'line' ? '& MAs' : '— Candle'}
        </h3>

        <div className="flex flex-wrap items-center gap-2">
          {/* MA Legend (line mode only) */}
          {chartType === 'line' && (
            <div className="flex gap-2 text-[10px] font-medium uppercase tracking-wider">
              <span className="text-emerald-500">Price</span>
              <span className="text-amber-500">MA7</span>
              <span className="text-blue-500">MA20</span>
              <span className="text-violet-500">MA50</span>
            </div>
          )}

          {/* Candle legend */}
          {chartType === 'candle' && (
            <div className="flex gap-2 text-[10px] font-medium uppercase tracking-wider">
              <span className="text-emerald-500">▲ Bull</span>
              <span className="text-red-500">▼ Bear</span>
            </div>
          )}

          {/* Toggle buttons */}
          <div className="flex rounded-lg overflow-hidden border border-zinc-200 text-[11px] font-semibold">
            <button
              onClick={() => setChartType('line')}
              className={`px-3 py-1 transition-colors ${chartType === 'line'
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white text-zinc-400 hover:text-zinc-700'
                }`}
            >
              Line
            </button>
            <button
              onClick={() => setChartType('candle')}
              disabled={!hasOHLC}
              className={`px-3 py-1 transition-colors ${chartType === 'candle'
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white text-zinc-400 hover:text-zinc-700'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              Candle
            </button>
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div className="h-[270px]">
        {chartType === 'line' ? (
          <Line data={lineChartData} options={lineOptions} />
        ) : (
          <CandleChart data={data} currencySymbol={currencySymbol} />
        )}
      </div>
    </div>
  );
};
