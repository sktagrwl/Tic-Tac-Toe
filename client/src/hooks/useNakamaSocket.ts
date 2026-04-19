import { useEffect } from 'react';
import type { Socket } from '@heroiclabs/nakama-js';
import { nakamaClient } from '../services/nakamaClient';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { OpCode } from '../types/nakama';
import type { StateUpdatePayload, ErrorPayload, RematchPayload, RematchRequestPayload, PlayerJoinPayload, PlayerLeavePayload } from '../types/nakama';

// Module-level singletons — one socket for the entire app lifetime
let socketInstance: Socket | null = null;
let isConnected = false;
let connectPromise: Promise<void> | null = null;

export function getSocket(): Socket | null {
  return socketInstance;
}

// Waits until the socket is fully connected before returning it
export async function waitForSocket(): Promise<Socket> {
  if (connectPromise) await connectPromise;
  if (socketInstance && isConnected) return socketInstance;
  throw new Error('Socket not initialized — call useNakamaSocket first');
}

export function useNakamaSocket() {
  const session    = useAuthStore((s) => s.session);
  const applyStateUpdate              = useGameStore((s) => s.applyStateUpdate);
  const addOrUpdatePlayer             = useGameStore((s) => s.addOrUpdatePlayer);
  const setPlayerOffline              = useGameStore((s) => s.setPlayerOffline);
  const setError                      = useGameStore((s) => s.setError);
  const resetGame                     = useGameStore((s) => s.resetGame);
  const setRematchRequestedByOpponent = useGameStore((s) => s.setRematchRequestedByOpponent);
  const setRematchRequestedByMe       = useGameStore((s) => s.setRematchRequestedByMe);
  const setRematchDeclined            = useGameStore((s) => s.setRematchDeclined);
  const setPendingRematchCode         = useGameStore((s) => s.setPendingRematchCode);

  useEffect(() => {
    // Guard: socketInstance is set synchronously on first run, so subsequent
    // calls from other components see it as non-null and bail out immediately.
    if (!session?.token || socketInstance !== null || connectPromise !== null) return;

    const socket = nakamaClient.createSocket(
      import.meta.env.VITE_NAKAMA_SSL === 'true',
      false
    );

    socketInstance = socket; // set immediately — acts as the re-entry guard

    socket.onmatchdata = (data) => {
      const raw = new TextDecoder().decode(data.data);
      const opCode = data.op_code;
      // Read userId fresh on every message instead of capturing a closure value.
      // The server broadcasts REMATCH_REQUEST back to all players (including the
      // sender), so a stale or empty closure userId would cause the sender to
      // incorrectly trigger setRematchRequestedByOpponent(true) for themselves.
      const currentUserId = useAuthStore.getState().userId;

      switch (opCode) {
        case OpCode.STATE_UPDATE:
        case OpCode.GAME_OVER: {
          const state = JSON.parse(raw) as StateUpdatePayload;
          applyStateUpdate(state, currentUserId);
          break;
        }
        case OpCode.PLAYER_JOIN: {
          // Server sends full PlayerInfo for the joining player.
          // applyStateUpdate will overwrite this once the second player joins
          // and triggers a STATE_UPDATE, but handling it here ensures the host
          // sees their own symbol badge immediately in the waiting room.
          const player = JSON.parse(raw) as PlayerJoinPayload;
          addOrUpdatePlayer(player, currentUserId);
          break;
        }
        case OpCode.PLAYER_LEAVE: {
          // Mark the player as offline. The forfeit GAME_OVER broadcast follows
          // immediately for in-progress games, so this is mainly for the UI
          // to show a "disconnected" indicator before the game-over screen lands.
          const payload = JSON.parse(raw) as PlayerLeavePayload;
          setPlayerOffline(payload.userId);
          break;
        }
        case OpCode.REMATCH: {
          // Server confirmed the rematch — reset game state and signal GamePage
          // to re-join using the (remapped) code. GamePage watches pendingRematchCode
          // and handles the actual joinByCode + joinMatch calls, avoiding any
          // React Router location.key timing issues.
          const payload = JSON.parse(raw) as RematchPayload;
          resetGame();
          setPendingRematchCode(payload.code);
          break;
        }
        case OpCode.REMATCH_REQUEST: {
          // Opponent wants a rematch — show accept/decline UI.
          // Server broadcasts to all; ignore if the message came from ourselves.
          const payload = JSON.parse(raw) as RematchRequestPayload;
          if (payload.from !== currentUserId) {
            setRematchRequestedByOpponent(true);
          }
          break;
        }
        case OpCode.REMATCH_DECLINE: {
          // Opponent declined our request.
          setRematchRequestedByMe(false);
          setRematchDeclined(true);
          break;
        }
        case OpCode.ERROR: {
          const err = JSON.parse(raw) as ErrorPayload;
          setError(err.message);
          break;
        }
        default:
          break;
      }
    };

    socket.ondisconnect = () => {
      isConnected = false;
      socketInstance = null;
    };

    connectPromise = socket.connect(session, true)
      .then(() => { isConnected = true; connectPromise = null; })
      .catch((err) => {
        console.error('Socket connection failed:', err);
        isConnected = false;
        socketInstance = null;
        connectPromise = null;
      });

    // No cleanup on unmount — socket is app-level, persists across pages.
  }, [session?.token]);
}
