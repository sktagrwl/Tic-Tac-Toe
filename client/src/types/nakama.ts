import type { MatchState } from './game';

// These integers MUST match opcodes.go exactly
export const OpCode = {
  MOVE:         1,
  STATE_UPDATE: 2,
  GAME_OVER:    3,
  PLAYER_JOIN:  4,
  PLAYER_LEAVE: 5,
  ERROR:        99,
} as const;

export type OpCodeValue = typeof OpCode[keyof typeof OpCode];

export interface MovePayload {
  position: number; // 0–8
}

export interface StateUpdatePayload {
  board: MatchState['board'];
  phase: MatchState['phase'];
  currentTurn: MatchState['currentTurn'];
  players: MatchState['players'];
  winner: MatchState['winner'];
  winLine: MatchState['winLine'];
  moveCount: MatchState['moveCount'];
}

export interface ErrorPayload {
  code: number;
  message: string;
}
