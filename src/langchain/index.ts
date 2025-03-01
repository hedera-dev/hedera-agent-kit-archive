import { Tool } from "@langchain/core/tools";
import HederaAgentKit from "../agent";
import * as dotenv from "dotenv";
import {HederaNetworkType} from "../types";
import { AccountId, PendingAirdropId, TokenId, TopicId } from "@hashgraph/sdk";
import { OpenAIChat } from "@langchain/openai";


dotenv.config();
export class HederaCreateFungibleTokenTool extends Tool {
  name = 'hedera_create_fungible_token'

  description = `Create a fungible token on Hedera
Inputs ( input is a JSON string ):
name: string, the name of the token e.g. My Token,
symbol: string, the symbol of the token e.g. MT,
decimals: number, the amount of decimals of the token,
initialSupply: number, the initial supply of the token e.g. 100000,
isSupplyKey: boolean, decides whether supply key should be set, false if not passed
isMetadataKey: boolean, decides whether metadata key should be set, false if not passed
isAdminKey: boolean, decides whether admin key should be set, false if not passed
memo: string, containing memo associated with this token, empty string if not passed
tokenMetadata: string, containing metadata associated with this token, empty string if not passed
`

  constructor(private hederaKit: HederaAgentKit) {
    super()
  }

  protected async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);

      const tokenId = (await this.hederaKit.createFT({
        name: parsedInput.name,
        symbol: parsedInput.symbol,
        decimals: parsedInput.decimals,
        initialSupply: parsedInput.initialSupply,
        isSupplyKey: parsedInput.isSupplyKey,
        isAdminKey: parsedInput.isAdminKey,
        isMetadataKey: parsedInput.isMetadataKey,
        memo: parsedInput.memo,
        tokenMetadata: new TextEncoder().encode(parsedInput.tokenMetadata),
      })).tokenId;

      return JSON.stringify({
        status: "success",
        message: "Token creation successful",
        initialSupply: parsedInput.initialSupply,
        tokenId: tokenId.toString(),
        solidityAddress: tokenId.toSolidityAddress(),
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

// FIXME: works well in isolation but normally usually createFT is called instead of createNFT
export class HederaCreateNonFungibleTokenTool extends Tool {
  name = 'hedera_create_fungible_token'

  description = `Create a non fungible (NFT) token on Hedera
Inputs ( input is a JSON string ):
name: string, the name of the token e.g. My Token,
symbol: string, the symbol of the token e.g. MT,
maxSupply: number, the max supply of the token e.g. 100000,
isMetadataKey: boolean, decides whether metadata key should be set, false if not passed
isAdminKey: boolean, decides whether admin key should be set, false if not passed
memo: string, containing memo associated with this token, empty string if not passed
tokenMetadata: string, containing metadata associated with this token, empty string if not passed
`

  constructor(private hederaKit: HederaAgentKit) {
    super()
  }

  protected async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);

      const tokenId = (await this.hederaKit.createNFT({
        name: parsedInput.name,
        symbol: parsedInput.symbol,
        maxSupply: parsedInput.maxSupply,
        isAdminKey: parsedInput.isAdminKey,
        isMetadataKey: parsedInput.isMetadataKey,
        memo: parsedInput.memo,
        tokenMetadata: new TextEncoder().encode(parsedInput.tokenMetadata),
      })).tokenId;

      return JSON.stringify({
        status: "success",
        message: "NFT Token creation successful",
        initialSupply: parsedInput.initialSupply,
        tokenId: tokenId.toString(),
        solidityAddress: tokenId.toSolidityAddress(),
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

export class HederaTransferTokenTool extends Tool {
  name = 'hedera_transfer_token'

  description = `Transfer fungible tokens on Hedera
Inputs ( input is a JSON string ):
tokenId: string, the ID of the token to transfer e.g. 0.0.123456,
toAccountId: string, the account ID to transfer to e.g. 0.0.789012,
amount: number, the amount of tokens to transfer e.g. 100
`

  constructor(private hederaKit: HederaAgentKit) {
    super()
  }

  protected async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);

      await this.hederaKit.transferToken(
        parsedInput.tokenId,
        parsedInput.toAccountId,
        parsedInput.amount
      );

      return JSON.stringify({
        status: "success",
        message: "Token transfer successful",
        tokenId: parsedInput.tokenId,
        toAccountId: parsedInput.toAccountId,
        amount: parsedInput.amount
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

export class HederaGetBalanceTool extends Tool {
  name = 'hedera_get_hbar_balance'

  description = `Retrieves the HBAR balance of a specified Hedera account.  
If an account ID is provided, it returns the balance of that account.  
If no input is given (empty JSON '{}'), it returns the balance of the connected account.  

### **Inputs** (optional, input is a JSON string):  
- **accountId** (*string*, optional): The Hedera account ID to check the balance for (e.g., "0.0.789012").  
  - If omitted, the tool will return the balance of the connected account.  

### **Example Usage:**  
1. **Get balance of a specific account:**  
   '{ "accountId": "0.0.123456" }'  
2. **Get balance of the connected account:**  
   '{}'
`


constructor(private hederaKit: HederaAgentKit) {

    super()
  }

  protected async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);

      const balance = await this.hederaKit.getHbarBalance(parsedInput?.accountId);

      return JSON.stringify({
        status: "success",
        balance: balance,
        unit: "HBAR"
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

export class HederaGetHtsBalanceTool extends Tool {
  name = 'hedera_get_hts_balance'

  description = `Retrieves the balance of a specified Hedera Token Service (HTS) token for a given account.  
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

  protected async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);
      if (!parsedInput.tokenId) {
        throw new Error("tokenId is required");
      }

      if (!process.env.HEDERA_NETWORK) {
        throw new Error("HEDERA_NETWORK environment variable is required");
      }

      const balance = await this.hederaKit.getHtsBalance(
          parsedInput.tokenId,
          process.env.HEDERA_NETWORK as HederaNetworkType,
          parsedInput?.accountId
      )

      const details = await this.hederaKit.getHtsTokenDetails(
          parsedInput?.tokenId,
          process.env.HEDERA_NETWORK as HederaNetworkType
      )

      return JSON.stringify({
        status: "success",
        balance: balance,
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

export class HederaAirdropTokenTool extends Tool {
  name = 'hedera_airdrop_token'

  description = `Airdrop fungible tokens to multiple accounts on Hedera
Inputs ( input is a JSON string ):
tokenId: string, the ID of the token to airdrop e.g. 0.0.123456,
recipients: array of objects containing:
  - accountId: string, the account ID to send tokens to e.g. 0.0.789012
  - amount: number, the amount of tokens to send e.g. 100
Example usage:
1. Airdrop 100 tokens to account 0.0.789012 and 200 tokens to account 0.0.789013:
  '{
    "tokenId": "0.0.123456",
    "recipients": [
    {"accountId": "0.0.789012", "amount": 100},
    {"accountId": "0.0.789013", "amount": 200}
  ]
}'
`

  constructor(private hederaKit: HederaAgentKit) {
    super()
  }

  protected async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);

      await this.hederaKit.airdropToken(
        parsedInput.tokenId,
        parsedInput.recipients
      );

      return JSON.stringify({
        status: "success",
        message: "Token airdrop successful",
        tokenId: parsedInput.tokenId,
        recipientCount: parsedInput.recipients.length,
        totalAmount: parsedInput.recipients.reduce((sum: number, r: any) => sum + r.amount, 0)
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

export class HederaAssociateTokenTool extends Tool { 
  name = 'hedera_associate_token'

  description = `Associate a token to an account on Hedera
Inputs ( input is a JSON string ):
tokenId: string, the ID of thee token to associate e.g. 0.0.123456,
Example usage:
1. Associate token 0.0.123456:
  '{
    "tokenId": "0.0.123456"
  }'
`

  constructor(private hederaKit: HederaAgentKit) {
    super()
  }

  protected async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);

      await this.hederaKit.associateToken(
        parsedInput.tokenId
      );

      return JSON.stringify({
        status: "success",
        message: "Token association successful",
        tokenId: parsedInput.tokenId
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

export class HederaDissociateTokenTool extends Tool {
  name = 'hedera_dissociate_token'

  description = `Dissociate a token from an account on Hedera
Inputs ( input is a JSON string ):
tokenId: string, the ID of the token to dissociate e.g. 0.0.123456,
Example usage:
1. Dissociate token 0.0.123456:
  '{
    "tokenId": "0.0.123456"
  }'
`

  constructor(private hederaKit: HederaAgentKit) {
    super()
  }

  protected async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);

      await this.hederaKit.dissociateToken(
        parsedInput.tokenId
      );

      return JSON.stringify({
        status: "success",
        message: "Token dissociation successful",
        tokenId: parsedInput.tokenId
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

export class HederaRejectTokenTool extends Tool {
  name = 'hedera_reject_token'

  description = `Reject a token from an account on Hedera
Inputs ( input is a JSON string ):
tokenId: string, the ID of the token to reject e.g. 0.0.123456,
Example usage:
1. Reject token 0.0.123456:
  '{
    "tokenId": "0.0.123456"
  }'
`

  constructor(private hederaKit: HederaAgentKit) {
    super()
  }

  protected async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);

      await this.hederaKit.rejectToken(
        TokenId.fromString(parsedInput.tokenId)
      );

      return JSON.stringify({
        status: "success",
        message: "Token rejection successful",
        tokenId: parsedInput.tokenId
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

export class HederaMintFungibleTokenTool extends Tool {
  name = 'hedera_mint_fungible_token'

  description = `Mint fungible tokens to an account on Hedera
Inputs ( input is a JSON string ):
tokenId: string, the ID of the token to mint e.g. 0.0.123456,
amount: number, the amount of tokens to mint e.g. 100,
Example usage:
1. Mint 100 of token 0.0.123456 to account 0.0.789012:
  '{
    "tokenId": "0.0.123456",
    "amount": 100
  }'
`

  constructor(private hederaKit: HederaAgentKit) {
    super()
  }

  protected async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);

      await this.hederaKit.mintToken(
        parsedInput.tokenId,
        parsedInput.amount
      );

      return JSON.stringify({
        status: "success",
        message: "Token minting successful",
        tokenId: parsedInput.tokenId,
        amount: parsedInput.amount
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
export class HederaTransferHbarTool extends Tool {
  name = 'hedera_transfer_hbar'

  description = `Transfer HBAR to an account on Hedera
Inputs ( input is a JSON string ):
toAccountId: string, the account ID to transfer to e.g. 0.0.789012 or EVM address 0x257B2457b10C02d393458393515F51dc8880300d,
amount: number, the amount of HBAR to transfer e.g. 100,
Example usage:
1. Transfer 100 HBAR to account 0.0.789012:
  '{
    "toAccountId": "0.0.789012",
    "amount": 100
  }
2. Transfer 100 HBAR to EVM address 0x257B2457b10C02d393458393515F51dc8880300d:
  '{
    "toAccountId": "0x257B2457b10C02d393458393515F51dc8880300d",
    "amount": 100
  }'
`

  constructor(private hederaKit: HederaAgentKit) {
    super()
  }

  protected async _call(input: string): Promise<string> {
    try {
      console.log(input);
      const parsedInput = JSON.parse(input);

      await this.hederaKit.transferHbar(
        parsedInput.toAccountId,
        parsedInput.amount
      );
      return JSON.stringify({
        status: "success",
        message: "HBAR transfer successful",
        toAccountId: parsedInput.toAccountId,
        amount: parsedInput.amount
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
export class HederaMintNFTTool extends Tool {
  name = 'hedera_mint_nft'

  description = `Mint an NFT to an account on Hedera
Inputs ( input is a JSON string ):
tokenId: string, the ID of the token to mint e.g. 0.0.123456,
tokenMetadata: string, the metadata of the NFT e.g. "My NFT",
Example usage:
1. Mint an NFT with metadata "My NFT" to token 0.0.123456:
  '{
    "tokenId": "0.0.123456",
    "tokenMetadata": "My NFT"
  }
}
`

  constructor(private hederaKit: HederaAgentKit) {
    super()
  }

  protected async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);

      await this.hederaKit.mintNFTToken(
        parsedInput.tokenId,
        parsedInput.tokenMetadata
      );

      return JSON.stringify({
        status: "success",
        message: "NFT minting successful",
        tokenId: parsedInput.tokenId,
        tokenMetadata: parsedInput.tokenMetadata
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
export class HederaClaimAirdropTool extends Tool {
  name = 'hedera_claim_airdrop'

  description = `Claim an airdrop for a token on Hedera
