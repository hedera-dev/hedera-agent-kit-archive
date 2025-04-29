import { describe, expect, it, beforeAll } from "vitest";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { AccountData } from "../utils/testnetUtils";
import { LangchainAgent } from "../utils/langchainAgent";
import { wait } from "../utils/utils";

const IS_CUSTODIAL = true;

describe("get_hbar_balance", () => {
  let acc1: AccountData;
  let acc2: AccountData;
  let acc3: AccountData;
  let langchainAgent: LangchainAgent;
  let hederaApiClient: HederaMirrorNodeClient;
  let testCases: [string, string][];

  beforeAll(async () => {
    dotenv.config();
    try {
      const wrapper = new NetworkClientWrapper(
        process.env.HEDERA_ACCOUNT_ID!,
        process.env.HEDERA_PRIVATE_KEY!,
        process.env.HEDERA_KEY_TYPE!,
        "testnet"
      );
      acc1 = await wrapper.createAccount(1);
      acc2 = await wrapper.createAccount(0.3);
      acc3 = await wrapper.createAccount(0);

      langchainAgent = await LangchainAgent.create();
      hederaApiClient = new HederaMirrorNodeClient(
        process.env.HEDERA_NETWORK_TYPE as "testnet" | "mainnet" | "previewnet"
      );
      testCases = [
        [acc1.accountId, `What's HBAR balance for ${acc1.accountId}`],
        [acc2.accountId, `How much HBARs has ${acc2.accountId}`],
        [acc3.accountId, `Check HBAR balance of wallet ${acc3.accountId}`],
      ];
    } catch (error) {
      console.error("Error in setup:", error);
      throw error;
    }
  });

  describe("balance checks", () => {
    it("should test dynamic account balances", async () => {
      for (const [accountId, promptText] of testCases) {
        const prompt = {
          user: "user",
          text: promptText,
        };

        const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);
        let hederaActionBalance: number;

        const match = response.messages[
          response.messages.length - 1
        ].text.match(/(\d+\.\d+|\d+)\s*HBAR/);

        if (match) {
          hederaActionBalance = parseFloat(match[1]);
        } else {
          throw new Error(
            "No match for HBAR balance found in response."
          );
        }
        const accountInfo = await hederaApiClient.getAccountInfo(accountId);
        const accountBalanceInBaseUnits = accountInfo.balance.balance;
        const mirrorNodeBalanceInDisplayUnits =
          await hederaApiClient.getHbarBalance(accountId);

        const HBAR_DECIMALS = 8;
        // compare balance in display units
        expect(hederaActionBalance).toEqual(mirrorNodeBalanceInDisplayUnits);
        // compare balance in base units
        expect(hederaActionBalance * 10 ** HBAR_DECIMALS).toEqual(accountBalanceInBaseUnits);

        await wait(1000);
      }
    });
  });
});
