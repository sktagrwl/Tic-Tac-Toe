import type { CellValue } from '../../types/game';

interface CellProps {
  value: CellValue;
  index: number;
  isWinning: boolean;
  isClickable: boolean;
  onClick: (index: number) => void;
}

export default function Cell({ value, index, isWinning, isClickable, onClick }: CellProps) {
  const symbolClass =
    value === 'X' ? 'text-oxo-x text-glow-x' :
    value === 'O' ? 'text-oxo-o text-glow-o' :
    'text-transparent';

  const stateClass =
    isWinning && value === 'X' ? 'cell-glow-x animate-glow-x' :
    isWinning && value === 'O' ? 'cell-glow-o animate-glow-o' :
    isClickable
      ? 'bg-oxo-surface border-oxo-border hover:bg-oxo-surface-2 hover:border-oxo-border-2 cursor-pointer'
      : 'bg-oxo-surface border-oxo-border cursor-default';

  return (
    <button
      onClick={() => isClickable && onClick(index)}
      disabled={!isClickable}
      className={`w-full aspect-square flex items-center justify-center text-4xl font-bold border-2 rounded-lg transition-colors duration-100 ${stateClass} ${symbolClass}`}
    >
      {value}
    </button>
  );
}
