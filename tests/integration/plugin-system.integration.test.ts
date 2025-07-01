import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { HederaAgentKit, PluginConfig } from '../../src/agent';
import { HederaConversationalAgent } from '../../src/agent/conversational-agent';
import { ServerSigner } from '../../src/signer/server-signer';
import { GenericPlugin } from '../../src/plugins';
import type { GenericPluginContext } from '../../src/plugins';
import { StructuredTool, DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env.test') });

/**
 * Mock MCP Tools Plugin to simulate external plugin loading
 */
class MockMCPToolsPlugin extends GenericPlugin {
  id = 'mock-mcp-tools-plugin';
  name = 'Mock MCP Tools Plugin';
  description = 'A mock plugin simulating MCP tools for testing plugin system';
  version = '1.0.0';
  author = 'Hedera Agent Kit Test';

  override async initialize(context: GenericPluginContext): Promise<void> {
    await super.initialize(context);
    this.context.logger.info('MockMCPToolsPlugin initialized');
  }

  getTools(): StructuredTool[] {
    return [
      new DynamicStructuredTool({
        name: 'mcp_test_tool',
        description: 'A test tool simulating MCP server capabilities',
        schema: z.object({
          operation: z.string().describe('The operation to perform'),
          data: z.string().optional().describe('Optional data for the operation'),
        }),
        func: async ({ operation, data }: { operation: string; data?: string }): Promise<string> => {
          return JSON.stringify({
            success: true,
            operation,
            data: data || 'no data provided',
            result: 'Mock MCP operation completed successfully',
            timestamp: new Date().toISOString(),
          });
        },
      }),
      new DynamicStructuredTool({
        name: 'mcp_hedera_integration',
        description: 'Test tool for MCP-Hedera integration',
        schema: z.object({
          accountId: z.string().describe('Hedera account ID'),
          action: z.string().describe('Action to perform'),
        }),
        func: async ({ accountId, action }: { accountId: string; action: string }): Promise<string> => {
          return JSON.stringify({
            success: true,
            accountId,
            action,
            network: 'testnet',
            result: 'MCP-Hedera integration test successful',
          });
        },
      }),
    ];
  }
}

async function initializeTestKit(pluginConfig?: PluginConfig): Promise<HederaAgentKit> {
  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  const openAIApiKey = process.env.OPENAI_API_KEY;

  if (!accountId || !privateKey) {
    throw new Error(
      'Hedera account ID or private key missing from environment variables.'
    );
  }
  if (!openAIApiKey) {
    throw new Error('OpenAI API key missing from environment variables.');
  }

  const signer = await ServerSigner.create(accountId, privateKey, 'testnet');
  const kit = new HederaAgentKit(signer, pluginConfig);
  await kit.initialize();
  return kit;
}

describe('Plugin System Integration Tests', () => {
  let kit: HederaAgentKit;
  let conversationalAgent: HederaConversationalAgent;

  beforeAll(async () => {
    console.log('Setting up plugin system integration tests...');
  });

  afterAll(async () => {
    console.log('Plugin system integration tests completed.');
  });

  describe('External Plugin Loading', () => {
    it('should support loading external plugins via PluginConfig', async () => {
      const mockPlugin = new MockMCPToolsPlugin();
      const pluginConfig: PluginConfig = {
        plugins: [mockPlugin],
        appConfig: {
          openAIApiKey: process.env.OPENAI_API_KEY,
        },
      };

      kit = await initializeTestKit(pluginConfig);

      const tools = kit.getAggregatedLangChainTools();
      expect(tools.length).toBeGreaterThan(0);

      const mcpTestTool = tools.find(tool => tool.name === 'mcp_test_tool');
      const mcpHederaIntegrationTool = tools.find(tool => tool.name === 'mcp_hedera_integration');

      expect(mcpTestTool).toBeDefined();
      expect(mcpHederaIntegrationTool).toBeDefined();
      expect(mcpTestTool?.description).toBe('A test tool simulating MCP server capabilities');
      expect(mcpHederaIntegrationTool?.description).toBe('Test tool for MCP-Hedera integration');
    });

    it('should initialize plugins with proper context', async () => {
      const mockPlugin = new MockMCPToolsPlugin();
      const pluginConfig: PluginConfig = {
        plugins: [mockPlugin],
        appConfig: {
          openAIApiKey: process.env.OPENAI_API_KEY,
          customConfig: 'test-value',
        },
      };

      kit = await initializeTestKit(pluginConfig);

      expect(mockPlugin.context).toBeDefined();
      expect(mockPlugin.context.logger).toBeDefined();
      expect(mockPlugin.context.config).toBeDefined();
      expect(mockPlugin.context.config.customConfig).toBe('test-value');
      expect(mockPlugin.context.client).toBeDefined();
      expect(mockPlugin.context.client.getNetwork()).toBe('testnet');
    });

    it('should work without any external plugins', async () => {
      kit = await initializeTestKit();

      const tools = kit.getAggregatedLangChainTools();
      expect(tools.length).toBeGreaterThan(0);

      const mcpTestTool = tools.find(tool => tool.name === 'mcp_test_tool');
      expect(mcpTestTool).toBeUndefined();
    });
  });

  describe('Conversational Agent Plugin Integration', () => {
    it('should support plugins in conversational agent constructor', async () => {
      const mockPlugin = new MockMCPToolsPlugin();
      const pluginConfig: PluginConfig = {
        plugins: [mockPlugin],
        appConfig: {
          openAIApiKey: process.env.OPENAI_API_KEY,
        },
      };

      const accountId = process.env.HEDERA_ACCOUNT_ID;
      const privateKey = process.env.HEDERA_PRIVATE_KEY;
      const openAIApiKey = process.env.OPENAI_API_KEY;

      if (!accountId || !privateKey || !openAIApiKey) {
        throw new Error('Required environment variables missing');
      }

      const signer = await ServerSigner.create(accountId, privateKey, 'testnet');
      conversationalAgent = new HederaConversationalAgent(signer, {
        pluginConfig,
        openAIApiKey,
        verbose: false,
      });

      await conversationalAgent.initialize();

      expect(conversationalAgent).toBeDefined();
    });

    it('should make plugin tools available in conversational agent', async () => {
      if (!conversationalAgent) {
        throw new Error('Conversational agent not initialized');
      }

      const response = await conversationalAgent.processMessage(
        'Use the mcp_test_tool to perform a "status_check" operation with data "test_data"'
      );

      expect(response).toBeDefined();
      expect(response.output).toBeDefined();
      expect(typeof response.output).toBe('string');
    });
  });

  describe('Plugin Tool Execution', () => {
    it('should execute plugin tools correctly', async () => {
      const mockPlugin = new MockMCPToolsPlugin();
      const tools = mockPlugin.getTools();
      const mcpTestTool = tools.find(tool => tool.name === 'mcp_test_tool');

      expect(mcpTestTool).toBeDefined();

      if (mcpTestTool) {
        const result = await mcpTestTool.invoke({
          operation: 'test_operation',
          data: 'test_data',
        });

        expect(result).toBeDefined();
        const parsedResult = JSON.parse(result);
        expect(parsedResult.success).toBe(true);
        expect(parsedResult.operation).toBe('test_operation');
        expect(parsedResult.data).toBe('test_data');
        expect(parsedResult.result).toBe('Mock MCP operation completed successfully');
      }
    });

    it('should handle plugin tool errors gracefully', async () => {
      const errorPlugin = new (class extends GenericPlugin {
        id = 'error-plugin';
        name = 'Error Plugin';
        description = 'Plugin that throws errors for testing';
        version = '1.0.0';
        author = 'Test';

        getTools(): StructuredTool[] {
          return [
            new DynamicStructuredTool({
              name: 'error_tool',
              description: 'A tool that throws errors',
              schema: z.object({
                shouldError: z.boolean().describe('Whether to throw an error'),
              }),
              func: async ({ shouldError }: { shouldError: boolean }): Promise<string> => {
                if (shouldError) {
                  throw new Error('Test error from plugin tool');
                }
                return 'Success';
              },
            }),
          ];
        }
      })();

      const tools = errorPlugin.getTools();
      const errorTool = tools[0];

      try {
        await errorTool.invoke({ shouldError: true });
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Test error from plugin tool');
      }

      const successResult = await errorTool.invoke({ shouldError: false });
      expect(successResult).toBe('Success');
    });
  });

  describe('Multiple Plugin Support', () => {
    it('should support loading multiple plugins simultaneously', async () => {
      const plugin1 = new MockMCPToolsPlugin();
      const plugin2 = new (class extends GenericPlugin {
        id = 'second-plugin';
        name = 'Second Plugin';
        description = 'Second plugin for testing';
        version = '1.0.0';
        author = 'Test';

        getTools(): StructuredTool[] {
          return [
            new DynamicStructuredTool({
              name: 'second_plugin_tool',
              description: 'Tool from the second plugin',
              schema: z.object({
                message: z.string().describe('Message to process'),
              }),
              func: async ({ message }: { message: string }): Promise<string> => {
                return `Second plugin processed: ${message}`;
              },
            }),
          ];
        }
      })();

      const pluginConfig: PluginConfig = {
        plugins: [plugin1, plugin2],
        appConfig: {
          openAIApiKey: process.env.OPENAI_API_KEY,
        },
      };

      kit = await initializeTestKit(pluginConfig);

      const tools = kit.getAggregatedLangChainTools();
      const tool1 = tools.find(tool => tool.name === 'mcp_test_tool');
      const tool2 = tools.find(tool => tool.name === 'second_plugin_tool');

      expect(tool1).toBeDefined();
      expect(tool2).toBeDefined();

      if (tool2) {
        const result = await tool2.invoke({ message: 'test message' });
        expect(result).toBe('Second plugin processed: test message');
      }
    });
  });
});