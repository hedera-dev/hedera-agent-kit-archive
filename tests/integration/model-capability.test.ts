import { describe, it, expect } from 'vitest';
import { HederaConversationalAgent } from '../../src/agent/conversational-agent';
import { ServerSigner } from '../../src/signer/server-signer';
import { ModelCapability } from '../../src/types/model-capability';

describe('Model Capability Configuration', () => {
  it('should configure model capability correctly for GPT-4o-mini', async () => {
    const signer = await ServerSigner.create(
      process.env.HEDERA_ACCOUNT_ID!,
      process.env.HEDERA_PRIVATE_KEY!,
      'testnet'
    );

    const agent = new HederaConversationalAgent(signer, {
      openAIModelName: 'gpt-4o-mini',
      verbose: false,
    });

    await agent.initialize();

    expect(agent['hederaKit'].modelCapability).toBe(ModelCapability.SMALL);
  });

  it('should configure model capability correctly for GPT-4-turbo', async () => {
    const signer = await ServerSigner.create(
      process.env.HEDERA_ACCOUNT_ID!,
      process.env.HEDERA_PRIVATE_KEY!,
      'testnet'
    );

    const agent = new HederaConversationalAgent(signer, {
      openAIModelName: 'gpt-4-turbo',
      verbose: false,
    });

    await agent.initialize();

    expect(agent['hederaKit'].modelCapability).toBe(ModelCapability.LARGE);
  });

  it('should load all tools by default', async () => {
    const signer = await ServerSigner.create(
      process.env.HEDERA_ACCOUNT_ID!,
      process.env.HEDERA_PRIVATE_KEY!,
      'testnet'
    );

    const agent = new HederaConversationalAgent(signer, {
      verbose: false,
    });

    await agent.initialize();

    const tools = agent['hederaKit'].getAggregatedLangChainTools();
    expect(tools.length).toBeGreaterThan(40);
  });
});
