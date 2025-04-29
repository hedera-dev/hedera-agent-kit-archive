import { describe, expect, it, beforeAll } from "vitest";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { AccountData } from "../utils/testnetUtils";
import { LangchainAgent } from "../utils/langchainAgent";
import { ExecutorAccountDetails } from "../../types";
import { wait } from "../utils/utils";

interface TestCase {
  promptText: string;
  holders: { accountId: string; balance: string }[];
}

interface TokenData {
  account: string;
  balance: number;
  decimals: number;
}

const IS_CUSTODIAL = false;

const extractHoldersData = (messages: any[]): TokenData[] => {
  const result = messages.reduce((acc, { content }) => {
    try {
      const response = JSON.parse(content);

      return response.holders as TokenData[];
    } catch {
      return acc;
    }
  }, "");

  if (!Array.isArray(result)) {
    throw new Error("Holders not found");
  }

  return result;
};

describe("get_list_of_token_holders (non-custodial)", () => {
  let acc1: AccountData;
  let acc2: AccountData;
  let acc3: AccountData;
  let txExecutorAccount: AccountData;
  let tokenCreatorAccount: AccountData;
  let token1: string;
  let token2: string;
  let testCases: TestCase[];
  let thresholdTestCases: TestCase[];
  let networkClientWrapper: NetworkClientWrapper;

  beforeAll(async () => {
    dotenv.config();
    try {
      networkClientWrapper = new NetworkClientWrapper(
        process.env.HEDERA_ACCOUNT_ID!,
        process.env.HEDERA_PRIVATE_KEY!,
        process.env.HEDERA_KEY_TYPE!,
        "testnet"
      );

      await Promise.all([
        networkClientWrapper.createAccount(0, -1),
        networkClientWrapper.createAccount(0, -1),
        networkClientWrapper.createAccount(0, -1),
        networkClientWrapper.createAccount(0, -1),
        networkClientWrapper.createAccount(30, -1), // the token creator account requires initial HBAR balance to pay transaction fees
      ]).then(([account1, account2, account3, account4, account5]) => {
        acc1 = account1;
        acc2 = account2;
        acc3 = account3;
        txExecutorAccount = account4;
        tokenCreatorAccount = account5;
      });

      await wait(3000); // wait for accounts to be created

      const tokenCreatorAccountNetworkClientWrapper =
        new NetworkClientWrapper(
          tokenCreatorAccount.accountId,
          tokenCreatorAccount.privateKey,
          "ECDSA",
          "testnet"
        );

      await Promise.all([
        tokenCreatorAccountNetworkClientWrapper.createFT({
          name: "MyToken1",
          symbol: "MTK1",
          initialSupply: 1000,
          decimals: 2,
        }),
        tokenCreatorAccountNetworkClientWrapper.createFT({
          name: "MyToken2",
          symbol: "MTK2",
          initialSupply: 1000, // base unit
          decimals: 2,
        }),
      ]).then(([t1, t2]) => {
        token1 = t1;
        token2 = t2;
      });

      await Promise.all([
        tokenCreatorAccountNetworkClientWrapper.transferToken(acc1.accountId, token1, 10), // base unit
        tokenCreatorAccountNetworkClientWrapper.transferToken(acc2.accountId, token1, 20),
        tokenCreatorAccountNetworkClientWrapper.transferToken(acc3.accountId, token1, 30),
        tokenCreatorAccountNetworkClientWrapper.transferToken(acc1.accountId, token2, 40),
        tokenCreatorAccountNetworkClientWrapper.transferToken(acc2.accountId, token2, 50),
        tokenCreatorAccountNetworkClientWrapper.transferToken(acc3.accountId, token2, 60),
        tokenCreatorAccountNetworkClientWrapper.transferToken(txExecutorAccount.accountId, token2, 60),
      ]);

      testCases = [
        {
          holders: [
            { accountId: acc1.accountId, balance: "0.1" }, // balance is given in the display unit
            { accountId: acc2.accountId, balance: "0.2" },
            { accountId: acc3.accountId, balance: "0.3" },
            {
              accountId: tokenCreatorAccount.accountId,
              balance: "9.4",
            },
          ],
          promptText: `Who owns token ${token1} and what are their balances?`,
        },
        {
          holders: [
            { accountId: acc1.accountId, balance: "0.4" },
            { accountId: acc2.accountId, balance: "0.5" },
            { accountId: acc3.accountId, balance: "0.6" },
            { accountId: txExecutorAccount.accountId, balance: "0.6" },
            {
              accountId: tokenCreatorAccount.accountId,
              balance: "7.9",
            },
          ],
          promptText: `Who owns token ${token2} and what are their balances?`,
        },
      ];

      thresholdTestCases = [
        {
          holders: [
            { accountId: acc3.accountId, balance: "0.3" },
            {
              accountId: tokenCreatorAccount.accountId,
              balance: "9.4",
            },
          ],
          promptText: `Which wallets hold token ${token1} and have at least 0.3 tokens?`,
        },
        {
          holders: [
            { accountId: acc3.accountId, balance: "0.6" },
            { accountId: txExecutorAccount.accountId, balance: "0.6" },
            {
              accountId: tokenCreatorAccount.accountId,
              balance: "7.9",
            },
          ],
          promptText: `Show me the token holders for ${token2} with balances greater or equal 0.6.`,
        },
      ];
    } catch (error) {
      console.error("Error in setup:", error);
      throw error;
    }
  });

  /*
  This action is not a typical non-custodial action. It does not require creation of any transaction, therefore, no txBytes are returned.
  This action fetches data from the hedera mirror node and returns a list of holders for the given token.
  */
  describe("get list of token holders checks", () => {
    it("should get list of token holders", async () => {
      for (const { promptText, holders } of testCases) {
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

        // STEP 1: send non-custodial prompt
        const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL, executorAccountDetails);

        console.log(JSON.stringify(response, null, 2));

        // STEP 2: extract holders from response
        const langchainResponseHolders = extractHoldersData(response.messages);
        console.log(JSON.stringify(langchainResponseHolders, null, 2));

        // STEP 3: verify the correctness
        expect(langchainResponseHolders.length).toBe(holders.length);

        langchainResponseHolders.forEach((holder) => {
          const relevantHolder = holders.find(
            (h) => h.accountId === holder.account
          );
          expect(relevantHolder?.balance).toEqual(holder.balance);
          expect(relevantHolder?.accountId).toEqual(holder.account);
        });

        console.log('\n\n');
      }
    });

    it("should get list of token holders with threshold", async () => {
      for (const { promptText, holders } of thresholdTestCases) {
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

        // STEP 1: send non-custodial prompt
        const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL, executorAccountDetails);

        // STEP 2: extract holders from response
        const langchainResponseHolders = extractHoldersData(response.messages);

        // STEP 3: verify the correctness
        expect(langchainResponseHolders.length).toBe(holders.length);

        langchainResponseHolders.forEach((holder) => {
          const relevantHolder = holders.find(
            (h) => h.accountId === holder.account
          );
          expect(relevantHolder?.balance).toEqual(holder.balance);
          expect(relevantHolder?.accountId).toEqual(holder.account);
        });

        console.log('\n\n');
      }
    });
  });
});
