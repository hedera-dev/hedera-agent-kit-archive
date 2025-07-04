import { HederaAgentKit } from '../../src/agent';
import { ServerSigner } from '../../src/signer/server-signer';
import { StructuredTool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import dotenv from 'dotenv';
import path from 'path';
import { ChainValues } from '@langchain/core/utils/types';
import { AccountCreateTransaction, AccountId, Client, ContractCreateFlow, Hbar, PrivateKey, PublicKey, Transaction, TransactionReceipt } from '@hashgraph/sdk';

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

/**
 * Creates a new Hedera account with the given initial balance, signed and paid by the provided payer.
 * @param client - The Hedera Client instance (connected to network and payer account).
 * @param payerSigner - ServerSigner with operator credentials for paying transaction fees.
 * @param initialBalanceHbar - Initial account balance in HBAR.
 * @returns An object with the new accountId, privateKey, and publicKey.
 * @throws Error if the account creation fails.
 */
export async function createNewHederaAccount(
  client: Client,
  payerSigner: ServerSigner,
  initialBalanceHbar: number,
  options?: { maxAutomaticTokenAssociations?: number }
): Promise<{
  accountId: AccountId;
  privateKey: PrivateKey;
  publicKey: PublicKey;
}> {
  const newPrivateKey = PrivateKey.generateED25519();
  const newPublicKey = newPrivateKey.publicKey;
  const transaction = new AccountCreateTransaction()
    .setKeyWithoutAlias(newPublicKey)
    .setInitialBalance(new Hbar(initialBalanceHbar))
    .setNodeAccountIds([new AccountId(3)]);

  if (options?.maxAutomaticTokenAssociations !== undefined) {
    transaction.setMaxAutomaticTokenAssociations(options.maxAutomaticTokenAssociations);
  }

  transaction.freezeWith(client);
  const signedTx = await transaction.sign(payerSigner.getOperatorPrivateKey());
  const txResponse = await signedTx.execute(client);
  const receipt = await txResponse.getReceipt(client);
  if (!receipt.accountId) {
    throw new Error('Failed to create new Hedera account: accountId is null.');
  }
  console.log(
    `Test utility created new account: ${receipt.accountId.toString()} with public key ${newPublicKey.toStringDer()}`
  ); // Log public key
  return {
    accountId: receipt.accountId,
    privateKey: newPrivateKey,
    publicKey: newPublicKey,
  }; // Return publicKey
}

/**
 * Signs a base64-encoded Hedera transaction with the provided private key and executes it on the given client.
 * 
 * @param transactionBytesBase64 - Transaction bytes in base64 format (from AgentResponse.transactionBytes).
 * @param privateKey - The PrivateKey used to sign the transaction.
 * @param client - An initialized Hedera Client instance.
 * @returns The TransactionReceipt of the executed transaction.
 * @throws Error if the transaction cannot be signed or executed.
 */
export async function signAndExecuteTransaction(
  transactionBytesBase64: string | undefined,
  privateKey: PrivateKey,
  client: Client
): Promise<TransactionReceipt> {
  if (!transactionBytesBase64) {
    throw new Error("[signAndExecuteTransaction]: transactionBytesBase64 is required");
  }

  const txBytes = Buffer.from(transactionBytesBase64, "base64");
  const tx = Transaction.fromBytes(txBytes);
  tx.freezeWith(client);

  const signedTx = await tx.sign(privateKey);
  const res = await signedTx.execute(client);
  const receipt = await res.getReceipt(client);

  return receipt;
}