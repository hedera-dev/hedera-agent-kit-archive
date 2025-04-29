import { describe, expect, it, beforeAll } from "vitest";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import { NetworkType } from "../types";
import { LangchainAgent } from "../utils/langchainAgent";
import { TopicInfoApiResponse } from "../../types";
import { wait } from "../utils/utils";

const IS_CUSTODIAL = true;

function extractTopicInfo(messages: any[]): TopicInfoApiResponse {
  const result = messages.reduce((acc, message) => {
    try {
      const parsedMessage = JSON.parse(message.content);
      if (parsedMessage.topicInfo) {
        return parsedMessage.topicInfo;
      }
      return acc;
    } catch (error) {
      return acc;
    }
  }, "");

  if (!result) {
    throw new Error("No topic info found");
  }

  return result as TopicInfoApiResponse;
}

dotenv.config();
describe("get_topic_info", () => {
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
          textPrompt: `Give me the info for topic ${topic1}`,
          topicId: topic1,
        },
        {
          textPrompt: `Give me the details about topic ${topic2}`,
          topicId: topic2,
        },
        {
          textPrompt: `I'd like to see the status of topic ${topic3}`,
          topicId: topic3,
        },
      ];
    } catch (error) {
      console.error("Error in setup:", error);
      throw error;
    }
  });

  describe("get topic info checks", () => {
    it("should get topic info", async () => {
      for (const { textPrompt } of testCases) {
        const prompt = {
          user: "user",
          text: textPrompt,
        };

        const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);
        await wait(5000);

        const topicInfo = extractTopicInfo(response.messages);
        const topicId = topicInfo.topic_id ?? "";
        const mirrorNodeTopicInfo =
          await hederaMirrorNodeClient.getTopic(topicId);

        expect(topicId).toBe(mirrorNodeTopicInfo.topic_id);
        expect(topicInfo.memo).toBe(mirrorNodeTopicInfo.memo);
        expect(topicInfo.admin_key?.key).toBe(
          mirrorNodeTopicInfo.admin_key?.key
        );
        expect(topicInfo.admin_key?._type).toBe(
          mirrorNodeTopicInfo.admin_key?._type
        );
        expect(topicInfo.timestamp?.from).toBe(
          mirrorNodeTopicInfo.timestamp.from
        );
        expect(topicInfo.timestamp?.to).toBe(mirrorNodeTopicInfo.timestamp.to);
      }
    });
  });
});