Inputs ( input is a JSON string ):
tokenId: string, the ID of the token to claim the airdrop for e.g. 0.0.123456,
senderAccountId: string, the account ID of the sender e.g. 0.0.789012,
Example usage:
1. Claim an airdrop for token 0.0.123456 from account 0.0.789012:
  '{
    "tokenId": "0.0.123456",
    "senderAccountId": "0.0.789012"
  }
`

  constructor(private hederaKit: HederaAgentKit) {
    super()
  }

  protected async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);
      const airdropId = new PendingAirdropId({
        tokenId: TokenId.fromString(parsedInput.tokenId),
        senderId: AccountId.fromString(parsedInput.senderAccountId),
        receiverId: this.hederaKit.client.operatorAccountId!
      });
      await this.hederaKit.claimAirdrop(
        airdropId
      );

      return JSON.stringify({
        status: "success",
        message: "Airdrop claim successful",
        tokenId: parsedInput.tokenId,
        senderAccountId: parsedInput.senderAccountId,
        receiverAccountId: AccountId.fromString(process.env.HEDERA_ACCOUNT_ID!)
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
export class HederaGetPendingAirdropTool extends Tool {
  name = 'hedera_get_pending_airdrop'

  description = `Get the pending airdrop for a token on Hedera
Inputs ( input is a JSON string ):
- accountId: string, the account ID to get the pending airdrop for e.g. 0.0.789012,
Example usage:
1. Get the pending airdrop for account 0.0.789012:
  '{
    "accountId": "0.0.789012"
  }'
