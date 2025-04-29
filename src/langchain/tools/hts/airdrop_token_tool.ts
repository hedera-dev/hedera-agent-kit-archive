import { Tool, ToolRunnableConfig } from "@langchain/core/tools";
import HederaAgentKit from "../../../agent";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { toBaseUnit } from "../../../utils/hts-format-utils";
import { AirdropRecipient } from "../../../tools";
import { prepareExecutorAccountDetails } from "../../../utils/langchain-tools-utils";

export class HederaAirdropTokenTool extends Tool {
    name = 'hedera_airdrop_token';

    description = `Airdrop fungible tokens to multiple accounts on Hedera
Inputs (input is a JSON string):
tokenId: string, the ID of the token to airdrop e.g. 0.0.123456,
recipients: array of objects containing:
  - accountId: string, the account ID to send tokens to e.g. 0.0.789012
  - amount: number, the amount of tokens to send e.g. 100, given in display unit
Example usage:
1. Airdrop 100 tokens to account 0.0.789012 and 200 tokens to account 0.0.789013:
  '{
    "tokenId": "0.0.123456",
    "recipients": [
      { "accountId": "0.0.789012", "amount": 100 },
      { "accountId": "0.0.789013", "amount": 200 }
    ]
}'`;

    constructor(private hederaKit: HederaAgentKit) {
        super();
    }

    protected override async _call(
      input: any,
      _runManager?: CallbackManagerForToolRun,
      config?: ToolRunnableConfig
    ): Promise<string> {
        try {
            const isCustodial = config?.configurable?.isCustodial === true;
            const executorAccountDetails = await prepareExecutorAccountDetails(
              isCustodial,
              config?.configurable?.executorAccountDetails,
              this.hederaKit.network
            );

            console.log(`hedera_airdrop_token tool has been called (${isCustodial ? 'custodial' : 'non-custodial'})`);

            const parsedInput = JSON.parse(input);
            const { tokenId, recipients } = parsedInput;

            if (!Array.isArray(recipients)) {
                throw new Error("Invalid 'recipients' array in input");
            }

            const parsedRecipients: AirdropRecipient[] = await Promise.all(
              recipients.map(async (recipient: { accountId: string; amount: number }) => {
                  const amountInBaseUnit = await toBaseUnit(tokenId, recipient.amount, this.hederaKit.network);
                  return {
                      accountId: recipient.accountId,
                      amount: amountInBaseUnit.toNumber(),
                  };
              })
            );

            const result = await this.hederaKit.airdropToken(
              tokenId,
              parsedRecipients,
              isCustodial,
              executorAccountDetails
            );

            return result.getStringifiedResponse();

        } catch (error: any) {
            return JSON.stringify({
                status: "error",
                message: error.message,
                code: error.code || "UNKNOWN_ERROR",
            });
        }
    }
}
