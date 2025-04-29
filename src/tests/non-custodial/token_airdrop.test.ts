import { describe, expect, it, beforeAll } from "vitest";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { AccountData } from "../utils/testnetUtils";
import { LangchainAgent } from "../utils/langchainAgent";
import { extractTxBytes, formatTxHash, signAndExecuteTx, wait } from "../utils/utils";
import { ExecutorAccountDetails } from "../../types";

const IS_CUSTODIAL = false;

describe("Test Token Airdrop", async () => {
  let acc1: AccountData;
  let acc2: AccountData;
  let acc3: AccountData;
  let acc4: AccountData;
  let acc5: AccountData;
  let txExecutorAccount: AccountData;
  let token1: string;
  let token2: string;
  let token3: string;
  let hederaApiClient: HederaMirrorNodeClient;
  let networkClientWrapper: NetworkClientWrapper;
  let executorCustodialClientWrapper: NetworkClientWrapper;
  let testCases: [string[], number, string, string][];

  beforeAll(async () => {
    dotenv.config();
    try {
      hederaApiClient = new HederaMirrorNodeClient("testnet");

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
        networkClientWrapper.createAccount(0, -1),
        networkClientWrapper.createAccount(0, -1),
        networkClientWrapper.createAccount(30, -1),
      ]).then(([_acc1, _acc2, _acc3, _acc4, _acc5, _acc6]) => {
        acc1 = _acc1;
        acc2 = _acc2;
        acc3 = _acc3;
        acc4 = _acc4;
        acc5 = _acc5;
        txExecutorAccount = _acc6;
      });

      executorCustodialClientWrapper = new NetworkClientWrapper(
        txExecutorAccount.accountId,
        txExecutorAccount.privateKey,
        'ECDSA', // .createAccount() creates account with ECDSA key
        "testnet"
      );

      // Create test tokens
      await Promise.all([
        executorCustodialClientWrapper.createFT({
          name: "AirdropToken",
          symbol: "ADT",
          initialSupply: 10000000,
          decimals: 2,
        }),
        executorCustodialClientWrapper.createFT({
          name: "AirdropToken2",
          symbol: "ADT2",
          initialSupply: 10000,
          decimals: 0,
        }),
        executorCustodialClientWrapper.createFT({
          name: "AirdropToken3",
          symbol: "ADT3",
          initialSupply: 10000000,
          decimals: 3,
        }),
      ]).then(([_token1, _token2, _token3]) => {
        token1 = _token1;
        token2 = _token2;
        token3 = _token3;
      });

      // Define test cases using created accounts and tokens
      testCases = [
        [
          [acc1.accountId, acc2.accountId, acc3.accountId],
          10,
          token1,
          `Airdrop 10 tokens ${token1} to accounts ${acc1.accountId}, ${acc2.accountId}, ${acc3.accountId}`,
        ],
        [
          [acc1.accountId, acc2.accountId, acc3.accountId],
          2,
          token2,
          `Send token airdrop of 2 tokens ${token2} to accounts ${acc1.accountId}, ${acc2.accountId}, ${acc3.accountId}`,
        ],
        [
          [
            acc1.accountId,
            acc2.accountId,
            acc3.accountId,
            acc4.accountId,
            acc5.accountId,
          ],
          3,
          token3,
          `Make airdrop of 3 tokens  ${token3} to accounts ${acc1.accountId}, ${acc2.accountId}, ${acc3.accountId}, ${acc4.accountId}, ${acc5.accountId}`,
        ],
      ];

      await wait(5000); // wait for the mirror node to be updated with new accounts and tokens

    } catch (error) {
      console.error("Error in setup:", error);
      throw error;
    }
  });

  describe("token airdrops", () => {
    it("should process airdrop for dynamically created accounts", async () => {
      for (const [
        receiversAccountsIds,
        transferAmount,
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
        const balanceExecutorBefore = await hederaApiClient.getTokenBalance(
          executorAccountDetails.executorAccountId!,
          tokenId
        );

        const balancesOfReceiversBefore = new Map<string, number>();
        for (const id of receiversAccountsIds) {
          const balance = await hederaApiClient.getTokenBalance(id, tokenId);
          balancesOfReceiversBefore.set(id, balance);
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

        const balanceExecutorAfter = await hederaApiClient.getTokenBalance(
          executorAccountDetails.executorAccountId!,
          tokenId
        );

        const balancesOfReceiversAfter = new Map<string, number>(
          await Promise.all(
            receiversAccountsIds.map(async (id): Promise<[string, number]> => {
              const balance = await hederaApiClient.getTokenBalance(
                id,
                tokenId
              );
              return [id, balance];
            })
          )
        );

        const txReport = await hederaApiClient.getTransactionReport(
          formatTxHash(executedTx.txHash),
          executorAccountDetails.executorAccountId!,
          receiversAccountsIds
        );

        // Compare before and after including the difference due to paid fees
        expect(txReport.status).toEqual("SUCCESS");
        expect(balanceExecutorBefore).toEqual(
          balanceExecutorAfter + transferAmount * receiversAccountsIds.length
        );
        receiversAccountsIds.forEach((id) =>
          expect(balancesOfReceiversBefore.get(id)).toEqual(
            balancesOfReceiversAfter.get(id)! - transferAmount
          )
        );

        console.log('\n\n');
      }
    });
  });
});
