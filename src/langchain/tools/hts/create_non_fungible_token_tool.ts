import { Tool, ToolRunnableConfig } from "@langchain/core/tools";
import HederaAgentKit from "../../../agent";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { prepareExecutorAccountDetails } from "../../../utils/langchain-tools-utils";


// FIXME: works well in isolation but normally usually createFT is called instead of createNFT
export class HederaCreateNonFungibleTokenTool extends Tool {
    name = 'hedera_create_non_fungible_token';

    description = `Create a non-fungible (NFT) token on Hedera.

Inputs (input is a JSON string):
- name: string (e.g. "My Token")
- symbol: string (e.g. "MT")
- maxSupply: number (optional), the maximum supply of the token. If not provided, this field will be omitted in the response.
- isMetadataKey: boolean, determines whether a metadata key should be set. Defaults to \`false\` if not provided.
- isAdminKey: boolean, determines whether an admin key should be set. Defaults to \`false\` if not provided.
- memo: string, containing a memo associated with the token. Defaults to an empty string if not provided.
- tokenMetadata: string, containing metadata associated with the token. Defaults to an empty string if not provided.
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

            console.log(`hedera_create_non_fungible_token tool has been called (${isCustodial ? 'custodial' : 'non-custodial'})`);

            const parsedInput = JSON.parse(input);
            const options = {
                name: parsedInput.name,
                symbol: parsedInput.symbol,
                maxSupply: parsedInput.maxSupply,
                isAdminKey: parsedInput.isAdminKey,
                isMetadataKey: parsedInput.isMetadataKey,
                memo: parsedInput.memo,
                tokenMetadata: new TextEncoder().encode(parsedInput.tokenMetadata),
            };

            return await this.hederaKit
                .createNFT(options, isCustodial, executorAccountDetails)
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
