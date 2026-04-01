import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { BarChart2, TrendingUp, TrendingDown } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);

interface VolumeChartProps {
    data: { date: string; volume: number }[];
}

function formatVolume(v: number): string {
    if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
    return `${v}`;
}

export const VolumeChart: React.FC<VolumeChartProps> = ({ data }) => {
    const volumes = data.map((d) => d.volume);

    // 20-day average volume (trailing)
    const avg20 = volumes.length >= 20
        ? volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
        : volumes.reduce((a, b) => a + b, 0) / (volumes.length || 1);

    const todayVolume = volumes[volumes.length - 1] ?? 0;
    const volumeVsAvg = avg20 > 0 ? ((todayVolume - avg20) / avg20) * 100 : 0;
    const isHighVolume = todayVolume > avg20 * 1.5;
    const isLowVolume = todayVolume < avg20 * 0.5;

    // Color each bar: spike (>2× avg) = purple, high (>avg) = teal, normal = low cyan
    const barColors = volumes.map((v) => {
        if (v > avg20 * 2) return 'rgba(172, 138, 255, 0.9)';   // Purple spike
        if (v > avg20 * 1.25) return 'rgba(0, 238, 252, 0.85)'; // Teal above avg
        return 'rgba(143, 245, 255, 0.3)';                       // Low cyan normal
    });

    const chartData = {
        labels: data.map((d) => d.date),
        datasets: [
            {
                label: 'Volume',
                data: volumes,
                backgroundColor: barColors,
                borderWidth: 0,
                borderRadius: 4,
            },
            {
                // Average volume shown as a thin "line" by rendering a tiny translucent bar at avg level
                label: 'Avg Volume (20d)',
                data: volumes.map(() => avg20),
                type: 'line' as const,
                borderColor: 'rgba(255, 113, 108, 0.8)', // Neon red line
                borderWidth: 1.5,
                borderDash: [6, 4],
                pointRadius: 0,
                fill: false,
                tension: 0,
            } as any,
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
                titleColor: '#8ff5ff',
                bodyColor: '#ffffff',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 12,
                callbacks: {
                    label: (ctx: any) => {
                        if (ctx.dataset.label === 'Volume') {
                            const spike = ctx.parsed.y > avg20 * 2;
                            return ` Volume: ${formatVolume(ctx.parsed.y)}${spike ? ' ⚡ Spike!' : ''}`;
                        }
                        return ` Avg (20d): ${formatVolume(avg20)}`;
                    },
                },
            },
        },
        scales: {
            x: { display: false },
            y: {
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: {
                    font: { size: 10 },
                    color: '#a1a1aa',
                    callback: (v: any) => formatVolume(v),
                },
            },
        },
        interaction: { intersect: false, mode: 'index' as const },
    };

    return (
        <div className="w-full bg-[#131313]/90 backdrop-blur-xl p-8 rounded-[28px] border border-white/5 shadow-2xl">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <BarChart2 size={24} className="text-[#8ff5ff]" />
                    <h3 className="text-xl font-black text-white tracking-widest uppercase">Volume Optics</h3>
                </div>
                <div className="flex flex-wrap gap-4 text-[10px] font-black uppercase tracking-widest">
                    <span className="text-[#ac8aff]">⚡ Spike</span>
                    <span className="text-[#00eefc]">Above Avg</span>
                    <span className="text-[#8ff5ff]/70">Normal</span>
                    <span className="text-[#ff716c]">— 20d Avg</span>
                </div>
            </div>

            {/* Stats row */}
            <div className="flex gap-4 mb-6 flex-wrap">
                <div className="flex flex-col px-5 py-3 bg-white/5 rounded-2xl border border-white/10 flex-1 min-w-[130px]">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#8ff5ff]/80">Today's Volume</span>
                    <span className="text-2xl font-black text-white drop-shadow-md">{formatVolume(todayVolume)}</span>
                </div>
                <div className="flex flex-col px-5 py-3 bg-white/5 rounded-2xl border border-white/10 flex-1 min-w-[130px]">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">20-Day Avg Volume</span>
                    <span className="text-2xl font-black text-zinc-300 relative">
                        {formatVolume(Math.round(avg20))}
                    </span>
                </div>
                <div className={`flex flex-col px-5 py-3 rounded-2xl border flex-1 min-w-[130px] ${isHighVolume ? 'bg-[#00eefc]/10 border-[#00eefc]/20' :
                    isLowVolume ? 'bg-[#ff716c]/10 border-[#ff716c]/20' :
                        'bg-white/5 border-white/10'
                    }`}>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Volume Velocity</span>
                    <div className={`flex flex-wrap items-center gap-1.5 text-lg py-0.5 font-black uppercase tracking-widest ${isHighVolume ? 'text-[#00eefc] drop-shadow-[0_0_5px_rgba(0,238,252,0.4)]' :
                        isLowVolume ? 'text-[#ff716c]' :
                            'text-zinc-300'
                        }`}>
                        {isHighVolume ? <TrendingUp size={16} strokeWidth={3} /> : isLowVolume ? <TrendingDown size={16} strokeWidth={3} /> : null}
                        <span>{isHighVolume ? 'Surging' : isLowVolume ? 'Lags' : 'Steady'}</span>
                        <span className="text-[11px] font-bold opacity-70 ml-1 mt-1">
                            ({volumeVsAvg > 0 ? '+' : ''}{volumeVsAvg.toFixed(1)}%)
                        </span>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="h-[180px]">
                <Bar data={chartData as any} options={options as any} />
            </div>
        </div>
    );
};
