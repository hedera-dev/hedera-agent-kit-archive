import { Tool, ToolRunnableConfig } from "@langchain/core/tools";
import HederaAgentKit from "../../../agent";
import { TopicId } from "@hashgraph/sdk";
import { convertStringToTimestamp } from "../../../utils/date-format-utils";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";

export class HederaGetTopicMessagesTool extends Tool {
    name = 'hedera_get_topic_messages'

    description = `Get messages from a topic on Hedera within an optional time range.

Inputs (input is a JSON string):
- topicId: string, the ID of the topic to get the messages from e.g. "0.0.123456"
- lowerThreshold: string (optional), ISO date string for the start of the time range e.g. "2025-01-02T00:00:00.000Z"
- upperThreshold: string (optional), ISO date string for the end of the time range e.g. "2025-01-20T12:50:30.123Z"

Example usage:
1. Get all messages from topic 0.0.123456:
  '{
    "topicId": "0.0.123456"
  }'

2. Get messages from topic after January 2, 2025:
  '{
    "topicId": "0.0.123456",
    "lowerThreshold": "2025-01-02T00:00:00.000Z"
  }'

3. Get messages between two dates: 2024-03-05T13:40:00.000Z and 2025-01-20T12:50:30.123Z
  '{
    "topicId": "0.0.123456", 
    "lowerThreshold": "2024-03-05T13:40:00.000Z",
    "upperThreshold": "2025-01-20T12:50:30.123Z"
  }'
`

    constructor(private hederaKit: HederaAgentKit) {
        super()
    }

    protected override async _call(input: any, _runManager?: CallbackManagerForToolRun, config?: ToolRunnableConfig): Promise<string> {
        try {
            console.log('hedera_get_topic_messages tool has been called');

            const parsedInput = JSON.parse(input);
            const unixLowerTimestamp = parsedInput.lowerThreshold !== undefined ? convertStringToTimestamp(parsedInput.lowerThreshold) : undefined;
            const unixUpperTimestamp = parsedInput.upperThreshold !== undefined ? convertStringToTimestamp(parsedInput.upperThreshold) : undefined;

            const messages = await this.hederaKit.getTopicMessages(
                TopicId.fromString(parsedInput.topicId),
                process.env.HEDERA_NETWORK_TYPE as "mainnet" | "testnet" | "previewnet" || "testnet",
                unixLowerTimestamp,
                unixUpperTimestamp
            );
            return JSON.stringify({
                status: "success",
                message: "Topic messages retrieved",
                messages: messages
            });
        } catch (error: any) {
            return JSON.stringify({
                status: "error",
                message: error.message,
                code: error.code || "UNKNOWN_ERROR",
            });
        }
    }
}