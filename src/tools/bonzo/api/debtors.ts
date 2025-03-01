import { BonzoApiClient } from './client';
import { BonzoDebtorsResponse } from '../../../types';

/**
 * Get a list of all accounts with outstanding debt
 * @returns List of debtor accounts
 */
export const get_bonzo_debtors = async (): Promise<BonzoDebtorsResponse> => {
  const client = new BonzoApiClient();
  return await client.getDebtors();
}; 