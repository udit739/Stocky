import { useState, useEffect } from 'react';

export interface StockAlert {
  id: string; // usually `${symbol}-${direction}-${targetPrice}`
  symbol: string;
  targetPrice: number;
  direction: 'above' | 'below';
  active: boolean;
}

const ALERTS_KEY = 'stocky_price_alerts_v1';

export function useAlerts() {
  const [alerts, setAlerts] = useState<StockAlert[]>(() => {
    try {
      const saved = localStorage.getItem(ALERTS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
  }, [alerts]);

  const addAlert = (symbol: string, targetPrice: number, direction: 'above' | 'below') => {
    const newAlert: StockAlert = {
      id: `${symbol}-${direction}-${targetPrice}-${Date.now()}`,
      symbol: symbol.toUpperCase(),
      targetPrice,
      direction,
      active: true,
    };
    setAlerts((prev) => [...prev, newAlert]);
  };

  const setAlertActive = (id: string, active: boolean) => {
    setAlerts((prev) => prev.map(a => a.id === id ? { ...a, active } : a));
  };

  const removeAlert = (id: string) => {
    setAlerts((prev) => prev.filter(a => a.id !== id));
  };

  return { alerts, addAlert, setAlertActive, removeAlert };
}
