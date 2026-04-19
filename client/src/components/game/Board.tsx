import type { Board, WinLine } from '../../types/game';
import Cell from './Cell';

interface BoardProps {
  board: Board;
  winLine: WinLine;
  isMyTurn: boolean;
  phase: string;
  onMove: (index: number) => void;
}

export default function Board({ board, winLine, isMyTurn, phase, onMove }: BoardProps) {
  const winningCells = winLine ? new Set(winLine) : new Set<number>();

  return (
    <div className="grid grid-cols-3 gap-2 w-full max-w-oxo-board mx-auto">
      {board.map((value, index) => (
        <Cell
          key={index}
          index={index}
          value={value}
          isWinning={winningCells.has(index)}
          isClickable={isMyTurn && phase === 'playing' && value === ''}
          onClick={onMove}
        />
      ))}
    </div>
  );
}
