import { beforeAll, describe, expect, it } from "vitest";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { AccountData } from "../utils/testnetUtils";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import { LangchainAgent } from "../utils/langchainAgent";
import { NetworkType } from "../types";
import { extractTxBytes, signAndExecuteTx, wait } from "../utils/utils";
import { ExecutorAccountDetails } from "../../types";

const IS_CUSTODIAL = false;

dotenv.config();
describe("associate_token (non-custodial)", () => {
  let tokenCreatorAccount: AccountData;
  let txExecutorAccount: AccountData;
  let token1: string;
  let token2: string;
  let networkClientWrapper: NetworkClientWrapper;
  let langchainAgent: LangchainAgent;
  let testCases: {
    tokenToAssociateId: string;
    promptText: string;
  }[];
  let hederaMirrorNodeClient: HederaMirrorNodeClient;

  beforeAll(async () => {
    try {
      langchainAgent = await LangchainAgent.create();
      hederaMirrorNodeClient = new HederaMirrorNodeClient("testnet" as NetworkType);

      networkClientWrapper = new NetworkClientWrapper(
        process.env.HEDERA_ACCOUNT_ID!,
        process.env.HEDERA_PRIVATE_KEY!,
        process.env.HEDERA_KEY_TYPE!,
        "testnet"
      );

      // Create test accounts
      const startingHbars = 20;
      const autoAssociation = -1; // unlimited auto association
      tokenCreatorAccount = await networkClientWrapper.createAccount(
        startingHbars,
        autoAssociation
      );

      txExecutorAccount = await networkClientWrapper.createAccount(
        startingHbars,
        autoAssociation
      );

      const tokenCreatorAccountNetworkClientWrapper =
        new NetworkClientWrapper(
          tokenCreatorAccount.accountId,
          tokenCreatorAccount.privateKey,
          "ECDSA",
          "testnet"
        );

      // create tokens
      await Promise.all([
        tokenCreatorAccountNetworkClientWrapper.createFT({
          name: "TokenToAssociate1",
          symbol: "TTA1",
          initialSupply: 1000,
          decimals: 2,
        }),
        tokenCreatorAccountNetworkClientWrapper.createFT({
          name: "TokenToAssociate2",
          symbol: "TTA2",
          initialSupply: 1000,
          decimals: 2,
        }),
      ]).then(([_token1, _token2]) => {
        token1 = _token1;
        token2 = _token2;
      });


      testCases = [
        {
          tokenToAssociateId: token1,
          promptText: `Associate token ${token1} to my account`,
        },
        {
          tokenToAssociateId: token2,
          promptText: `Associate token ${token2} to my account ${txExecutorAccount.accountId}`,
        },
      ];
    } catch (error) {
      console.error("Error in setup:", error);
      throw error;
    }
  });

  describe("associate token checks", () => {
    it("should associate token", async () => {
      for (const { promptText, tokenToAssociateId } of testCases || []) {
        const prompt = {
          user: "user",
          text: promptText,
        };

        console.log(`Prompt: ${promptText}`);
        console.log(JSON.stringify(txExecutorAccount, null, 2));

        const executorAccountDetails: ExecutorAccountDetails = {
          executorAccountId: txExecutorAccount.accountId,
          executorPublicKey: txExecutorAccount.publicKey,
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

        await wait(5000); // wait for the mirror node to update the account info

        // STEP 4: verify that token was associated
        const token = await hederaMirrorNodeClient.getAccountToken(
          txExecutorAccount.accountId,
          tokenToAssociateId
        );

        expect(executedTx.status).toBe("SUCCESS");
        expect(token).toBeDefined();

        console.log('\n\n');
      }
    });
  });
});
