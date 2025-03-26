import { BonzoApiClient } from './client';
import { BonzoInfoResponse } from '../../../types';

/**
 * Get server and protocol configuration information
 * @returns Protocol information
 */
export const get_bonzo_info = async (): Promise<BonzoInfoResponse> => {
  const client = new BonzoApiClient();
  return await client.getInfo();
}; 