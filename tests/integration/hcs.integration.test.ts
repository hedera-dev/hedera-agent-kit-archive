import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { HederaAgentKit } from '../../src/agent';
import { ServerSigner } from '../../src/signer/server-signer'; // Assuming this path is correct
import {
  HederaCreateTopicTool,
  HederaDeleteTopicTool,
} from '../../src/langchain/tools/hcs'; // Assuming path to HCS tools index or specific file
import { TopicId } from '@hashgraph/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { StructuredTool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';

import { HederaSubmitMessageTool } from '../../src/langchain/tools/hcs'; // Assuming path to HCS tools index or specific file
import { HederaUpdateTopicTool } from '../../src/langchain/tools/hcs'; // Assuming path to HCS tools index or specific file

// Ensure environment variables are loaded for the test file itself
// This path assumes hcs.integration.test.ts is in the same dir as hts.integration.test.ts
dotenv.config({ path: path.resolve(__dirname, '../../../.env.test') });

// --- INLINED UTILS (Copied from hts.integration.test.ts - consider moving to a shared utils.ts eventually) ---
async function initializeTestKit(): Promise<HederaAgentKit> {
  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  const openAIApiKey = process.env.OPENAI_API_KEY;
  if (!accountId || !privateKey)
    throw new Error(
      'Hedera account ID or private key missing from environment variables.'
    );
  if (!openAIApiKey)
    throw new Error('OpenAI API key missing from environment variables.');
  const signer = await ServerSigner.create(accountId, privateKey, 'testnet');
  const kit = new HederaAgentKit(signer, { appConfig: { openAIApiKey } });
  await kit.initialize();
  return kit;
}

function generateUniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 7)}`;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createTestAgentExecutor(
  tool: StructuredTool,
  openAIApiKey: string
): Promise<AgentExecutor> {
  const tools = [tool];
  const llm = new ChatOpenAI({
    apiKey: openAIApiKey,
    modelName: 'gpt-4o-mini',
    temperature: 0,
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

interface HCSToolResult {
  success?: boolean;
  error?: unknown;
  receipt?: {
    status?: string;
    topicId?: TopicId;
    topicSequenceNumber?: number;
  };
}

function getToolOutputFromResult(agentResult: unknown): HCSToolResult {
  console.log('Full agentResult:', JSON.stringify(agentResult, null, 2));
  let toolOutputData: HCSToolResult | undefined;
  
  if (
    agentResult &&
    typeof agentResult === 'object' &&
    'intermediateSteps' in agentResult &&
    Array.isArray((agentResult as { intermediateSteps: unknown[] }).intermediateSteps) &&
    (agentResult as { intermediateSteps: unknown[] }).intermediateSteps.length > 0
  ) {
    const intermediateSteps = (agentResult as { intermediateSteps: unknown[] }).intermediateSteps;
    const lastStep = intermediateSteps[intermediateSteps.length - 1];
    
    if (lastStep && typeof lastStep === 'object' && 'observation' in lastStep && 'action' in lastStep) {
      const observation = (lastStep as { observation: unknown; action: unknown }).observation;
      console.log(
        'Last intermediate step action:',
        JSON.stringify((lastStep as { action: unknown }).action, null, 2)
      );
      console.log(
        'Attempting to use this observation from last intermediate step:',
        observation
      );
      
      if (typeof observation === 'string') {
        try {
          toolOutputData = JSON.parse(observation) as HCSToolResult;
        } catch (error: unknown) {
          throw new Error(
            `Failed to parse observation string from intermediateStep. String was: "${observation}". Error: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      } else if (typeof observation === 'object' && observation !== null) {
        toolOutputData = observation as HCSToolResult;
        console.log(
          'Observation from intermediateStep was already an object, using directly:',
          toolOutputData
        );
      } else {
        console.warn(
          'Observation in last intermediate step was not a string or a recognized object. Full step:',
          lastStep
        );
      }
    }
  }
  
  if (!toolOutputData) {
    console.warn(
      'Could not find usable tool output in intermediateSteps. Attempting to parse agentResult.output.',
      `agentResult.output: ${agentResult && typeof agentResult === 'object' && 'output' in agentResult ? (agentResult as { output: unknown }).output : 'undefined'}`
    );
    
    if (
      !(
        agentResult &&
        typeof agentResult === 'object' &&
        'intermediateSteps' in agentResult &&
        Array.isArray((agentResult as { intermediateSteps: unknown[] }).intermediateSteps) &&
        (agentResult as { intermediateSteps: unknown[] }).intermediateSteps.length > 0
      )
    ) {
      if (
        agentResult &&
        typeof agentResult === 'object' &&
        'output' in agentResult &&
        typeof (agentResult as { output: unknown }).output === 'string'
      ) {
        try {
          toolOutputData = JSON.parse((agentResult as { output: string }).output) as HCSToolResult;
          console.warn('Parsed agentResult.output as a fallback.');
        } catch (error: unknown) {
          throw new Error(
            `No intermediate steps, and agentResult.output was not valid JSON. Output: "${(agentResult as { output: string }).output}". Error: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      } else {
        throw new Error(
          'No intermediate steps, and agentResult.output is not a string.'
        );
      }
    } else {
      throw new Error(
        'Intermediate steps found, but observation was not a usable string or object. See logs for details.'
      );
    }
  }
  
  return toolOutputData || { success: false };
}
// --- END INLINED UTILS ---

describe('Hedera HCS Tools Integration Tests', () => {
  let kit: HederaAgentKit;
  let openAIApiKey: string;
  let createdTopicIds: TopicId[] = [];

  beforeAll(async () => {
    kit = await initializeTestKit();
    openAIApiKey = process.env.OPENAI_API_KEY as string;
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables.');
    }
  });

  afterAll(async () => {
    if (kit && createdTopicIds.length > 0) {
      console.log(
        `Attempting to clean up ${createdTopicIds.length} created topic(s)...`
      );
      const deleteTool = new HederaDeleteTopicTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(
        deleteTool,
        openAIApiKey
      );
      for (const topicId of createdTopicIds) {
        try {
          const prompt = `Delete topic ${topicId.toString()}. metaOptions: { adminKeyShouldSign: true }`; // Assuming adminKey is operator
          console.log(`Cleaning up topic: ${topicId.toString()}`);
          const agentResult = await agentExecutor.invoke({ input: prompt });
          const result = getToolOutputFromResult(agentResult);
          expect(
            result.success,
            `Cleanup Failed for ${topicId.toString()}: ${result.error}`
          ).toBe(true);
          if (result.receipt) {
            expect(result.receipt.status).toEqual('SUCCESS');
            console.log(`Successfully cleaned up topic ${topicId.toString()}`);
          }
        } catch (error) {
          console.error(
            `Failed to clean up topic ${topicId.toString()}:`,
            error
          );
        }
      }
    }
  });

  describe('HederaCreateTopicTool', () => {
    it('should create a new HCS topic with a memo and admin key', async () => {
      const tool = new HederaCreateTopicTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);
      const topicMemo = generateUniqueName('TestTopicMemo');
      const prompt = `Create a new HCS topic with memo "${topicMemo}" and set the admin key to the current signer. metaOptions: { adminKeyShouldSign: true }`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(result.success, `CreateTopic Test Failed: ${result.error}`).toBe(
        true
      );
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      expect(result.receipt.topicId?.toString()).toMatch(
        new RegExp('^0\\.0\\.\\d+$')
      );

      if (result.receipt.topicId) {
        createdTopicIds.push(result.receipt.topicId);
        console.log(
          `Created HCS Topic ${result.receipt.topicId.toString()} with memo '${topicMemo}'.`
        );
      }
    });
  });

  describe('HederaSubmitMessageToTopicTool', () => {
    let topicIdForMessages: TopicId;

    beforeAll(async () => {
      // Create a topic to submit messages to
      const createTopicTool = new HederaCreateTopicTool({ hederaKit: kit });
      const agentExecutorCreate = await createTestAgentExecutor(
        createTopicTool,
        openAIApiKey
      );
      const topicMemo = generateUniqueName('TopicForMessages');
      // Operator will be admin key by default if not specified, submit key will be open
      const createPrompt = `Create a new HCS topic with memo "${topicMemo}". metaOptions: { adminKeyShouldSign: true }`;

      const agentResultCreate = await agentExecutorCreate.invoke({
        input: createPrompt,
      });
      const resultCreate = getToolOutputFromResult(agentResultCreate);
      expect(
        resultCreate.success,
        `Setup for SubmitMessage (Topic Creation) failed: ${resultCreate.error}`
      ).toBe(true);
      expect(
        resultCreate.receipt?.topicId,
        'Topic creation for message submission failed to return topicId'
      ).toBeDefined();
      topicIdForMessages = resultCreate.receipt!.topicId!;
      createdTopicIds.push(topicIdForMessages); // Ensure cleanup
      console.log(
        `Created topic ${topicIdForMessages.toString()} for message submission tests.`
      );
    });

    it('should submit a message to the topic', async () => {
      const tool = new HederaSubmitMessageTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);
      const messageContent = `Test message from HederaAgentKit: ${generateUniqueName(
        'msg'
      )}`;
      const prompt = `Submit the following message to topic ${topicIdForMessages.toString()}: "${messageContent}"`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(result.success, `SubmitMessage Test Failed: ${result.error}`).toBe(
        true
      );
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      expect(result.receipt.topicSequenceNumber).toBeDefined();
      // Assuming this is the first message, sequence number should be 1 (as a string from JSON or number)
      expect(Number(result.receipt.topicSequenceNumber)).toBeGreaterThan(0);
      console.log(
        `Successfully submitted message to topic ${topicIdForMessages.toString()}. Sequence number: ${
          result.receipt.topicSequenceNumber
        }`
      );
    });
  });

  describe('HederaUpdateTopicTool', () => {
    let topicToUpdateId: TopicId;
    const initialMemo = generateUniqueName('InitialUpdateTopicMemo');

    beforeAll(async () => {
      const createTopicTool = new HederaCreateTopicTool({ hederaKit: kit });
      const agentExecutorCreate = await createTestAgentExecutor(
        createTopicTool,
        openAIApiKey
      );
      const operatorPublicKeyDer = (
        await kit.signer.getPublicKey()
      ).toStringDer(); // Re-introduce

      // Create a topic with an admin key to allow updates (operator is admin)
      const createPrompt = `Create a new HCS topic with memo "${initialMemo}" and admin key "${operatorPublicKeyDer}". metaOptions: { adminKeyShouldSign: true }`; // Reverted to DER key and metaOptions

      const agentResultCreate = await agentExecutorCreate.invoke({
        input: createPrompt,
      });
      const resultCreate = getToolOutputFromResult(agentResultCreate);
      expect(
        resultCreate.success,
        `Setup for UpdateTopic (Topic Creation) failed: ${resultCreate.error}`
      ).toBe(true);
      expect(
        resultCreate.receipt?.topicId,
        'Topic creation for update test failed to return topicId'
      ).toBeDefined();
      topicToUpdateId = resultCreate.receipt!.topicId!;
      createdTopicIds.push(topicToUpdateId);
      console.log(
        `Created topic ${topicToUpdateId.toString()} with memo '${initialMemo}' for update tests.`
      );
    });

    it('should update the topic memo', async () => {
      const tool = new HederaUpdateTopicTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);
      const newMemo = generateUniqueName('UpdatedTopicMemo');

      // Prompt to update the memo. Operator is the admin key.
      const prompt = `Update HCS topic ${topicToUpdateId.toString()}. Set its memo to "${newMemo}".`; // Removed metaOptions

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(
        result.success,
        `UpdateTopic Memo Test Failed: ${result.error}`
      ).toBe(true);
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      console.log(
        `Successfully updated memo for topic ${topicToUpdateId.toString()} to '${newMemo}'.`
      );

      // TODO: Future - query topic info to verify newMemo is set.
    });
  });

  describe('HederaDeleteTopicTool (Dedicated Test)', () => {
    let topicToDeleteId: TopicId;

    beforeEach(async () => {
      // Create a fresh topic for each delete attempt
      const createTopicTool = new HederaCreateTopicTool({ hederaKit: kit });
      const agentExecutorCreate = await createTestAgentExecutor(
        createTopicTool,
        openAIApiKey
      );
      const topicMemo = generateUniqueName('DeletableTopic');
      const operatorPublicKeyDer = (
        await kit.signer.getPublicKey()
      ).toStringDer(); // Re-introduce

      const createPrompt = `Create a new HCS topic with memo "${topicMemo}" and admin key "${operatorPublicKeyDer}". metaOptions: { adminKeyShouldSign: true }`; // Reverted to DER key and metaOptions

      const agentResultCreate = await agentExecutorCreate.invoke({
        input: createPrompt,
      });
      const resultCreate = getToolOutputFromResult(agentResultCreate);
      expect(
        resultCreate.success,
        `Setup for DeleteTopic Test (Topic Creation) failed: ${resultCreate.error}`
      ).toBe(true);
      expect(
        resultCreate.receipt?.topicId,
        'Deletable topic creation failed to return topicId'
      ).toBeDefined();
      topicToDeleteId = resultCreate.receipt!.topicId!;
      // Not adding to global createdTopicIds as this test will delete it.
      console.log(
        `Created deletable topic ${topicToDeleteId.toString()} for dedicated delete test.`
      );
    });

    it('should delete the topic successfully', async () => {
      const tool = new HederaDeleteTopicTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);
      const prompt = `Delete topic ${topicToDeleteId.toString()}. metaOptions: { adminKeyShouldSign: true }`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(result.success, `DeleteTopic Test Failed: ${result.error}`).toBe(
        true
      );
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      console.log(
        `Successfully deleted topic ${topicToDeleteId.toString()} in dedicated test.`
      );
    });
  });
});
