import { describe, expect, it, beforeAll } from "vitest";
import { LangchainAgent } from "../utils/langchainAgent";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { AccountData } from "../utils/testnetUtils";
import { formatTxHash, wait } from "../utils/utils";

const IS_CUSTODIAL = true;

const extractTxHash = (messages: any[]) => {
  return messages.reduce((acc, { content }) => {
    try {
      const response = JSON.parse(content);

      if (response.status === "error") {
        throw new Error(response.message);
      }

      return String(response.txHash);
    } catch {
      return acc;
    }
  }, "");
};


describe("Test HBAR transfer", async () => {
  let acc1: AccountData;
  let acc2: AccountData;
  let acc3: AccountData;
  let langchainAgent: LangchainAgent;
  let hederaApiClient: HederaMirrorNodeClient;
  let testCases: [string, number, string][];

  beforeAll(async () => {
    dotenv.config();
    try {
      langchainAgent = await LangchainAgent.create();

      const wrapper = new NetworkClientWrapper(
        process.env.HEDERA_ACCOUNT_ID!,
        process.env.HEDERA_PRIVATE_KEY!,
        process.env.HEDERA_KEY_TYPE!,
        "testnet"
      );
      acc1 = await wrapper.createAccount(0);
      acc2 = await wrapper.createAccount(0);
      acc3 = await wrapper.createAccount(0);

      hederaApiClient = new HederaMirrorNodeClient("testnet");

      testCases = [
        [acc1.accountId, 1, `Transfer 1 HBAR to the account ${acc1.accountId}`],
        [acc2.accountId, 0.5, `Send 0.5 HBAR to account ${acc2.accountId}.`],
        [acc3.accountId, 3, `Transfer exactly 3 HBAR to ${acc3.accountId}.`],
      ];
    } catch (error) {
      console.error("Error in setup:", error);
      throw error;
    }
  });

  describe("balance checks", () => {
    it("should test dynamic HBAR transfers", async () => {
      for (const [
        receiversAccountId,
        transferAmount,
        promptText,
      ] of testCases) {
        const agentsAccountId = process.env.HEDERA_ACCOUNT_ID;

        if (!agentsAccountId || receiversAccountId === agentsAccountId) {
          throw new Error(
            "Env file must be defined! Note that transfers can be done to the operator account address."
          );
        }

        // Get balances before
        const balanceAgentBefore =
          await hederaApiClient.getHbarBalance(agentsAccountId);
        const balanceReceiverBefore =
          await hederaApiClient.getHbarBalance(receiversAccountId);

        // Perform transfer action
        const prompt = {
          user: "user",
          text: promptText,
        };
        const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);
        const txHash = extractTxHash(response.messages);

        // Get balances after transaction being successfully processed by mirror node
        await wait(5000);

        const balanceAgentAfter =
          await hederaApiClient.getHbarBalance(agentsAccountId);
        const balanceReceiverAfter =
          await hederaApiClient.getHbarBalance(receiversAccountId);
        const txReport = await hederaApiClient.getTransactionReport(
          formatTxHash(txHash),
          agentsAccountId,
          [receiversAccountId]
        );

        // Compare before and after including the difference due to paid fees
        const margin = 0.5;
        expect(txReport.status).toEqual("SUCCESS");
        expect(
          Math.abs(
            balanceAgentBefore -
              (balanceAgentAfter + transferAmount + txReport.totalPaidFees)
          )
        ).toBeLessThanOrEqual(margin);
        expect(
          Math.abs(
            balanceReceiverBefore - (balanceReceiverAfter - transferAmount)
          )
        ).toBeLessThanOrEqual(margin);

        await wait(1000);
      }
    });
  });
});
