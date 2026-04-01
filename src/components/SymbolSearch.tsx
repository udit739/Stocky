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
                className="fixed right-0 z-50 flex flex-col items-center gap-1.5 py-5 px-2 bg-[#131313]/90 backdrop-blur-xl border border-r-0 border-white/10 text-white rounded-l-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:bg-[#1a1919] hover:border-[#8ff5ff]/50 transition-all duration-200 group"
            >
                {open ? <ChevronRight size={16} className="text-zinc-400 group-hover:text-[#8ff5ff]" /> : <Search size={16} className="text-[#8ff5ff]" />}
                <span
                    className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap text-zinc-400 group-hover:text-white transition-colors"
                    style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
                >
                    Ticker Search
                </span>
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
                <div className="h-full flex flex-col bg-[#0e0e0e]/95 backdrop-blur-2xl border-l border-white/5 shadow-2xl">

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#8ff5ff]/20 to-[#00deec]/5 border border-[#8ff5ff]/20 flex items-center justify-center">
                                <Search size={14} className="text-[#8ff5ff]" />
                            </div>
                            <span className="text-xs font-black text-white uppercase tracking-widest">Ticker Search</span>
                        </div>
                        <button
                            onClick={handleClose}
                            className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Search input */}
                    <div className="px-5 py-5 border-b border-white/5">
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                {searching
                                    ? <Loader2 size={16} className="animate-spin text-[#8ff5ff]" />
                                    : <Search size={16} className="text-zinc-500" />
                                }
                            </div>
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="e.g. NVDA, AAPL, Tesla..."
                                disabled={isLoading}
                                className="w-full pl-11 pr-10 py-3.5 bg-[#1a1919] border border-white/5 rounded-2xl text-sm font-bold tracking-wide text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#8ff5ff] transition-all uppercase"
                            />
                            {query && (
                                <button
                                    onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <p className="mt-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-2">
                            Global Market Search
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
                                    className="px-5 py-10 flex flex-col items-center text-center gap-6"
                                >
                                    <div className="w-16 h-16 rounded-[20px] bg-[#1a1919] border border-white/5 shadow-inner flex items-center justify-center">
                                        <Search size={24} className="text-zinc-600" />
                                    </div>
                                    <p className="text-xs text-zinc-500 font-medium leading-relaxed max-w-[200px]">
                                        Enter a <span className="text-white">ticker</span> or <span className="text-white">company</span> to launch neural analysis.
                                    </p>

                                    {/* US quick-picks */}
                                    <div className="w-full text-left mt-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3">Popular US</p>
                                        <div className="flex flex-wrap gap-2">
                                            {['AAPL', 'TSLA', 'MSFT', 'NVDA', 'GOOGL', 'AMZN'].map(s => (
                                                <button key={s} onClick={() => handleSelect(s)} disabled={isLoading}
                                                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white/5 border border-white/5 text-zinc-400 hover:bg-[#8ff5ff]/10 hover:text-[#8ff5ff] hover:border-[#8ff5ff]/20 hover:shadow-[0_0_15px_rgba(143,245,255,0.15)] transition-all disabled:opacity-40">
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* India quick-picks */}
                                    <div className="w-full text-left mt-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3">Popular India</p>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { label: 'Reliance', sym: 'RELIANCE.BSE' },
                                                { label: 'TCS', sym: 'TCS.BSE' },
                                                { label: 'HDFC', sym: 'HDFCBANK.BSE' },
                                                { label: 'Tata Motors', sym: 'TATAMOTORS.BSE' },
                                            ].map(({ label, sym }) => (
                                                <button key={sym} onClick={() => handleSelect(sym)} disabled={isLoading}
                                                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white/5 border border-white/5 text-zinc-400 hover:bg-[#ac8aff]/10 hover:text-[#ac8aff] hover:border-[#ac8aff]/20 hover:shadow-[0_0_15px_rgba(172,138,255,0.15)] transition-all disabled:opacity-40">
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
                                <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-2 space-y-1">
                                    <p className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-widest text-zinc-600">
                                        Matches
                                    </p>
                                    {results.map((m, i) => (
                                        <button
                                            key={`${m.symbol}-${i}`}
                                            onClick={() => handleSelect(m.symbol)}
                                            disabled={isLoading}
                                            className="w-full text-left px-3 py-3 flex items-center gap-4 rounded-2xl hover:bg-white/5 transition-all group disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <div className="shrink-0 w-10 h-10 rounded-xl bg-[#1a1919] border border-white/5 flex items-center justify-center group-hover:border-[#8ff5ff]/20 group-hover:bg-[#8ff5ff]/10 transition-colors">
                                                <TrendingUp size={16} className="text-zinc-500 group-hover:text-[#8ff5ff]" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-sm font-black text-white group-hover:text-[#8ff5ff] transition-colors tracking-wide">
                                                        {m.symbol}
                                                    </span>
                                                    <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm bg-white/5 text-zinc-400 shrink-0">
                                                        {m.type || 'Equity'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-zinc-400 truncate leading-tight font-medium">{m.name}</p>
                                            </div>
                                            <div className="shrink-0 text-right pr-1">
                                                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest leading-tight">{m.region}</p>
                                                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest leading-tight">{m.currency}</p>
                                            </div>
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-4 border-t border-white/5 bg-black/20">
                        <p className="text-[10px] font-black text-zinc-600 tracking-widest uppercase text-center">Terminal Initialized</p>
                    </div>
                </div>
            </motion.div>
        </>
    );
};
