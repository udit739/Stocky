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
    <form onSubmit={handleSubmit} className="w-full max-w-lg mx-auto mb-8 relative z-20">
      <div className="relative group flex p-1.5 bg-[#1a1919]/80 backdrop-blur-xl rounded-[28px] border border-white/5 shadow-2xl">
        <div className="relative flex-1">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="ENTER Ticker "
            className="w-full px-6 py-4 bg-[#0e0e0e] border border-white/5 rounded-2xl shadow-inner focus:outline-none focus:ring-1 focus:ring-[#8ff5ff] transition-all text-white placeholder:text-zinc-600 font-bold tracking-wider uppercase"
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !symbol.trim()}
          className="ml-2 px-8 bg-gradient-to-br from-[#8ff5ff] to-[#00deec] text-[#005d63] rounded-2xl font-bold tracking-wide hover:shadow-[0_0_20px_rgba(143,245,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 uppercase"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-[#005d63]/30 border-t-[#005d63] rounded-full animate-spin" />
          ) : (
            <Search size={18} strokeWidth={3} />
          )}
          <span>Predict</span>
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-zinc-500 font-medium tracking-wide">
        Try <span className="text-[#8ff5ff] font-bold">NVDA</span>, <span className="text-[#ac8aff] font-bold">TSLA</span>
      </p>
    </form>
  );
};
