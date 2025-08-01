import { Context } from '@/shared/configuration';
import { z } from 'zod';

export const transferERC20Parameters = (_context: Context = {}) =>
  z.object({
    contractId: z.string().describe('The id of the ERC20 contract.'),
    recipientAddress: z.string().describe('Address to which the tokens will be transferred.'),
    amount: z.number().describe('The amount of tokens to transfer.'),
  });
  
export const transferERC20ParametersNormalised = () =>
  transferERC20Parameters().extend({
    gas: z.number().describe('The maximum amount of gas to use for the contract call'),
  });