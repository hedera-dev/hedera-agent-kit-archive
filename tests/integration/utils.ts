import { HederaAgentKit } from '../../src/agent';
import { ServerSigner } from '../../src/signer/server-signer';
import { StructuredTool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import dotenv from 'dotenv';
import path from 'path';
import { ChainValues } from '@langchain/core/utils/types';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DEFAULT_MODEL = DEFAULT_MODEL;

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

  const signer = await ServerSigner.create(accountId, privateKey, 'testnet');

  const kit = new HederaAgentKit(signer, { appConfig: { openAIApiKey } }, 'provideBytes', undefined, true, undefined, DEFAULT_MODEL); 
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
 