`

  constructor(private hederaKit: HederaAgentKit) {
    super()
  }

  protected async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);

      const airdrop = await this.hederaKit.getPendingAirdrops(
        parsedInput.accountId,
        process.env.HEDERA_NETWORK as HederaNetworkType
      ); 

      return JSON.stringify({
        status: "success",
        message: "Pending airdrop retrieved",
        airdrop: airdrop
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
export class HederaGetAllTokenBalancesTool extends Tool {
  name = 'hedera_get_all_token_balances'

  description = `Get all token balances for an account on Hedera
Inputs ( input is a JSON string ):
accountId : string, the account ID to get the token balances for e.g. 0.0.789012,
- **accountId** (*string*, optional): The Hedera account ID to check the balance for (e.g., "0.0.789012").  
  - If omitted, the tool will return the balance of the connected account.  

Example usage:
1. Get all token balances for account 0.0.789012:
  '{
    "accountId": "0.0.789012"
  }'
2. Get all token balances for the connected account:
   '{}'
`

  constructor(private hederaKit: HederaAgentKit) {
    super()
  }

  protected async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);

      const balances = await this.hederaKit.getAllTokensBalances(
        process.env.HEDERA_NETWORK as HederaNetworkType,
        parsedInput.accountId
      );

      return JSON.stringify({
        status: "success",
        message: "Token balances retrieved",
        balances: balances
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
export class HederaGetTokenHoldersTool extends Tool {
  name = 'hedera_get_token_holders'

  description = `Get the holders of a token on Hedera
