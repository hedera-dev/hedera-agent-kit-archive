import * as dotenv from 'dotenv';
dotenv.config();

import {
  HederaConversationalAgent,
  ServerSigner,
  formatCost,
  HederaNetworkType,
} from 'hedera-agent-kit';
import { CostCalculation, TokenUsage } from '../src/utils/token-usage-tracker';

/**
 * Example demonstrating token usage tracking and cost calculation
 */
async function main(): Promise<void> {
  const operatorId = process.env.HEDERA_ACCOUNT_ID;
  const operatorKey = process.env.HEDERA_PRIVATE_KEY;
  const network = process.env.HEDERA_NETWORK || 'testnet';
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!operatorId || !operatorKey || !openaiApiKey) {
    throw new Error(
      'HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY, and OPENAI_API_KEY must be set in .env'
    );
  }

  // Initialize the signer and agent
  const signer = await ServerSigner.create(
    operatorId,
    operatorKey,
    network as HederaNetworkType
  );
  const agent = new HederaConversationalAgent(signer, {
    openAIApiKey: openaiApiKey,
    operationalMode: 'provideBytes',
    verbose: false,
  });

  await agent.initialize();
  console.log('🤖 Hedera Agent initialized with token tracking\n');

  // Example queries
  const queries = [
    "What's the current HBAR price?",
    'Check my account balance',
    'Create a new fungible token called TestToken with symbol TEST',
  ];

  const chatHistory: Array<{ type: 'human' | 'ai'; content: string }> = [];

  for (const query of queries) {
    console.log(`\n💬 User: ${query}`);

    // Process the message
    const response = await agent.processMessage(query, chatHistory);

    // Update chat history
    chatHistory.push({ type: 'human', content: query });
    chatHistory.push({ type: 'ai', content: response.output });

    console.log(`🤖 Agent: ${response.output}`);

    // Display token usage for this request
    if (response.tokenUsage && response.cost) {
      console.log('\n📊 Token Usage:');
      console.log(`   - Prompt tokens: ${response.tokenUsage.promptTokens}`);
      console.log(
        `   - Completion tokens: ${response.tokenUsage.completionTokens}`
      );
      console.log(`   - Total tokens: ${response.tokenUsage.totalTokens}`);
      console.log(`   - Cost: ${formatCost(response.cost)}`);
    }
  }

  // Display cumulative token usage
  console.log('\n📈 Cumulative Token Usage:');
  const totalUsage = agent.getTotalTokenUsage();
  console.log(`   - Total prompt tokens: ${totalUsage.promptTokens}`);
  console.log(`   - Total completion tokens: ${totalUsage.completionTokens}`);
  console.log(`   - Total tokens: ${totalUsage.totalTokens}`);
  console.log(`   - Total cost: ${formatCost(totalUsage.cost)}`);

  // Display token usage history
  console.log('\n📜 Token Usage History:');
  const history = agent.getTokenUsageHistory();
  history.forEach(
    (usage: TokenUsage & { cost: CostCalculation }, index: number) => {
      console.log(`   Request ${index + 1}:`);
      console.log(`     - Tokens: ${usage.totalTokens}`);
      console.log(`     - Cost: ${formatCost(usage.cost)}`);
      console.log(`     - Timestamp: ${usage.timestamp?.toISOString()}`);
    }
  );

  // Example: Integration with credits system
  console.log('\n💳 Credits System Integration Example:');
  const totalCostUSD = totalUsage.cost.totalCost;
  const hbarPriceUSD = 0.05; // Example HBAR price
  const hbarCost = totalCostUSD / hbarPriceUSD;
  const creditsDeducted = Math.ceil(hbarCost * 1000); // 1 credit = 0.001 HBAR

  console.log(`   - Total USD cost: $${totalCostUSD.toFixed(6)}`);
  console.log(`   - HBAR equivalent: ${hbarCost.toFixed(4)} HBAR`);
  console.log(`   - Credits to deduct: ${creditsDeducted} credits`);

  // Reset tracking for new session
  agent.resetTokenUsageTracking();
  console.log('\n✅ Token tracking reset for new session');
}

main().catch(console.error);
