import { Tool, ToolRunnableConfig } from "@langchain/core/tools";
import HederaAgentKit from "../../../agent";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { prepareExecutorAccountDetails } from "../../../utils/langchain-tools-utils";

export class HederaTransferHbarTool extends Tool {
    name = 'hedera_transfer_native_hbar_token';

    description = `Transfer HBAR to an account on Hedera
Inputs (input is a JSON string):
toAccountId: string, the account ID to transfer to e.g. 0.0.789012,
amount: number, the amount of HBAR to transfer e.g. 100,
Example usage:
1. Transfer 100 HBAR to account 0.0.789012:
  '{
    "toAccountId": "0.0.789012",
    "amount": 100
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

            console.log(`hedera_transfer_native_hbar_token tool has been called (${isCustodial ? 'custodial' : 'non-custodial'})`);

            const parsedInput = JSON.parse(input);
            return this.hederaKit
                .transferHbar(
                  parsedInput.toAccountId,
                  parsedInput.amount,
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
