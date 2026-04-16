import type { CellValue } from '../../types/game';

interface CellProps {
  value: CellValue;
  index: number;
  isWinning: boolean;
  isClickable: boolean;
  onClick: (index: number) => void;
}

export default function Cell({ value, index, isWinning, isClickable, onClick }: CellProps) {
  return (
    <button
      onClick={() => isClickable && onClick(index)}
      disabled={!isClickable}
      className={`
        w-full aspect-square flex items-center justify-center
        text-4xl font-bold rounded-xl border-2 transition-all duration-150
        ${isWinning
          ? 'border-yellow-400 bg-yellow-50'
          : 'border-gray-200 bg-white hover:bg-gray-50'
        }
        ${isClickable ? 'cursor-pointer' : 'cursor-default'}
        ${value === 'X' ? 'text-blue-600' : 'text-red-500'}
      `}
    >
      {value}
    </button>
  );
}
