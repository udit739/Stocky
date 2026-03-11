import React, { useState } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
    TrendingUp,
    TrendingDown,
    Minus,
    Activity,
    BarChart2,
    ShieldCheck,
    FlaskConical,
    ArrowUpRight,
    ArrowDownRight,
} from 'lucide-react';
import { motion } from 'motion/react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

interface PredictionResult {
    trend: 'Bullish' | 'Bearish' | 'Neutral';
    prediction: string;
    confidence: number;
    signal: 'Buy' | 'Hold' | 'Sell';
    explanation: string;
}

interface StockDataPoint {
    date: string;
    close: number;
    volume: number;
    rsi: number | null;
    ma7: number | null;
    ma20: number | null;
    ma50: number | null;
}

interface StockData {
    symbol: string;
    currencySymbol: string;
    data: StockDataPoint[];
    latestPrice: number;
    previousPrice: number;
    latestRSI: number | null;
    arimaForecast: number[];
    prediction: PredictionResult;
}

interface CompareViewProps {
    stockA: StockData;
    stockB: StockData;
}

// ── Colour palette for the two stocks ──
const COLOR_A = { line: '#6366f1', fill: 'rgba(99,102,241,0.08)', light: 'bg-indigo-50', text: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700', border: 'border-indigo-200' };
const COLOR_B = { line: '#f59e0b', fill: 'rgba(245,158,11,0.08)', light: 'bg-amber-50', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700', border: 'border-amber-200' };

// Normalise prices to % return from first common date
function normalise(prices: number[]): number[] {
    if (prices.length === 0) return [];
    const base = prices[0];
    return prices.map(p => ((p - base) / base) * 100);
}

// Align two date arrays to the common intersection
function alignData(a: StockDataPoint[], b: StockDataPoint[]) {
    const setA = new Map(a.map(d => [d.date, d]));
    const setB = new Map(b.map(d => [d.date, d]));
    const common = [...setA.keys()].filter(d => setB.has(d)).sort();
    return {
        dates: common,
        aAligned: common.map(d => setA.get(d)!),
        bAligned: common.map(d => setB.get(d)!),
    };
}

function calcChange(data: StockDataPoint[], barsBack: number): number | null {
    if (data.length < barsBack + 1) return null;
    const past = data[data.length - 1 - barsBack].close;
    const now = data[data.length - 1].close;
    return ((now - past) / past) * 100;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const SignalBadge: React.FC<{ signal: 'Buy' | 'Hold' | 'Sell' }> = ({ signal }) => {
    const colors = { Buy: 'bg-emerald-500', Hold: 'bg-amber-500', Sell: 'bg-rose-500' };
    return (
        <span className={`inline-block px-4 py-1 rounded-full font-bold text-white text-sm shadow ${colors[signal]}`}>
            {signal}
        </span>
    );
};

const TrendBadge: React.FC<{ trend: 'Bullish' | 'Bearish' | 'Neutral' }> = ({ trend }) => {
    const styles = {
        Bullish: 'text-emerald-600 bg-emerald-50 border border-emerald-200',
        Bearish: 'text-rose-600 bg-rose-50 border border-rose-200',
        Neutral: 'text-amber-600 bg-amber-50 border border-amber-200',
    }[trend];
    const Icon = trend === 'Bullish' ? TrendingUp : trend === 'Bearish' ? TrendingDown : Minus;
    return (
        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${styles}`}>
            <Icon size={12} /> {trend}
        </span>
    );
};

const PctCell: React.FC<{ pct: number | null }> = ({ pct }) => {
    if (pct === null) return <span className="text-zinc-400">—</span>;
    const pos = pct >= 0;
    const Icon = pos ? ArrowUpRight : ArrowDownRight;
    return (
        <span className={`inline-flex items-center gap-0.5 font-semibold ${pos ? 'text-emerald-600' : 'text-rose-600'}`}>
            <Icon size={14} />{pos ? '+' : ''}{pct.toFixed(2)}%
        </span>
    );
};

const WinnerTag: React.FC<{ show: boolean }> = ({ show }) =>
    show ? (
        <span className="ml-1 text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
            Better
        </span>
    ) : null;

// ── Main Compare View ─────────────────────────────────────────────────────────

export const CompareView: React.FC<CompareViewProps> = ({ stockA, stockB }) => {
    const [showNorm, setShowNorm] = useState(true);

    const { dates, aAligned, bAligned } = alignData(stockA.data, stockB.data);

    const aPrices = aAligned.map(d => d.close);
    const bPrices = bAligned.map(d => d.close);

    const aNorm = normalise(aPrices);
    const bNorm = normalise(bPrices);

    const aRsi = aAligned.map(d => d.rsi);
    const bRsi = bAligned.map(d => d.rsi);

    // Normalised chart
    const normChartData = {
        labels: dates,
        datasets: [
            {
                label: stockA.symbol,
                data: aNorm,
                borderColor: COLOR_A.line,
                backgroundColor: COLOR_A.fill,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0.3,
                fill: true,
            },
            {
                label: stockB.symbol,
                data: bNorm,
                borderColor: COLOR_B.line,
                backgroundColor: COLOR_B.fill,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0.3,
                fill: true,
            },
        ],
    };

    // Absolute price chart
    const absChartData = {
        labels: dates,
        datasets: [
            {
                label: `${stockA.symbol} (${stockA.currencySymbol})`,
                data: aPrices,
                borderColor: COLOR_A.line,
                backgroundColor: COLOR_A.fill,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0.3,
                fill: false,
                yAxisID: 'yA',
            },
            {
                label: `${stockB.symbol} (${stockB.currencySymbol})`,
                data: bPrices,
                borderColor: COLOR_B.line,
                backgroundColor: COLOR_B.fill,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0.3,
                fill: false,
                yAxisID: 'yB',
            },
        ],
    };

    const normOptions: any = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: '#18181b',
                titleColor: '#fff',
                bodyColor: '#d4d4d8',
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y >= 0 ? '+' : ''}${ctx.parsed.y.toFixed(2)}%`,
                },
            },
        },
        scales: {
            x: { display: false },
            y: {
                grid: { color: 'rgba(0,0,0,0.05)' },
                ticks: {
                    font: { size: 10 },
                    callback: (v: any) => `${v >= 0 ? '+' : ''}${Number(v).toFixed(1)}%`,
                },
            },
        },
        interaction: { intersect: false, mode: 'index' as const },
    };

    const absOptions: any = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: '#18181b',
                titleColor: '#fff',
                bodyColor: '#d4d4d8',
                padding: 12,
                cornerRadius: 8,
            },
        },
        scales: {
            x: { display: false },
            yA: {
                type: 'linear' as const,
                position: 'left' as const,
                grid: { color: 'rgba(99,102,241,0.08)' },
                ticks: { font: { size: 10 }, callback: (v: any) => `${stockA.currencySymbol}${v}`, color: COLOR_A.line },
            },
            yB: {
                type: 'linear' as const,
                position: 'right' as const,
                grid: { drawOnChartArea: false },
                ticks: { font: { size: 10 }, callback: (v: any) => `${stockB.currencySymbol}${v}`, color: COLOR_B.line },
            },
        },
        interaction: { intersect: false, mode: 'index' as const },
    };

    // RSI chart
    const rsiChartData = {
        labels: dates,
        datasets: [
            {
                label: `${stockA.symbol} RSI`,
                data: aRsi,
                borderColor: COLOR_A.line,
                borderWidth: 1.5,
                pointRadius: 0,
                tension: 0.2,
                spanGaps: true,
            },
            {
                label: `${stockB.symbol} RSI`,
                data: bRsi,
                borderColor: COLOR_B.line,
                borderWidth: 1.5,
                pointRadius: 0,
                tension: 0.2,
                spanGaps: true,
            },
        ],
    };

    const rsiOptions: any = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: { mode: 'index', intersect: false, backgroundColor: '#18181b', titleColor: '#fff', bodyColor: '#d4d4d8', padding: 10, cornerRadius: 8 },
        },
        scales: {
            x: { display: false },
            y: {
                min: 0, max: 100,
                grid: { color: 'rgba(0,0,0,0.05)' },
                ticks: { stepSize: 25, font: { size: 10 } },
            },
        },
        interaction: { intersect: false, mode: 'index' as const },
    };

    // ── Metrics ──
    const a1d = ((stockA.latestPrice - stockA.previousPrice) / stockA.previousPrice) * 100;
    const b1d = ((stockB.latestPrice - stockB.previousPrice) / stockB.previousPrice) * 100;
    const a5d = calcChange(stockA.data, 5);
    const b5d = calcChange(stockB.data, 5);
    const a1m = calcChange(stockA.data, 21);
    const b1m = calcChange(stockB.data, 21);

    const aArimaTarget = stockA.arimaForecast.length > 0 ? stockA.arimaForecast[stockA.arimaForecast.length - 1] : null;
    const bArimaTarget = stockB.arimaForecast.length > 0 ? stockB.arimaForecast[stockB.arimaForecast.length - 1] : null;
    const aArimaChg = aArimaTarget !== null ? ((aArimaTarget - stockA.latestPrice) / stockA.latestPrice) * 100 : null;
    const bArimaChg = bArimaTarget !== null ? ((bArimaTarget - stockB.latestPrice) / stockB.latestPrice) * 100 : null;

    const betterReturn = (a: number | null, b: number | null, higherIsBetter = true) => {
        if (a === null || b === null) return { a: false, b: false };
        return higherIsBetter
            ? { a: a > b, b: b > a }
            : { a: a < b, b: a > b };
    };

    const ret1d = betterReturn(a1d, b1d);
    const ret5d = betterReturn(a5d, b5d);
    const ret1m = betterReturn(a1m, b1m);
    const retArima = betterReturn(aArimaChg, bArimaChg);
    const retConf = betterReturn(stockA.prediction.confidence, stockB.prediction.confidence);
    const retRsi = betterReturn(
        stockA.latestRSI !== null ? -Math.abs(stockA.latestRSI - 50) : null,
        stockB.latestRSI !== null ? -Math.abs(stockB.latestRSI - 50) : null,
    ); // Closer to 50 = more neutral / less extreme

    const MetricRow: React.FC<{
        label: string;
        icon: React.ReactNode;
        aVal: React.ReactNode;
        bVal: React.ReactNode;
        aBetter?: boolean;
        bBetter?: boolean;
    }> = ({ label, icon, aVal, bVal, aBetter, bBetter }) => (
        <tr className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60 transition-colors">
            <td className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                <span className="flex items-center gap-1.5">{icon}{label}</span>
            </td>
            <td className="py-3 px-4 text-sm">
                {aVal}
                <WinnerTag show={!!aBetter} />
            </td>
            <td className="py-3 px-4 text-sm">
                {bVal}
                <WinnerTag show={!!bBetter} />
            </td>
        </tr>
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-12 space-y-8"
        >
            {/* ── Stock Header Cards ── */}
            <div className="grid grid-cols-2 gap-4">
                {[
                    { stock: stockA, color: COLOR_A, change: a1d },
                    { stock: stockB, color: COLOR_B, change: b1d },
                ].map(({ stock, color, change }) => (
                    <div
                        key={stock.symbol}
                        className={`bg-white rounded-2xl border ${color.border} shadow-sm p-5 flex flex-col gap-2`}
                    >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className={`text-2xl font-black ${color.text}`}>{stock.symbol}</span>
                            <TrendBadge trend={stock.prediction.trend} />
                        </div>
                        <div className="text-3xl font-bold text-zinc-900">
                            {stock.currencySymbol}{stock.latestPrice.toFixed(2)}
                        </div>
                        <div className={`flex items-center gap-1 font-semibold text-sm ${change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {change >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                            {change >= 0 ? '+' : ''}{change.toFixed(2)}% today
                        </div>
                        <div className="mt-1">
                            <SignalBadge signal={stock.prediction.signal} />
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Price Chart ── */}
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">
                        {showNorm ? 'Normalised Return (%)' : 'Absolute Price'}
                    </h3>
                    <div className="flex rounded-lg overflow-hidden border border-zinc-200 text-[11px] font-semibold">
                        <button
                            onClick={() => setShowNorm(true)}
                            className={`px-3 py-1 transition-colors ${showNorm ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-400 hover:text-zinc-700'}`}
                        >
                            % Return
                        </button>
                        <button
                            onClick={() => setShowNorm(false)}
                            className={`px-3 py-1 transition-colors ${!showNorm ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-400 hover:text-zinc-700'}`}
                        >
                            Price
                        </button>
                    </div>
                </div>
                <div className="h-[280px]">
                    <Line data={showNorm ? normChartData : absChartData} options={showNorm ? normOptions : absOptions} />
                </div>
            </div>

            {/* ── RSI Comparison Chart ── */}
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                        <Activity size={14} className="text-violet-500" /> RSI (14) Comparison
                    </h3>
                    <div className="flex gap-3 text-xs font-medium">
                        <span className="text-rose-500">70 Overbought</span>
                        <span className="text-emerald-500">30 Oversold</span>
                    </div>
                </div>
                <div className="h-[180px]">
                    <Line data={rsiChartData} options={rsiOptions} />
                </div>
            </div>

            {/* ── Metrics Comparison Table ── */}
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-100">
                    <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                        <BarChart2 size={14} className="text-zinc-400" /> Side-by-Side Metrics
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50">
                                <th className="py-2.5 px-4 text-xs font-bold text-zinc-400 uppercase tracking-wider w-36">Metric</th>
                                <th className={`py-2.5 px-4 text-xs font-bold uppercase tracking-wider ${COLOR_A.text}`}>
                                    {stockA.symbol}
                                </th>
                                <th className={`py-2.5 px-4 text-xs font-bold uppercase tracking-wider ${COLOR_B.text}`}>
                                    {stockB.symbol}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <MetricRow
                                label="Signal"
                                icon={<ShieldCheck size={12} />}
                                aVal={<SignalBadge signal={stockA.prediction.signal} />}
                                bVal={<SignalBadge signal={stockB.prediction.signal} />}
                            />
                            <MetricRow
                                label="Confidence"
                                icon={<ShieldCheck size={12} />}
                                aVal={<span className="font-semibold">{stockA.prediction.confidence}%</span>}
                                bVal={<span className="font-semibold">{stockB.prediction.confidence}%</span>}
                                aBetter={retConf.a}
                                bBetter={retConf.b}
                            />
                            <MetricRow
                                label="1-Day"
                                icon={<TrendingUp size={12} />}
                                aVal={<PctCell pct={a1d} />}
                                bVal={<PctCell pct={b1d} />}
                                aBetter={ret1d.a}
                                bBetter={ret1d.b}
                            />
                            <MetricRow
                                label="5-Day"
                                icon={<TrendingUp size={12} />}
                                aVal={<PctCell pct={a5d} />}
                                bVal={<PctCell pct={b5d} />}
                                aBetter={ret5d.a}
                                bBetter={ret5d.b}
                            />
                            <MetricRow
                                label="1-Month"
                                icon={<TrendingUp size={12} />}
                                aVal={<PctCell pct={a1m} />}
                                bVal={<PctCell pct={b1m} />}
                                aBetter={ret1m.a}
                                bBetter={ret1m.b}
                            />
                            <MetricRow
                                label="ARIMA 7d"
                                icon={<FlaskConical size={12} />}
                                aVal={
                                    aArimaTarget !== null && aArimaChg !== null ? (
                                        <span className="flex flex-col">
                                            <span className="font-semibold">{stockA.currencySymbol}{aArimaTarget.toFixed(2)}</span>
                                            <PctCell pct={aArimaChg} />
                                        </span>
                                    ) : <span className="text-zinc-400">—</span>
                                }
                                bVal={
                                    bArimaTarget !== null && bArimaChg !== null ? (
                                        <span className="flex flex-col">
                                            <span className="font-semibold">{stockB.currencySymbol}{bArimaTarget.toFixed(2)}</span>
                                            <PctCell pct={bArimaChg} />
                                        </span>
                                    ) : <span className="text-zinc-400">—</span>
                                }
                                aBetter={retArima.a}
                                bBetter={retArima.b}
                            />
                            <MetricRow
                                label="RSI (14)"
                                icon={<Activity size={12} />}
                                aVal={
                                    stockA.latestRSI !== null ? (
                                        <span className={`font-semibold ${stockA.latestRSI > 70 ? 'text-rose-600' : stockA.latestRSI < 30 ? 'text-emerald-600' : 'text-zinc-700'}`}>
                                            {stockA.latestRSI.toFixed(1)}
                                            <span className="ml-1 text-[10px] font-normal opacity-60">
                                                {stockA.latestRSI > 70 ? '(OB)' : stockA.latestRSI < 30 ? '(OS)' : ''}
                                            </span>
                                        </span>
                                    ) : <span className="text-zinc-400">—</span>
                                }
                                bVal={
                                    stockB.latestRSI !== null ? (
                                        <span className={`font-semibold ${stockB.latestRSI > 70 ? 'text-rose-600' : stockB.latestRSI < 30 ? 'text-emerald-600' : 'text-zinc-700'}`}>
                                            {stockB.latestRSI.toFixed(1)}
                                            <span className="ml-1 text-[10px] font-normal opacity-60">
                                                {stockB.latestRSI > 70 ? '(OB)' : stockB.latestRSI < 30 ? '(OS)' : ''}
                                            </span>
                                        </span>
                                    ) : <span className="text-zinc-400">—</span>
                                }
                                aBetter={retRsi.a}
                                bBetter={retRsi.b}
                            />
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── AI Analysis Side-by-Side ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                    { stock: stockA, color: COLOR_A },
                    { stock: stockB, color: COLOR_B },
                ].map(({ stock, color }) => (
                    <div key={stock.symbol} className={`bg-white rounded-2xl border ${color.border} shadow-sm p-5`}>
                        <div className="flex items-center gap-2 mb-3">
                            <span className={`text-xs font-black uppercase tracking-widest ${color.text}`}>{stock.symbol}</span>
                            <span className="text-xs text-zinc-400">— AI Analysis</span>
                        </div>
                        <p className="text-zinc-600 text-sm leading-relaxed italic mb-4">
                            "{stock.prediction.prediction}"
                        </p>
                        <div className="pt-4 border-t border-zinc-50">
                            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Reasoning</h4>
                            <p className="text-zinc-700 text-xs leading-relaxed">{stock.prediction.explanation}</p>
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};
