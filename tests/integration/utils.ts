import { HederaAgentKit } from '../../src/agent';
import { AbstractSigner, ServerSigner } from '../../src';
import { StructuredTool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import dotenv from 'dotenv';
import path from 'path';
import { ChainValues } from '@langchain/core/utils/types';
import {
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenAssociateTransaction,
  TokenMintTransaction,
  TokenId,
  AccountId,
  TransactionReceipt,
  PublicKey as SDKPublicKey,
  ContractCreateFlow, AccountInfoQuery, TokenNftInfoQuery, NftId, AccountBalanceQuery
} from '@hashgraph/sdk';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * Initializes HederaAgentKit with a ServerSigner for testing.
 * Reads Hedera Testnet account ID and private key from environment variables.
 */
export async function initializeTestKit(): Promise<HederaAgentKit> {
  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  const openAIApiKey = process.env.OPENAI_API_KEY;

  if (!accountId || !privateKey) {
    throw new Error(
      'HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set in .env or environment variables.'
    );
  }
  if (!openAIApiKey) {
    throw new Error(
      'OPENAI_API_KEY must be set in .env.test or environment variables for agent execution.'
    );
  }

  const signer = new ServerSigner(accountId, privateKey, 'testnet');

  const kit = new HederaAgentKit(signer, { appConfig: { openAIApiKey } }, 'returnBytes', undefined, true, undefined, DEFAULT_MODEL);
  await kit.initialize();
  return kit;
}

/**
 * Creates a simple test agent executor with just the single tool to avoid token context issues.
 */
export async function createSimpleTestAgentExecutor(
  tool: StructuredTool,
  openAIApiKey: string
): Promise<AgentExecutor> {
  const tools = [tool];
  
  const llm = new ChatOpenAI({
    apiKey: openAIApiKey,
    modelName: DEFAULT_MODEL,
    temperature: 0,
    maxTokens: 500,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      'You are a helpful assistant. Use the provided tool to answer the user question.',
    ],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}'],
  ]);

  const agent = await createOpenAIToolsAgent({ llm, tools, prompt });

  return new AgentExecutor({
    agent,
    tools,
    verbose: false,
    returnIntermediateSteps: true,
  });
}

/**
 * Creates a unique name string, typically for entities like tokens or topics,
 * by appending a timestamp and a short random string to a prefix.
 * @param prefix - The prefix for the name.
 * @returns A unique name string.
 */
