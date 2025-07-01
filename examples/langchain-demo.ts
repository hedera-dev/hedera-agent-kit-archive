if (typeof window === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).window = {};
}
if (typeof self === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).self = global;
}

import * as dotenv from 'dotenv';
dotenv.config();

import './hedera-logger-override';

import { ServerSigner } from '../src/signer/server-signer';
import { Transaction } from '@hashgraph/sdk';
import { Buffer } from 'buffer';
import * as readline from 'readline';
import {
  HederaConversationalAgent,
  AgentResponse,
} from '../src/agent/conversational-agent';
import { HelloWorldPlugin } from './hello-world-plugin';
import type { IPlugin } from '../src/plugins';
import type { HederaNetworkType } from '../src/types';
import chalk from 'chalk';
import gradient from 'gradient-string';
import { enableHederaLogging } from './hedera-logger-override';
import { HederaAccountPlugin, HederaHCSPlugin } from '../src/plugins/core';

function createInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function main(): Promise<void> {
  const hederaGradient = gradient(['#8259ef', '#2d84eb']);
  const successGradient = gradient(['#3ec878', '#2d84eb']);
  const warningColor = chalk.hex('#464646').dim;
  const errorColor = chalk.hex('#464646');
  const primaryPurple = chalk.hex('#8259ef').bold;
  const primaryBlue = chalk.hex('#2d84eb').bold;
  const primaryGreen = chalk.hex('#3ec878').bold;
  const charcoal = chalk.hex('#464646');

  const args = process.argv.slice(2);
  const mode = args[0] || 'provideBytes';

  if (!['provideBytes', 'directExecution'].includes(mode)) {
    console.error(
      errorColor(
        `Invalid mode: ${mode}. Use 'provideBytes' or 'directExecution'.`
      )
    );
    process.exit(1);
  }

  const isAutonomous = mode === 'directExecution';
  const modeDescription = isAutonomous
    ? 'Autonomous Mode'
    : 'Human-in-the-Loop Mode';

  const banner = `
${hederaGradient(
    '╔═══════════════════════════════════════════════════════════════╗'
  )}
${hederaGradient(
    '║                      HEDERA AGENT KIT                        ║'
  )}
${hederaGradient(`║                   ${modeDescription.padEnd(30)} ║`)}
${hederaGradient(
    '╚═══════════════════════════════════════════════════════════════╝'
  )}
`;

  console.log(banner);
  console.log(primaryGreen('🚀 Initializing Hedera Agent Kit...\n'));
  console.log(primaryBlue(`🔧 Operational Mode: ${chalk.white(mode)}\n`));

  const operatorId = process.env.HEDERA_ACCOUNT_ID;
  const operatorKey = process.env.HEDERA_PRIVATE_KEY;
  const network = (process.env.HEDERA_NETWORK || 'testnet') as HederaNetworkType;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  const userAccountId = process.env.USER_ACCOUNT_ID;
  const userPrivateKey = process.env.USER_PRIVATE_KEY;

  if (!operatorId || !operatorKey) {
    throw new Error(
      'HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set in .env'
    );
  }
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY must be set in .env');
  }

  const agentSigner = await ServerSigner.create(operatorId, operatorKey, network);

  const conversationalAgent = new HederaConversationalAgent(agentSigner, {
    operationalMode: mode as 'provideBytes' | 'directExecution',
    ...(userAccountId && { userAccountId }),
    verbose: false,
    openAIApiKey: openaiApiKey,
    scheduleUserTransactionsInBytesMode: true,
    openAIModelName: 'gpt-4o-mini',
    pluginConfig: {
      plugins: [
        new HederaHCSPlugin(),
        new HederaAccountPlugin(),
        new HelloWorldPlugin() as IPlugin],
    },
  });

  const loadingFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let frameIndex = 0;
  const loadingInterval = setInterval(() => {
    process.stdout.write(
      `\r${primaryBlue(
        `${loadingFrames[frameIndex]} Initializing Hedera Agent Kit...`
      )}`
    );
    frameIndex = (frameIndex + 1) % loadingFrames.length;
  }, 100);

  await conversationalAgent.initialize();

  setTimeout(() => {
    clearInterval(loadingInterval);
    process.stdout.write('\r' + ' '.repeat(50) + '\r');

    console.log(successGradient('✅ Hedera Agent Kit Ready!'));
    console.log(
      `${primaryPurple('🤖 AI Agent:')} ${chalk.white(
        'Connected and operational'
      )}`
    );
    console.log(
      `${primaryBlue('🌐 Network:')} ${chalk.white(network.toUpperCase())}`
    );
    console.log(
      `${primaryPurple('🔗 Agent Account:')} ${chalk.white(operatorId)}`
    );
    if (userAccountId && userPrivateKey) {
      console.log(
        `${primaryGreen('👤 User Account:')} ${chalk.white(
          userAccountId
        )} ${charcoal.dim('(configured)')}`
      );
    } else {
      console.log(`${charcoal.dim('👤 User Account: Not configured')}`);
    };
    console.log();
    console.log(
      primaryBlue.dim('💬 Type "exit" to quit, or try "say hello to Hedera"')
    );
    console.log(
      primaryPurple.dim(
        '💡 Try: "create an account", "check my balance", or "send 1 HBAR to 0.0.123"'
      )
    );
    console.log();

    console.log(
      charcoal.dim(
        '📊 Initialization logs suppressed for clean startup experience'
      )
    );
    console.log();
    enableHederaLogging();
    askQuestion();
  }, 1000);

  const chatHistory: Array<{ type: 'human' | 'ai'; content: string }> = [];
  const rl = createInterface();

  async function handleUserSignedExecution(
    transactionBytesBase64: string,
    originalPromptForHistory?: string
  ): Promise<void> {
    if (!userAccountId || !userPrivateKey) {
      console.log(
        warningColor(
          'Agent > USER_ACCOUNT_ID and USER_PRIVATE_KEY are not set. Cannot execute with user key.'
        )
      );
      chatHistory.push({
        type: 'ai',
        content: 'User keys not configured, cannot proceed with user signing.',
      });
      return;
    }
    if (originalPromptForHistory)
      chatHistory.push({ type: 'human', content: originalPromptForHistory });

    console.log(
      `${primaryBlue('Agent >')} ${primaryPurple(
        `Preparing and executing transaction with user account ${userAccountId}...`
      )}`
    );
    try {
      const userSigner = await ServerSigner.create(
        userAccountId,
        userPrivateKey,
        network
      );
      const txBytes = Buffer.from(
        transactionBytesBase64.replace(/`/g, '').trim(),
        'base64'
      );
      let transaction = Transaction.fromBytes(txBytes);

      // Always attempt to freeze and sign with the user's key for this demo.
      // If the transaction was already frozen (e.g., a ScheduleSign prepared by the agent),
      // freezeWith() on an already frozen tx might be a no-op or error depending on SDK version/state.
      // For simplicity, we assume transaction from bytes needs user signature and payment.
      let frozenTx;
      if (transaction.isFrozen()) {
        frozenTx = transaction;
      } else {
        frozenTx = await transaction.freezeWith(userSigner.getClient());
      }
      const signedTx = await frozenTx.sign(userSigner.getOperatorPrivateKey());

      const response = await signedTx.execute(userSigner.getClient());
      const receipt = await response.getReceipt(userSigner.getClient());

      const successMsg = `Transaction executed with your key. Receipt: ${JSON.stringify(
        receipt.toJSON()
      )}`;
      console.log(`${primaryGreen('Agent >')} ${primaryGreen(successMsg)}`);
      chatHistory.push({ type: 'ai', content: successMsg });
    } catch (e: unknown) {
      const error = e as Error;
      const errorMsg = `Sorry, I encountered an error executing that with your key: ${error.message || String(e)
        }`;
      console.error(
        `${errorColor('Agent >')} ${charcoal.dim(
          'Error executing transaction with user key:'
        )}`,
        e
      );
      chatHistory.push({ type: 'ai', content: errorMsg });
    }
  }

  async function processAndRespond(
    userInput: string,
    isFollowUp: boolean = false
  ): Promise<void> {
    if (!isFollowUp) {
      chatHistory.push({ type: 'human', content: userInput });
    }

    const agentResponse: AgentResponse =
      await conversationalAgent.processMessage(userInput, chatHistory);

    if (agentResponse.notes) {
      console.log(
        `${primaryBlue('Agent Notes >')} ${charcoal.dim(
          agentResponse.notes.map((note) => `- ${note}`).join('\n')
        )}`
      );
    }

    console.log(
      `${primaryPurple('Agent Message >')} ${chalk.white(
        agentResponse.message
      )}`
    );
    if (agentResponse.output !== agentResponse.message) {
      console.log(
        `${primaryBlue('Agent Tool Output (JSON) >')} ${charcoal.dim(
          agentResponse.output
        )}`
      );
    }
    chatHistory.push({
      type: 'ai',
      content: agentResponse.message || agentResponse.output,
    });

    if (agentResponse.scheduleId) {
      const scheduleIdToSign = agentResponse.scheduleId;
      rl.question(
        `${primaryPurple('Agent >')} ${primaryGreen(
          `Transaction scheduled with ID ${scheduleIdToSign}`
        )}. ${primaryBlue(
          `Sign and submit with your account ${userAccountId}?`
        )} ${charcoal.dim('(y/n):')} `,
        async (answer) => {
          if (answer.toLowerCase() === 'y') {
            const followUpInput = `Sign and submit scheduled transaction ${scheduleIdToSign}`;
            console.log(
              `\n${primaryGreen('User (follow-up) >')} ${chalk.white(
                followUpInput
              )}`
            );
            await processAndRespond(followUpInput, true);
          } else {
            chatHistory.push({
              type: 'ai',
              content: 'Okay, scheduled transaction not signed.',
            });
            askQuestion();
          }
        }
      );
      return;
    }

    if (agentResponse.transactionBytes) {
      if (userAccountId && userPrivateKey) {
        const finalBytes = agentResponse.transactionBytes;
        const originalPromptForHistory = isFollowUp ? undefined : userInput;
        rl.question(
          `${primaryPurple('Agent >')} ${primaryGreen(
            'Transaction bytes received'
          )}. ${primaryBlue(
            `Sign and execute with YOUR account ${userAccountId}?`
          )} ${charcoal.dim('(y/n):')} `,
          async (answer) => {
            if (answer.toLowerCase() === 'y') {
              await handleUserSignedExecution(
                finalBytes,
                originalPromptForHistory
              );
            } else {
              chatHistory.push({
                type: 'ai',
                content: 'Okay, transaction not executed.',
              });
            }
            askQuestion();
          }
        );
        return;
      }
    }

    if (agentResponse.error) {
      console.error(
        `${errorColor('Agent >')} ${charcoal.dim('Error reported by agent:')}`,
        agentResponse.error
      );
    }
    askQuestion();
  }

  function askQuestion(): void {
    setTimeout(() => {
      rl.question(`${primaryGreen('User >')} `, async (input) => {
        if (input.toLowerCase() === 'exit') {
          rl.close();
          console.log(
            `\n${hederaGradient(
              '🎉 Interactive demo finished. Thank you for using Hedera Agent Kit!'
            )}`
          );
          return;
        }
        try {
          console.log(
            `\n${primaryBlue('🤖 Invoking agent with:')} ${chalk.white(
              `"${input}"`
            )}`
          );
          await processAndRespond(input);
        } catch (e: unknown) {
          const error = e as Error;
          const errorMsg = error.message || String(e);
          console.error(
            `${errorColor('Error during agent invocation loop:')}`,
            errorMsg
          );
          if (
            chatHistory[chatHistory.length - 1]?.content !== input ||
            chatHistory[chatHistory.length - 1]?.type !== 'human'
          ) {
            chatHistory.push({ type: 'human', content: input });
          }
          chatHistory.push({
            type: 'ai',
            content: `Sorry, a critical error occurred: ${errorMsg}`,
          });
          askQuestion();
        }
      });
    }, 100);
  }
}

main().catch(console.error);
