import { describe, expect, it, beforeAll } from "vitest";
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
describe("dissociate_token (non-custodial)", () => {
  let tokenCreatorAccount: AccountData;
  let token1: string;
  let token2: string;
  let networkClientWrapper: NetworkClientWrapper;
  let testCases: {
    tokenToDissociateId: string;
    promptText: string;
  }[];
  let txExecutorAccount: AccountData;
  let hederaApiClient: HederaMirrorNodeClient;

  beforeAll(async () => {
    try {
      hederaApiClient = new HederaMirrorNodeClient("testnet" as NetworkType);

      networkClientWrapper = new NetworkClientWrapper(
        process.env.HEDERA_ACCOUNT_ID!,
        process.env.HEDERA_PRIVATE_KEY!,
        process.env.HEDERA_KEY_TYPE!,
        "testnet"
      );

      // Create test accounts
      tokenCreatorAccount = await networkClientWrapper.createAccount(
        20, // starting HBARs
        0 // no auto association
      );

      txExecutorAccount = await networkClientWrapper.createAccount(
        5, // starting HBARs
        0 // no auto association
      );

      const tokenCreatorAccountNetworkClientWrapper =
        new NetworkClientWrapper(
          tokenCreatorAccount.accountId,
          tokenCreatorAccount.privateKey,
          "ECDSA",
          "testnet"
        );

      // custodial executor network client wrapper is required for associating tokens that will be dissociated in non-custodial flow
      const executorCustodialAccountNetworkClientWrapper =
        new NetworkClientWrapper(
          txExecutorAccount.accountId,
          txExecutorAccount.privateKey,
          "ECDSA",
          "testnet"
        );

      // create tokens
      await Promise.all([
        tokenCreatorAccountNetworkClientWrapper.createFT({
          name: "TokenToDissociate1",
          symbol: "TTD1",
          initialSupply: 1000,
          decimals: 2,
        }),
        tokenCreatorAccountNetworkClientWrapper.createFT({
          name: "TokenToDissociate2",
          symbol: "TTD2",
          initialSupply: 1000,
          decimals: 2,
        }),
      ]).then(([_token1, _token2]) => {
        token1 = _token1;
        token2 = _token2;
      });

      // associate with those tokens
      await executorCustodialAccountNetworkClientWrapper.associateToken(token1);
      await executorCustodialAccountNetworkClientWrapper.associateToken(token2);

      testCases = [
        {
          tokenToDissociateId: token1,
          promptText: `Dissociate token ${token1} from my account`,
        },
        {
          tokenToDissociateId: token2,
          promptText: `Dissociate token ${token2} from my account`,
        },
      ];
    } catch (error) {
      console.error("Error in setup:", error);
      throw error;
    }
  });

  describe("dissociate token checks", () => {
    it("should dissociate token", async () => {
      for (const { promptText, tokenToDissociateId } of testCases || []) {
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

        // STEP 2: extract tx bytes
        const txBytesString = extractTxBytes(response.messages)

        // STEP 3: verify correctness by signing and executing the tx
        const executedTx = await signAndExecuteTx(
          txBytesString,
          txExecutorAccount.privateKey,
          txExecutorAccount.accountId
        )

        await wait(5000); // wait for the mirror node to update

        // STEP 2: verify correctness by checking that token was dissociated
        const token = await hederaApiClient.getAccountToken(
          networkClientWrapper.getAccountId(),
          tokenToDissociateId
        );

        expect(token).toBeUndefined();

        console.log('\n\n');
      }
    });
  });
});
