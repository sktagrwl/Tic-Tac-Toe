import { nakamaClient } from './nakamaClient';
import type { Session } from '@heroiclabs/nakama-js';
import { OpCode } from '../types/nakama';
import { getSocket, waitForSocket } from '../hooks/useNakamaSocket.ts';

export async function findMatch(session: Session): Promise<string> {
  const response = await nakamaClient.rpc(session, 'find_match', {});
  const payload = response.payload as { matchId: string };
  return payload.matchId;
}

export async function joinMatch(matchId: string): Promise<void> {
  const socket = await waitForSocket();
  await socket.joinMatch(matchId);
}

export async function leaveMatch(matchId: string): Promise<void> {
  const socket = getSocket();
  if (!socket) return; // already disconnected, nothing to do
  await socket.leaveMatch(matchId);
}

export async function sendMove(matchId: string, position: number): Promise<void> {
  const socket = getSocket();
  if (!socket) throw new Error('Socket not connected');
  const payload = JSON.stringify({ position });
  await socket.sendMatchState(matchId, OpCode.MOVE, payload);
}
