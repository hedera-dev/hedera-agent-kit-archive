import { Tool, ToolRunnableConfig } from "@langchain/core/tools";
import HederaAgentKit from "../../../agent";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { prepareExecutorAccountDetails } from "../../../utils/langchain-tools-utils";

export class HederaMintNFTTool extends Tool {
    name = 'hedera_mint_nft';

    description = `Mint an NFT to an account on Hedera
Inputs (input is a JSON string):
tokenId: string, the ID of the token to mint e.g. 0.0.123456,
tokenMetadata: string, the metadata of the NFT e.g. "My NFT",
Example usage:
1. Mint an NFT with metadata "My NFT" to token 0.0.123456:
  '{
    "tokenId": "0.0.123456",
    "tokenMetadata": "My NFT"
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

            console.log(`hedera_mint_nft tool has been called (${isCustodial ? 'custodial' : 'non-custodial'})`);

            const parsedInput = JSON.parse(input);
            return await this.hederaKit.mintNFTToken(
                  parsedInput.tokenId,
                  new TextEncoder().encode(parsedInput.tokenMetadata),
                  isCustodial,
                  executorAccountDetails,
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
