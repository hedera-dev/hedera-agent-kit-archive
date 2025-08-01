import { Context } from '@/shared/configuration';
import { z } from 'zod';

export const transferERC721Parameters = (_context: Context = {}) =>
  z.object({
    contractId: z.string().describe('The id of the ERC721 contract.'),
    fromAddress: z.string().describe('Address from which the token will be transferred.'),
    toAddress: z.string().describe('Address to which the token will be transferred.'),
    tokenId: z.number().describe('The ID of the token to transfer.'),
  });
  
export const transferERC721ParametersNormalised = () =>
  transferERC721Parameters().extend({
    gas: z.number().describe('The maximum amount of gas to use for the contract call'),
  });
