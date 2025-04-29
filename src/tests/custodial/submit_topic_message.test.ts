import { describe, expect, it, beforeAll } from "vitest";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import { LangchainAgent } from "../utils/langchainAgent";
import { wait } from "../utils/utils";

const IS_CUSTODIAL = true;

const extractTopicId = (messages: any[]): string => {
  const result = messages.reduce((acc, message) => {
    try {
      const parsedMessage = JSON.parse(message.content);
      if (parsedMessage.topicId) {
        return parsedMessage.topicId;
      }
      return acc;
    } catch (error) {
      return acc;
    }
  }, "");

  if (!result) {
    throw new Error("No topic ID found");
  }

  return result;
};

dotenv.config();
describe("submit_topic_message", () => {
  let topic1: string;
  let topic2: string;
  let topic3: string;
  const MESSAGE1: string = "Message1";
  const MESSAGE2: string = "Message2";
  const MESSAGE3: string = "Message3";
  let testCases: { textPrompt: string; topicId: string; message: string }[];
  let networkClientWrapper: NetworkClientWrapper;
  const hederaMirrorNodeClient = new HederaMirrorNodeClient(
    process.env.HEDERA_NETWORK_TYPE as "testnet" | "mainnet" | "previewnet"
  );

  beforeAll(async () => {
    try {
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
          textPrompt: `Submit message ${MESSAGE1} to topic ${topic1}`,
          topicId: topic1,
          message: MESSAGE1,
        },
        {
          textPrompt: `Submit message ${MESSAGE2} to topic ${topic2}`,
          topicId: topic2,
          message: MESSAGE2,
        },
        {
          textPrompt: `Submit message ${MESSAGE3} to topic ${topic3}`,
          topicId: topic3,
          message: MESSAGE3,
        },
      ];
    } catch (error) {
      console.error("Error in setup:", error);
      throw error;
    }
  });

  describe("submit topic message checks", () => {
    it("should submit message to topic", async () => {
      for (const {
        textPrompt,
        message,
        topicId: expectedTopicId,
      } of testCases) {
        const prompt = {
          user: "user",
          text: textPrompt,
        };

        const langchainAgent = await LangchainAgent.create();
        const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);
        console.log(JSON.stringify(response, null, 2));
        const extractedTopicId = extractTopicId(response.messages);
        await wait(5000);

        const topicMessages =
          await hederaMirrorNodeClient.getTopicMessages(extractedTopicId);

        const receivedMessage = topicMessages.find(({ message: _message }) => {
          return message === _message;
        });

        expect(expectedTopicId).toEqual(extractedTopicId);
        expect(receivedMessage).toBeTruthy();
      }
    });
  });
});
