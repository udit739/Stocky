import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, TrendingUp, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';


interface SymbolMatch {
    symbol: string;
    name: string;
    type: string;
    region: string;
    currency: string;
}

interface SymbolSearchProps {
    onSelectSymbol: (symbol: string) => void;
    isLoading: boolean;
}

async function searchSymbols(query: string): Promise<SymbolMatch[]> {
    const res = await fetch(`/api/symbol-search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Search failed');
    return data.bestMatches || [];
}

export const SymbolSearch: React.FC<SymbolSearchProps> = ({ onSelectSymbol, isLoading }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SymbolMatch[]>([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const doSearch = useCallback(async (q: string) => {
        if (!q.trim()) { setResults([]); setError(null); return; }
        setSearching(true);
        setError(null);
        try {
            const matches = await searchSymbols(q.trim());
            setResults(matches);
        } catch (err: any) {
            console.error('[SymbolSearch] error:', err);
            setError(`Search failed: ${err?.message || 'Unknown error'}`);
            setResults([]);
        } finally {
            setSearching(false);
        }
    }, []);

    useEffect(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => doSearch(query), 500);
        return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
    }, [query, doSearch]);

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 300);
    }, [open]);

    const handleSelect = (symbol: string) => {
        onSelectSymbol(symbol);
        setQuery('');
        setResults([]);
        setOpen(false);
    };

    const handleClose = () => {
        setOpen(false);
        setQuery('');
        setResults([]);
    };

    return (
        <>
            {/* Toggle tab */}
            <button
                onClick={() => setOpen(v => !v)}
                aria-label={open ? 'Close Symbol Finder' : 'Open Symbol Finder'}
                style={{ top: '50%', transform: 'translateY(-50%)' }}
                className="fixed right-0 z-50 flex flex-col items-center gap-1.5 py-5 px-2 bg-gradient-to-b from-purple-600 to-violet-700 text-white rounded-l-2xl shadow-2xl hover:from-purple-500 hover:to-violet-600 transition-all duration-200"
            >
                {open ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                <span
                    className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap"
                    style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
                >
                    Symbol Finder
                </span>
                <TrendingUp size={15} className="opacity-80" />
            </button>

            {/* Backdrop */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={handleClose}
                        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
                    />
                )}
            </AnimatePresence>

            {/* Sliding drawer */}
            <motion.div
                initial={false}
                animate={{ x: open ? 0 : '100%' }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                className="fixed top-0 right-0 h-full z-50 w-80 flex flex-col"
                style={{ willChange: 'transform' }}
            >
                <div className="h-full flex flex-col bg-[#1e1630]/90 backdrop-blur-xl border-l border-white/10 shadow-2xl">

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-purple-500/25 border border-purple-400/30 flex items-center justify-center">
                                <TrendingUp size={14} className="text-purple-300" />
                            </div>
                            <span className="text-sm font-bold text-white tracking-wide">Symbol Finder</span>
                        </div>
                        <button
                            onClick={handleClose}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X size={15} />
                        </button>
                    </div>

                    {/* Search input */}
                    <div className="px-4 py-4 border-b border-white/8">
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                {searching
                                    ? <Loader2 size={15} className="animate-spin text-purple-400" />
                                    : <Search size={15} className="text-white/35" />
                                }
                            </div>
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="e.g. Apple, Reliance, EV India…"
                                disabled={isLoading}
                                className="w-full pl-9 pr-8 py-2.5 bg-white/8 border border-white/15 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all"
                            />
                            {query && (
                                <button
                                    onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70 transition-colors"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                        <p className="mt-1.5 text-[10px] text-white/25 pl-1">
                            Search by company name or ticker symbol
                        </p>
                    </div>

                    {/* Results / hint */}
                    <div className="flex-1 overflow-y-auto">
                        <AnimatePresence mode="wait">
                            {error && (
                                <motion.p key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="px-5 py-4 text-xs text-rose-300">{error}</motion.p>
                            )}

                            {!error && results.length === 0 && !searching && !query && (
                                <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="px-5 py-8 flex flex-col items-center text-center gap-4"
                                >
                                    <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-400/20 flex items-center justify-center">
                                        <Search size={20} className="text-purple-400" />
                                    </div>
                                    <p className="text-[12px] text-white/35 leading-relaxed">
                                        Type a company name or ticker to find and analyze any stock.
                                    </p>

                                    {/* US quick-picks */}
                                    <div className="w-full text-left px-1">
                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-1.5">🇺🇸 US</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {['AAPL', 'TSLA', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META'].map(s => (
                                                <button key={s} onClick={() => handleSelect(s)} disabled={isLoading}
                                                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white/8 border border-white/12 text-white/60 hover:bg-purple-500/20 hover:text-purple-300 hover:border-purple-400/30 transition-all disabled:opacity-40">
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* India quick-picks */}
                                    <div className="w-full text-left px-1">
                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-1.5">🇮🇳 India (BSE)</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {[
                                                { label: 'RELIANCE', sym: 'RELIANCE.BSE' },
                                                { label: 'TCS', sym: 'TCS.BSE' },
                                                { label: 'INFY', sym: 'INFY.BSE' },
                                                { label: 'HDFC Bank', sym: 'HDFCBANK.BSE' },
                                                { label: 'WIPRO', sym: 'WIPRO.BSE' },
                                                { label: 'ICICI Bank', sym: 'ICICIBANK.BSE' },
                                                { label: 'Tata Motors', sym: 'TATAMOTORS.BSE' },
                                                { label: 'SBI', sym: 'SBIN.BSE' },
                                            ].map(({ label, sym }) => (
                                                <button key={sym} onClick={() => handleSelect(sym)} disabled={isLoading}
                                                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-orange-500/10 border border-orange-400/20 text-orange-200/70 hover:bg-orange-500/25 hover:text-orange-200 hover:border-orange-400/40 transition-all disabled:opacity-40">
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {!error && results.length === 0 && !searching && query && (
                                <motion.p key="no-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="px-5 py-6 text-center text-[12px] text-white/35">
                                    No results found for <span className="text-white/60 font-semibold">"{query}"</span>
                                </motion.p>
                            )}

                            {!error && results.length > 0 && (
                                <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                                        {results.length} result{results.length !== 1 ? 's' : ''}
                                    </p>
                                    {results.map((m, i) => (
                                        <button
                                            key={`${m.symbol}-${i}`}
                                            onClick={() => handleSelect(m.symbol)}
                                            disabled={isLoading}
                                            className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/8 active:bg-white/12 transition-colors border-b border-white/6 last:border-b-0 group disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <div className="mt-0.5 shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500/25 to-violet-600/20 border border-purple-400/25 flex items-center justify-center">
                                                <TrendingUp size={13} className="text-purple-300" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <span className="text-[13px] font-bold text-white group-hover:text-purple-200 transition-colors">
                                                        {m.symbol}
                                                    </span>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/8 border border-white/10 text-white/45 shrink-0">
                                                        {m.type || 'Equity'}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-white/55 truncate leading-tight">{m.name}</p>
                                                <p className="text-[10px] text-white/30 mt-0.5">{m.region} · {m.currency}</p>
                                            </div>
                                            <ChevronRight size={13} className="shrink-0 mt-2 text-white/20 group-hover:text-purple-400 transition-colors" />
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-3 border-t border-white/8">
                        <p className="text-[10px] text-white/25 text-center">Click a result to run full AI analysis</p>
                    </div>
                </div>
            </motion.div>
        </>
    );
};
