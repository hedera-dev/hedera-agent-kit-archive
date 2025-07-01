import { describe, it, expect } from 'vitest';
import {
  BaseHederaQueryTool,
  FieldProcessor,
} from '../../src/langchain/tools/common/base-hedera-query-tool';
import { ModelCapability } from '../../src/types/model-capability';
import { z } from 'zod';
import { ServerSigner } from '../../src/signer/server-signer';
import HederaAgentKit from '../../src/agent/agent';

const TestSchema = z.object({
  testParam: z.string().optional(),
});

class TestQueryTool extends BaseHederaQueryTool<typeof TestSchema> {
  name = 'test-query-tool';
  description = 'Test tool for notes functionality';
  specificInputSchema = TestSchema;
  namespace = 'test';

  protected override async executeQuery(): Promise<unknown> {
    return {
      contract: {
        bytecode: 'a'.repeat(15000),
        name: 'TestContract',
      },
      largeArray: Array.from({ length: 100 }, (_, i) => ({
        id: i,
        data: `item-${i}`,
      })),
    };
  }

  protected getLargeFieldProcessors(): Record<string, FieldProcessor> {
    return {
      'contract.bytecode': {
        maxLength: 200,
        truncateMessage: 'Contract bytecode was shortened for readability',
      },
    };
  }

  public override async testCall(args: z.infer<typeof TestSchema>): Promise<string> {
    return this._call(args);
  }
}

describe('Query Tool Notes System', () => {
  it('should add user-friendly notes when fields are truncated', async () => {
    const signer = await ServerSigner.create(
      process.env.HEDERA_ACCOUNT_ID!,
      process.env.HEDERA_PRIVATE_KEY!,
      'testnet'
    );

    const hederaKit = new HederaAgentKit(
      signer,
      undefined,
      'provideBytes',
      undefined,
      true,
      ModelCapability.SMALL,
      'gpt-3.5-turbo'
    );
    await hederaKit.initialize();

    const tool = new TestQueryTool({
      hederaKit,
      modelCapability: ModelCapability.SMALL,
    });

    const result = await tool.testCall({ testParam: 'test' });
    const parsedResult = JSON.parse(result);

    expect(parsedResult.success).toBe(true);
    expect(parsedResult.notes).toBeDefined();
    expect(parsedResult.notes.length).toBeGreaterThan(0);

    const bytecodeNote = parsedResult.notes.find((note: string) =>
      note.includes('Contract bytecode was shortened for readability')
    );
    expect(bytecodeNote).toBeDefined();
    expect(bytecodeNote).toContain('Original size: 15000 characters');
    expect(bytecodeNote).toContain('shown: 200 characters');

    const arrayNote = parsedResult.notes.find((note: string) =>
      note.includes("List was shortened to fit your model's capacity")
    );
    expect(arrayNote).toBeDefined();
    expect(arrayNote).toContain('Showing 5 of 100 items');

    expect(parsedResult.data.contract.bytecode.length).toBe(200);
  });

  it('should not add notes when no truncation occurs', async () => {
    const signer = await ServerSigner.create(
      process.env.HEDERA_ACCOUNT_ID!,
      process.env.HEDERA_PRIVATE_KEY!,
      'testnet'
    );

    const hederaKit = new HederaAgentKit(
      signer,
      undefined,
      'provideBytes',
      undefined,
      true,
      ModelCapability.UNLIMITED,
      'claude-3.5-sonnet'
    );
    await hederaKit.initialize();

    const tool = new TestQueryTool({
      hederaKit,
      modelCapability: ModelCapability.UNLIMITED,
    });

    const result = await tool.testCall({ testParam: 'test' });
    const parsedResult = JSON.parse(result);

    expect(parsedResult.success).toBe(true);
    expect(parsedResult.notes).toBeUndefined();
    expect(parsedResult.data.contract.bytecode.length).toBe(15000);
  });
});
