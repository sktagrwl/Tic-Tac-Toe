import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useStatsStore } from '../stores/statsStore';
import { useNakamaSocket } from '../hooks/useNakamaSocket';
import { findMatch, quickMatch, listRooms } from '../services/matchService';
import Navbar from '../components/Navbar';
import type { PlayerStats } from '../types/game';
import type { RoomEntry } from '../types/nakama';

// ─── Decorative board — X wins on the diagonal ───────────────────────────────
const DEMO_CELLS = ['X', 'O', '', 'O', 'X', '', '', '', 'X'] as const;
const DEMO_WIN   = new Set([0, 4, 8]);

function DemoBoard() {
  return (
    <div className="grid grid-cols-3 gap-2 w-[180px]">
      {DEMO_CELLS.map((cell, i) => (
        <div
          key={i}
          className={[
            'aspect-square flex items-center justify-center text-2xl font-bold rounded-xl border transition-all duration-500',
            cell === 'X' && DEMO_WIN.has(i)
              ? 'text-oxo-x text-glow-x border-oxo-x/40 bg-[rgba(0,212,255,0.06)] cell-glow-x'
              : cell === 'X'
              ? 'text-oxo-x text-glow-x border-oxo-border bg-oxo-surface'
              : cell === 'O'
              ? 'text-oxo-o text-glow-o border-oxo-border bg-oxo-surface'
              : 'border-oxo-border bg-oxo-surface',
          ].join(' ')}
        >
          {cell}
        </div>
      ))}
    </div>
  );
}

// ─── Stat chip ────────────────────────────────────────────────────────────────
function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-2">
      <span className="text-[9px] uppercase tracking-[0.2em] text-oxo-faint mb-0.5">{label}</span>
      <span className={`font-bold text-sm leading-none ${color}`}>{value}</span>
    </div>
  );
}

function StatsBar({ stats }: { stats: PlayerStats }) {
  return (
    <div className="flex items-center divide-x divide-oxo-border border border-oxo-border rounded-xl bg-black/40 overflow-hidden">
      <StatChip label="Wins"   value={stats.wins}      color="text-[#22c55e]" />
      <StatChip label="Losses" value={stats.losses}    color="text-oxo-o"     />
      <StatChip label="Draws"  value={stats.draws}     color="text-oxo-muted" />
      <StatChip label="Streak" value={stats.winStreak} color="text-oxo-x"     />
    </div>
  );
}

// ─── Stat hover chip (used in Browse Rooms hover reveal) ─────────────────────
function StatHover({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`font-bold text-xs ${color}`}>{value}</span>
      <span className="text-[9px] text-oxo-faint uppercase tracking-wider">{label}</span>
    </div>
  );
}

