import { Tool, ToolRunnableConfig } from "@langchain/core/tools";
import HederaAgentKit from "../../../agent";
import { toBaseUnit } from "../../../utils/hts-format-utils";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { prepareExecutorAccountDetails } from "../../../utils/langchain-tools-utils";

export class HederaTransferTokenTool extends Tool {
    name = 'hedera_transfer_token';

    description = `Transfer fungible tokens on Hedera
Inputs (input is a JSON string):
tokenId: string, the ID of the token to transfer e.g. 0.0.123456,
toAccountId: string, the account ID to transfer to e.g. 0.0.789012,
amount: number, the amount of tokens to transfer e.g. 100 in base unit
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

            console.log(`hedera_transfer_token tool has been called (${isCustodial ? 'custodial' : 'non-custodial'})`);

            const parsedInput = JSON.parse(input);
            const amount = await toBaseUnit(parsedInput.tokenId, parsedInput.amount, this.hederaKit.network);
            return this.hederaKit
                .transferToken(
                  parsedInput.tokenId,
                  parsedInput.toAccountId,
                  Number(amount.toString()),
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
