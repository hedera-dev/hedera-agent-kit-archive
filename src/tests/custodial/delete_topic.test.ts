import { describe, expect, it, beforeAll } from "vitest";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import { NetworkType } from "../types";
import { LangchainAgent } from "../utils/langchainAgent";
import { wait } from "../utils/utils";

const IS_CUSTODIAL = true;

dotenv.config();
describe("delete_topic", () => {
  let topic1: string;
  let topic2: string;
  let topic3: string;
  let langchainAgent: LangchainAgent;
  let testCases: { textPrompt: string; topicId: string }[];
  let networkClientWrapper: NetworkClientWrapper;
  const hederaMirrorNodeClient = new HederaMirrorNodeClient(
    process.env.HEDERA_NETWORK_TYPE as NetworkType
  );

  beforeAll(async () => {
    try {
      langchainAgent = await LangchainAgent.create();

      networkClientWrapper = new NetworkClientWrapper(
        process.env.HEDERA_ACCOUNT_ID!,
        process.env.HEDERA_PRIVATE_KEY!,
        process.env.HEDERA_KEY_TYPE!,
        "testnet"
      );

      await Promise.all([
        networkClientWrapper.createTopic("Hello world 1", true),
        networkClientWrapper.createTopic("Hello world 2", true),
        networkClientWrapper.createTopic("Hello world 3", true),
      ]).then(([_topic1, _topic2, _topic3]) => {
        topic1 = _topic1.topicId;
        topic2 = _topic2.topicId;
        topic3 = _topic3.topicId;
      });

      testCases = [
        {
          textPrompt: `Delete topic with id ${topic1}`,
          topicId: topic1,
        },
        {
          textPrompt: `Delete topic with id ${topic2}`,
          topicId: topic2,
        },
        {
          textPrompt: `Delete topic with id ${topic3}`,
          topicId: topic3,
        },
      ];
    } catch (error) {
      console.error("Error in setup:", error);
      throw error;
    }
  });

  describe("delete topic checks", () => {
    it("should delete topic", async () => {
      for (const { textPrompt, topicId } of testCases) {
        const prompt = {
          user: "user",
          text: textPrompt,
        };

        await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);
        await wait(5000);

        const topicInfo = await hederaMirrorNodeClient.getTopic(topicId);

        expect(topicInfo.deleted).toBe(true);
      }
    });
  });
});