Inputs ( input is a JSON string ):
tokenId: string, the ID of the token to get the holders for e.g. 0.0.123456,
threshold (optional): number, the threshold of the token to get the holders for e.g. 100,
Example usage:
1. Get the holders of token 0.0.123456 with a threshold of 100:
  '{
    "tokenId": "0.0.123456",
    "threshold": 100
  }
}
`

  constructor(private hederaKit: HederaAgentKit) {
    super()
  }

  protected async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);

      const holders = await this.hederaKit.getTokenHolders(
        parsedInput.tokenId,
        parsedInput.threshold
      );

      return JSON.stringify({
        status: "success",
        message: "Token holders retrieved",
        holders: holders
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

export class HederaCreateTopicTool extends Tool {
  name = 'hedera_create_topic'

  description = `Create a topic on Hedera
Inputs ( input is a JSON string ):
name: string, the name of the topic e.g. My Topic,
isSubmitKey: boolean, decides whether submit key should be set, false if not passed
Example usage:
1. Create a topic with name "My Topic" and submit key:
  '{
    "name": "My Topic",
    "isSubmitKey": true
  }'
`

  constructor(private hederaKit: HederaAgentKit) {
    super()
  }

  protected async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);
      const topic = await this.hederaKit.createTopic(
        parsedInput.name,
        parsedInput.isSubmitKey
      );
      return JSON.stringify({
        status: "success",
        message: "Topic created",
        topic: topic
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
export class HederaDeleteTopicTool extends Tool {
  name = 'hedera_delete_topic'

  description = `Delete a topic on Hedera
