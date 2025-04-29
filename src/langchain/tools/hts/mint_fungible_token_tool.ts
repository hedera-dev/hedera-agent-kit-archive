import { Tool, ToolRunnableConfig } from "@langchain/core/tools";
import HederaAgentKit from "../../../agent";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { HederaNetworkType } from "../../../types";
import { toBaseUnit } from "../../../utils/hts-format-utils";
import { prepareExecutorAccountDetails } from "../../../utils/langchain-tools-utils";

export class HederaMintFungibleTokenTool extends Tool {
    name = 'hedera_mint_fungible_token';

    description = `Mint fungible tokens to an account on Hedera
Inputs (input is a JSON string):
tokenId: string, the ID of the token to mint e.g. 0.0.123456,
amount: number, the amount of tokens to mint e.g. 100,
Example usage:
1. Mint 100 of token 0.0.123456 to account 0.0.789012:
  '{
    "tokenId": "0.0.123456",
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

            console.log(`hedera_mint_fungible_token tool has been called (${isCustodial ? 'custodial' : 'non-custodial'})`);

            const parsedInput = JSON.parse(input);

            const details = await this.hederaKit.getHtsTokenDetails(
              parsedInput?.tokenId,
              process.env.HEDERA_NETWORK_TYPE as HederaNetworkType,
            )

            const displayUnitAmount = await toBaseUnit(details.token_id, parsedInput.amount, this.hederaKit.network);

            return await this.hederaKit
                .mintToken(parsedInput.tokenId, displayUnitAmount.toNumber(), isCustodial, executorAccountDetails)
                .then(response => response.getStringifiedResponse());
        } catch (error: any) {
            return JSON.stringify({
                status: "error",
                message: error.message,
                code: error.code || "UNKNOWN_ERROR",
            });
        }
    }
}
