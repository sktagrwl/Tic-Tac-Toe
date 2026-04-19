import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useNakamaSocket } from '../hooks/useNakamaSocket';
import { joinByCode, joinMatch, leaveMatch, sendMove, sendRematchRequest, sendRematch, sendRematchDecline } from '../services/matchService';
import Board from '../components/game/Board';
import GameStatus from '../components/game/GameStatus';
import Navbar from '../components/Navbar';

export default function GamePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { session, userId, username } = useAuthStore();
  const {
    board,
    phase,
    players,
    winner,
    winLine,
    isMyTurn,
    mySymbol,
    error,
    rematchRequestedByMe,
    rematchRequestedByOpponent,
    rematchDeclined,
    setMatchId,
    resetGame,
    setRematchRequestedByMe,
    setRematchRequestedByOpponent,
    setRematchDeclined,
    pendingRematchCode,
    setPendingRematchCode,
  } = useGameStore();

  useNakamaSocket();

  // The real Nakama match ID resolved from the short code
  const matchIdRef = useRef<string | null>(null);
  const [isJoining, setIsJoining] = useState(true);

  useEffect(() => {
    if (!code || !session) return;

    setIsJoining(true);
    let cancelled = false;

    (async () => {
      try {
        // A 5-char short code (Create Room / Join by Code / Rematch) needs
        // resolution via the join_by_code RPC.  A full Nakama matchId (Quick
        // Match) already IS the matchId — skip the RPC and use it directly.
        const isShortCode = code.length <= 8 && !code.includes('-') && !code.includes('.');
        const matchId = isShortCode ? await joinByCode(session, code) : code;
        if (cancelled) return;

        matchIdRef.current = matchId;
        setMatchId(matchId);
        await joinMatch(matchId);
        if (!cancelled) setIsJoining(false);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to join match:', err);
          useGameStore.getState().setError('Room not found or no longer available.');
          setIsJoining(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (matchIdRef.current) {
        leaveMatch(matchIdRef.current).catch(() => {});
        matchIdRef.current = null;
      }
      resetGame();
    };
  }, [code, location.key]);

  // When the server confirms a rematch, navigate to the same game URL.
  // Changing location.key re-triggers the [code, location.key] effect above,
  // which reuses the exact same joinByCode → joinMatch logic as the initial join.
  // The effect cleanup (leaveMatch) handles leaving the old match automatically.
  useEffect(() => {
    if (!pendingRematchCode) return;
    setPendingRematchCode(null);
    navigate(`/game/${pendingRematchCode}`, { replace: true });
  }, [pendingRematchCode, navigate, setPendingRematchCode]);

  const handleMove = async (position: number) => {
    if (!matchIdRef.current || !isMyTurn) return;
    try {
      await sendMove(matchIdRef.current, position);
    } catch (err) {
      console.error('Failed to send move:', err);
    }
  };

  const handleLeave = async () => {
    const mid = matchIdRef.current;
    matchIdRef.current = null; // null before navigate so cleanup doesn't re-send
    if (mid) await leaveMatch(mid).catch(() => {});
    resetGame();
    navigate('/lobby');
  };

  const handlePlayAgain = async () => {
    if (!matchIdRef.current) return;
    setRematchDeclined(false);
    setRematchRequestedByMe(true);
    try {
      await sendRematchRequest(matchIdRef.current);
    } catch (err) {
      console.error('Failed to request rematch:', err);
      setRematchRequestedByMe(false);
    }
  };

  const handleAcceptRematch = async () => {
    if (!matchIdRef.current) return;
    setRematchRequestedByOpponent(false);
    try {
      await sendRematch(matchIdRef.current);
    } catch (err) {
      console.error('Failed to accept rematch:', err);
    }
  };

  const handleDeclineRematch = async () => {
    if (!matchIdRef.current) return;
    setRematchRequestedByOpponent(false);
    try {
      await sendRematchDecline(matchIdRef.current);
    } catch (err) {
      console.error('Failed to decline rematch:', err);
    }
  };

  const opponent = players.find((p) => p.userId !== userId);
  const me = players.find((p) => p.userId === userId);

  return (
    <div className="min-h-screen bg-oxo-bg animate-fade-in">
      <Navbar showBack backPath="/lobby" backLabel="Lobby" />

      <div className="max-w-sm mx-auto px-6 py-8 space-y-6 flex flex-col items-center">

        {/* Room code strip */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-oxo-faint uppercase tracking-widest">Room</span>
          <span className="font-mono text-sm font-bold text-oxo-x tracking-[0.2em]">{code}</span>
        </div>

        {/* Player bar */}
        <div className="flex items-center justify-between w-full gap-3">
          {/* My side */}
          <div className={`flex-1 flex flex-col items-start gap-1.5 ${me ? '' : 'opacity-30'}`}>
            <div className="flex items-center gap-2">
              {isMyTurn && phase === 'playing' && (
                <span className="w-2 h-2 rounded-full bg-oxo-x dot-pulse flex-shrink-0" />
              )}
              <span className="text-sm font-semibold text-oxo-text truncate max-w-[90px]">
                {username}
              </span>
            </div>
            {me && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                me.symbol === 'X' ? 'bg-oxo-x/10 text-oxo-x' : 'bg-oxo-o/10 text-oxo-o'
              }`}>
                {me.symbol}
              </span>
            )}
          </div>

          {/* VS badge */}
          <div className="flex-shrink-0 text-oxo-faint text-[10px] font-bold tracking-widest border border-oxo-border rounded-full px-3 py-1">
            VS
          </div>

          {/* Opponent side */}
          <div className={`flex-1 flex flex-col items-end gap-1.5 ${opponent ? '' : 'opacity-30'}`}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-oxo-text truncate max-w-[90px]">
                {opponent ? opponent.username : 'Waiting...'}
              </span>
              {!isMyTurn && phase === 'playing' && opponent && (
                <span className="w-2 h-2 rounded-full bg-oxo-x dot-pulse flex-shrink-0" />
              )}
            </div>
            {opponent && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                opponent.symbol === 'X' ? 'bg-oxo-x/10 text-oxo-x' : 'bg-oxo-o/10 text-oxo-o'
              }`}>
                {opponent.symbol}
              </span>
            )}
          </div>
        </div>

        {/* Joining indicator */}
        {isJoining && !error && (
          <div className="w-full p-3 bg-oxo-surface border border-oxo-border rounded-lg text-sm text-center text-oxo-muted animate-pulse">
            Connecting to room…
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="w-full p-3 bg-red-950/60 border border-red-800 text-red-400 rounded-lg text-sm text-center animate-fade-up">
            {error}
          </div>
        )}

        {/* Board */}
        <Board
          board={board}
          winLine={winLine}
          isMyTurn={isMyTurn}
          phase={phase}
          onMove={handleMove}
        />

        {/* Status */}
        <GameStatus
          phase={phase}
          isMyTurn={isMyTurn}
          mySymbol={mySymbol}
          winner={winner}
          myUserId={userId}
        />

        {/* Post-game actions */}
        {phase === 'finished' && (
          <div className="w-full space-y-3">

            {/* Opponent sent a rematch request — show accept / decline */}
            {rematchRequestedByOpponent && !rematchRequestedByMe ? (
              <>
                <p className="text-center text-xs text-oxo-faint tracking-wide animate-fade-up">
                  Opponent wants a rematch!
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleAcceptRematch}
                    className="flex-1 py-3 font-bold rounded-xl text-sm tracking-wide transition-all"
                    style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 50%, #00d4ff 100%)', color: '#fff' }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={handleDeclineRematch}
                    className="flex-1 py-3 font-semibold rounded-xl text-sm border border-oxo-border text-oxo-muted hover:text-white hover:border-oxo-border-2 transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </>
            ) : rematchRequestedByMe ? (
              /* I sent a request — waiting */
              <button
                disabled
                className="w-full py-3 font-bold rounded-xl text-sm tracking-wide opacity-50 cursor-not-allowed"
                style={{ background: 'rgba(124,58,237,0.15)', color: 'rgba(255,255,255,0.5)' }}
              >
                Waiting for opponent...
              </button>
            ) : (
              /* Default — show Play Again */
              <>
                {rematchDeclined && (
                  <p className="text-center text-xs text-oxo-o tracking-wide animate-fade-up">
                    Opponent declined the rematch.
                  </p>
                )}
                <button
                  onClick={handlePlayAgain}
                  className="w-full py-3 font-bold rounded-xl transition-all text-sm tracking-wide text-white"
                  style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 50%, #00d4ff 100%)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 22px rgba(124,58,237,0.45)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
                >
                  Play Again
                </button>
              </>
            )}

            <button
              onClick={handleLeave}
              className="w-full py-2.5 border border-oxo-border text-oxo-muted hover:text-white hover:border-oxo-border-2 font-semibold rounded-xl transition-colors text-sm"
            >
              Back to Lobby
            </button>
          </div>
        )}

        {/* Leave during game */}
        {phase === 'playing' && (
          <button
            onClick={handleLeave}
            className="w-full py-2 text-sm text-oxo-faint hover:text-oxo-o transition-colors"
          >
            Forfeit & Leave
          </button>
        )}

      </div>
    </div>
  );
}
