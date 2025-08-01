import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client } from '@hashgraph/sdk';
import { handleTransaction } from '@/shared/strategies/tx-mode-strategy';
import { transferERC721Parameters } from '@/shared/parameter-schemas/erc721.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

const transferERC721Prompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will transfer an existing ERC721 token on Hedera.

Parameters:
- contractId (str, required): The id of the ERC721 contract
- fromAddress (str, required): The EVM address from which the token will be transfered
- toAddress (str, required): The EVM address to which the token will be transfered
- tokenId (number, required): The ID of the transfered token
${usageInstructions}

Example: "Transfer ERC721 token 0.0.6486793 with id 0 from 0xd94dc7f82f103757f715514e4a37186be6e4580b to 0xd94dc7f82f103757f715514e4a37186be6e4580b" means transfering the ERC721 token (identified by 0) with contract id 0.0.6486793 from the 0xd94dc7f82f103757f715514e4a37186be6e4580b EVM address to the 0xd94dc7f82f103757f715514e4a37186be6e4580b EVM address.
`;
};

const transferERC721 = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof transferERC721Parameters>>,
) => {
  try {
    const normalisedParams = await HederaParameterNormaliser.normaliseTransferERC721Params(
      params,
      context,
    );
    const tx = HederaBuilder.transferERC721(normalisedParams);
    const result = await handleTransaction(tx, client, context);
    return result;
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Failed to transfer ERC721';
  }
};

export const TRANSFER_ERC721_TOOL = 'transfer_erc721_tool';

const tool = (context: Context): Tool => ({
  method: TRANSFER_ERC721_TOOL,
  name: 'Transfer ERC721',
  description: transferERC721Prompt(context),
  parameters: transferERC721Parameters(context),
  execute: transferERC721,
});

export default tool;
