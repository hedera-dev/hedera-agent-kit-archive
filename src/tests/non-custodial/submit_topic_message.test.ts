import { describe, expect, it, beforeAll } from "vitest";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import { LangchainAgent } from "../utils/langchainAgent";
import { extractTxBytes, signAndExecuteTx, wait } from "../utils/utils";
import { AccountData } from "../utils/testnetUtils";
import { ExecutorAccountDetails } from "../../types";

const IS_CUSTODIAL = false;

dotenv.config();
describe("submit_topic_message (non-custodial)", () => {
  let topic1: string;
  let topic2: string;
  let topic3: string;
  const MESSAGE1: string = "Message1";
  const MESSAGE2: string = "Message2";
  const MESSAGE3: string = "Message3";
  let testCases: { textPrompt: string; topicId: string; message: string }[];
  let networkClientWrapper: NetworkClientWrapper;
  let executorCustodialClientWrapper: NetworkClientWrapper;
  let hederaApiClient: HederaMirrorNodeClient;
  let txExecutorAccount: AccountData;

  beforeAll(async () => {
    try {
      hederaApiClient = new HederaMirrorNodeClient("testnet");

      networkClientWrapper = new NetworkClientWrapper(
        process.env.HEDERA_ACCOUNT_ID!,
        process.env.HEDERA_PRIVATE_KEY!,
        process.env.HEDERA_KEY_TYPE!,
        "testnet"
      );

      // Create a test account
      const startingHbars = 60;
      const autoAssociation = -1; // unlimited auto association
      txExecutorAccount = await networkClientWrapper.createAccount(
        startingHbars,
        autoAssociation
      );

      // a custodial client wrapper for the tx executor account is required for creating topics before the test
      executorCustodialClientWrapper = new NetworkClientWrapper(
        txExecutorAccount.accountId,
        txExecutorAccount.privateKey,
        'ECDSA', // .createAccount() creates account with ECDSA key
        "testnet"
      );

      await Promise.all([
        executorCustodialClientWrapper.createTopic("Hello world 1", true),
        executorCustodialClientWrapper.createTopic("Hello world 2", true),
        executorCustodialClientWrapper.createTopic("Hello world 3", true),
      ]).then(([_topic1, _topic2, _topic3]) => {
        topic1 = _topic1.topicId;
        topic2 = _topic2.topicId;
        topic3 = _topic3.topicId;
      });

      testCases = [
        {
          textPrompt: `Submit message ${MESSAGE1} to topic ${topic1}`,
          topicId: topic1,
          message: MESSAGE1,
        },
        {
          textPrompt: `Submit message ${MESSAGE2} to topic ${topic2}`,
          topicId: topic2,
          message: MESSAGE2,
        },
        {
          textPrompt: `Submit message ${MESSAGE3} to topic ${topic3}`,
          topicId: topic3,
          message: MESSAGE3,
        },
      ];
    } catch (error) {
      console.error("Error in setup:", error);
      throw error;
    }
  });

  describe("submit topic message checks", () => {
    it("should submit message to topic", async () => {
      for (const { textPrompt, message, topicId } of testCases) {
        const prompt = {
          user: "user",
          text: textPrompt,
        };

        const langchainAgent = await LangchainAgent.create();

        console.log(`Prompt: ${textPrompt}`);
        console.log(JSON.stringify(txExecutorAccount, null, 2));

        const executorAccountDetails: ExecutorAccountDetails = {
          executorAccountId: txExecutorAccount.accountId,
          executorPublicKey: txExecutorAccount.publicKey,
        }

        // STEP 1: send non-custodial prompt
        const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL, executorAccountDetails);

        // STEP 2: extract tx bytes
        const txBytesString = extractTxBytes(response.messages)

        // STEP 3: verify correctness by signing and executing the tx
        const executedTx = await signAndExecuteTx(
          txBytesString,
          txExecutorAccount.privateKey,
          txExecutorAccount.accountId
        )

        await wait(5000); // wait for the mirror node to update

        // STEP 4: verify that the topic was deleted correctly
        const topicMessages =
          await hederaApiClient.getTopicMessages(topicId);

        const receivedMessage = topicMessages.find(({ message: _message }) => {
          return message === _message;
        });

        expect(receivedMessage).toBeTruthy();

        console.log('\n\n');
      }
    });
  });
});
