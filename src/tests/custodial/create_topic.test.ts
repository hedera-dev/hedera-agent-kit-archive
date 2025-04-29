import { describe, it, expect } from "vitest";
import * as dotenv from "dotenv";
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
describe("create_topic", () => {
  const hederaMirrorNodeClient = new HederaMirrorNodeClient(
    process.env.HEDERA_NETWORK_TYPE as "testnet" | "mainnet" | "previewnet"
  );

  describe("create_topic", () => {
    it("should create topic", async () => {
      const MEMO = "Hello world";
      const prompt = {
        user: "user",
        text: `Create a topic with memo "${MEMO}"`,
      };

      const langchainAgent = await LangchainAgent.create();

      const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);
      console.log(JSON.stringify(response, null, 2));
      const topicId = extractTopicId(response.messages);
      await wait(5000);

      const topic = await hederaMirrorNodeClient.getTopic(topicId);
      expect(topic.memo).toEqual(MEMO);
      expect(!!topic.submit_key).toBeFalsy();
    });

    it("should create topic with submit key", async () => {
      const MEMO = "Hello world";
      const prompt = {
        user: "user",
        text: `Create a topic with memo "${MEMO}". Restrict posting with a key`,
      };

      const langchainAgent = await LangchainAgent.create();
      const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);
      const topicId = extractTopicId(response.messages);
      await wait(5000);

      const topic = await hederaMirrorNodeClient.getTopic(topicId);

      expect(topic.memo).toEqual(MEMO);
      expect(!!topic.submit_key).toBeTruthy();
    });

    it("should create topic without submit key", async () => {
      const MEMO = "Hello world";
      const prompt = {
        user: "user",
        text: `Create a topic with memo "${MEMO}". Do not set a submit key`,
      };

      const langchainAgent = await LangchainAgent.create();
      const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);
      const topicId = extractTopicId(response.messages);
      await wait(5000);

      const topic = await hederaMirrorNodeClient.getTopic(topicId);

      expect(topic.memo).toEqual(MEMO);
      expect(!!topic.submit_key).toBeFalsy();
    });
  });
});