export function generateUniqueName(prefix: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${timestamp}-${randomSuffix}`;
}

/**
 * Introduces a delay for a specified number of milliseconds.
 * @param ms - The number of milliseconds to delay.
 * @returns A promise that resolves after the delay.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a minimal LangChain agent executor configured with the provided tool.
 * This allows simulating how a LangChain agent would invoke the tool.
 * @param tool - The StructuredTool to be used by the agent.
 * @param openAIApiKey - The OpenAI API key.
 * @returns An AgentExecutor instance.
 */
export async function createTestAgentExecutor(
  tool: StructuredTool,
  openAIApiKey: string
): Promise<AgentExecutor> {
  const tools = [tool];
  
  const llm = new ChatOpenAI({
    apiKey: openAIApiKey,
    modelName: DEFAULT_MODEL,
    temperature: 0,
    maxTokens: 1000,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      'You are a helpful assistant that can use tools to perform actions on the Hedera network. When a user asks you to do something that requires a tool, call the appropriate tool with the correct parameters. Respond directly to the user otherwise.',
    ],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}'],
  ]);

  const agent = await createOpenAIToolsAgent({ llm, tools, prompt });

  return new AgentExecutor({
    agent,
    tools,
    verbose: process.env.VERBOSE_AGENT_LOGGING === 'true',
    returnIntermediateSteps: true,
  });
}

/**
 * Extracts tool output from agent execution result.
 * Handles both intermediate steps and direct output parsing.
 */
export function getToolOutputFromResult(agentResult: ChainValues): unknown {
  let toolOutputData: unknown;

  if (
    agentResult.intermediateSteps &&
    agentResult.intermediateSteps.length > 0
  ) {
    const lastStep =
      agentResult.intermediateSteps[agentResult.intermediateSteps.length - 1];
    const observation = lastStep.observation;

    if (typeof observation === 'string') {
      try {
        toolOutputData = JSON.parse(observation);
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        throw new Error(
          `Failed to parse observation string from intermediateStep. String was: "${observation}". Error: ${errorMessage}`
        );
      }
    } else if (typeof observation === 'object' && observation !== null) {
      toolOutputData = observation;
    } else {
      console.warn(
        'Observation in last intermediate step was not a string or a recognized object.'
      );
    }
  }

  if (!toolOutputData) {
    if (typeof agentResult.output === 'string') {
      try {
        toolOutputData = JSON.parse(agentResult.output);
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        throw new Error(
          `No intermediate steps, and agentResult.output was not valid JSON. Output: "${agentResult.output}". Error: ${errorMessage}`
        );
      }
    } else {
      throw new Error(
        'No intermediate steps, and agentResult.output is not a string.'
      );
    }
  }

  return toolOutputData;
}

/**
 * Deploys a simple test contract using ContractCreateFlow.
 * @param signer - The ServerSigner instance with operator credentials.
 * @param bytecode - The contract bytecode as a hex string.
 * @param gas - (Optional) Gas limit for contract creation. Default: 1_000_000
 * @returns The deployed contract ID as a string.
 */
export async function deployMockTestContract(
  signer: { getOperatorPrivateKey: () => any; getClient: () => any },
  gas: number = 1_000_000
): Promise<string> {
  const bytecode = '608060405234801561001057600080fd5b50610150806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c80632e64cec11461003b5780636057361d14610059575b600080fd5b610043610075565b60405161005091906100a1565b60405180910390f35b610073600480360381019061006e91906100ed565b61007e565b005b60008054905090565b8060008190555050565b6000819050919050565b61009b81610088565b82525050565b60006020820190506100b66000830184610092565b92915050565b600080fd5b6100ca81610088565b81146100d557600080fd5b50565b6000813590506100e7816100c1565b92915050565b600060208284031215610103576101026100bc565b5b6000610111848285016100d8565b9150509291505056fea2646970667358221220322c78243e61b783558c522e6092c0ac5855bee1d38553261e1a2797c2d6515064736f6c63430008120033';
  const contractCreateTx = await new ContractCreateFlow()
    .setBytecode(bytecode)
    .setGas(gas)
    .setAdminKey(signer.getOperatorPrivateKey().publicKey)
    .execute(signer.getClient());
  const contractCreateRx = await contractCreateTx.getReceipt(signer.getClient());
  return contractCreateRx.contractId?.toString() || '';
}


// === HTS HELPER METHODS ===

// Helper method to create a fungible token
export async function createFungibleToken(
  signer: ServerSigner,
  options: {
    name?: string;
    symbol?: string;
    initialSupply?: number;
    decimals?: number;
    maxSupply?: number;
    treasuryAccountId: AccountId;
    supplyType?: TokenSupplyType;
    adminKey?: SDKPublicKey;
    supplyKey?: SDKPublicKey;
    wipeKey?: SDKPublicKey;
    pauseKey?: SDKPublicKey;
    freezeKey?: SDKPublicKey;
    kycKey?: SDKPublicKey;
  }
): Promise<TokenId> {
  const tokenName = options.name || generateUniqueName('FT');
  const tokenSymbol = options.symbol || generateUniqueName('FT');
  const initialSupply = options.initialSupply || 1000;
  const decimals = options.decimals || 0;
  const supplyType = options.supplyType || TokenSupplyType.Infinite;

  let tx = new TokenCreateTransaction()
    .setTokenName(tokenName)
    .setTokenSymbol(tokenSymbol)
    .setTokenType(TokenType.FungibleCommon)
    .setInitialSupply(initialSupply)
    .setDecimals(decimals)
    .setSupplyType(supplyType)
    .setTreasuryAccountId(options.treasuryAccountId);

  // Set optional keys
  if (options.adminKey) tx = tx.setAdminKey(options.adminKey);
  if (options.supplyKey) tx = tx.setSupplyKey(options.supplyKey);
  if (options.wipeKey) tx = tx.setWipeKey(options.wipeKey);
  if (options.pauseKey) tx = tx.setPauseKey(options.pauseKey);
  if (options.freezeKey) tx = tx.setFreezeKey(options.freezeKey);
  if (options.kycKey) tx = tx.setKycKey(options.kycKey);

  // Set max supply if finite
  if (supplyType === TokenSupplyType.Finite && options.maxSupply) {
    tx = tx.setMaxSupply(options.maxSupply);
  }

  const frozenTx = tx.freezeWith(signer.getClient());
  const receipt = await signer.signAndExecuteTransaction(frozenTx);

  if (!receipt.tokenId) {
    throw new Error('Failed to create fungible token: tokenId is null in receipt');
  }

  return receipt.tokenId;
}

// Helper method to create an NFT collection
export async function createNftCollection(
  signer: ServerSigner,
  options: {
    name?: string;
    symbol?: string;
    maxSupply?: number;
    treasuryAccountId: AccountId;
    supplyType?: TokenSupplyType;
    adminKey?: SDKPublicKey;
    supplyKey?: SDKPublicKey;
    wipeKey?: SDKPublicKey;
    pauseKey?: SDKPublicKey;
    freezeKey?: SDKPublicKey;
    kycKey?: SDKPublicKey;
  }
): Promise<TokenId> {
  const tokenName = options.name || generateUniqueName('NFT');
  const tokenSymbol = options.symbol || generateUniqueName('NFT');
  const maxSupply = options.maxSupply || 100;
  const supplyType = options.supplyType || TokenSupplyType.Finite;

  let tx = new TokenCreateTransaction()
    .setTokenName(tokenName)
    .setTokenSymbol(tokenSymbol)
    .setTokenType(TokenType.NonFungibleUnique)
    .setMaxSupply(maxSupply)
    .setSupplyType(supplyType)
    .setTreasuryAccountId(options.treasuryAccountId);

  // Set optional keys
  if (options.adminKey) tx = tx.setAdminKey(options.adminKey);
  if (options.supplyKey) tx = tx.setSupplyKey(options.supplyKey);
  if (options.wipeKey) tx = tx.setWipeKey(options.wipeKey);
  if (options.pauseKey) tx = tx.setPauseKey(options.pauseKey);
  if (options.freezeKey) tx = tx.setFreezeKey(options.freezeKey);
  if (options.kycKey) tx = tx.setKycKey(options.kycKey);

  const frozenTx = tx.freezeWith(signer.getClient());
  const receipt = await signer.signAndExecuteTransaction(frozenTx);

  if (!receipt.tokenId) {
    throw new Error('Failed to create NFT collection: tokenId is null in receipt');
  }

  return receipt.tokenId;
}

// Helper method to associate tokens with an account
export async function associateTokensWithAccount(
  signer: ServerSigner,
  accountId: AccountId,
  tokenIds: TokenId[]
): Promise<TransactionReceipt> {
  const associateTx = new TokenAssociateTransaction()
    .setAccountId(accountId)
    .setTokenIds(tokenIds)
    .freezeWith(signer.getClient());

  return await signer.signAndExecuteTransaction(associateTx);
}

// Helper method to mint fungible tokens
export async function mintFt(
  signer: ServerSigner,
  tokenId: TokenId,
  amount: number
): Promise<TransactionReceipt> {
  const mintTx = new TokenMintTransaction()
    .setTokenId(tokenId)
    .setAmount(amount)
    .freezeWith(signer.getClient());

  return await signer.signAndExecuteTransaction(mintTx);
}

// Helper method to mint NFTs
export async function mintNft(
  signer: ServerSigner,
  tokenId: TokenId,
  metadata: string | Uint8Array
): Promise<{ receipt: TransactionReceipt; serial: number }> {
  const metadataBytes = typeof metadata === 'string'
    ? new TextEncoder().encode(metadata)
    : metadata;

  const mintTx = new TokenMintTransaction()
    .setTokenId(tokenId)
    .setMetadata([metadataBytes])
    .freezeWith(signer.getClient());

  const receipt = await signer.signAndExecuteTransaction(mintTx);
  const serial = receipt.serials[0].toNumber();

  return { receipt, serial };
}

// helper method for fetching balances with use of AccountInfoQuery
export async function getTokenBalance(accountId: AccountId | string, tokenId: TokenId | string, signer: AbstractSigner): Promise<number> {
  const accountInfo = await new AccountInfoQuery()
    .setAccountId(accountId)
    .execute(signer.getClient());

  const tokenRel = accountInfo.tokenRelationships.get(tokenId.toString());
  if (!tokenRel) throw new Error(`Token relationship not found for token ${tokenId}`);

  return tokenRel.balance.toNumber();
}

export async function getNftOwner(
  tokenId: TokenId | string,
  serial: number,
  signer: AbstractSigner
): Promise<AccountId> {
  if (!(tokenId instanceof TokenId)) {
    tokenId = TokenId.fromString(tokenId);
  }

  const nftInfo = await new TokenNftInfoQuery()
    .setNftId(new NftId(tokenId, serial))
    .execute(signer.getClient());

  return nftInfo[0].accountId;
}

export function getTokenBalanceQuery(accountId: string, tokenId: TokenId, signer: AbstractSigner): Promise<number> {
  return new AccountBalanceQuery()
    .setAccountId(accountId)
    .execute(signer.getClient())
    .then(balance => balance.tokens?._map.get(tokenId.toString())?.toNumber() ?? 0);
}