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
                borderColor: '#ac8aff', // Violet color for RSI
                backgroundColor: 'rgba(172, 138, 255, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0.2,
                spanGaps: true,
                fill: true,
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
                backgroundColor: '#0e0e0e',
                titleColor: '#ac8aff',
                bodyColor: '#ffffff',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 12,
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
                    color: 'rgba(255, 255, 255, 0.05)',
                },
                ticks: {
                    stepSize: 25,
                    font: {
                        size: 10,
                    },
                    color: '#a1a1aa'
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
                    ctx.strokeStyle = 'rgba(255, 113, 108, 0.6)'; // Neon red fading
                    ctx.setLineDash([4, 4]);
                    ctx.stroke();

                    // Oversold Line (30)
                    const y30 = yAxis.getPixelForValue(30);
                    ctx.beginPath();
                    ctx.moveTo(xAxis.left, y30);
                    ctx.lineTo(xAxis.right, y30);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = 'rgba(143, 245, 255, 0.6)'; // Neon cyan fading
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
        <div className="w-full h-[250px] bg-[#131313]/90 backdrop-blur-xl p-6 rounded-[28px] border border-white/5 shadow-2xl mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h3 className="text-xs font-black text-white uppercase tracking-widest">RSI (14)</h3>
                <div className="flex gap-4 text-[10px] uppercase font-black tracking-widest">
                    <span className="text-[#ff716c]">70 (Overbought)</span>
                    <span className="text-[#8ff5ff]">30 (Oversold)</span>
                </div>
            </div>
            <div className="[150px]">
                {/* We use any for typecast due to dynamic chartjs ref plugins */}
                <Line data={chartData as any} options={options as any} />
            </div>
        </div>
    );
};
