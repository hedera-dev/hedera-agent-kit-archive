import { describe, expect, it, beforeAll } from "vitest";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { AccountData } from "../utils/testnetUtils";
import { LangchainAgent } from "../utils/langchainAgent";
import { formatTxHash } from "../utils/utils";
import { wait } from "../utils/utils";


interface AirdropLangchainResponse {
  status: string;
  message: string;
  tokenId: string;
  recipientCount: number;
  totalAmount: number;
  txHash: string;
}

const IS_CUSTODIAL = true;

function extractLangchainResponse(
  messages: any[]
): AirdropLangchainResponse | null {
  const toolMessages = messages.filter(
    (msg) =>
      (msg.id && msg.id[2] === "ToolMessage") ||
      msg.name === "hedera_airdrop_token"
  );

  for (const message of toolMessages) {
    try {
      const toolResponse = JSON.parse(message.content);

      if (toolResponse.status !== "success" || !toolResponse.txHash) {
        throw new Error(toolResponse.message ?? "Unknown error");
      }

      return toolResponse as AirdropLangchainResponse;
    } catch (error) {
      console.error("Error parsing tool message:", error);
    }
  }

  return null;
}

describe("Test Token Airdrop", async () => {
  let acc1: AccountData;
  let acc2: AccountData;
  let acc3: AccountData;
  let acc4: AccountData;
  let acc5: AccountData;
  let token1: string;
  let token2: string;
  let token3: string;
  let langchainAgent: LangchainAgent;
  let hederaApiClient: HederaMirrorNodeClient;
  let networkClientWrapper: NetworkClientWrapper;
  let testCases: [string[], number, string, string][];

  beforeAll(async () => {
    dotenv.config();
    try {
      langchainAgent = await LangchainAgent.create();
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
      ]).then(([_acc1, _acc2, _acc3, _acc4, _acc5]) => {
        acc1 = _acc1;
        acc2 = _acc2;
        acc3 = _acc3;
        acc4 = _acc4;
        acc5 = _acc5;
      });

      // Create test tokens
      await Promise.all([
        networkClientWrapper.createFT({
          name: "AirdropToken",
          symbol: "ADT",
          initialSupply: 10000000,
          decimals: 2,
        }),
        networkClientWrapper.createFT({
          name: "AirdropToken2",
          symbol: "ADT2",
          initialSupply: 10000,
          decimals: 0,
        }),
        networkClientWrapper.createFT({
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

      await wait(5000);
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
        const agentsAccountId = process.env.HEDERA_ACCOUNT_ID;

        if (
          !agentsAccountId ||
          receiversAccountsIds.find((id) => id === agentsAccountId)
        ) {
          throw new Error(
            "Note that airdrops cannot be done to the operator account address."
          );
        }

        console.log(`Fetching balances before test`)

        // Get balances before
        const balanceAgentBefore = await hederaApiClient.getTokenBalance(
          agentsAccountId,
          tokenId
        );

        const balancesOfReceiversBefore = new Map<string, number>();
        for (const id of receiversAccountsIds) {
          const balance = await hederaApiClient.getTokenBalance(id, tokenId);
          balancesOfReceiversBefore.set(id, balance);
        }

        const prompt = {
          user: "user",
          text: promptText,
        };

        const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);
        const airdropResponse = extractLangchainResponse(response.messages);
        const txHash = formatTxHash(airdropResponse?.txHash ?? '');

        // Get balances after transaction being successfully processed by mirror node
        await wait(5000);

        console.log(`Fetching balances after test`)

        const balanceAgentAfter = await hederaApiClient.getTokenBalance(
          agentsAccountId,
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
          txHash,
          agentsAccountId,
          receiversAccountsIds
        );

        // Compare before and after including the difference due to paid fees
        expect(txReport.status).toEqual("SUCCESS");
        expect(balanceAgentBefore).toEqual(
          balanceAgentAfter + transferAmount * receiversAccountsIds.length
        );
        receiversAccountsIds.forEach((id) =>
          expect(balancesOfReceiversBefore.get(id)).toEqual(
            balancesOfReceiversAfter.get(id)! - transferAmount
          )
        );

        await wait(1000);
      }
    });
  });
});
