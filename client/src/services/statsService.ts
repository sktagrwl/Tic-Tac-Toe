import { nakamaClient } from './nakamaClient';
import type { Session } from '@heroiclabs/nakama-js';
import type { PlayerStats, GameHistoryPage } from '../types/game';

export async function getStats(session: Session): Promise<PlayerStats> {
  const response = await nakamaClient.rpc(session, 'get_stats', {});
  return response.payload as PlayerStats;
}

export async function getGameHistory(
  session: Session,
  cursor = '',
  limit = 10,
): Promise<GameHistoryPage> {
  const response = await nakamaClient.rpc(session, 'get_game_history', { cursor, limit });
  return response.payload as GameHistoryPage;
}