import { Context } from '@/shared/configuration';
import { z } from 'zod';

export const contractExecuteTransactionParametersNormalised = (_context: Context = {}) =>
  z.object({
    contractId: z.string().describe('The ID of the contract to execute.'),
    functionParameters: z
      .instanceof(Uint8Array)
      .describe('The parameters of the function to execute.'),
    gas: z.number().int().describe('The gas limit for the contract call.'),
  });
