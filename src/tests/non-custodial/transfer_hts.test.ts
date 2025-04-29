import { describe, expect, it, beforeAll } from "vitest";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { AccountData } from "../utils/testnetUtils";
import { LangchainAgent } from "../utils/langchainAgent";
import { extractTxBytes, formatTxHash, signAndExecuteTx, wait } from "../utils/utils";
import { ExecutorAccountDetails } from "../../types";

const IS_CUSTODIAL = false;

describe("transfer_token_tool (non-custodial)", async () => {
  let acc1: AccountData;
  let acc2: AccountData;
  let acc3: AccountData;
  let txExecutorAccount: AccountData;
  let token1: string;
  let token2: string;
  let hederaApiClient: HederaMirrorNodeClient;
  let networkClientWrapper: NetworkClientWrapper;
  let executorCustodialClientWrapper: NetworkClientWrapper;
  let testCases: [string, number, string, string][];

  beforeAll(async () => {
    dotenv.config();
    try {
      networkClientWrapper = new NetworkClientWrapper(
        process.env.HEDERA_ACCOUNT_ID!,
        process.env.HEDERA_PRIVATE_KEY!,
        process.env.HEDERA_KEY_TYPE!,
        "testnet"
      );

      // Create test accounts
      await Promise.all([
        networkClientWrapper.createAccount(0, -1),
        networkClientWrapper.createAccount(0, -1),
        networkClientWrapper.createAccount(0, -1),
        networkClientWrapper.createAccount(30, -1), // txExecutorAccount needs to have 30 HBARs to pay for the tx gas
      ]).then(([_acc1, _acc2, _acc3, _acc4]) => {
        acc1 = _acc1;
        acc2 = _acc2;
        acc3 = _acc3;
        txExecutorAccount = _acc4;
      });

      // a custodial client wrapper for the tx executor account is required for creating tokens before the test
      executorCustodialClientWrapper = new NetworkClientWrapper(
        txExecutorAccount.accountId,
        txExecutorAccount.privateKey,
        'ECDSA', // .createAccount() creates account with ECDSA key
        "testnet"
      );

      // Create test tokens
      await Promise.all([
        executorCustodialClientWrapper.createFT({
          name: "TestToken1",
          symbol: "TT1",
          initialSupply: 1000000,
          decimals: 2,
        }),
        executorCustodialClientWrapper.createFT({
          name: "TestToken2",
          symbol: "TT2",
          initialSupply: 2000,
          decimals: 0,
        }),
      ]).then(([_token1, _token2]) => {
        token1 = _token1;
        token2 = _token2;
      });

      hederaApiClient = new HederaMirrorNodeClient("testnet");

      // Define test cases using created accounts and tokens
      // Operate on display units
      testCases = [
        [
          acc1.accountId,
          12.5,
          token1,
          `Transfer 12.5 tokens ${token1} to the account ${acc1.accountId}`,
        ],
        [
          acc2.accountId,
          10,
          token2,
          `Send 10 tokens ${token2} to account ${acc2.accountId}.`,
        ],
        [
          acc3.accountId,
          3,
          token1,
          `Transfer exactly 3 of token ${token1} to ${acc3.accountId}.`,
        ],
      ];

      await wait(5000); // wait for the mirror node to be updated with new accounts and tokens
    } catch (error) {
      console.error("Error in setup:", error);
      throw error;
    }
  });

  describe("token transfers", () => {
    it("should process token transfers for dynamically created accounts", async () => {
      for (const [
        receiversAccountId,
        transferAmountInDisplayUnits,
        tokenId,
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
        const balanceExecutorBeforeInDisplayUnits =
          await hederaApiClient.getTokenBalance(executorAccountDetails.executorAccountId!, tokenId);
        const balanceExecutorBeforeInBaseUnits = (
          await hederaApiClient.getAccountToken(executorAccountDetails.executorAccountId!, tokenId)
        )?.balance;

        const balanceReceiverBeforeInDisplayUnits = await hederaApiClient.getTokenBalance(
          receiversAccountId,
          tokenId
        );
        const balanceReceiverBeforeInBaseUnits = (
          await hederaApiClient.getAccountToken(receiversAccountId, tokenId)
        )?.balance ?? 0;

        const tokenDetails = await hederaApiClient.getTokenDetails(tokenId);

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
        const balanceExecutorAfterInDisplayUnits =
          await hederaApiClient.getTokenBalance(executorAccountDetails.executorAccountId!, tokenId);
        const balanceExecutorAfterInBaseUnits =
          (await hederaApiClient.getAccountToken(executorAccountDetails.executorAccountId!, tokenId))
            ?.balance ?? 0;

        const balanceReceiverAfterInDisplayUnits =
          await hederaApiClient.getTokenBalance(receiversAccountId, tokenId);
        const balanceReceiverAfterInBaseUnits =
          (await hederaApiClient.getAccountToken(receiversAccountId, tokenId))
            ?.balance ?? 0;

        const txReport = await hederaApiClient.getTransactionReport(
          formatTxHash(executedTx.txHash),
          executorAccountDetails.executorAccountId!,
          [receiversAccountId]
        );

        // Compare before and after including the difference due to paid fees
        expect(txReport.status).toEqual("SUCCESS");
        // check if the balance is correct in display units
        expect(balanceExecutorBeforeInDisplayUnits).toEqual(
          balanceExecutorAfterInDisplayUnits + transferAmountInDisplayUnits
        );
        // check if the balance is correct in base units
        expect(balanceExecutorBeforeInBaseUnits).toEqual(
          balanceExecutorAfterInBaseUnits +
            transferAmountInDisplayUnits * 10 ** Number(tokenDetails.decimals)
        );
        // check if the balance is correct in display units for receiver
        expect(balanceReceiverBeforeInDisplayUnits).toEqual(
          balanceReceiverAfterInDisplayUnits - transferAmountInDisplayUnits
        );
        // check if the balance is correct in base units for receiver
        expect(balanceReceiverBeforeInBaseUnits).toEqual(
          balanceReceiverAfterInBaseUnits -
            transferAmountInDisplayUnits * 10 ** Number(tokenDetails.decimals)
        );

        console.log("\n\n");
      }
    });
  });
});
