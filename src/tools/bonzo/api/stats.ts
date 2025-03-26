import { BonzoApiClient } from './client';
import { BonzoStatsResponse } from '../../../types';

/**
 * Get 24-hour usage statistics for the protocol
 * @returns Protocol statistics
 */
export const get_bonzo_stats = async (): Promise<BonzoStatsResponse> => {
  const client = new BonzoApiClient();
  return await client.getStats();
}; 