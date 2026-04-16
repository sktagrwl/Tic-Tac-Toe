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

  // Actions
  setMatchId: (id: string) => void;
  applyStateUpdate: (state: MatchState, myUserId: string) => void;
  setError: (msg: string | null) => void;
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
      winner: state.winner,
      winLine: state.winLine,
      moveCount: state.moveCount,
      mySymbol,
      isMyTurn,
      error: null,
    });
  },

  setError: (msg) => set({ error: msg }),

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
    }),
}));

