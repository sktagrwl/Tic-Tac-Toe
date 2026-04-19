import type { MatchState } from './game';

// These integers MUST match opcodes.go exactly
export const OpCode = {
  MOVE:            1,
  STATE_UPDATE:    2,
  GAME_OVER:       3,
  PLAYER_JOIN:     4,
  PLAYER_LEAVE:    5,
  REMATCH:         6, // accept (client→server) / new code broadcast (server→client)
  REMATCH_REQUEST: 7, // "I want a rematch" — relayed to opponent
  REMATCH_DECLINE: 8, // "No thanks"         — relayed to requester
  ERROR:           99,
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

// Mirrors server PlayerInfo struct (match/state.go)
export interface PlayerJoinPayload {
  userId: string;
  username: string;
  symbol: 'X' | 'O';
  presence: boolean;
}

export interface PlayerLeavePayload {
  userId: string;
}

export interface RematchPayload {
  code: string; // 5-char short code — navigate to /game/:code
}

export interface RematchRequestPayload {
  from: string; // userId of the player who wants a rematch
}

export interface RematchDeclinePayload {
  // empty — presence of this message is the signal
}

export interface ErrorPayload {
  code: number;
  message: string;
}

// Returned by list_rooms RPC
export interface RoomEntry {
  code: string;
  hostName: string;
  hostId: string;
  stats: {
    wins: number;
    losses: number;
    draws: number;
    winStreak: number;
    totalGames: number;
  };
}
