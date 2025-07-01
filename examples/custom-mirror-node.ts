import { HederaAgentKit } from '../src/agent/agent';
import { HederaConversationalAgent } from '../src/agent/conversational-agent';
import { ServerSigner } from '../src/signer/server-signer';

/**
 * Example demonstrating how to use HederaAgentKit with a custom mirror node configuration
 */
async function exampleWithCustomMirrorNode(): Promise<void> {
  // Example 1: Using HGraph with API key in URL
  const hgraphConfig = {
    customUrl: 'https://mainnet.hedera.api.hgraph.dev/v1/<API-KEY>',
    apiKey: 'your-hgraph-api-key-here'
  };

  // Example 2: Using custom provider with API key in headers
  const customProviderConfig = {
    customUrl: 'https://custom-mirror-node.com',
    apiKey: 'your-api-key',
    headers: {
      'X-Custom-Header': 'value',
      'X-Another-Header': 'another-value'
    }
  };

  // Initialize signer
  const signer = await ServerSigner.create(
    '0.0.12345',
    'your-private-key-here',
    'mainnet'
  );

  // Create HederaAgentKit with custom mirror node configuration
  const agentKit = new HederaAgentKit(
    signer,
    undefined, // pluginConfig
    'provideBytes', // operationalMode
    undefined, // userAccountId
    true, // scheduleUserTransactionsInBytesMode
    undefined, // modelCapability
    undefined, // modelName
    hgraphConfig // mirrorNodeConfig
  );

  // Initialize the kit
  await agentKit.initialize();

  // The mirror node will now use the custom configuration for all API calls
  console.log('HederaAgentKit initialized with custom mirror node configuration');

  // Example with conversational agent
  const openAIApiKey = process.env.OPENAI_API_KEY;
  if (!openAIApiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  
  const conversationalAgent = new HederaConversationalAgent(signer, {
    openAIApiKey,
    mirrorNodeConfig: customProviderConfig // Pass the custom config here
  });

  await conversationalAgent.initialize();
  console.log('HederaConversationalAgent initialized with custom mirror node configuration');
}

// Run the example
if (require.main === module) {
  exampleWithCustomMirrorNode().catch(console.error);
}