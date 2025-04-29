import { describe, expect, it, beforeAll } from "vitest";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { AccountData } from "../utils/testnetUtils";
import { LangchainAgent } from "../utils/langchainAgent";
import { formatTxHash, wait } from "../utils/utils";

const IS_CUSTODIAL = true;

interface TransferDetailsFromToolResponse {
  status: string;
  message: string;
  tokenId: string;
  toAccountId: string;
  amount: number;
  txHash: string;
  decimals: number;
}

const extractTransferDetails = (
  messages: any[]
): TransferDetailsFromToolResponse | null => {
  return messages.reduce((acc, { content }) => {
    try {
      const response = JSON.parse(content);

      if (response.status === "error") {
        throw new Error(response.message);
      }

      return response as TransferDetailsFromToolResponse;
    } catch {
      return acc;
    }
  }, null);
};


describe("Test Token transfer", async () => {
  let acc1: AccountData;
  let acc2: AccountData;
  let acc3: AccountData;
  let token1: string;
  let token2: string;
  let hederaApiClient: HederaMirrorNodeClient;
  let networkClientWrapper: NetworkClientWrapper;
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
      ]).then(([_acc1, _acc2, _acc3]) => {
        acc1 = _acc1;
        acc2 = _acc2;
        acc3 = _acc3;
      });

      // Create test tokens
      await Promise.all([
        networkClientWrapper.createFT({
          name: "TestToken1",
          symbol: "TT1",
          initialSupply: 1000000,
          decimals: 2,
        }),
        networkClientWrapper.createFT({
          name: "TestToken2",
          symbol: "TT2",
          initialSupply: 2000,
          decimals: 0,
        }),
      ]).then(([_token1, _token2]) => {
        token1 = _token1;
        token2 = _token2;
      });

      await wait(5000);

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
        const agentsAccountId = process.env.HEDERA_ACCOUNT_ID;

        if (!agentsAccountId || receiversAccountId === agentsAccountId) {
          throw new Error(
            "Note that transfers cant be done to the operator account address."
          );
        }

        const tokenDetails = await hederaApiClient.getTokenDetails(tokenId);

        const balanceAgentBeforeInDisplayUnits =
          await hederaApiClient.getTokenBalance(agentsAccountId, tokenId);
        const balanceAgentBeforeInBaseUnits = (
          await hederaApiClient.getAccountToken(agentsAccountId, tokenId)
        )?.balance;

        const balanceReceiverBeforeInDisplayUnits = await hederaApiClient.getTokenBalance(
          receiversAccountId,
          tokenId
        );

        const balanceReceiverBeforeInBaseUnits = (
          await hederaApiClient.getAccountToken(receiversAccountId, tokenId)
        )?.balance ?? 0;

        const prompt = {
          user: "user",
          text: promptText,
        };

        const langchainAgent = await LangchainAgent.create();
        const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);
        const transferDetails = extractTransferDetails(response.messages);
        const formattedTxHash = formatTxHash(transferDetails?.txHash ?? "");

        if (!formattedTxHash) {
          throw new Error("No match for transaction hash found in response.");
        }

        await wait(5000);

        const balanceAgentAfterInDisplayUnits =
          await hederaApiClient.getTokenBalance(agentsAccountId, tokenId);

        const balanceAgentAfterInBaseUnits =
          (await hederaApiClient.getAccountToken(agentsAccountId, tokenId))
            ?.balance ?? 0;

        const balanceReceiverAfterInDisplayUnits =
          await hederaApiClient.getTokenBalance(receiversAccountId, tokenId);

        const balanceReceiverAfterInBaseUnits =
          (await hederaApiClient.getAccountToken(receiversAccountId, tokenId))
            ?.balance ?? 0;

        const txReport = await hederaApiClient.getTransactionReport(
          formattedTxHash,
          agentsAccountId,
          [receiversAccountId]
        );

        // Compare before and after including the difference due to paid fees
        expect(txReport.status).toEqual("SUCCESS");
        // check if balance is correct in display units
        expect(balanceAgentBeforeInDisplayUnits).toEqual(
          balanceAgentAfterInDisplayUnits + transferAmountInDisplayUnits
        );
        // check if balance is correct in base units
        expect(balanceAgentBeforeInBaseUnits).toEqual(
          balanceAgentAfterInBaseUnits +
            transferAmountInDisplayUnits * 10 ** Number(tokenDetails.decimals)
        );
        // check if balance is correct in display units for receiver
        expect(balanceReceiverBeforeInDisplayUnits).toEqual(
          balanceReceiverAfterInDisplayUnits - transferAmountInDisplayUnits
        );
        // check if balance is correct in base units for receiver
        expect(balanceReceiverBeforeInBaseUnits).toEqual(
          balanceReceiverAfterInBaseUnits -
            transferAmountInDisplayUnits * 10 ** Number(tokenDetails.decimals)
        );
        await wait(1000);
      }
    });
  });
});
