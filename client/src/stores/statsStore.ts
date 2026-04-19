import { create } from 'zustand';
import type { PlayerStats, GameHistoryEntry } from '../types/game';
import { useAuthStore } from './authStore';
import { getStats, getGameHistory } from '../services/statsService';

interface StatsState {
  // Aggregate stats
  stats: PlayerStats | null;
  loading: boolean;
  error: string | null;
  fetchStats: () => Promise<void>;

  // Game history pagination
  history: GameHistoryEntry[];
  historyLoading: boolean;
  historyError: string | null;
  historyHasMore: boolean;
  historyPage: number;   // 1-based current page number
  _cursors: string[];    // _cursors[i] = cursor to fetch page (i+1); _cursors[0] always ""

  fetchHistory: (cursor?: string) => Promise<void>;
  historyNextPage: () => void;
  historyPrevPage: () => void;
}

export const useStatsStore = create<StatsState>()((set, get) => ({
  // ── Aggregate stats ──────────────────────────────────────────────────────
  stats: null,
  loading: false,
  error: null,

  fetchStats: async () => {
    const session = useAuthStore.getState().session;
    if (!session) return;

    set({ loading: true, error: null });
    try {
      const stats = await getStats(session);
      set({ stats, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load stats',
        loading: false,
      });
    }
  },

  // ── Game history ─────────────────────────────────────────────────────────
  history: [],
  historyLoading: false,
  historyError: null,
  historyHasMore: false,
  historyPage: 1,
  _cursors: [''],   // index 0 = first page cursor ("")

  fetchHistory: async (cursor = '') => {
    const session = useAuthStore.getState().session;
    if (!session) return;

    set({ historyLoading: true, historyError: null });
    try {
      const page = await getGameHistory(session, cursor, 10);
      const { historyPage, _cursors } = get();

      // Store the next-page cursor so historyNextPage can use it later
      if (page.hasMore && page.cursor) {
        const updated = [..._cursors];
        updated[historyPage] = page.cursor;
        set({ _cursors: updated });
      }

      set({
        history: page.entries,
        historyHasMore: page.hasMore,
        historyLoading: false,
      });
    } catch (err) {
      set({
        historyError: err instanceof Error ? err.message : 'Failed to load history',
        historyLoading: false,
      });
    }
  },

  historyNextPage: () => {
    const { historyPage, _cursors, historyHasMore, historyLoading } = get();
    if (!historyHasMore || historyLoading) return;
    const nextCursor = _cursors[historyPage] ?? '';
    set({ historyPage: historyPage + 1 });
    get().fetchHistory(nextCursor);
  },

  historyPrevPage: () => {
    const { historyPage, _cursors, historyLoading } = get();
    if (historyPage <= 1 || historyLoading) return;
    const prevPage = historyPage - 1;
    const prevCursor = _cursors[prevPage - 1] ?? '';
    set({ historyPage: prevPage });
    get().fetchHistory(prevCursor);
  },
}));
