import { Tool, ToolRunnableConfig } from "@langchain/core/tools";
import HederaAgentKit from "../../../agent";
import { HederaNetworkType } from "../../../types";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { toDisplayUnit } from "../../../utils/hts-format-utils";
import { prepareExecutorAccountDetails } from "../../../utils/langchain-tools-utils";

export class HederaGetHtsBalanceTool extends Tool {
    name = 'hedera_get_hts_balance'

    description = `Retrieves the balance of a specified Hedera Token Service (HTS) token for a given account in display unit.  
If an account ID is provided, it returns the balance of that account.  
If no account ID is given, it returns the balance for the connected account.

### **Inputs** (JSON string, required fields specified):  
- **tokenId** (*string*, required): The ID of the token to check the balance for (e.g., "0.0.112233").  
- **accountId** (*string*, optional): The Hedera account ID to check the balance for (e.g., "0.0.789012").  
  - If omitted, the tool will return the balance for the connected account.


### **Example Usage:**  
1. **Get balance of token 0.0.112233 for account "0.0.123456:**  
   '{ "accountId": "0.0.123456", "tokenId":"0.0.112233"}'  
2. **Get balance of of token 0.0.11223 for the connected account:**  
   '{"tokenId":"0.0.112233"}'
`

    constructor(private hederaKit: HederaAgentKit) {
        super()
    }

    protected override async _call(input: any, _runManager?: CallbackManagerForToolRun, config?: ToolRunnableConfig): Promise<string> {
        try {
            const isCustodial = config?.configurable?.isCustodial === true;
            const executorAccountDetails = await prepareExecutorAccountDetails(
              isCustodial,
              config?.configurable?.executorAccountDetails,
              this.hederaKit.network
            );

            console.log('hedera_get_hts_balance tool has been called')

            const parsedInput = JSON.parse(input);
            if (!parsedInput.tokenId) {
                throw new Error("tokenId is required");
            }
            if(!process.env.HEDERA_NETWORK_TYPE) {
                throw new Error("HEDERA_NETWORK_TYPE environment variable is required");
            }

            const balance = await this.hederaKit.getHtsBalance(
                parsedInput.tokenId,
                process.env.HEDERA_NETWORK_TYPE as HederaNetworkType,
                parsedInput?.accountId,
                isCustodial,
                executorAccountDetails
            )

            const details = await this.hederaKit.getHtsTokenDetails(
                parsedInput?.tokenId,
                process.env.HEDERA_NETWORK_TYPE as HederaNetworkType,
            )

            const displayUnitBalance = await toDisplayUnit(details.token_id, balance, this.hederaKit.network);

            return JSON.stringify({
                status: "success",
                balance: displayUnitBalance.toNumber(), // in display unit
                unit: details.symbol
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