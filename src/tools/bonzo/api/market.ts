import { BonzoApiClient } from './client';
import { BonzoMarketResponse } from '../../../types';

/**
 * Get current global state of all Bonzo liquidity pools
 * @returns Market information for all liquidity pools
 */
export const get_bonzo_market = async (): Promise<BonzoMarketResponse> => {
  const client = new BonzoApiClient();
  return await client.getMarket();
}; 