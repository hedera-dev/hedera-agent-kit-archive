import { describe, expect, it, beforeAll } from "vitest";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { AccountData } from "../utils/testnetUtils";
import { LangchainAgent } from "../utils/langchainAgent";
import { ExecutorAccountDetails } from "../../types";

const IS_CUSTODIAL = false;

describe("get_hbar_balance", () => {
  let acc1: AccountData;
  let acc2: AccountData;
  let acc3: AccountData;
  let langchainAgent: LangchainAgent;
  let hederaApiClient: HederaMirrorNodeClient;
  let testCases: [string, string][];
  let txExecutorAccount: AccountData;

  beforeAll(async () => {
    dotenv.config();
    try {
      const networkClientWrapper = new NetworkClientWrapper(
        process.env.HEDERA_ACCOUNT_ID!,
        process.env.HEDERA_PRIVATE_KEY!,
        process.env.HEDERA_KEY_TYPE!,
        "testnet"
      );
      // Create a test account
      acc1 = await networkClientWrapper.createAccount(1);
      acc2 = await networkClientWrapper.createAccount(0.3);
      acc3 = await networkClientWrapper.createAccount(0);

      const startingHbars = 1.23;
      const autoAssociation = -1; // unlimited auto association
      txExecutorAccount = await networkClientWrapper.createAccount(
        startingHbars,
        autoAssociation
      );

      hederaApiClient = new HederaMirrorNodeClient(
        process.env.HEDERA_NETWORK_TYPE as "testnet" | "mainnet" | "previewnet"
      );

      testCases = [
        [acc1.accountId, `What's HBAR balance for ${acc1.accountId}`],
        [acc2.accountId, `How much HBARs has ${acc2.accountId}`],
        [acc3.accountId, `Check HBAR balance of wallet ${acc3.accountId}`],
        [txExecutorAccount.accountId, `What's my HBAR balance?`],
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

        langchainAgent = await LangchainAgent.create();

        console.log(`Prompt: ${promptText}`);
        console.log(JSON.stringify(txExecutorAccount, null, 2));

        const executorAccountDetails: ExecutorAccountDetails = {
          executorAccountId: txExecutorAccount.accountId,
          executorPublicKey: txExecutorAccount.publicKey,
        }

        // STEP 1: send non-custodial prompt
        const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL, executorAccountDetails);

        let hederaActionBalance: number;

        // STEP 2: extract response data (this action fetches data from the mirror node, so there is no transaction to sign and execute)')
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
        // STEP 3: verify correctness by comparing the retrieved balance with the one from the mirror node
        const accountInfo = await hederaApiClient.getAccountInfo(accountId);
        const accountBalanceInBaseUnits = accountInfo.balance.balance;
        const mirrorNodeBalanceInDisplayUnits =
          await hederaApiClient.getHbarBalance(accountId);

        const HBAR_DECIMALS = 8;
        // compare balance in display units
        expect(hederaActionBalance).toEqual(mirrorNodeBalanceInDisplayUnits);
        // compare balance in base units
        expect(hederaActionBalance * 10 ** HBAR_DECIMALS).toEqual(accountBalanceInBaseUnits);

        console.log('\n\n');
      }
    });
  });
});
