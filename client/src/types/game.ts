export type CellValue = 'X' | 'O' | '';

export type Board = [
  CellValue, CellValue, CellValue,
  CellValue, CellValue, CellValue,
  CellValue, CellValue, CellValue
];

export type WinLine = [number, number, number] | null;

export type MatchPhase = 'waiting' | 'playing' | 'finished';

export interface MatchPlayer {
  userId: string;
  username: string;
  symbol: 'X' | 'O';
  presence: boolean;
}

export interface MatchState {
  board: Board;
  phase: MatchPhase;
  currentTurn: string;
  players: MatchPlayer[];
  winner: string | null;
  winLine: WinLine;
  moveCount: number;
}

export interface PlayerStats {
  userId: string;
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;
  bestWinStreak: number;
  totalGames: number;
}
