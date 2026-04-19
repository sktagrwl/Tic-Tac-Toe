import { create } from 'zustand';
import type { Board, MatchPhase, MatchPlayer, MatchState, WinLine } from '../types/game';

const emptyBoard = (): Board => ['', '', '', '', '', '', '', '', ''];

interface GameState {
  // Match data
  matchId: string | null;
  board: Board;
  phase: MatchPhase;
  currentTurn: string;
  players: MatchPlayer[];
  winner: string | null;
  winLine: WinLine;
  moveCount: number;
  error: string | null;

  // Derived — computed from players + authStore userId
  mySymbol: 'X' | 'O' | null;
  isMyTurn: boolean;

  // Rematch handshake state
  rematchRequestedByMe: boolean;       // I sent a rematch request
  rematchRequestedByOpponent: boolean; // Opponent sent a rematch request
  rematchDeclined: boolean;            // Opponent declined my request
  pendingRematchCode: string | null;   // Set when server confirms rematch → triggers re-join in GamePage

  // Actions
  setMatchId: (id: string) => void;
  applyStateUpdate: (state: MatchState, myUserId: string) => void;
  addOrUpdatePlayer: (player: MatchPlayer, myUserId: string) => void;
  setPlayerOffline: (userId: string) => void;
  setError: (msg: string | null) => void;
  setRematchRequestedByMe: (v: boolean) => void;
  setRematchRequestedByOpponent: (v: boolean) => void;
  setRematchDeclined: (v: boolean) => void;
  setPendingRematchCode: (code: string | null) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>()((set) => ({
  // Initial state
  matchId: null,
  board: emptyBoard(),
  phase: 'waiting',
  currentTurn: '',
  players: [],
  winner: null,
  winLine: null,
  moveCount: 0,
  error: null,
  mySymbol: null,
  isMyTurn: false,
  rematchRequestedByMe: false,
  rematchRequestedByOpponent: false,
  rematchDeclined: false,
  pendingRematchCode: null,

  // Actions
  setMatchId: (id) => set({ matchId: id }),

  applyStateUpdate: (state, myUserId) => {
    const me = state.players.find((p) => p.userId === myUserId);
    const mySymbol = me?.symbol ?? null;
    const isMyTurn = state.currentTurn === myUserId;

    set({
      board: state.board,
      phase: state.phase,
      currentTurn: state.currentTurn,
      players: state.players,
      winner: state.winner === '' ? null : state.winner,
      winLine: state.winLine && state.winLine[0] === -1 ? null : state.winLine,
      moveCount: state.moveCount,
      mySymbol,
      isMyTurn,
      error: null,
    });
  },

  // Called on PLAYER_JOIN — adds the player if not present, updates if already there.
  // Recalculates mySymbol/isMyTurn in case this is the local player joining their own room.
  addOrUpdatePlayer: (player, myUserId) =>
    set((s) => {
      const existing = s.players.findIndex((p) => p.userId === player.userId);
      const updated = existing >= 0
        ? s.players.map((p, i) => (i === existing ? player : p))
        : [...s.players, player];
      const me = updated.find((p) => p.userId === myUserId);
      return { players: updated, mySymbol: me?.symbol ?? s.mySymbol };
    }),

  // Called on PLAYER_LEAVE — marks the player as offline without removing them.
  setPlayerOffline: (userId) =>
    set((s) => ({
      players: s.players.map((p) =>
        p.userId === userId ? { ...p, presence: false } : p
      ),
    })),

  setError: (msg) => set({ error: msg }),

  setRematchRequestedByMe:       (v) => set({ rematchRequestedByMe: v }),
  setRematchRequestedByOpponent: (v) => set({ rematchRequestedByOpponent: v }),
  setRematchDeclined:            (v) => set({ rematchDeclined: v }),
  setPendingRematchCode:         (code) => set({ pendingRematchCode: code }),

  resetGame: () =>
    set({
      matchId: null,
      board: emptyBoard(),
      phase: 'waiting',
      currentTurn: '',
      players: [],
      winner: null,
      winLine: null,
      moveCount: 0,
      error: null,
      mySymbol: null,
      isMyTurn: false,
      rematchRequestedByMe: false,
      rematchRequestedByOpponent: false,
      rematchDeclined: false,
      pendingRematchCode: null,
    }),
}));

