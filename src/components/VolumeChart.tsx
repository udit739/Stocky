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

    // Color each bar: spike (>2× avg) = amber, high (>avg) = blue-400, normal = blue-200
    const barColors = volumes.map((v) => {
        if (v > avg20 * 2) return 'rgba(251, 146, 60, 0.85)';   // amber spike
        if (v > avg20 * 1.25) return 'rgba(96, 165, 250, 0.85)'; // blue-400 above avg
        return 'rgba(147, 197, 253, 0.65)';                       // blue-200 normal
    });

    const chartData = {
        labels: data.map((d) => d.date),
        datasets: [
            {
                label: 'Volume',
                data: volumes,
                backgroundColor: barColors,
                borderWidth: 0,
                borderRadius: 2,
            },
            {
                // Average volume shown as a thin "line" by rendering a tiny translucent bar at avg level
                label: 'Avg Volume (20d)',
                data: volumes.map(() => avg20),
                type: 'line' as const,
                borderColor: 'rgba(99, 102, 241, 0.7)',
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
                backgroundColor: '#18181b',
                titleColor: '#ffffff',
                bodyColor: '#ffffff',
                padding: 12,
                cornerRadius: 8,
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
                grid: { color: 'rgba(0,0,0,0.04)' },
                ticks: {
                    font: { size: 10 },
                    callback: (v: any) => formatVolume(v),
                },
            },
        },
        interaction: { intersect: false, mode: 'index' as const },
    };

    return (
        <div className="w-full bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                    <BarChart2 size={16} className="text-blue-400" />
                    <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">Volume</h3>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                    <span className="text-amber-500">⚡ Spike</span>
                    <span className="text-blue-400">Above Avg</span>
                    <span className="text-blue-200">Normal</span>
                    <span className="text-indigo-400">— 20d Avg</span>
                </div>
            </div>

            {/* Stats row */}
            <div className="flex gap-3 mb-4 flex-wrap">
                <div className="flex flex-col px-4 py-2 bg-zinc-50 rounded-xl border border-zinc-100 flex-1 min-w-[130px]">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Today's Volume</span>
                    <span className="text-lg font-black text-zinc-900">{formatVolume(todayVolume)}</span>
                </div>
                <div className="flex flex-col px-4 py-2 bg-zinc-50 rounded-xl border border-zinc-100 flex-1 min-w-[130px]">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">20-Day Avg Volume</span>
                    <span className="text-lg font-black text-zinc-900">{formatVolume(Math.round(avg20))}</span>
                </div>
                <div className={`flex flex-col px-4 py-2 rounded-xl border flex-1 min-w-[130px] ${isHighVolume ? 'bg-amber-50 border-amber-100' :
                    isLowVolume ? 'bg-blue-50 border-blue-100' :
                        'bg-zinc-50 border-zinc-100'
                    }`}>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Volume Status</span>
                    <div className={`flex flex-wrap items-center gap-1 text-sm font-black ${isHighVolume ? 'text-amber-600' :
                        isLowVolume ? 'text-blue-600' :
                            'text-zinc-900'
                        }`}>
                        {isHighVolume ? <TrendingUp size={14} /> : isLowVolume ? <TrendingDown size={14} /> : null}
                        <span>{isHighVolume ? 'High' : isLowVolume ? 'Low' : 'Normal'}</span>
                        <span className="text-xs font-semibold opacity-70">
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
