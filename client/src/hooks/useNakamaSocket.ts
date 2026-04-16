import { useEffect } from 'react';
import type { Socket } from '@heroiclabs/nakama-js';
import { nakamaClient } from '../services/nakamaClient';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { OpCode } from '../types/nakama';
import type { StateUpdatePayload, ErrorPayload } from '../types/nakama';

// Module-level singletons — one socket for the entire app lifetime
let socketInstance: Socket | null = null;
let isConnected = false;
let connectPromise: Promise<void> | null = null;

export function getSocket(): Socket | null {
  return socketInstance;
}

// Waits until the socket is fully connected before returning it
export async function waitForSocket(): Promise<Socket> {
  if (socketInstance && isConnected) return socketInstance;
  if (connectPromise) {
    await connectPromise;
    if (socketInstance) return socketInstance;
  }
  throw new Error('Socket not initialized — call useNakamaSocket first');
}

export function useNakamaSocket() {
  const session = useAuthStore((s) => s.session);
  const userId = useAuthStore((s) => s.userId);
  const applyStateUpdate = useGameStore((s) => s.applyStateUpdate);
  const setError = useGameStore((s) => s.setError);

  useEffect(() => {
    // Already connected or no session — nothing to do
    if (!session?.token || isConnected) return;

    const socket = nakamaClient.createSocket(
      import.meta.env.VITE_NAKAMA_SSL === 'true',
      false
    );

    socketInstance = socket;
    isConnected = true; // prevent duplicate connect attempts

    socket.onmatchdata = (data) => {
      const raw = new TextDecoder().decode(data.data);
      const opCode = data.op_code;

      switch (opCode) {
        case OpCode.STATE_UPDATE:
        case OpCode.GAME_OVER: {
          const state = JSON.parse(raw) as StateUpdatePayload;
          applyStateUpdate(state, userId);
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
      .then(() => { connectPromise = null; })
      .catch((err) => {
        console.error('Socket connection failed:', err);
        isConnected = false;
        socketInstance = null;
        connectPromise = null;
      });

    // No cleanup on unmount — socket is app-level, persists across pages.
  }, [session?.token]);
}