Inputs ( input is a JSON string ):
topicId: string, the ID of the topic to delete e.g. 0.0.123456,
Example usage:
1. Delete topic 0.0.123456:
  '{
    "topicId": "0.0.123456"
  }'
`

  constructor(private hederaKit: HederaAgentKit) {
    super()
  }

  protected async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);
      await this.hederaKit.deleteTopic(
        TopicId.fromString(parsedInput.topicId)
      );
      return JSON.stringify({
        status: "success",
        message: "Topic deleted",
        topicId: parsedInput.topicId
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
export class HederaSubmitTopicMessageTool extends Tool {
  name = 'hedera_submit_topic_message'

  description = `Submit a message to a topic on Hedera
Inputs ( input is a JSON string ):
topicId: string, the ID of the topic to submit the message to e.g. 0.0.123456,
message: string, the message to submit to the topic e.g. "Hello, Hedera!"
Example usage:
1. Submit a message to topic 0.0.123456:
  '{
    "topicId": "0.0.123456",
    "message": "Hello, Hedera!"
  }'
`

  constructor(private hederaKit: HederaAgentKit) {
    super()
  }

  protected async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);
      await this.hederaKit.submitTopicMessage(
        TopicId.fromString(parsedInput.topicId),
        parsedInput.message
      );
      return JSON.stringify({
        status: "success",
        message: "Message submitted",
        topicId: parsedInput.topicId,
        topicMessage: parsedInput.message
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

export class HederaGetTopicInfoTool extends Tool {
  name = 'hedera_get_topic_info'

  description = `Get information about a topic on Hedera
Inputs ( input is a JSON string ):
topicId: string, the ID of the topic to get the information for e.g. 0.0.123456,
Example usage:
1. Get information about topic 0.0.123456:
  '{
    "topicId": "0.0.123456"
  }'
`

  constructor(private hederaKit: HederaAgentKit) {
    super()
  }

  protected async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);
      const topicInfo = await this.hederaKit.getTopicInfo(
        TopicId.fromString(parsedInput.topicId),
        this.hederaKit.client.network.type as HederaNetworkType
      );
      return JSON.stringify({
        status: "success",
        message: "Topic information retrieved",
        topicInfo: topicInfo
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

  protected async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);
      const messages = await this.hederaKit.getTopicMessages(
        TopicId.fromString(parsedInput.topicId),
        parsedInput.lowerThreshold,
        parsedInput.upperThreshold
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


export function createHederaTools(hederaKit: HederaAgentKit): Tool[] {
  return [
    new HederaCreateFungibleTokenTool(hederaKit),
    new HederaTransferTokenTool(hederaKit),
    new HederaGetBalanceTool(hederaKit),
    new HederaAirdropTokenTool(hederaKit),
    new HederaCreateNonFungibleTokenTool(hederaKit),
    new HederaGetHtsBalanceTool(hederaKit),
    new HederaAssociateTokenTool(hederaKit),
    new HederaDissociateTokenTool(hederaKit),
    new HederaRejectTokenTool(hederaKit),
    new HederaMintFungibleTokenTool(hederaKit),
    new HederaTransferHbarTool(hederaKit),
    new HederaMintNFTTool(hederaKit),
    new HederaClaimAirdropTool(hederaKit),
    new HederaGetPendingAirdropTool(hederaKit),
    new HederaGetAllTokenBalancesTool(hederaKit),
    new HederaGetTokenHoldersTool(hederaKit),
    new HederaCreateTopicTool(hederaKit),
    new HederaDeleteTopicTool(hederaKit),
    new HederaSubmitTopicMessageTool(hederaKit),
    new HederaGetTopicInfoTool(hederaKit),
    new HederaGetTopicMessagesTool(hederaKit)
  ]
}