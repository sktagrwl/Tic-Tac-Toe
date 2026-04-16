import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useNakamaSocket } from '../hooks/useNakamaSocket';
import { joinMatch, leaveMatch, sendMove } from '../services/matchService';
import Board from '../components/game/Board';
import GameStatus from '../components/game/GameStatus';

export default function GamePage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
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
    setMatchId,
    resetGame,
  } = useGameStore();

  // Connect socket
  useNakamaSocket();

  // Join the match on mount
  useEffect(() => {
    if (!matchId || !session) return;

    setMatchId(matchId);
    joinMatch(matchId).catch((err) => {
      console.error('Failed to join match:', err);
    });

    return () => {
      // Leave match on unmount
      leaveMatch(matchId).catch(() => {});
    };
  }, [matchId]);

  const handleMove = async (position: number) => {
    if (!matchId || !isMyTurn) return;
    try {
      await sendMove(matchId, position);
    } catch (err) {
      console.error('Failed to send move:', err);
    }
  };

  const handleLeave = async () => {
    if (matchId) await leaveMatch(matchId).catch(() => {});
    resetGame();
    navigate('/lobby');
  };

  // Find opponent
  const opponent = players.find((p) => p.userId !== userId);
  const me = players.find((p) => p.userId === userId);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top bar */}
      <nav className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => navigate('/lobby')}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Lobby
        </button>
        <span className="text-xs text-gray-400 font-mono truncate max-w-xs">
          {matchId}
        </span>
        <button
          onClick={handleLeave}
          className="text-sm text-red-500 hover:text-red-700"
        >
          Leave
        </button>
      </nav>

      <div className="max-w-sm mx-auto px-6 py-8 space-y-6">

        {/* Player bar */}
        <div className="flex items-center justify-between bg-white rounded-2xl shadow-sm p-4">
          <div className={`text-center flex-1 ${me ? '' : 'opacity-40'}`}>
            <p className="font-semibold text-gray-900 text-sm truncate">
              {username} {me ? `(${me.symbol})` : ''}
            </p>
            <p className={`text-xs mt-1 ${isMyTurn && phase === 'playing' ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
              {isMyTurn && phase === 'playing' ? '● your turn' : '○ waiting'}
            </p>
          </div>

          <div className="text-gray-300 font-bold text-lg px-4">vs</div>

          <div className={`text-center flex-1 ${opponent ? '' : 'opacity-40'}`}>
            <p className="font-semibold text-gray-900 text-sm truncate">
              {opponent ? `${opponent.username} (${opponent.symbol})` : 'Waiting...'}
            </p>
            <p className={`text-xs mt-1 ${!isMyTurn && phase === 'playing' ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
              {!isMyTurn && phase === 'playing' ? '● their turn' : '○ waiting'}
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm text-center">
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
          <div className="space-y-3 pt-2">
            <button
              onClick={handleLeave}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
            >
              Back to Lobby
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
