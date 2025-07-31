import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client } from '@hashgraph/sdk';
import { handleTransaction } from '@/shared/strategies/tx-mode-strategy';
import { transferERC20Parameters } from '@/shared/parameter-schemas/erc20.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

const transferERC20Prompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will transfer a given amount of an existing ERC20 token on Hedera.

Parameters:
- contractId (str, required): The id of the ERC20 contract
- recipientAddress (str, required): The EVM address to which the tokens will be transfered
- amount (number, required): The amount to be transfered
${usageInstructions}

Example: "Transfer 1 ERC20 token 0.0.6473135 to 0xd94dc7f82f103757f715514e4a37186be6e4580b" means transfering the amount of 1 of the ERC20 token with contract id 0.0.6473135 to the 0xd94dc7f82f103757f715514e4a37186be6e4580b EVM address.
`;
};

const transferERC20 = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof transferERC20Parameters>>,
) => {
  try {
    const normalisedParams = await HederaParameterNormaliser.normaliseTransferERC20Params(
      params,
      context,
    );
    const tx = HederaBuilder.transferERC20(normalisedParams);
    const result = await handleTransaction(tx, client, context);
    return result;
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Failed to transfer ERC20';
  }
};

export const TRANSFER_ERC20_TOOL = 'transfer_erc20_tool';

const tool = (context: Context): Tool => ({
  method: TRANSFER_ERC20_TOOL,
  name: 'Transfer ERC20',
  description: transferERC20Prompt(context),
  parameters: transferERC20Parameters(context),
  execute: transferERC20,
});

export default tool;
