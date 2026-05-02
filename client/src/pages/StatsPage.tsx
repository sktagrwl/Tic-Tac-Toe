import { useEffect } from 'react';
import { useNakamaSocket } from '../hooks/useNakamaSocket';
import { useStatsStore } from '../stores/statsStore';
import Navbar from '../components/Navbar';
import type { PlayerStats, GameHistoryEntry } from '../types/game';

// ─── Left panel: aggregate stats ─────────────────────────────────────────────

function StatsPanel({ stats, loading, error }: {
  stats: PlayerStats | null;
  loading: boolean;
  error: string | null;
}) {
  const winRate = stats && stats.totalGames > 0
    ? Math.round((stats.wins / stats.totalGames) * 100)
    : 0;

  return (
    <div className="w-full md:w-[40%] md:max-w-[480px] flex flex-col justify-center px-6 md:px-10 py-8 md:py-0 select-none flex-shrink-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Your Stats</h1>
        <p className="text-[11px] text-oxo-faint mt-0.5 tracking-wide uppercase">All time performance</p>
      </div>

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-14 rounded-xl bg-oxo-surface animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-950/60 border border-red-800 text-red-400 rounded-xl text-xs">
          {error}
        </div>
      )}

      {stats && (
        <div className="space-y-5">
          {/* 2×2 stat grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard value={stats.wins}       label="Wins"   color="text-[#22c55e]" accent="rgba(34,197,94,0.08)" />
            <StatCard value={stats.losses}     label="Losses" color="text-oxo-o"     accent="rgba(255,0,110,0.08)" />
            <StatCard value={stats.draws}      label="Draws"  color="text-oxo-muted" accent="rgba(255,255,255,0.04)" />
            <StatCard value={stats.totalGames} label="Total"  color="text-oxo-text"  accent="rgba(255,255,255,0.04)" />
          </div>

          {/* Win rate bar */}
          <div className="card-arena p-4">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-oxo-accent/40 to-transparent" />
            <div className="flex items-baseline gap-2 mb-2.5">
              <span className="text-4xl font-bold text-white tabular-nums">{winRate}</span>
              <span className="text-lg font-bold text-oxo-faint">%</span>
              <span className="text-oxo-faint text-xs ml-1">win rate</span>
            </div>
            <div className="h-1 bg-oxo-surface-3 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${winRate}%`,
                  background: 'linear-gradient(90deg, #7c3aed, #00d4ff)',
                }}
              />
            </div>
          </div>

          {/* Streaks */}
          <div className="card-arena divide-y divide-oxo-border overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-oxo-x/30 to-transparent" />
            <StatRow label="Current Streak" value={stats.winStreak}     color="text-oxo-x" />
            <StatRow label="Best Streak"    value={stats.bestWinStreak} color="text-oxo-accent-2" />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ value, label, color, accent }: {
  value: number; label: string; color: string; accent: string;
}) {
  return (
    <div
      className="relative rounded-xl p-4 border border-oxo-border flex flex-col gap-1 overflow-hidden"
      style={{ background: accent }}
    >
      <p className={`text-3xl md:text-4xl font-bold tabular-nums leading-none ${color}`}>{value}</p>
      <p className="text-[10px] text-oxo-faint uppercase tracking-[0.2em] mt-1">{label}</p>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex justify-between items-center px-4 py-3">
      <span className="text-xs text-oxo-muted tracking-wide">{label}</span>
      <span className={`font-bold text-sm tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

// ─── Right panel: game history ────────────────────────────────────────────────

function HistoryPanel() {
  const {
    history,
    historyLoading,
    historyError,
    historyHasMore,
    historyPage,
    historyNextPage,
    historyPrevPage,
  } = useStatsStore();

  return (
    <div className="flex-1 flex flex-col px-6 md:px-8 py-8 md:py-6 min-h-0 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className="text-sm font-bold text-white tracking-wide">Game History</h2>
        <span className="text-[10px] text-oxo-faint border border-oxo-border rounded-full px-2.5 py-0.5 tracking-widest">
          Page {historyPage}
        </span>
      </div>

      {/* Error */}
      {historyError && (
        <div className="mb-3 px-3 py-2 bg-red-950/60 border border-red-800/70 text-red-400 rounded-xl text-xs flex-shrink-0">
          {historyError}
        </div>
      )}

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-1 pr-1">
        {historyLoading ? (
          <HistorySkeleton />
        ) : history.length === 0 ? (
          <HistoryEmpty />
        ) : (
          history.map((entry, i) => <HistoryRow key={`${entry.matchId}-${i}`} entry={entry} />)
        )}
      </div>

      {/* Pagination footer */}
      <div className="flex items-center justify-between pt-4 border-t border-oxo-border flex-shrink-0 mt-2">
        <button
          onClick={historyPrevPage}
          disabled={historyPage <= 1 || historyLoading}
          className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-oxo-border text-oxo-muted
                     hover:text-white hover:border-oxo-border-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ← Prev
        </button>

        <span className="text-[11px] text-oxo-faint tracking-wide">Page {historyPage}</span>

        <button
          onClick={historyNextPage}
          disabled={!historyHasMore || historyLoading}
          className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-oxo-border text-oxo-muted
                     hover:text-white hover:border-oxo-border-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function HistoryRow({ entry }: { entry: GameHistoryEntry }) {
  const resultStyles: Record<string, { badge: string; label: string }> = {
    win:  { badge: 'bg-[rgba(34,197,94,0.15)] text-[#22c55e] border-[rgba(34,197,94,0.25)]',  label: 'W' },
    loss: { badge: 'bg-[rgba(255,0,110,0.12)] text-oxo-o    border-[rgba(255,0,110,0.2)]',    label: 'L' },
    draw: { badge: 'bg-oxo-surface text-oxo-muted border-oxo-border',                          label: 'D' },
  };
  const rs = resultStyles[entry.result] ?? resultStyles.draw;
  const date = new Date(entry.playedAt * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors group">
      {/* Result badge */}
      <span className={`w-6 h-6 flex items-center justify-center text-[11px] font-bold rounded-md border flex-shrink-0 ${rs.badge}`}>
        {rs.label}
      </span>

      {/* vs + opponent */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span className="text-[10px] text-oxo-faint">vs</span>
        <span className="text-sm font-semibold text-oxo-text truncate">{entry.opponentName}</span>
      </div>

      {/* Symbol played */}
      <span className={`text-xs font-bold flex-shrink-0 ${entry.mySymbol === 'X' ? 'text-oxo-x' : 'text-oxo-o'}`}>
        {entry.mySymbol}
      </span>

      {/* Room code */}
      <span className="font-mono text-[10px] text-oxo-faint tracking-widest flex-shrink-0 w-12 text-center">
        {entry.shortCode || '—'}
      </span>

      {/* Date */}
      <span className="text-[11px] text-oxo-faint tabular-nums flex-shrink-0">{date}</span>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="h-10 rounded-xl bg-oxo-surface animate-pulse" />
      ))}
    </div>
  );
}

function HistoryEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
      <div className="w-10 h-10 rounded-full border border-oxo-border flex items-center justify-center">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-oxo-faint">
          <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </div>
      <p className="text-sm text-oxo-faint">No games played yet</p>
      <p className="text-[11px] text-oxo-faint/60">Play a game to see your history here</p>
    </div>
  );
}

// ─── Page root ────────────────────────────────────────────────────────────────

export default function StatsPage() {
  useNakamaSocket();

  const { stats, loading, error, fetchStats, fetchHistory } = useStatsStore();

  useEffect(() => {
    fetchStats();
    fetchHistory('');
  }, [fetchStats, fetchHistory]);

  return (
    <div className="h-[100dvh] overflow-hidden bg-black flex flex-col relative">
      {/* Background layers */}
      <div className="absolute inset-0 bg-arena pointer-events-none" />
      <div className="absolute inset-0 bg-scan-grid pointer-events-none opacity-60" />

      <Navbar borderless backPath="/lobby" backLabel="Lobby" />

      <div className="flex-1 flex flex-col md:flex-row min-h-0 relative z-10">
        {/* Left — stats */}
        <StatsPanel stats={stats} loading={loading} error={error} />

        {/* Vertical divider — desktop only */}
        <div
          className="hidden md:block w-px self-stretch my-8 flex-shrink-0"
          style={{ background: 'linear-gradient(to bottom, transparent, rgba(42,42,42,0.8) 30%, rgba(42,42,42,0.8) 70%, transparent)' }}
        />

        {/* Horizontal divider — mobile only */}
        <div className="md:hidden h-px mx-6 bg-oxo-border flex-shrink-0" />

        {/* Right — history */}
        <HistoryPanel />
      </div>
    </div>
  );
}
