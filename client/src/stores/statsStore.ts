import { create } from 'zustand';
import type { PlayerStats } from '../types/game';
import { useAuthStore } from './authStore';
import { getStats } from '../services/statsService';

interface StatsState {
  stats: PlayerStats | null;
  loading: boolean;
  error: string | null;
  fetchStats: () => Promise<void>;
}

export const useStatsStore = create<StatsState>()((set) => ({
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
}));
