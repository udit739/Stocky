import React, { useEffect, useRef, useState } from 'react';

// 10 countries with their currency symbols and accent colors
const CURRENCIES = [
  { symbol: '$',  country: 'USD', color: '#8ff5ff' },  // USA
  { symbol: '€',  country: 'EUR', color: '#ac8aff' },  // Euro
  { symbol: '£',  country: 'GBP', color: '#ffd580' },  // UK
  { symbol: '¥',  country: 'JPY', color: '#ff8c8c' },  // Japan
  { symbol: '₹',  country: 'INR', color: '#80ffb4' },  // India
  { symbol: '₩',  country: 'KRW', color: '#ffb347' },  // South Korea
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

const PARTICLE_COUNT = 28;

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function buildParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const cur = CURRENCIES[i % CURRENCIES.length];
    return {
      id: i,
      symbol: cur.symbol,
      country: cur.country,
      color: cur.color,
      x: randomBetween(0, 100),
      startY: randomBetween(10, 110),   // spread across entire page height + below
      size: randomBetween(1.1, 2.6),
      duration: randomBetween(12, 28),
      delay: randomBetween(0, 20),
      opacity: randomBetween(0.06, 0.22),
      rotate: randomBetween(-30, 30),
      rotateSpeed: Math.random() > 0.5 ? 1 : -1,
      drift: randomBetween(-60, 60),
    };
  });
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
        fontWeight: 900,
        fontFamily: "'Space Grotesk', sans-serif",
        letterSpacing: '-0.03em',
        userSelect: 'none',
        willChange: 'transform, opacity',
        animation: `
          currencyFloat ${p.duration}s ${p.delay}s linear infinite,
          currencyDrift  ${p.duration * 0.7}s ${p.delay}s ease-in-out infinite alternate,
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
