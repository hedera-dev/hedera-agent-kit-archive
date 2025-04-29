import { describe, expect, it, beforeAll } from "vitest";
import { LangchainAgent } from "../utils/langchainAgent";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { AccountData } from "../utils/testnetUtils";
import { wait } from "../utils/utils";

const IS_CUSTODIAL = true;

const extractTokenBalance = (messages: any[]) => {
  return messages.reduce((acc, { content }) => {
    try {
      const response = JSON.parse(content);

      if (response.status === "error") {
        throw new Error(response.message);
      }

      return String(response.balance);
    } catch {
      return acc;
    }
  }, "");
};

describe("get_hts_balance", () => {
  let acc1: AccountData;
  let acc2: AccountData;
  let acc3: AccountData;
  let token1: string;
  let token2: string;
  let langchainAgent: LangchainAgent;
  let hederaApiClient: HederaMirrorNodeClient;
  let testCases: [string, string, string][];

  beforeAll(async () => {
    dotenv.config();
    try {
      langchainAgent = await LangchainAgent.create();

      const networkClientWrapper = new NetworkClientWrapper(
        process.env.HEDERA_ACCOUNT_ID!,
        process.env.HEDERA_PRIVATE_KEY!,
        process.env.HEDERA_KEY_TYPE!,
        "testnet"
      );

      await Promise.all([
        networkClientWrapper.createAccount(0, -1),
        networkClientWrapper.createAccount(0, -1),
        networkClientWrapper.createAccount(0, -1),
      ]).then(([_acc1, _acc2, _acc3]) => {
        acc1 = _acc1;
        acc2 = _acc2;
        acc3 = _acc3;
      });

      token1 = await networkClientWrapper.createFT({
        name: "MyToken",
        symbol: "MTK",
        initialSupply: 1000,
        decimals: 2,
      });
      token2 = await networkClientWrapper.createFT({
        name: "MyToken2",
        symbol: "MTK2",
        initialSupply: 2000,
        decimals: 0,
      });

      await Promise.all([
        networkClientWrapper.transferToken(acc1.accountId, token1, 100),
        networkClientWrapper.transferToken(acc2.accountId, token2, 123),
        networkClientWrapper.transferToken(acc3.accountId, token2, 10),
        networkClientWrapper.transferToken(acc3.accountId, token1, 7),
      ]);
      await wait(5000);
      hederaApiClient = new HederaMirrorNodeClient("testnet");

      testCases = [
        [
          acc1.accountId,
          token1,
          `What's balance of token ${token1} for ${acc1.accountId}`,
        ],
        [
          acc2.accountId,
          token2,
          `How many tokens with id ${token2} account ${acc2.accountId} has`,
        ],
        [
          acc3.accountId,
          token2,
          `Check balance of token ${token2} for wallet ${acc3.accountId}`,
        ],
        [
          acc1.accountId,
          token2,
          `What's balance of ${token2} for ${acc1.accountId}`,
        ],
        [
          acc3.accountId,
          token1,
          `What is the token balance of ${token1} account ${acc3.accountId} has`,
        ],
        [
          acc3.accountId,
          token2,
          `Check balance of token ${token2} for wallet ${acc3.accountId}`,
        ],
      ];
    } catch (error) {
      console.error("Error in setup:", error);
      throw error;
    }
  });

  describe("balance checks", () => {
    it("should test dynamic token balances", async () => {
      for (const [accountId, tokenId, promptText] of testCases) {
        const prompt = {
          user: "user",
          text: promptText,
        };

        const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);
        await wait(5000);

        const hederaActionBalanceInDisplayUnits = extractTokenBalance(response.messages);
        const mirrorNodeBalanceInDisplayUnits = await hederaApiClient.getTokenBalance(
          accountId,
          tokenId
        );

        const mirrorNodeBalanceInBaseUnits = (await hederaApiClient.getAccountToken(
          accountId,
          tokenId
        ))?.balance ?? 0;

        const decimals = (await hederaApiClient.getTokenDetails(tokenId))?.decimals;
        const hederaActionBalanceInBaseUnits = (Number(hederaActionBalanceInDisplayUnits) * 10 ** Number(decimals)).toFixed(0);

        expect(String(hederaActionBalanceInDisplayUnits)).toEqual(String(mirrorNodeBalanceInDisplayUnits));
        expect(hederaActionBalanceInBaseUnits).toEqual(String(mirrorNodeBalanceInBaseUnits));
      }
    });
  });
});
