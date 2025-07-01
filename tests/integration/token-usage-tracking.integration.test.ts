import { describe, it, expect, beforeAll } from 'vitest';
import { HederaConversationalAgent } from '../../src/agent/conversational-agent';
import { ServerSigner } from '../../src/signer/server-signer';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Integration test for token usage tracking with real OpenAI API calls
 */
describe('Token Usage Tracking Integration', () => {
  let testAccountId: string;
  let testPrivateKey: string;
  let openaiApiKey: string;

  beforeAll(() => {
    testAccountId = process.env.HEDERA_ACCOUNT_ID || '';
    testPrivateKey = process.env.HEDERA_PRIVATE_KEY || '';
    openaiApiKey = process.env.OPENAI_API_KEY || '';

    if (!testAccountId || !testPrivateKey || !openaiApiKey) {
      throw new Error(
        'HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY, and OPENAI_API_KEY must be set for integration tests'
      );
    }
  });

  const createAgent = async (): Promise<HederaConversationalAgent> => {
    const signer = await ServerSigner.create(testAccountId, testPrivateKey, 'testnet');
    const agent = new HederaConversationalAgent(signer, {
      openAIApiKey: openaiApiKey,
      operationalMode: 'provideBytes',
      verbose: false,
      disableLogging: true,
    });
    await agent.initialize();
    return agent;
  };

  it('should track token usage for a simple query', async () => {
    const agent = await createAgent();
    const response = await agent.processMessage('What is 2 + 2?', []);

    expect(response.output).toBeDefined();
    expect(response.tokenUsage).toBeDefined();
    expect(response.tokenUsage?.promptTokens).toBeGreaterThan(0);
    expect(response.tokenUsage?.completionTokens).toBeGreaterThan(0);
    expect(response.tokenUsage?.totalTokens).toBeGreaterThan(0);
    expect(response.tokenUsage?.totalTokens).toBe(
      response.tokenUsage?.promptTokens! +
        response.tokenUsage?.completionTokens!
    );
  });

  it('should calculate costs accurately', async () => {
    const agent = await createAgent();
    const response = await agent.processMessage(
      'What is the capital of France?',
      []
    );

    expect(response.cost).toBeDefined();
    expect(response.cost?.promptCost).toBeGreaterThan(0);
    expect(response.cost?.completionCost).toBeGreaterThan(0);
    expect(response.cost?.totalCost).toBeGreaterThan(0);
    expect(response.cost?.totalCost).toBeCloseTo(
      response.cost?.promptCost! + response.cost?.completionCost!,
      10
    );
    expect(response.cost?.currency).toBe('USD');
  });

  it('should track cumulative token usage across multiple requests', async () => {
    const agent = await createAgent();

    const queries = [
      'What is 5 + 5?',
      'What is the weather like?',
      'Tell me a short joke',
    ];

    let individualTotalTokens = 0;
    let individualTotalCost = 0;

    for (const query of queries) {
      const response = await agent.processMessage(query, []);
      expect(response.tokenUsage).toBeDefined();
      expect(response.cost).toBeDefined();

      individualTotalTokens += response.tokenUsage?.totalTokens || 0;
      individualTotalCost += response.cost?.totalCost || 0;
    }

    const totalUsage = agent.getTotalTokenUsage();
    expect(totalUsage.totalTokens).toBe(individualTotalTokens);
    expect(totalUsage.cost.totalCost).toBeCloseTo(individualTotalCost, 10);
  });

  it('should maintain token usage history', async () => {
    const agent = await createAgent();

    const queries = ['Query 1', 'Query 2', 'Query 3'];

    for (const query of queries) {
      await agent.processMessage(query, []);
    }

    const history = agent.getTokenUsageHistory();
    expect(history).toHaveLength(3);

    for (const record of history) {
      expect(record.promptTokens).toBeGreaterThan(0);
      expect(record.completionTokens).toBeGreaterThan(0);
      expect(record.totalTokens).toBeGreaterThan(0);
      expect(record.cost).toBeDefined();
      expect(record.cost.totalCost).toBeGreaterThan(0);
      expect(record.timestamp).toBeInstanceOf(Date);
    }
  });

  it('should track token usage for tool-based queries', async () => {
    const agent = await createAgent();
    const response = await agent.processMessage(
      `What is the current HBAR price?`,
      []
    );

    expect(response.output).toBeDefined();
    expect(response.tokenUsage).toBeDefined();
    expect(response.tokenUsage?.promptTokens).toBeGreaterThan(100);
    expect(response.cost).toBeDefined();
    expect(response.cost?.totalCost).toBeGreaterThan(0);
  });

  it('should provide reasonable cost estimates', async () => {
    const agent = await createAgent();
    const response = await agent.processMessage(
      'Write a haiku about blockchain',
      []
    );

    expect(response.cost).toBeDefined();

    const costInCents = response.cost!.totalCost * 100;
    expect(costInCents).toBeLessThan(1);

    const hbarPrice = 0.05;
    const hbarCost = response.cost!.totalCost / hbarPrice;
    const creditsNeeded = Math.ceil(hbarCost * 1000);

    expect(creditsNeeded).toBeGreaterThan(0);
    expect(creditsNeeded).toBeLessThan(100);
  });

  it('should handle errors while still tracking tokens', async () => {
    const agent = await createAgent();
    const response = await agent.processMessage(
      'Execute a non-existent tool: call_fake_tool_12345',
      []
    );

    expect(response.error).toBeUndefined();
    expect(response.tokenUsage).toBeDefined();
    expect(response.tokenUsage?.totalTokens).toBeGreaterThan(0);
    expect(response.cost).toBeDefined();
  });
});
