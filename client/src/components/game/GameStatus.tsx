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
      <p className="text-center text-oxo-faint text-sm animate-fade-in">
        Waiting for opponent to join...
      </p>
    );
  }

  if (phase === 'finished') {
    if (winner === 'draw') {
      return (
        <p className="text-center text-oxo-muted font-semibold text-lg animate-fade-up">
          It's a draw!
        </p>
      );
    }
    if (winner === myUserId) {
      return (
        <p className="text-center text-[#22c55e] font-bold text-xl animate-fade-up">
          You win!
        </p>
      );
    }
    return (
      <p className="text-center text-oxo-o font-bold text-xl animate-fade-up">
        You lose!
      </p>
    );
  }

  // phase === 'playing'
  if (isMyTurn) {
    return (
      <p className="text-center text-oxo-x font-semibold animate-fade-in">
        Your turn — place {mySymbol}
      </p>
    );
  }

  return (
    <p className="text-center text-oxo-faint">
      Waiting for opponent's move...
    </p>
  );
}
