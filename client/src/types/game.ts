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

export type GameResult = 'win' | 'loss' | 'draw';

export interface GameHistoryEntry {
  matchId: string;
  shortCode: string;       // "" for quick match rooms
  opponentId: string;
  opponentName: string;
  result: GameResult;
  mySymbol: 'X' | 'O';
  playedAt: number;        // Unix seconds
}

export interface GameHistoryPage {
  entries: GameHistoryEntry[];
  cursor: string;
  hasMore: boolean;
}
