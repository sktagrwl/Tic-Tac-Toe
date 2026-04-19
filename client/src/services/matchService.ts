import { nakamaClient } from './nakamaClient';
import type { Session } from '@heroiclabs/nakama-js';
import { OpCode } from '../types/nakama';
import type { RoomEntry } from '../types/nakama';
import { getSocket, waitForSocket } from '../hooks/useNakamaSocket.ts';

// Creates a new private room and returns its 5-char short code.
export async function findMatch(session: Session): Promise<string> {
  const response = await nakamaClient.rpc(session, 'find_match', {});
  const payload = response.payload as { code: string };
  return payload.code;
}

// Resolves a 5-char code to the underlying Nakama match ID.
export async function joinByCode(session: Session, code: string): Promise<string> {
  const response = await nakamaClient.rpc(session, 'join_by_code', { code });
  const payload = response.payload as { matchId: string };
  return payload.matchId;
}

// Joins the Quick Match pool — returns the 5-char short code, same as findMatch.
export async function quickMatch(session: Session): Promise<string> {
  const response = await nakamaClient.rpc(session, 'quick_match', {});
  const payload = response.payload as { code: string };
  return payload.code;
}

// Returns open private rooms with host info and stats.
export async function listRooms(session: Session): Promise<RoomEntry[]> {
  const response = await nakamaClient.rpc(session, 'list_rooms', {});
  return (response.payload as RoomEntry[]) ?? [];
}

export async function joinMatch(matchId: string): Promise<void> {
  const socket = await waitForSocket();
  await socket.joinMatch(matchId);
}

export async function leaveMatch(matchId: string): Promise<void> {
  const socket = getSocket();
  if (!socket) return;
  await socket.leaveMatch(matchId);
}

export async function sendMove(matchId: string, position: number): Promise<void> {
  const socket = getSocket();
  if (!socket) throw new Error('Socket not connected');
  const payload = JSON.stringify({ position });
  await socket.sendMatchState(matchId, OpCode.MOVE, payload);
}

// Sends a rematch request to the opponent. They must accept before a new match is created.
export async function sendRematchRequest(matchId: string): Promise<void> {
  const socket = getSocket();
  if (!socket) throw new Error('Socket not connected');
  await socket.sendMatchState(matchId, OpCode.REMATCH_REQUEST, '{}');
}

// Accepts the opponent's pending rematch request. The server creates a new match and
// broadcasts the code to both players via OpCode.REMATCH.
export async function sendRematch(matchId: string): Promise<void> {
  const socket = getSocket();
  if (!socket) throw new Error('Socket not connected');
  await socket.sendMatchState(matchId, OpCode.REMATCH, '{}');
}

// Declines the opponent's pending rematch request.
export async function sendRematchDecline(matchId: string): Promise<void> {
  const socket = getSocket();
  if (!socket) throw new Error('Socket not connected');
  await socket.sendMatchState(matchId, OpCode.REMATCH_DECLINE, '{}');
}
