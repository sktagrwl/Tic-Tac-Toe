import { nakamaClient } from './nakamaClient';
import type { Session } from '@heroiclabs/nakama-js';
import type { PlayerStats } from '../types/game';

export async function getStats(session: Session): Promise<PlayerStats> {
  const response = await nakamaClient.rpc(session, 'get_stats', {});
  return response.payload as PlayerStats;
}