import React, { useMemo } from 'react';
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
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, FlaskConical } from 'lucide-react';

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

interface DataPoint {
    date: string;
    close: number;
}

interface ArimaChartProps {
    data: DataPoint[];
    arimaForecast: number[];
    symbol: string;
    currencySymbol?: string;
}

function nextTradingDates(fromDate: string, count: number): string[] {
    const result: string[] = [];
    const d = new Date(fromDate);
    while (result.length < count) {
        d.setDate(d.getDate() + 1);
        const day = d.getDay();
        if (day !== 0 && day !== 6) {
            result.push(d.toISOString().split('T')[0]);
        }
    }
    return result;
}

export const ArimaChart: React.FC<ArimaChartProps> = ({ data, arimaForecast, symbol, currencySymbol = '$' }) => {
    const HISTORY_WINDOW = 30;

    const chartData = useMemo(() => {
        const history = data.slice(-HISTORY_WINDOW);
        const lastDate = history[history.length - 1]?.date ?? new Date().toISOString().split('T')[0];
        const futureDates = nextTradingDates(lastDate, arimaForecast.length);

        const historyLabels = history.map(d => d.date);
        const historyPrices = history.map(d => d.close);

        // The forecast line starts at the last historical price so the chart
        // looks visually connected (no gap between history and forecast).
        const forecastOverlap = [history[history.length - 1].close, ...arimaForecast];
        const forecastLabels = [historyLabels[historyLabels.length - 1], ...futureDates];

        const allLabels = [...historyLabels, ...futureDates];

        // Pad historical prices so they align with allLabels
        const historyPricesPadded = [
            ...historyPrices,
            ...Array(futureDates.length).fill(null),
        ];

        // Forecast dataset: nulls for historical slots, then forecast values
        const forecastPricesPadded = [
            ...Array(historyLabels.length - 1).fill(null),
            ...forecastOverlap,
        ];

        const lastPrice = historyPrices[historyPrices.length - 1];
        const endForecast = arimaForecast[arimaForecast.length - 1];
        const isUp = endForecast >= lastPrice;

        return { allLabels, historyPricesPadded, forecastPricesPadded, lastPrice, endForecast, isUp, forecastLabels };
    }, [data, arimaForecast]);

    const { allLabels, historyPricesPadded, forecastPricesPadded, lastPrice, endForecast, isUp } = chartData;

    const changePct = ((endForecast - lastPrice) / lastPrice) * 100;
    const changeAbs = endForecast - lastPrice;

    const chartConfig = {
        labels: allLabels,
        datasets: [
            {
                label: 'Historical',
                data: historyPricesPadded,
                borderColor: '#71717a',
                backgroundColor: 'rgba(113,113,122,0.08)',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0.35,
                fill: false,
            },
            {
                label: 'ARIMA Forecast',
                data: forecastPricesPadded,
                borderColor: isUp ? '#8ff5ff' : '#ff716c',
                backgroundColor: isUp
                    ? 'rgba(143,245,255,0.12)'
                    : 'rgba(255,113,108,0.12)',
                borderWidth: 2.5,
                borderDash: [6, 4],
                pointRadius: (ctx: any) => (ctx.dataIndex >= allLabels.length - arimaForecast.length ? 3 : 0),
                pointHoverRadius: 5,
                pointBackgroundColor: isUp ? '#8ff5ff' : '#ff716c',
                tension: 0.35,
                fill: true,
            },
        ],
    };

    const options: any = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index' as const, intersect: false },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#0e0e0e',
                titleColor: '#ac8aff',
                bodyColor: '#ffffff',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 12,
                callbacks: {
                    label: (ctx: any) => {
                        if (ctx.parsed.y === null) return '';
                        return ` ${ctx.dataset.label}: ${currencySymbol}${ctx.parsed.y.toFixed(2)}`;
                    },
                },
            },
        },
        scales: {
            x: {
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: {
                    color: '#a1a1aa',
                    maxRotation: 0,
                    maxTicksLimit: 8,
                    font: { size: 11 },
                },
            },
            y: {
                position: 'right' as const,
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: {
                    color: '#a1a1aa',
                    font: { size: 11 },
                    callback: (v: number) => `${currencySymbol}${v.toFixed(0)}`,
                },
            },
        },
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#131313]/90 backdrop-blur-xl rounded-[28px] border border-white/5 shadow-2xl p-8"
        >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-[#ac8aff]/10 border border-[#ac8aff]/20">
                        <FlaskConical size={24} className="text-[#ac8aff]" />
                    </div>
                    <div>
                        <h3 className="font-black text-white text-xl uppercase tracking-widest leading-tight">ARIMA Forecast</h3>
                        <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1.5">Statistical model · 7-day outlook for {symbol}</p>
                    </div>
                </div>

                {/* Summary badge */}
                <div
                    className={`flex flex-wrap items-center gap-4 px-5 py-3.5 rounded-2xl border backdrop-blur-md shadow-lg ${isUp
                        ? 'bg-[#8ff5ff]/10 border-[#8ff5ff]/20 text-[#8ff5ff]'
                        : 'bg-[#ff716c]/10 border-[#ff716c]/20 text-[#ff716c]'
                        }`}
                >
                    <div className="shrink-0">
                        {isUp ? <TrendingUp size={24} strokeWidth={3} /> : <TrendingDown size={24} strokeWidth={3} />}
                    </div>
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-widest opacity-70">7-Day Target</div>
                        <div className="font-black text-2xl tracking-tight">{currencySymbol}{endForecast.toFixed(2)}</div>
                    </div>
                    <div className="pl-4 border-l border-white/10">
                        <div className="text-[10px] font-black uppercase tracking-widest opacity-70">Expected Δ</div>
                        <div className="font-black text-sm whitespace-nowrap tracking-wider">
                            {changeAbs >= 0 ? '+' : ''}{changeAbs.toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
                        </div>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-6 mb-6">
                <div className="flex items-center gap-2">
                    <span className="inline-block w-6 h-1 bg-[#71717a] rounded-sm" />
                    <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Historical (30d)</span>
                </div>
                <div className="flex items-center gap-2">
                    <span
                        className="inline-block w-8 h-1 rounded-sm"
                        style={{
                            background: isUp ? '#8ff5ff' : '#ff716c',
                            backgroundImage: `repeating-linear-gradient(90deg, ${isUp ? '#8ff5ff' : '#ff716c'} 0 6px, transparent 6px 10px)`,
                        }}
                    />
                    <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">ARIMA Forecast (7d)</span>
                </div>
            </div>

            {/* Chart */}
            <div style={{ height: 260 }}>
                <Line data={chartConfig} options={options} />
            </div>

            {/* Disclaimer */}
            <p className="mt-4 text-[10px] text-zinc-400 text-center">
                ARIMA(2,1,2) · Statistical extrapolation only · Not financial advice
            </p>
        </motion.div>
    );
};