// ─── Scanning dots (loading indicator) ───────────────────────────────────────
function ScanDots() {
  return (
    <span className="inline-flex items-center gap-1 mr-2">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-white animate-scan-pulse"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LobbyPage() {
  const navigate          = useNavigate();
  const { session, isAuthenticated } = useAuthStore();
  const setMatchId        = useGameStore((s) => s.setMatchId);
  const { stats, fetchStats } = useStatsStore();

  useNakamaSocket();

  const [isCreating,      setIsCreating]      = useState(false);
  const [isQuickMatching, setIsQuickMatching] = useState(false);
  const [roomCode,        setRoomCode]        = useState('');
  const [joinCode,        setJoinCode]        = useState('');
  const [error,           setError]           = useState<string | null>(null);
  const [copied,          setCopied]          = useState(false);

  // Browse Rooms panel
  const [browseMode,      setBrowseMode]      = useState(false);
  const [rooms,           setRooms]           = useState<RoomEntry[]>([]);
  const [isLoadingRooms,  setIsLoadingRooms]  = useState(false);
  const [hoveredCode,     setHoveredCode]     = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) fetchStats();
  }, [isAuthenticated, fetchStats]);

  const requireAuth = () => navigate('/login');

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCreateRoom = async () => {
    if (!isAuthenticated) { requireAuth(); return; }
    if (!session) return;
    setIsCreating(true);
    setError(null);
    try {
      const code = await findMatch(session);
      setRoomCode(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const handleQuickMatch = async () => {
    if (!isAuthenticated) { requireAuth(); return; }
    if (!session) return;
    setIsQuickMatching(true);
    setError(null);
    try {
      const code = await quickMatch(session);
      navigate(`/game/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quick match failed');
    } finally {
      setIsQuickMatching(false);
    }
  };

  const handleBrowseRooms = async () => {
    if (!isAuthenticated) { requireAuth(); return; }
    if (!session) return;
    setBrowseMode(true);
    setIsLoadingRooms(true);
    setError(null);
    try {
      const list = await listRooms(session);
      setRooms(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rooms');
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) { requireAuth(); return; }
    if (!joinCode.trim()) return;
    setMatchId(joinCode.trim());
    navigate(`/game/${joinCode.trim()}`);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-[100dvh] overflow-hidden bg-black flex flex-col relative">

      {/* ── Background layers ──────────────────────────────────────────── */}
      <div className="absolute inset-0 bg-arena pointer-events-none" />
      <div className="absolute inset-0 bg-scan-grid pointer-events-none opacity-60" />

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <Navbar borderless />

      {/* ── Main content ───────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 relative z-10">

        {/* ════ LEFT PANEL — desktop only ════════════════════════════════ */}
        <div className="hidden md:flex flex-1 flex-col justify-center items-center gap-7 px-12 select-none">

          {/* Wordmark */}
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-[90px] font-bold leading-none tracking-tight">
              <span className="text-oxo-o animate-glow-text-o">O</span>
              <span className="text-oxo-x animate-glow-text-x" style={{ animationDelay: '0.6s' }}>X</span>
              <span className="text-oxo-o animate-glow-text-o" style={{ animationDelay: '1.2s' }}>O</span>
            </h1>
            <p className="text-[10px] tracking-[0.35em] uppercase text-oxo-faint">
              Real-time multiplayer arena
            </p>
          </div>

          {/* Thin separator line with glow */}
          <div className="w-48 h-px bg-gradient-to-r from-transparent via-oxo-accent/40 to-transparent" />

          {/* Stats — only when logged in */}
          {isAuthenticated && stats && <StatsBar stats={stats} />}

          {/* Demo board */}
          <DemoBoard />

          {/* X vs O caption */}
          <div className="flex items-center gap-3 text-xs text-oxo-faint">
            <span className="text-oxo-x font-bold tracking-widest">X</span>
            <span className="text-oxo-faint/40">——</span>
            <span className="tracking-wider">vs</span>
            <span className="text-oxo-faint/40">——</span>
            <span className="text-oxo-o font-bold tracking-widest">O</span>
          </div>
        </div>

        {/* ── Vertical divider (desktop) ─────────────────────────────── */}
        <div
          className="hidden md:block w-px self-stretch my-8 flex-shrink-0"
          style={{ background: 'linear-gradient(to bottom, transparent, rgba(42,42,42,0.8) 30%, rgba(42,42,42,0.8) 70%, transparent)' }}
        />

        {/* ════ RIGHT PANEL — action cards ═══════════════════════════════ */}
        <div className="flex-1 md:flex-none md:w-[390px] flex flex-col justify-center gap-3 px-5 md:px-10 py-5 md:py-0 overflow-hidden">

          {/* Mobile: compact header */}
          <div className="md:hidden flex items-center justify-between mb-1">
            <span className="text-4xl font-bold leading-none">
              <span className="text-oxo-o">O</span>
              <span className="text-oxo-x">X</span>
              <span className="text-oxo-o">O</span>
            </span>
            {isAuthenticated && stats && (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-[#22c55e] font-bold">{stats.wins}W</span>
                <span className="text-oxo-o font-bold">{stats.losses}L</span>
                <span className="text-oxo-muted font-bold">{stats.draws}D</span>
                <span className="text-oxo-x font-bold">{stats.winStreak} str</span>
              </div>
            )}
          </div>

          {/* Error banner */}
          {error && (
            <div className="px-4 py-2.5 bg-red-950/60 border border-red-800/70 text-red-400 rounded-xl text-xs animate-fade-up">
              {error}
            </div>
          )}

          {/* ── Guest CTA ──────────────────────────────────────────────── */}
          {!isAuthenticated && (
            <div className="card-arena p-5 text-center space-y-3">
              <p className="text-oxo-faint text-xs tracking-wide">Sign in to start playing</p>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-2.5 bg-gradient-to-r from-oxo-accent to-[#00d4ff] text-white font-bold rounded-xl tracking-wide transition-all hover:shadow-[0_0_20px_rgba(124,58,237,0.45)] text-sm"
              >
                Sign In
              </button>
            </div>
          )}

          {browseMode ? (
            /* ══ BROWSE ROOMS VIEW ════════════════════════════════════════ */
            <div className="card-arena flex flex-col" style={{ maxHeight: 'calc(100dvh - 200px)' }}>
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-oxo-accent/50 to-transparent" />

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/[0.06] flex-shrink-0">
                <button
                  onClick={() => { setBrowseMode(false); setHoveredCode(null); }}
                  className="text-[11px] text-oxo-faint hover:text-white transition-colors flex items-center gap-1"
                >
                  ← Back
                </button>
                <span className="text-xs font-bold text-white tracking-wide">Open Rooms</span>
                <button
                  onClick={handleBrowseRooms}
                  disabled={isLoadingRooms}
                  className="text-[11px] text-oxo-accent-2 hover:text-white transition-colors disabled:opacity-40"
                >
                  {isLoadingRooms ? '...' : 'Refresh'}
                </button>
              </div>

              {/* Room list */}
              <div className="overflow-y-auto flex-1 px-3 py-2">
                {isLoadingRooms ? (
                  <div className="flex items-center justify-center py-8">
                    <ScanDots />
                    <span className="text-[11px] text-oxo-faint ml-2">Loading rooms...</span>
                  </div>
                ) : rooms.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <div className="w-10 h-10 rounded-full border border-oxo-border flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 14 14" fill="none" className="text-oxo-faint">
                        <circle cx="7" cy="7" r="2" fill="currentColor" />
                        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                        <circle cx="7" cy="7" r="6.5" stroke="currentColor" strokeWidth="0.8" opacity="0.25" />
                      </svg>
                    </div>
                    <p className="text-[11px] text-oxo-faint text-center">No open rooms right now</p>
                    <p className="text-[10px] text-oxo-faint/60 text-center">Create a room to be the first!</p>
                  </div>
                ) : (
                  <div className="space-y-1 py-1">
                    {rooms.map((room) => (
                      <div
                        key={room.code}
                        className="rounded-xl overflow-hidden transition-all duration-200"
                        onMouseEnter={() => setHoveredCode(room.code)}
                        onMouseLeave={() => setHoveredCode(null)}
                      >
                        {/* Main row */}
                        <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] rounded-xl transition-colors">
                          {/* Avatar */}
                          <div className="w-7 h-7 rounded-full bg-oxo-accent/20 border border-oxo-accent/30 flex items-center justify-center flex-shrink-0">
                            <span className="text-[11px] font-bold text-oxo-accent-2">
                              {room.hostName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          {/* Name + code */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{room.hostName}</p>
                            <p className="text-[9px] font-mono text-oxo-faint tracking-widest">{room.code}</p>
                          </div>
                          {/* Join button */}
                          <button
                            onClick={() => navigate(`/game/${room.code}`)}
                            className="flex-shrink-0 px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-all"
                            style={{
                              background: 'rgba(124,58,237,0.12)',
                              borderColor: 'rgba(124,58,237,0.35)',
                              color: '#a78bfa',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.25)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.12)'; }}
                          >
                            Join
                          </button>
                        </div>

                        {/* Stats hover reveal */}
                        {hoveredCode === room.code && (
                          <div className="flex items-center gap-4 px-4 py-2 bg-white/[0.03] border-t border-white/[0.04] animate-fade-up">
                            <StatHover label="W" value={room.stats.wins}      color="text-[#22c55e]" />
                            <StatHover label="L" value={room.stats.losses}    color="text-oxo-o"     />
                            <StatHover label="D" value={room.stats.draws}     color="text-oxo-muted" />
                            <StatHover label="Streak" value={room.stats.winStreak} color="text-oxo-x" />
                            <span className="ml-auto text-[9px] text-oxo-faint">{room.stats.totalGames} games</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ══ NORMAL ACTION CARDS ══════════════════════════════════════ */
            <>
              {/* ── Quick Match ─────────────────────────────────────────── */}
              <div className="card-arena p-5" style={{ borderColor: 'rgba(124,58,237,0.25)' }}>
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-oxo-accent/70 to-transparent" />

                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-wide">Quick Match</h2>
                    <p className="text-[11px] text-oxo-faint mt-0.5">
                      {isQuickMatching
                        ? 'Scanning for open matches...'
                        : 'Get matched instantly with any available opponent'}
                    </p>
                  </div>
                  <div className={`w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 ml-3 ${
                    isQuickMatching
                      ? 'border-oxo-accent/60 bg-oxo-accent/10 animate-scan-pulse'
                      : 'border-oxo-border bg-oxo-surface'
                  }`}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={isQuickMatching ? 'text-oxo-accent' : 'text-oxo-faint'}>
                      <circle cx="7" cy="7" r="2" fill="currentColor" />
                      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                      <circle cx="7" cy="7" r="6.5" stroke="currentColor" strokeWidth="0.8" opacity="0.25" />
                    </svg>
                  </div>
                </div>

                <button
                  onClick={handleQuickMatch}
                  disabled={isQuickMatching || !isAuthenticated}
                  className="w-full py-2.5 rounded-xl font-bold text-sm tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                  style={{
                    background: isQuickMatching ? 'rgba(124,58,237,0.2)' : 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 50%, #00d4ff 100%)',
                  }}
                  onMouseEnter={e => { if (!isQuickMatching) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 22px rgba(124,58,237,0.45)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
                >
                  {isQuickMatching ? <><ScanDots /><span className="text-oxo-muted">Searching...</span></> : 'Find Match'}
                </button>
              </div>

              {/* ── Create Room ─────────────────────────────────────────── */}
              <div className="card-arena p-5">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#00d4ff]/30 to-transparent" />
                <h2 className="text-sm font-bold text-white tracking-wide mb-0.5">Create Room</h2>

                {!roomCode ? (
                  <div className="space-y-3 mt-3">
                    <p className="text-[10px] text-oxo-faint leading-relaxed">
                      Invite-only — share the room code with your friend to let them in.
                    </p>
                    <button
                      onClick={handleCreateRoom}
                      disabled={isCreating || !isAuthenticated}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold tracking-wide border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: '#ffffff' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
                    >
                      {isCreating ? 'Creating...' : 'Create Room'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5 mt-3">
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-black/60 border border-oxo-border-2 rounded-xl">
                      <span className="flex-1 font-mono text-sm font-bold text-oxo-x tracking-[0.2em]">{roomCode}</span>
                      <button
                        onClick={handleCopyCode}
                        className={`text-[11px] font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${copied ? 'text-[#22c55e]' : 'text-oxo-accent-2 hover:text-white'}`}
                      >
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-[10px] text-oxo-faint text-center">Share this code, then enter the room</p>
                    <button
                      onClick={() => navigate(`/game/${roomCode}`)}
                      className="w-full py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all"
                      style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(34,197,94,0.2)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(34,197,94,0.12)'; }}
                    >
                      Enter Room
                    </button>
                    <button onClick={() => setRoomCode('')} className="w-full py-1.5 text-[11px] text-oxo-faint hover:text-oxo-muted transition-colors">
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* ── Join by Code ────────────────────────────────────────── */}
              <div className="card-arena p-5">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#ff006e]/25 to-transparent" />
                <h2 className="text-sm font-bold text-white tracking-wide mb-3">Join by Code</h2>
                <form onSubmit={handleJoinRoom} className="flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g. K7P2X"
                    maxLength={5}
                    className="input-oxo font-mono flex-1 text-sm font-bold tracking-[0.2em] uppercase py-2"
                  />
                  <button
                    type="submit"
                    disabled={!joinCode.trim() || !isAuthenticated}
                    className="px-5 py-2 text-sm font-semibold rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                    style={{ background: 'rgba(255,0,110,0.1)', borderColor: 'rgba(255,0,110,0.3)', color: '#ff006e' }}
                    onMouseEnter={e => { if (joinCode.trim()) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,0,110,0.2)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,0,110,0.1)'; }}
                  >
                    Join
                  </button>
                </form>
              </div>

              {/* ── Browse Rooms link ────────────────────────────────────── */}
              <button
                onClick={handleBrowseRooms}
                disabled={!isAuthenticated}
                className="w-full py-3 text-sm font-semibold rounded-xl border border-oxo-border text-oxo-muted hover:text-white hover:border-oxo-border-2 disabled:opacity-30 transition-colors tracking-wide"
              >
                Browse open rooms →
              </button>
            </>
          )}

        </div>
        {/* ══ end right panel ══════════════════════════════════════════════ */}
      </div>
      {/* ── end main ─────────────────────────────────────────────────────── */}
    </div>
  );
}
