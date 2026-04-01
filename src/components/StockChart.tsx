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
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD_L, y);
        ctx.lineTo(W - PAD_R, y);
        ctx.stroke();
        ctx.fillStyle = '#a1a1aa';
        ctx.fillText(`${currencySymbol}${price.toFixed(2)}`, PAD_L - 4, y + 3.5);
      }

      // X-axis labels (every ~15 candles)
      ctx.textAlign = 'center';
      ctx.fillStyle = '#a1a1aa';
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
        ctx.strokeStyle = bullish ? '#8ff5ff' : '#ff716c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wickX, toY(high));
        ctx.lineTo(wickX, toY(low));
        ctx.stroke();

        // Body
        ctx.fillStyle = bullish ? '#8ff5ff' : '#ff716c';
        ctx.fillRect(x, bodyTop, candleW, bodyH);

        // Hollow body for bullish (optional modern look)
        if (bullish && bodyH > 3) {
          ctx.fillStyle = 'rgba(14,14,14,0.6)';
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
          className="pointer-events-none absolute z-10 bg-[#0e0e0e]/95 text-white text-[11px] rounded-xl px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.5)] border border-white/10 backdrop-blur-md min-w-[140px]"
          style={{
            left: tooltip.x + 14,
            top: Math.max(8, tooltip.y - 60),
          }}
        >
          <p className="font-bold text-[#8ff5ff] mb-2 uppercase tracking-wider">{tooltip.date}</p>
          <p><span className="text-zinc-500 font-bold inline-block w-4">O</span> {currencySymbol}{tooltip.open.toFixed(2)}</p>
          <p><span className="text-zinc-500 font-bold inline-block w-4">H</span> {currencySymbol}{tooltip.high.toFixed(2)}</p>
          <p><span className="text-zinc-500 font-bold inline-block w-4">L</span> {currencySymbol}{tooltip.low.toFixed(2)}</p>
          <p><span className="text-zinc-500 font-bold inline-block w-4">C</span> {currencySymbol}{tooltip.close.toFixed(2)}</p>
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
        borderColor: '#8ff5ff',
        backgroundColor: 'rgba(143, 245, 255, 0.05)',
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
        borderColor: '#00eefc',
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
        borderColor: '#ac8aff',
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
        borderColor: '#5516be',
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
        backgroundColor: '#0e0e0e',
        titleColor: '#8ff5ff',
        bodyColor: '#ffffff',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
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
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h3 className="text-sm font-black text-white uppercase tracking-widest">
          Price History {chartType === 'line' ? '& MAs' : '— Candle'}
        </h3>

        <div className="flex flex-wrap items-center gap-3">
          {/* MA Legend (line mode only) */}
          {chartType === 'line' && (
            <div className="flex gap-3 text-[10px] font-black uppercase tracking-widest">
              <span className="text-[#8ff5ff]">Price</span>
              <span className="text-[#00eefc]">MA7</span>
              <span className="text-[#ac8aff]">MA20</span>
              <span className="text-[#5516be]">MA50</span>
            </div>
          )}

          {/* Candle legend */}
          {chartType === 'candle' && (
            <div className="flex gap-3 text-[10px] font-black uppercase tracking-widest">
              <span className="text-[#8ff5ff]">▲ Bull</span>
              <span className="text-[#ff716c]">▼ Bear</span>
            </div>
          )}

          {/* Toggle buttons */}
          <div className="flex rounded-full overflow-hidden border border-white/10 text-[10px] font-black uppercase tracking-widest bg-white/5 p-1">
            <button
              onClick={() => setChartType('line')}
              className={`px-4 py-1.5 rounded-full transition-colors ${chartType === 'line'
                ? 'bg-gradient-to-r from-[#8ff5ff] to-[#00deec] text-[#005d63]'
                : 'text-zinc-400 hover:text-white'
                }`}
            >
              Line
            </button>
            <button
              onClick={() => setChartType('candle')}
              disabled={!hasOHLC}
              className={`px-4 py-1.5 rounded-full transition-colors ${chartType === 'candle'
                ? 'bg-gradient-to-r from-[#ac8aff] to-[#8455ef] text-[#280067]'
                : 'text-zinc-400 hover:text-white'
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
