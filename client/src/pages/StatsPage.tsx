import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStatsStore } from '../stores/statsStore';
import { useAuthStore } from '../stores/authStore';

export default function StatsPage() {
  const navigate = useNavigate();
  const username = useAuthStore((s) => s.username);
  const { stats, loading, error, fetchStats } = useStatsStore();

  useEffect(() => {
    fetchStats();
  }, []);

  const winRate = stats && stats.totalGames > 0
    ? Math.round((stats.wins / stats.totalGames) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            {username.charAt(0).toUpperCase()}
          </div>
          <span className="font-semibold text-gray-900">{username}</span>
        </div>
        <button
          onClick={() => navigate('/lobby')}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Back to Lobby
        </button>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Your Stats</h1>

        {loading && (
          <p className="text-gray-500">Loading...</p>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {stats && (
          <>
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Wins" value={stats.wins} color="text-green-600" />
              <StatCard label="Losses" value={stats.losses} color="text-red-500" />
              <StatCard label="Draws" value={stats.draws} color="text-gray-500" />
            </div>

            {/* Detail row */}
            <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
              <StatRow label="Total Games" value={stats.totalGames} />
              <StatRow label="Win Rate" value={`${winRate}%`} />
              <StatRow label="Current Win Streak" value={stats.winStreak} />
              <StatRow label="Best Win Streak" value={stats.bestWinStreak} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 text-center">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}
