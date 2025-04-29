import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import { describe, expect, it, beforeAll } from "vitest";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { AccountData } from "../utils/testnetUtils";
import { DetailedTokenBalance } from "../types";
import { LangchainAgent } from "../utils/langchainAgent";
import { wait } from "../utils/utils";
import { ExecutorAccountDetails } from "../../types";

const IS_CUSTODIAL = false;

const extractBalances = (messages: any[]): DetailedTokenBalance[] => {
  const result = messages.reduce((acc, { content }) => {
    try {
      const response = JSON.parse(content);
      console.log(response);
      if (response.status === "error") {
        throw new Error(response.message);
      }

      if (!response?.balances) {
        throw new Error("Balance not found");
      }
      return response.balances as DetailedTokenBalance[];
    } catch {
      return acc;
    }
  }, "");

  if (!Array.isArray(result)) {
    throw new Error("No balances");
  }

  return result;
};

describe("get_all_balances (non-custodial)", () => {
  let acc1: AccountData;
  let acc2: AccountData;
  let acc3: AccountData;
  let txExecutorAccount: AccountData;
  let token1: string;
  let token2: string;
  let hederaApiClient: HederaMirrorNodeClient;
  let testCases: [string, string][];

  beforeAll(async () => {
    dotenv.config();
    try {    
      const networkClientWrapper = new NetworkClientWrapper(
        process.env.HEDERA_ACCOUNT_ID!,
        process.env.HEDERA_PRIVATE_KEY!,
        process.env.HEDERA_KEY_TYPE!,
        "testnet"
      );

      // Create accounts
      await Promise.all([
        networkClientWrapper.createAccount(0, -1),
        networkClientWrapper.createAccount(0, -1),
        networkClientWrapper.createAccount(0, -1),
        networkClientWrapper.createAccount(0, -1),
      ]).then(([_acc1, _acc2, _acc3, _acc4]) => {
        acc1 = _acc1;
        acc2 = _acc2;
        acc3 = _acc3;
        txExecutorAccount = _acc4;
      });

      // Create tokens
      await Promise.all([
        networkClientWrapper.createFT({
          name: "MyToken",
          symbol: "MTK",
          initialSupply: 1000,
          decimals: 2,
        }),
        networkClientWrapper.createFT({
          name: "MyToken2",
          symbol: "MTK2",
          initialSupply: 2000,
          decimals: 0,
        }),
      ]).then(([_token1, _token2]) => {
        token1 = _token1;
        token2 = _token2;
      });

      // Transfer tokens to accounts
      await Promise.all([ 
        networkClientWrapper.transferToken(acc1.accountId, token1, 100),
        networkClientWrapper.transferToken(acc2.accountId, token2, 123),
        networkClientWrapper.transferToken(acc3.accountId, token2, 10),
        networkClientWrapper.transferToken(acc3.accountId, token1, 7),
        networkClientWrapper.transferToken(txExecutorAccount.accountId, token1, 17),
      ]);

      hederaApiClient = new HederaMirrorNodeClient("testnet");

      testCases = [
        [
          acc1.accountId,
          `Show me the balances of all tokens for wallet ${acc1.accountId}`,
        ],
        [
          acc2.accountId,
          `What are the token balances for wallet ${acc2.accountId}`,
        ],
        [
          acc3.accountId,
          `Show me all token balances for account ${acc3.accountId}`,
        ],
        [txExecutorAccount.accountId, "Show me all your token balances."],
        [txExecutorAccount.accountId, "Show me all my token balances."],
      ];
    } catch (error) {
      console.error("Error in setup:", error);
      throw error;
    }
  });

  /*
  This action is not a typical non-custodial action. It does not require creation of any transaction, therefore no txBytes are returned.
  This action fetches data from the hedera mirror node and returns the balances of all tokens for the given account.
  If no account is provided, the Executor account is used by default in non-custodial flow, whereas in custodial flow, the operator account is used.
   */
  describe("balance checks", () => {
    it("should test all token balances", async () => {
      for (const [accountId, promptText] of testCases) {
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

        // STEP 2: extract balances
        const tokensBalanceFromLangchain = extractBalances(response.messages);

        // STEP 3: verify with balances from hedera mirror node
        const allTokensBalances =
          await hederaApiClient.getAllTokensBalances(accountId);

        const formattedBalances = allTokensBalances.map((token) => ({
          ...token,
          balanceInDisplayUnit: token.balanceInDisplayUnit.toString(),
        }));

        formattedBalances.forEach((token) => {
          const correspondingTokenFromLangchain = tokensBalanceFromLangchain.find(
            ({ tokenId: elizaTokenId }) => elizaTokenId === token.tokenId
          );
          expect(correspondingTokenFromLangchain?.tokenId).toEqual(token.tokenId);
          expect(correspondingTokenFromLangchain?.balance).toEqual(token.balance);
          expect(correspondingTokenFromLangchain?.tokenName).toEqual(
            token.tokenName
          );
          expect(correspondingTokenFromLangchain?.tokenSymbol).toEqual(
            token.tokenSymbol
          );
        });

        console.log("\n\n");
      }
    });
  });
});
