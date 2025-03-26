import { BonzoApiClient } from './client';
import { BonzoDashboardResponse } from '../../../types';

/**
 * Get detailed information about an account's lending and borrowing positions
 * @param accountId Hedera account ID in format shard.realm.num
 * @returns Dashboard information for the specified account
 */
export const get_bonzo_dashboard = async (
  accountId: string
): Promise<BonzoDashboardResponse> => {
  const client = new BonzoApiClient();
  return await client.getDashboard(accountId);
}; 