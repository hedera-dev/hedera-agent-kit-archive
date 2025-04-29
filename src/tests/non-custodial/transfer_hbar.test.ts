import { describe, expect, it, beforeAll } from "vitest";
import { LangchainAgent } from "../utils/langchainAgent";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { AccountData } from "../utils/testnetUtils";
import { extractTxBytes, formatTxHash, signAndExecuteTx, wait } from "../utils/utils";
import { ExecutorAccountDetails } from "../../types";

const IS_CUSTODIAL = false;

describe("Test HBAR transfer (non-custodial)", async () => {
  let acc1: AccountData;
  let acc2: AccountData;
  let acc3: AccountData;
  let txExecutorAccount: AccountData;
  let networkClientWrapper: NetworkClientWrapper;
  let hederaApiClient: HederaMirrorNodeClient;
  let testCases: [string, number, string][];

  beforeAll(async () => {
    dotenv.config();
    try {
      networkClientWrapper = new NetworkClientWrapper(
        process.env.HEDERA_ACCOUNT_ID!,
        process.env.HEDERA_PRIVATE_KEY!,
        process.env.HEDERA_KEY_TYPE!,
        "testnet"
      );
      acc1 = await networkClientWrapper.createAccount(0);
      acc2 = await networkClientWrapper.createAccount(0);
      acc3 = await networkClientWrapper.createAccount(0);
      txExecutorAccount = await networkClientWrapper.createAccount(15); // set up with 15 HBARs

      hederaApiClient = new HederaMirrorNodeClient("testnet");

      testCases = [
        [acc1.accountId, 1, `Transfer 1 HBAR to the account ${acc1.accountId}`],
        [acc2.accountId, 0.5, `Send 0.5 HBAR to account ${acc2.accountId}.`],
        [acc3.accountId, 3, `Transfer exactly 3 HBAR to ${acc3.accountId}.`],
      ];

      await wait(5000); // wait for the mirror node to be updated with new accounts
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
        const prompt = {
          user: "user",
          text: promptText,
        };

        const langchainAgent = await LangchainAgent.create();

        console.log(`Prompt: ${promptText}`);
        console.log(JSON.stringify(txExecutorAccount, null, 2));

        const executorAccountDetails: ExecutorAccountDetails = {
          executorAccountId: txExecutorAccount.accountId,
          executorPublicKey: txExecutorAccount.publicKey,
        }

        // STEP 0: get state before action call
        const balanceExecutorBefore =
          await hederaApiClient.getHbarBalance(executorAccountDetails.executorAccountId!);
        const balanceReceiverBefore =
          await hederaApiClient.getHbarBalance(receiversAccountId);

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

        // STEP 4: verify that the transfer was executed correctly
        const balanceAgentAfter =
          await hederaApiClient.getHbarBalance(executorAccountDetails.executorAccountId!);
        const balanceReceiverAfter =
          await hederaApiClient.getHbarBalance(receiversAccountId);

        const txReport = await hederaApiClient.getTransactionReport(
          formatTxHash(executedTx.txHash),
          executorAccountDetails.executorAccountId!,
          [receiversAccountId]
        );

        // Compare before and after including the difference due to paid fees
        const margin = 0.5;
        expect(txReport.status).toEqual("SUCCESS");
        expect(
          Math.abs(
            balanceExecutorBefore -
              (balanceAgentAfter + transferAmount + txReport.totalPaidFees)
          )
        ).toBeLessThanOrEqual(margin);
        expect(
          Math.abs(
            balanceReceiverBefore - (balanceReceiverAfter - transferAmount)
          )
        ).toBeLessThanOrEqual(margin);

        console.log("\n\n");
      }
    });
  });
});
