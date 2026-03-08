import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip
);

interface RsiChartProps {
    data: { date: string; rsi: number | null }[];
}

export const RsiChart: React.FC<RsiChartProps> = ({ data }) => {
    const chartData = {
        labels: data.map((d) => d.date),
        datasets: [
            {
                label: `RSI (14)`,
                data: data.map((d) => d.rsi),
                borderColor: '#6e0be6fa', // Violet color for RSI
                borderWidth: 1.5,
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0.2,
                spanGaps: true,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
                backgroundColor: '#ffffffff',
                titleColor: '#1a17dbac',
                bodyColor: '#1a17dbac',
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: (context: any) => `RSI: ${context.parsed.y?.toFixed(2) || 'N/A'}`,
                },
            },
        },
        scales: {
            x: {
                display: false,
            },
            y: {
                min: 0,
                max: 100,
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)',
                },
                ticks: {
                    stepSize: 25,
                    font: {
                        size: 10,
                    },
                },
                afterDraw: (chart: any) => {
                    // Draw overbought/oversold reference lines after drawing the axes
                    const ctx = chart.ctx;
                    const yAxis = chart.scales.y;
                    const xAxis = chart.scales.x;

                    ctx.save();

                    // Overbought Line (70)
                    const y70 = yAxis.getPixelForValue(70);
                    ctx.beginPath();
                    ctx.moveTo(xAxis.left, y70);
                    ctx.lineTo(xAxis.right, y70);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; // red-500 fading
                    ctx.setLineDash([5, 5]);
                    ctx.stroke();

                    // Oversold Line (30)
                    const y30 = yAxis.getPixelForValue(30);
                    ctx.beginPath();
                    ctx.moveTo(xAxis.left, y30);
                    ctx.lineTo(xAxis.right, y30);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)'; // emerald-500 fading
                    ctx.stroke();

                    ctx.restore();
                }
            },
        },
        interaction: {
            intersect: false,
            mode: 'index' as const,
        },
    };

    return (
        <div className="w-full h-[250px] bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm mt-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-black uppercase tracking-wider">Relative Strength Index (14)</h3>
                <div className="flex gap-3 text-xs font-medium">
                    <span className="text-rose-500">70 (Overbought)</span>
                    <span className="text-emerald-500">30 (Oversold)</span>
                </div>
            </div>
            <div className="[150px]">
                {/* We use any for typecast due to dynamic chartjs ref plugins */}
                <Line data={chartData as any} options={options as any} />
            </div>
        </div>
    );
};
