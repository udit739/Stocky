import React, { useState } from 'react';

// 10 countries with their currency symbols and accent colors
const CURRENCIES = [
  { symbol: '$', country: 'USD', color: '#8ff5ff' },  // USA
  { symbol: '€', country: 'EUR', color: '#ac8aff' },  // Euro
  { symbol: '£', country: 'GBP', color: '#ffd580' },  // UK
  { symbol: '¥', country: 'JPY', color: '#ff8c8c' },  // Japan
  { symbol: '₹', country: 'INR', color: '#80ffb4' },  // India
  { symbol: '₩', country: 'KRW', color: '#ffb347' },  // South Korea
  { symbol: 'Fr', country: 'CHF', color: '#ff6ec7' },  // Switzerland
  { symbol: 'A$', country: 'AUD', color: '#6ecbff' },  // Australia
  { symbol: 'C$', country: 'CAD', color: '#ff9580' },  // Canada
  { symbol: 'R$', country: 'BRL', color: '#afffaf' },  // Brazil
];

interface Particle {
  id: number;
  symbol: string;
  country: string;
  color: string;
  x: number;       // vw %
  startY: number;  // vh % – initial position
  size: number;    // font-size rem
  duration: number;// animation seconds
  delay: number;   // animation delay
  opacity: number;
  rotate: number;  // initial rotation deg
  rotateSpeed: number; // deg/s direction sign
  drift: number;   // horizontal drift px
}

// Grid dimensions – one particle per cell guarantees no overlap
const GRID_COLS = 9;
const GRID_ROWS = 6;
const PARTICLE_COUNT = GRID_COLS * GRID_ROWS; // 54

// Cell size in viewport units
const CELL_W = 100 / GRID_COLS; // ~14.28 vw per column
const CELL_H = 120 / GRID_ROWS; // 30 vh per row (120 % so particles also spawn below the fold)

// Max random jitter inside a cell: ±40 % of cell dimension
const JITTER_X = CELL_W * 0.4;
const JITTER_Y = CELL_H * 0.4;

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function buildParticles(): Particle[] {
  const particles: Particle[] = [];

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const i = row * GRID_COLS + col;
      // Shuffle currencies so adjacent cells get different symbols
      const cur = CURRENCIES[i % CURRENCIES.length];

      // Cell centre + jitter keeps symbols within their cell
      const cellCX = col * CELL_W + CELL_W / 2;
      const cellCY = row * CELL_H + CELL_H / 2 + 10; // +10 vh offset from top

      particles.push({
        id: i,
        symbol: cur.symbol,
        country: cur.country,
        color: cur.color,
        x: Math.max(2, Math.min(97, cellCX + randomBetween(-JITTER_X, JITTER_X))),
        startY: Math.max(5, cellCY + randomBetween(-JITTER_Y, JITTER_Y)),
        size: randomBetween(1.0, 2.2),
        duration: randomBetween(14, 30),
        delay: randomBetween(0, 22),
        opacity: randomBetween(0.07, 0.20),
        rotate: randomBetween(-25, 25),
        rotateSpeed: Math.random() > 0.5 ? 1 : -1,
        // Horizontal drift capped to half a cell width so symbols stay in lane
        drift: randomBetween(-CELL_W * 0.3 * 16, CELL_W * 0.3 * 16),
      });
    }
  }

  return particles;
}


export function CurrencyBackground() {
  const [particles] = useState<Particle[]>(buildParticles);

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      {particles.map((p) => (
        <FloatingSymbol key={p.id} particle={p} />
      ))}
    </div>
  );
}

function FloatingSymbol({ particle: p }: { particle: Particle }) {
  return (
    <span
      style={{
        position: 'absolute',
        left: `${p.x}vw`,
        top: `${p.startY}vh`,
        fontSize: `${p.size}rem`,
        color: p.color,
        opacity: p.opacity,
        fontWeight: 700,
        fontFamily: "'Space Grotesk', sans-serif",
        letterSpacing: '-0.03em',
        userSelect: 'none',
        willChange: 'transform, opacity',
        animation: `
          currencyFloat ${p.duration}s ${p.delay}s linear infinite,
          currencyDrift  ${p.duration * 0.9}s ${p.delay}s ease-in-out infinite alternate,
          currencyRotate ${p.duration * 0.5}s ${p.delay}s linear infinite
        `,
        '--drift': `${p.drift}px`,
        '--rotate-dir': `${360 * p.rotateSpeed}deg`,
      } as React.CSSProperties}
    >
      {p.symbol}
    </span>
  );
}
