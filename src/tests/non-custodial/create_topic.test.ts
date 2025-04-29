import { describe, it, expect, beforeAll, afterEach } from "vitest";
import * as dotenv from "dotenv";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import { LangchainAgent } from "../utils/langchainAgent";
import { extractTxBytes, formatTxHash, signAndExecuteTx, wait } from "../utils/utils";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { AccountData } from "../utils/testnetUtils";
import { ExecutorAccountDetails } from "../../types";

const IS_CUSTODIAL = false;

dotenv.config();
describe("create_topic", () => {
  let hederaApiClient: HederaMirrorNodeClient;
  let networkClientWrapper: NetworkClientWrapper;
  let txExecutorAccount: AccountData;

  beforeAll(async () => {
    hederaApiClient = new HederaMirrorNodeClient("testnet");

    networkClientWrapper = new NetworkClientWrapper(
      process.env.HEDERA_ACCOUNT_ID!,
      process.env.HEDERA_PRIVATE_KEY!,
      process.env.HEDERA_KEY_TYPE!,
      "testnet"
    );

    // Create a test account
    const startingHbars = 5;
    const autoAssociation = -1; // unlimited auto association
    txExecutorAccount = await networkClientWrapper.createAccount(
      startingHbars,
      autoAssociation
    );
  })

  describe("create_topic", () => {
    it("should create topic", async () => {
      const MEMO = "Hello world";
      const prompt = {
        user: "user",
        text: `Create a topic with memo "${MEMO}"`,
      };

      const langchainAgent = await LangchainAgent.create();

      console.log(`Prompt: ${prompt.text}`);
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

      // STEP 4: verify that the topic was created correctly
      const topicId = await hederaApiClient.getTransactionDetails(
        formatTxHash(executedTx.txHash),
      ).then((tx) => tx.entity_id);

      const topic = await hederaApiClient.getTopic(topicId);

      expect(topic.memo).toEqual(MEMO);
      expect(!!topic.submit_key).toBeFalsy();
    });

    it("should create topic with submit key", async () => {
      const MEMO = "Hello world";
      const prompt = {
        user: "user",
        text: `Create a topic with memo "${MEMO}". Restrict posting with a key`,
      };

      const langchainAgent = await LangchainAgent.create();

      console.log(`Prompt: ${prompt.text}`);
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

      // STEP 4: verify that the topic was created correctly
      const topicId = await hederaApiClient.getTransactionDetails(
        formatTxHash(executedTx.txHash),
      ).then((tx) => tx.entity_id);

      const topic = await hederaApiClient.getTopic(topicId);

      expect(topic.memo).toEqual(MEMO);
      expect(!!topic.submit_key).toBeTruthy();
    });

    it("should create topic without submit key", async () => {
      const MEMO = "Hello world";
      const prompt = {
        user: "user",
        text: `Create a topic with memo "${MEMO}". Do not set a submit key`,
      };

      const langchainAgent = await LangchainAgent.create();

      console.log(`Prompt: ${prompt.text}`);
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

      // STEP 4: verify that the topic was created correctly
      const topicId = await hederaApiClient.getTransactionDetails(
        formatTxHash(executedTx.txHash),
      ).then((tx) => tx.entity_id);

      const topic = await hederaApiClient.getTopic(topicId);

      expect(topic.memo).toEqual(MEMO);
      expect(!!topic.submit_key).toBeFalsy();
    });

    afterEach(() => {
      console.log("\n\n");
    })
  });
});
