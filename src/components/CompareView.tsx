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
const COLOR_A = { line: '#8ff5ff', fill: 'rgba(143,245,255,0.08)', light: 'bg-[#8ff5ff]/10', text: 'text-[#8ff5ff]', badge: 'bg-[#8ff5ff]/10 text-[#8ff5ff]', border: 'border-[#8ff5ff]/20' };
const COLOR_B = { line: '#ac8aff', fill: 'rgba(172,138,255,0.08)', light: 'bg-[#ac8aff]/10', text: 'text-[#ac8aff]', badge: 'bg-[#ac8aff]/10 text-[#ac8aff]', border: 'border-[#ac8aff]/20' };

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
    const colors = {
        Buy: 'bg-gradient-to-br from-[#8ff5ff] to-[#00deec] text-[#005d63]',
        Hold: 'bg-gradient-to-br from-[#ac8aff] to-[#8455ef] text-[#280067]',
        Sell: 'bg-gradient-to-br from-[#ff716c] to-[#d7383b] text-[#490006]'
    };
    return (
        <span className={`inline-block px-4 py-1.5 rounded-full font-black uppercase text-[10px] tracking-widest shadow-lg ${colors[signal]}`}>
            {signal}
        </span>
    );
};

const TrendBadge: React.FC<{ trend: 'Bullish' | 'Bearish' | 'Neutral' }> = ({ trend }) => {
    const styles = {
        Bullish: 'text-[#8ff5ff] bg-[#8ff5ff]/10 border border-[#8ff5ff]/20',
        Bearish: 'text-[#ff716c] bg-[#ff716c]/10 border border-[#ff716c]/20',
        Neutral: 'text-[#ac8aff] bg-[#ac8aff]/10 border border-[#ac8aff]/20',
    }[trend];
    const Icon = trend === 'Bullish' ? TrendingUp : trend === 'Bearish' ? TrendingDown : Minus;
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] uppercase font-black tracking-widest ${styles}`}>
            <Icon size={14} strokeWidth={3} /> {trend}
        </span>
    );
};

const PctCell: React.FC<{ pct: number | null }> = ({ pct }) => {
    if (pct === null) return <span className="text-zinc-600">—</span>;
    const pos = pct >= 0;
    const Icon = pos ? ArrowUpRight : ArrowDownRight;
    return (
        <span className={`inline-flex items-center gap-0.5 font-bold tracking-wider ${pos ? 'text-[#8ff5ff]' : 'text-[#ff716c]'}`}>
            <Icon size={16} strokeWidth={3} />{pos ? '+' : ''}{pct.toFixed(2)}%
        </span>
    );
};

const WinnerTag: React.FC<{ show: boolean }> = ({ show }) =>
    show ? (
        <span className="ml-2 text-[8px] font-black uppercase tracking-widest bg-[#00eefc]/20 text-[#00eefc] border border-[#00eefc]/30 px-1.5 py-0.5 rounded-sm">
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
            legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 }, color: '#a1a1aa' } },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: '#0e0e0e',
                titleColor: '#ac8aff',
                bodyColor: '#ffffff',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 12,
                callbacks: {
                    label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y >= 0 ? '+' : ''}${ctx.parsed.y.toFixed(2)}%`,
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
            legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 }, color: '#a1a1aa' } },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: '#0e0e0e',
                titleColor: '#ac8aff',
                bodyColor: '#ffffff',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 12,
            },
        },
        scales: {
            x: { display: false },
            yA: {
                type: 'linear' as const,
                position: 'left' as const,
                grid: { color: 'rgba(143,245,255,0.08)' },
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
            legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 }, color: '#a1a1aa' } },
            tooltip: { mode: 'index', intersect: false, backgroundColor: '#0e0e0e', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, titleColor: '#ac8aff', bodyColor: '#ffffff', padding: 10, cornerRadius: 12 },
        },
        scales: {
            x: { display: false },
            y: {
                min: 0, max: 100,
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: { stepSize: 25, font: { size: 10 }, color: '#a1a1aa' },
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
        <tr className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
            <td className="py-4 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest whitespace-nowrap">
                <span className="flex items-center gap-2">{icon}{label}</span>
            </td>
            <td className="py-4 px-6 text-sm text-white">
                {aVal}
                <WinnerTag show={!!aBetter} />
            </td>
            <td className="py-4 px-6 text-sm text-white">
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
            <div className="grid grid-cols-2 gap-6">
                {[
                    { stock: stockA, color: COLOR_A, change: a1d },
                    { stock: stockB, color: COLOR_B, change: b1d },
                ].map(({ stock, color, change }) => (
                    <div
                        key={stock.symbol}
                        className={`bg-[#131313]/90 backdrop-blur-xl rounded-[28px] border ${color.border} shadow-2xl p-8 flex flex-col gap-3`}
                    >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <span className={`text-3xl font-black drop-shadow-md ${color.text}`}>{stock.symbol}</span>
                            <TrendBadge trend={stock.prediction.trend} />
                        </div>
                        <div className="text-4xl font-black text-white drop-shadow-md pt-2">
                            {stock.currencySymbol}{stock.latestPrice.toFixed(2)}
                        </div>
                        <div className={`flex items-center gap-1.5 font-black text-sm tracking-wider ${change >= 0 ? 'text-[#8ff5ff]' : 'text-[#ff716c]'}`}>
                            {change >= 0 ? <ArrowUpRight size={18} strokeWidth={3} /> : <ArrowDownRight size={18} strokeWidth={3} />}
                            {change >= 0 ? '+' : ''}{change.toFixed(2)}% today
                        </div>
                        <div className="mt-2 text-left">
                            <SignalBadge signal={stock.prediction.signal} />
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Price Chart ── */}
            <div className="bg-[#131313]/90 backdrop-blur-xl rounded-[28px] border border-white/5 shadow-2xl p-8">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">
                        {showNorm ? 'Normalised Return (%)' : 'Absolute Price'}
                    </h3>
                    <div className="flex rounded-full overflow-hidden border border-white/10 text-[10px] uppercase font-black tracking-widest bg-white/5 p-1">
                        <button
                            onClick={() => setShowNorm(true)}
                            className={`px-4 py-1.5 rounded-full transition-colors ${showNorm ? 'bg-gradient-to-r from-[#8ff5ff] to-[#00deec] text-[#005d63]' : 'text-zinc-500 hover:text-white'}`}
                        >
                            % Return
                        </button>
                        <button
                            onClick={() => setShowNorm(false)}
                            className={`px-4 py-1.5 rounded-full transition-colors ${!showNorm ? 'bg-gradient-to-r from-[#ac8aff] to-[#8455ef] text-[#280067]' : 'text-zinc-500 hover:text-white'}`}
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
            <div className="bg-[#131313]/90 backdrop-blur-xl rounded-[28px] border border-white/5 shadow-2xl p-8">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <Activity size={18} className="text-[#ac8aff]" /> RSI (14) Comparison
                    </h3>
                    <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest">
                        <span className="text-[#ff716c]">70 Overbought</span>
                        <span className="text-[#8ff5ff]">30 Oversold</span>
                    </div>
                </div>
                <div className="h-[180px]">
                    <Line data={rsiChartData} options={rsiOptions} />
                </div>
            </div>

            {/* ── Metrics Comparison Table ── */}
            <div className="bg-[#131313]/90 backdrop-blur-xl rounded-[28px] border border-white/5 shadow-2xl overflow-hidden">
                <div className="px-8 py-6 border-b border-white/5">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-3">
                        <BarChart2 size={18} className="text-[#ac8aff]" /> Side-by-Side Metrics
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5 bg-[#0e0e0e]/50">
                                <th className="py-4 px-6 text-[10px] font-black text-zinc-600 uppercase tracking-widest w-36">Metric</th>
                                <th className={`py-4 px-6 text-[10px] font-black uppercase tracking-widest ${COLOR_A.text}`}>
                                    {stockA.symbol}
                                </th>
                                <th className={`py-4 px-6 text-[10px] font-black uppercase tracking-widest ${COLOR_B.text}`}>
                                    {stockB.symbol}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <MetricRow
                                label="Signal"
                                icon={<ShieldCheck size={14} className="text-[#8ff5ff]" />}
                                aVal={<SignalBadge signal={stockA.prediction.signal} />}
                                bVal={<SignalBadge signal={stockB.prediction.signal} />}
                            />
                            <MetricRow
                                label="Conviction"
                                icon={<ShieldCheck size={14} className="text-[#8ff5ff]" />}
                                aVal={<span className="font-black text-lg tracking-wider">{stockA.prediction.confidence}%</span>}
                                bVal={<span className="font-black text-lg tracking-wider">{stockB.prediction.confidence}%</span>}
                                aBetter={retConf.a}
                                bBetter={retConf.b}
                            />
                            <MetricRow
                                label="1-Day"
                                icon={<TrendingUp size={14} className="text-[#ac8aff]" />}
                                aVal={<PctCell pct={a1d} />}
                                bVal={<PctCell pct={b1d} />}
                                aBetter={ret1d.a}
                                bBetter={ret1d.b}
                            />
                            <MetricRow
                                label="5-Day"
                                icon={<TrendingUp size={14} className="text-[#ac8aff]" />}
                                aVal={<PctCell pct={a5d} />}
                                bVal={<PctCell pct={b5d} />}
                                aBetter={ret5d.a}
                                bBetter={ret5d.b}
                            />
                            <MetricRow
                                label="1-Month"
                                icon={<TrendingUp size={14} className="text-[#ac8aff]" />}
                                aVal={<PctCell pct={a1m} />}
                                bVal={<PctCell pct={b1m} />}
                                aBetter={ret1m.a}
                                bBetter={ret1m.b}
                            />
                            <MetricRow
                                label="ARIMA 7d"
                                icon={<FlaskConical size={14} className="text-[#00eefc]" />}
                                aVal={
                                    aArimaTarget !== null && aArimaChg !== null ? (
                                        <span className="flex flex-col gap-1">
                                            <span className="font-black tracking-wider text-lg">{stockA.currencySymbol}{aArimaTarget.toFixed(2)}</span>
                                            <PctCell pct={aArimaChg} />
                                        </span>
                                    ) : <span className="text-zinc-600">—</span>
                                }
                                bVal={
                                    bArimaTarget !== null && bArimaChg !== null ? (
                                        <span className="flex flex-col gap-1">
                                            <span className="font-black tracking-wider text-lg">{stockB.currencySymbol}{bArimaTarget.toFixed(2)}</span>
                                            <PctCell pct={bArimaChg} />
                                        </span>
                                    ) : <span className="text-zinc-600">—</span>
                                }
                                aBetter={retArima.a}
                                bBetter={retArima.b}
                            />
                            <MetricRow
                                label="RSI (14)"
                                icon={<Activity size={14} className="text-[#ff716c]" />}
                                aVal={
                                    stockA.latestRSI !== null ? (
                                        <span className={`font-black text-lg tracking-wider ${stockA.latestRSI > 70 ? 'text-[#ff716c]' : stockA.latestRSI < 30 ? 'text-[#8ff5ff]' : 'text-zinc-400'}`}>
                                            {stockA.latestRSI.toFixed(1)}
                                            <span className="ml-1 text-[10px] font-bold opacity-60">
                                                {stockA.latestRSI > 70 ? '(OB)' : stockA.latestRSI < 30 ? '(OS)' : ''}
                                            </span>
                                        </span>
                                    ) : <span className="text-zinc-600">—</span>
                                }
                                bVal={
                                    stockB.latestRSI !== null ? (
                                        <span className={`font-black text-lg tracking-wider ${stockB.latestRSI > 70 ? 'text-[#ff716c]' : stockB.latestRSI < 30 ? 'text-[#8ff5ff]' : 'text-zinc-400'}`}>
                                            {stockB.latestRSI.toFixed(1)}
                                            <span className="ml-1 text-[10px] font-bold opacity-60">
                                                {stockB.latestRSI > 70 ? '(OB)' : stockB.latestRSI < 30 ? '(OS)' : ''}
                                            </span>
                                        </span>
                                    ) : <span className="text-zinc-600">—</span>
                                }
                                aBetter={retRsi.a}
                                bBetter={retRsi.b}
                            />
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── AI Analysis Side-by-Side ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                    { stock: stockA, color: COLOR_A },
                    { stock: stockB, color: COLOR_B },
                ].map(({ stock, color }) => (
                    <div key={stock.symbol} className={`bg-[#131313]/90 backdrop-blur-xl rounded-[28px] border ${color.border} shadow-2xl p-8`}>
                        <div className="flex items-center gap-3 mb-5">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${color.text} bg-white/5 px-2 py-1 rounded-sm`}>{stock.symbol}</span>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">— Neural Analysis</span>
                        </div>
                        <p className="text-zinc-300 text-base leading-relaxed italic mb-6 font-light">
                            "{stock.prediction.prediction}"
                        </p>
                        <div className="pt-6 border-t border-white/5">
                            <h4 className="text-[10px] font-black text-[#00eefc] uppercase tracking-widest mb-3">Reasoning Subroutine</h4>
                            <p className="text-zinc-400 text-sm font-medium leading-relaxed">{stock.prediction.explanation}</p>
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};
