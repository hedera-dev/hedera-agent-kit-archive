import { describe, expect, it, beforeAll } from "vitest";
import { NetworkType } from "../types";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import { LangchainAgent } from "../utils/langchainAgent";
import { wait } from "../utils/utils";
import { HCSMessage } from "../../types";

const IS_CUSTODIAL = true;

function extractTopicMessages(messages: any[]): HCSMessage[] {
    const result = messages.reduce<HCSMessage[] | null>((acc, message) => {
        try {
            const toolResponse = JSON.parse(message.content);
            if (toolResponse.status === "success" && toolResponse.messages) {
                return toolResponse.messages as HCSMessage[];
            }

            return acc;

        } catch (error) {
            return acc;
        }
    }, null);

    if (!result) {
        throw new Error("No topic messages found");
    }

    return result;
}


dotenv.config();
describe("get_topic_messages", () => {
    let topic1: string;
    let topic2: string;
    let langchainAgent: LangchainAgent;
    let testCases: {
        textPrompt: string;
        topicId: string;
        range: { lowerTimestamp: string | undefined, upperTimestamp: string | undefined },
        expectedLength: number
    }[];
    let networkClientWrapper: NetworkClientWrapper;
    const hederaMirrorNodeClient = new HederaMirrorNodeClient(
        process.env.HEDERA_NETWORK_TYPE as NetworkType
    );

    beforeAll(async () => {
        try {
            networkClientWrapper = new NetworkClientWrapper(
                process.env.HEDERA_ACCOUNT_ID!,
                process.env.HEDERA_PRIVATE_KEY!,
                process.env.HEDERA_KEY_TYPE!,
                "testnet",
            );

            await Promise.all([
                networkClientWrapper.createTopic("Hello world 1", true),
                networkClientWrapper.createTopic("Hello world 2", true),
            ]).then(([_topic1, _topic2]) => {
                topic1 = _topic1.topicId;
                topic2 = _topic2.topicId;
            });

            const timestampBefore: string = new Date().toISOString();

            await wait(1000);

            await Promise.all([
                networkClientWrapper.submitTopicMessage(topic1, "(1) Test message for topic 1."),
            ]);

            await wait(1000);

            const timestampAfterFirstMsg: string = new Date().toISOString();

            await Promise.all([
                networkClientWrapper.submitTopicMessage(topic1, "(2) Test message for topic 1."),
                networkClientWrapper.submitTopicMessage(topic1, "(3) Test message for topic 1."),
            ]);

            await wait(1000);

            testCases = [
                {
                    textPrompt: `Give me messages from topic ${topic1}  that were posted after ${timestampAfterFirstMsg}`,
                    topicId: topic1,
                    range: { lowerTimestamp: timestampAfterFirstMsg, upperTimestamp: undefined },
                    expectedLength: 2,
                },
                {
                    textPrompt: `Give me messages from topic ${topic1} that were posted before ${timestampBefore}`,
                    topicId: topic1,
                    range: { lowerTimestamp: undefined, upperTimestamp: timestampBefore },
                    expectedLength: 0,
                },
                {
                    textPrompt: `Give me messages from topic ${topic1} that were posted after ${timestampBefore}`,
                    topicId: topic1,
                    range: { lowerTimestamp: timestampBefore, upperTimestamp: undefined },
                    expectedLength: 3,
                },
                {
                    textPrompt: `Give me messages from topic ${topic1} that were posted after ${timestampBefore} and before ${timestampAfterFirstMsg}.`,
                    topicId: topic1,
                    range: { lowerTimestamp: timestampBefore, upperTimestamp: timestampAfterFirstMsg },
                    expectedLength: 1,
                },
                {
                    textPrompt: `Give me messages from topic ${topic2}`,
                    topicId: topic2,
                    range: { lowerTimestamp: undefined, upperTimestamp: undefined },
                    expectedLength: 0,
                },
                {
                    textPrompt: `Give me messages from topic ${topic1}`,
                    topicId: topic1,
                    range: { lowerTimestamp: undefined, upperTimestamp: undefined },
                    expectedLength: 3,
                },
            ];

        } catch (error) {
            console.error("Error in setup:", error);
            throw error;
        }
    });

    describe("get topic messages checks", () => {
        it("should get topic messages", async () => {
            for (const { textPrompt, topicId, range, expectedLength } of testCases) {
                langchainAgent = await LangchainAgent.create();
                const prompt = {
                    user: "user",
                    text: textPrompt,
                };
                console.log(`sending prompt`);
                const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);
                const messages = extractTopicMessages(response.messages);

                await wait(5000);

                const mirrorNodeTopicMessages = await hederaMirrorNodeClient.getTopicMessages(topicId, range);

                if(expectedLength == 0) {
                    expect(mirrorNodeTopicMessages.length).toEqual(0);
                } else {
                    for (const mirrorNodeMessage of mirrorNodeTopicMessages) {
                        expect(topicId).toEqual(mirrorNodeMessage.topic_id);
                        const messageText = mirrorNodeMessage.message;
                        const messageFound = messages.some(msg => msg.message === messageText);

                        expect(messageFound).toBe(true);
                    }
                }
            }
        });
    });
});