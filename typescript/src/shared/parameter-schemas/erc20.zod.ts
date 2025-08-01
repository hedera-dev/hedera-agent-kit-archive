import { Context } from '@/shared/configuration';
import { z } from 'zod';

export const createERC20Parameters = (_context: Context = {}) =>
  z.object({
    tokenName: z.string().describe('The name of the token.'),
    tokenSymbol: z.string().describe('The symbol of the token.'),
    decimals: z
      .number()
      .int()
      .min(0)
      .max(18)
      .default(18)
      .describe('The number of decimals the token supports.'),
    initialSupply: z.number().int().min(0).default(0).describe('The initial supply of the token.'),
  });
