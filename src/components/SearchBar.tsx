import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  onSearch: (symbol: string) => void;
  isLoading: boolean;
  value?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, isLoading, value: externalValue }) => {
  const [symbol, setSymbol] = useState(externalValue ?? '');

  // Sync when a symbol is selected externally (e.g. from SymbolSearch drawer)
  useEffect(() => {
    if (externalValue !== undefined) setSymbol(externalValue);
  }, [externalValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (symbol.trim()) {
      onSearch(symbol.trim().toUpperCase());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto mb-8">
      <div className="relative group">
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="Enter stock symbol (e.g AAPL, MSFT)"
          className="w-full px-5 py-3 bg-white border border-zinc-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black transition-all text-zinc-800 placeholder:text-zinc-400"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !symbol.trim()}
          className="absolute right-2 top-2 bottom-2 px-6 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 disabled:opacity-100 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Search size={18} />
          )}
          <span>Predict</span>
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-white font-semibold">
        Try symbols like <span className="text-white">AAPL</span>, <span className="text-white">TSLA</span>
      </p>
    </form>
  );
};
