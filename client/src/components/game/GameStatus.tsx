import type { MatchPhase } from '../../types/game';

interface GameStatusProps {
  phase: MatchPhase;
  isMyTurn: boolean;
  mySymbol: 'X' | 'O' | null;
  winner: string | null;
  myUserId: string;
}

export default function GameStatus({
  phase,
  isMyTurn,
  mySymbol,
  winner,
  myUserId,
}: GameStatusProps) {
  if (phase === 'waiting') {
    return (
      <p className="text-center text-gray-500 text-sm mt-4">
        Waiting for opponent to join...
      </p>
    );
  }

  if (phase === 'finished') {
    if (winner === 'draw') {
      return (
        <p className="text-center text-gray-700 font-semibold mt-4">
          It's a draw!
        </p>
      );
    }
    if (winner === myUserId) {
      return (
        <p className="text-center text-green-600 font-bold text-lg mt-4">
          You win!
        </p>
      );
    }
    return (
      <p className="text-center text-red-500 font-bold text-lg mt-4">
        You lose!
      </p>
    );
  }

  // phase === 'playing'
  if (isMyTurn) {
    return (
      <p className="text-center text-blue-600 font-semibold mt-4">
        Your turn — place {mySymbol}
      </p>
    );
  }

  return (
    <p className="text-center text-gray-500 mt-4">
      Waiting for opponent's move...
    </p>
  );
}
