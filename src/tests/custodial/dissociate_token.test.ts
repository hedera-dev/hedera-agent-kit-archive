import { describe, expect, it, beforeAll } from "vitest";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { AccountData } from "../utils/testnetUtils";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import { LangchainAgent } from "../utils/langchainAgent";
import { NetworkType } from "../types";
import { wait } from "../utils/utils";

const IS_CUSTODIAL = true;

dotenv.config();
describe("dissociate_token", () => {
  let tokenCreatorAccount: AccountData;
  let token1: string;
  let token2: string;
  let networkClientWrapper: NetworkClientWrapper;
  let langchainAgent: LangchainAgent;
  let testCases: {
    tokenToDissociateId: string;
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

      // Create a test account
      const startingHbars = 20;
      const autoAssociation = 0; // no auto association
      tokenCreatorAccount = await networkClientWrapper.createAccount(
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
      await networkClientWrapper.associateToken(token1);
      await networkClientWrapper.associateToken(token2);

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

        console.log(`Prompt: ${promptText}`);

        // STEP 1: send custodial prompt
        const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);

        await wait(5000); // wait for the mirror node to update

        // STEP 2: verify correctness by checking that token was dissociated
        const token = await hederaMirrorNodeClient.getAccountToken(
          networkClientWrapper.getAccountId(),
          tokenToDissociateId
        );

        expect(token).toBeUndefined();

        console.log('\n\n');
      }
    });
  });
});
