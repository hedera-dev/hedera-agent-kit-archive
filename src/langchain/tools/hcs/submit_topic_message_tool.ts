import { Tool, ToolRunnableConfig } from "@langchain/core/tools";
import HederaAgentKit from "../../../agent";
import { TopicId } from "@hashgraph/sdk";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { prepareExecutorAccountDetails } from "../../../utils/langchain-tools-utils";

export class HederaSubmitTopicMessageTool extends Tool {
    name = 'hedera_submit_topic_message';

    description = `Submit a message to a topic on Hedera
Inputs (input is a JSON string):
topicId: string, the ID of the topic to submit the message to e.g. 0.0.123456,
message: string, the message to submit to the topic e.g. "Hello, Hedera!"
Example usage:
1. Submit a message to topic 0.0.123456:
  '{
    "topicId": "0.0.123456",
    "message": "Hello, Hedera!"
  }'
`;

    constructor(private hederaKit: HederaAgentKit) {
        super();
    }

    protected override async _call(input: any, _runManager?: CallbackManagerForToolRun, config?: ToolRunnableConfig): Promise<string> {
        try {
            const isCustodial = config?.configurable?.isCustodial === true;
            const executorAccountDetails = await prepareExecutorAccountDetails(
              isCustodial,
              config?.configurable?.executorAccountDetails,
              this.hederaKit.network
            );

            console.log(`hedera_submit_topic_message tool has been called (${isCustodial ? 'custodial' : 'non-custodial'})`);

            const parsedInput = JSON.parse(input);
            const topicId = TopicId.fromString(parsedInput.topicId);
            return await this.hederaKit
                .submitTopicMessage(
                  topicId,
                  parsedInput.message,
                  isCustodial,
                  executorAccountDetails
                ).then(response => response.getStringifiedResponse());

        } catch (error: any) {
            return JSON.stringify({
                status: "error",
                message: error.message,
                code: error.code || "UNKNOWN_ERROR",
            });
        }
    }
}
