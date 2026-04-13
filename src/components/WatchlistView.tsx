import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, Trash2 } from 'lucide-react';
import { WatchlistCard } from './WatchlistCard';

interface WatchlistViewProps {
  watchlist: string[];
  onRemove: (symbol: string) => void;
  onOpen: (symbol: string) => void;
  onClearAll: () => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  watchlist,
  onRemove,
  onOpen,
  onClearAll,
}) => {
  if (watchlist.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-20 flex flex-col items-center gap-6 text-center"
      >
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-[#131313] border border-white/5 flex items-center justify-center shadow-2xl">
            <Star size={40} className="text-zinc-700" />
          </div>
          <div className="absolute inset-0 rounded-full bg-[#ac8aff]/5 blur-xl" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black text-white tracking-wide">Your watchlist is empty</h2>
          <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">
            Search for a stock and click the{' '}
            <span className="text-[#ffd580] font-bold">★ Add to Watchlist</span>{' '}
            button to start tracking it here.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mt-6 space-y-6"
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#ffd580]/10 rounded-xl border border-[#ffd580]/20">
            <Star size={18} className="text-[#ffd580] fill-[#ffd580]/40" />
          </div>
          <div>
            <h2 className="text-base font-black text-white tracking-wide">Watchlist</h2>
            <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest">
              {watchlist.length} {watchlist.length === 1 ? 'stock' : 'stocks'} · live quotes
            </p>
          </div>
        </div>

        {watchlist.length > 0 && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-600 hover:text-rose-400 hover:bg-rose-400/10 border border-transparent hover:border-rose-400/20 transition-all"
          >
            <Trash2 size={13} />
            Clear all
          </button>
        )}
      </div>

      {/* Cards grid */}
      <motion.div
        layout
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <AnimatePresence mode="popLayout">
          {watchlist.map(symbol => (
            <WatchlistCard
              key={symbol}
              symbol={symbol}
              onRemove={onRemove}
              onOpen={onOpen}
            />
          ))}
        </AnimatePresence>
      </motion.div>

      <p className="text-center text-[10px] text-zinc-700 font-bold uppercase tracking-widest">
        Prices refresh automatically every 60 seconds
      </p>
    </motion.div>
  );
};
