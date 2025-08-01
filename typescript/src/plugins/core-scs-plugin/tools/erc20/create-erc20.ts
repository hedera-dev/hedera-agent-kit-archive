import { z } from 'zod';
import { AgentMode, type Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, TransactionRecordQuery } from '@hashgraph/sdk';
import { ExecuteStrategyResult, handleTransaction } from '@/shared/strategies/tx-mode-strategy';
import { createERC20Parameters } from '@/shared/parameter-schemas/erc20.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';

const createERC20Prompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool creates an ERC20 token on Hedera by calling the BaseERC20Factory contract.

Parameters:
- tokenName (str, required): The name of the token
- tokenSymbol (str, required): The symbol of the token
- decimals (int, optional): The number of decimals the token supports. Defaults to 18
- initialSupply (int, optional): The initial supply of the token. Defaults to 0
- factoryContractAddress (str, required): The address of the BaseERC20Factory contract
${usageInstructions}
`;
};

const getERC20Address = async (client: Client, executeStrategyResult: ExecuteStrategyResult) => {
  const record = await new TransactionRecordQuery()
    .setTransactionId(executeStrategyResult.transactionId)
    .execute(client);
  return record.contractFunctionResult?.getAddress(0);
};

const createERC20 = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof createERC20Parameters>>,
) => {
  try {
    //TODO: make this address configurable
    const factoryContractAddress = '0.0.6471814';
    // ABI for the deployToken function
    const abi = [
      'function deployToken(string memory name_, string memory symbol_, uint8 decimals_, uint256 initialSupply_) external returns (address)',
    ];
    const normalisedParams = HederaParameterNormaliser.normaliseCreateERC20Params(
      params,
      factoryContractAddress,
      abi,
      'deployToken',
    );
    const tx = HederaBuilder.executeTransaction(normalisedParams);
    const result = await handleTransaction(tx, client, context);
    if (context.mode == AgentMode.AUTONOMOUS) {
      const erc20Address = await getERC20Address(client, result as ExecuteStrategyResult);
      return {
        ...result,
        erc20Address: erc20Address?.toString(),
        message: `ERC20 token created successfully at address ${erc20Address?.toString()}`,
      };
    }
    return result;
  } catch (error) {
    console.error('[CreateERC20] Error creating ERC20 token:', error);
    if (error instanceof Error) {
      return error.message;
    }
    return 'Failed to create ERC20 token';
  }
};

export const CREATE_ERC20_TOOL = 'create_erc20_tool';

const tool = (context: Context): Tool => ({
  method: CREATE_ERC20_TOOL,
  name: 'Create ERC20 Token',
  description: createERC20Prompt(context),
  parameters: createERC20Parameters(context),
  execute: createERC20,
});

export default tool;
