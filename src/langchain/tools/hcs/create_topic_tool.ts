import { Tool, ToolRunnableConfig } from "@langchain/core/tools";
import HederaAgentKit from "../../../agent";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { prepareExecutorAccountDetails } from "../../../utils/langchain-tools-utils";

export class HederaCreateTopicTool extends Tool {

    name = 'hedera_create_topic'

    description = `Create a topic on Hedera
Inputs ( input is a JSON string ):
name: string, the name of the topic e.g. My Topic,
isSubmitKey: boolean, decides whether submit key should be set, false if not passed
Example usage:
1. Create a topic with memo "My Topic":
  '{
    "name": "My Topic",
    "isSubmitKey": false
  }'
2. Create a topic with memo "My Topic". Restrict posting with a key:
  '{
    "name": "My Topic",
    "isSubmitKey": true
  }'
3. Create a topic with memo "My Topic". Do not set a submit key:
  '{
    "name": "My Topic",
    "isSubmitKey": false
  }'
`

    constructor(private hederaKit: HederaAgentKit) {
        super();
    }

    protected override async _call(input: any, _runManager?: CallbackManagerForToolRun, config?: ToolRunnableConfig):  Promise<string> {
        try {
            const isCustodial = config?.configurable?.isCustodial === true;
            const executorAccountDetails = await prepareExecutorAccountDetails(
              isCustodial,
              config?.configurable?.executorAccountDetails,
              this.hederaKit.network
            );

            console.log(`hedera_create_topic tool has been called (${isCustodial ? 'custodial' : 'non-custodial'})`);

            const parsedInput = JSON.parse(input);
            return await this.hederaKit
                .createTopic(
                  parsedInput.name,
                  parsedInput.isSubmitKey,
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
