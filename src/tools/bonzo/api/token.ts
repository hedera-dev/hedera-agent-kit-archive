import { BonzoApiClient } from './client';
import { BonzoTokenResponse } from '../../../types';

/**
 * Get circulation information for the BONZO token
 * @returns BONZO token information
 */
export const get_bonzo_token = async (): Promise<BonzoTokenResponse> => {
  const client = new BonzoApiClient();
  return await client.getBonzoToken();
};

/**
 * Get current circulating supply of BONZO token in decimal notation
 * @returns Circulating supply as a string
 */
export const get_bonzo_circulation = async (): Promise<string> => {
  const client = new BonzoApiClient();
  return await client.getBonzoCirculation();
}; 