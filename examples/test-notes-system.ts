import * as dotenv from 'dotenv';
dotenv.config();

import { ServerSigner } from '../src/signer/server-signer';
import {
  HederaConversationalAgent,
  AgentResponse,
} from '../src/agent/conversational-agent';
import { HederaNetworkType } from '../src/types';

async function testNotes(): Promise<void> {
  console.log('Starting Hedera Agent Kit - Notes System Test...');

  const operatorId = process.env.HEDERA_ACCOUNT_ID;
  const operatorKey = process.env.HEDERA_PRIVATE_KEY;
  const network = (process.env.HEDERA_NETWORK ||
    'testnet') as HederaNetworkType;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const userAccountId = process.env.USER_ACCOUNT_ID; // For user-centric operations

  if (!operatorId || !operatorKey || !openaiApiKey) {
    console.error(
      'HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY, and OPENAI_API_KEY must be set in .env'
    );
    process.exit(1);
  }
  if (!userAccountId) {
    console.warn(
      'USER_ACCOUNT_ID is not set in .env. Some notes related to user account defaulting might not appear as expected.'
    );
  }

  console.log(`Using Agent Operator ID: ${operatorId} on ${network}`);
  if (userAccountId) {
    console.log(
      `User Account ID (for user-centric transactions): ${userAccountId}`
    );
  }

  const agentSigner = await ServerSigner.create(operatorId, operatorKey, network);

  const conversationalAgent = new HederaConversationalAgent(agentSigner, {
    operationalMode: 'provideBytes',
    userAccountId: userAccountId || undefined,
    verbose: true,
    openAIApiKey: openaiApiKey,
    scheduleUserTransactionsInBytesMode: true,
    pluginConfig: {
      plugins: [],
    },
  });

  try {
    await conversationalAgent.initialize();
    console.log('HederaConversationalAgent initialized for notes test.\n');

    const testQuery =
      'i want to create a token called HUMAN, with 1000 initial supply';
    console.log(`Test Query: "${testQuery}"\n`);

    const agentResponse: AgentResponse =
      await conversationalAgent.processMessage(testQuery);

    console.log('agent response', agentResponse);
    console.log('--- Agent Response ---_');
    console.log('Output:\n', agentResponse.output);
    console.log('\nTransactionBytes:', agentResponse.transactionBytes);
    console.log('ScheduleId:', agentResponse.schedule_id);
    console.log('Error:', agentResponse.error);
    console.log('RawToolOutput:', agentResponse.rawToolOutput); // To see the JSON from the tool
    console.log(
      'Notes directly from AgentResponse object:',
      agentResponse.notes
    );
    console.log('--- End of Agent Response ---\n');

    if (agentResponse.notes && agentResponse.notes.length > 0) {
      console.log('SUCCESS: Notes were found in the agent response!');
    } else if (
      agentResponse.output.includes('defaults applied') ||
      agentResponse.output.includes('defaulted to')
    ) {
      console.log(
        'PARTIAL SUCCESS: Notes seem to be in the output string, but not in the dedicated `notes` field of AgentResponse.'
      );
    } else {
      console.error(
        'FAILURE: No notes found in agent response or output string. Expected Zod defaults (e.g., for decimals, supplyType) and potentially builder defaults (e.g., treasury).'
      );
    }
  } catch (error) {
    console.error('An error occurred during the test:', error);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  testNotes().catch((error) => {
    console.error('Unhandled error in testNotes:', error);
    process.exit(1);
  });
}

main();
