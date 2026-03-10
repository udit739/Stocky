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
                borderColor: '#94a3b8',
                backgroundColor: 'rgba(148,163,184,0.08)',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0.35,
                fill: false,
            },
            {
                label: 'ARIMA Forecast',
                data: forecastPricesPadded,
                borderColor: isUp ? '#8b5cf6' : '#f43f5e',
                backgroundColor: isUp
                    ? 'rgba(139,92,246,0.12)'
                    : 'rgba(244,63,94,0.12)',
                borderWidth: 2.5,
                borderDash: [6, 4],
                pointRadius: (ctx: any) => (ctx.dataIndex >= allLabels.length - arimaForecast.length ? 3 : 0),
                pointHoverRadius: 5,
                pointBackgroundColor: isUp ? '#8b5cf6' : '#f43f5e',
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
                backgroundColor: 'rgba(15,23,42,0.9)',
                titleColor: '#e2e8f0',
                bodyColor: '#cbd5e1',
                borderColor: 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                padding: 12,
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
                grid: { color: 'rgba(0,0,0,0.04)' },
                ticks: {
                    color: '#94a3b8',
                    maxRotation: 0,
                    maxTicksLimit: 8,
                    font: { size: 11 },
                },
            },
            y: {
                position: 'right' as const,
                grid: { color: 'rgba(0,0,0,0.04)' },
                ticks: {
                    color: '#94a3b8',
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
            className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6"
        >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-violet-50">
                        <FlaskConical size={20} className="text-violet-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-zinc-900 text-lg leading-tight">ARIMA Forecast</h3>
                        <p className="text-xs text-zinc-400 font-medium">Statistical model · 7-day outlook for {symbol}</p>
                    </div>
                </div>

                {/* Summary badge */}
                <div
                    className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl border ${isUp
                        ? 'bg-violet-50 border-violet-100 text-violet-700'
                        : 'bg-rose-50 border-rose-100 text-rose-700'
                        }`}
                >
                    <div className="shrink-0">
                        {isUp ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    </div>
                    <div>
                        <div className="text-xs font-bold uppercase tracking-widest opacity-60">7-Day Target</div>
                        <div className="font-black text-xl">{currencySymbol}{endForecast.toFixed(2)}</div>
                    </div>
                    <div className="pl-3 border-l border-current/20">
                        <div className="text-xs font-bold uppercase tracking-widest opacity-60">Expected Δ</div>
                        <div className="font-bold text-sm whitespace-nowrap">
                            {changeAbs >= 0 ? '+' : ''}{changeAbs.toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
                        </div>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 mb-4">
                <div className="flex items-center gap-1.5">
                    <span className="inline-block w-6 h-0.5 bg-slate-400 rounded" />
                    <span className="text-xs text-zinc-500 font-medium">Historical (30d)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span
                        className="inline-block w-6 h-0.5 rounded"
                        style={{
                            background: isUp ? '#8b5cf6' : '#f43f5e',
                            backgroundImage: `repeating-linear-gradient(90deg, ${isUp ? '#8b5cf6' : '#f43f5e'} 0 6px, transparent 6px 10px)`,
                        }}
                    />
                    <span className="text-xs text-zinc-500 font-medium">ARIMA Forecast (7d)</span>
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
