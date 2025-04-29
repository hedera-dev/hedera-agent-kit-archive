# Hedera Agent Kit - LangChain Tools

This directory contains a collection of LangChain-compatible tools for interacting with the Hedera blockchain. These tools enable AI agents to perform various operations on Hedera, including managing HBAR balances, working with the Hedera Consensus Service (HCS), and utilizing the Hedera Token Service (HTS).

## Overview

The tools are organized into three main categories:

1. **HBAR Tools** - For working with Hedera's native cryptocurrency
2. **HCS Tools** - For interacting with the Hedera Consensus Service
3. **HTS Tools** - For utilizing the Hedera Token Service

Each tool extends the LangChain `Tool` class and provides a standardized interface for AI agents to interact with Hedera's blockchain services.

## Usage

To use these tools with a LangChain agent, you need to:

1. Initialize a `HederaAgentKit` instance
2. Create the tools using the `createHederaTools` function
3. Pass the tools to your LangChain agent

```typescript
import { createHederaTools } from "hedera-agent-kit";
import HederaAgentKit from "hedera-agent-kit/agent";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

// Initialize HederaAgentKit
const hederaKit = new HederaAgentKit(
  process.env.HEDERA_ACCOUNT_ID!,
  process.env.HEDERA_PRIVATE_KEY!,
  "testnet" // or "mainnet" or "previewnet"
);

// Create the LangChain-compatible tools
const tools = createHederaTools(hederaKit);

// Create a language model
const llm = new ChatOpenAI({
  modelName: "o3-mini",
});

// Create the agent
const agent = createReactAgent({
  llm,
  tools,
});
```

## Available Tools

### HBAR Tools

- **HederaGetBalanceTool** - Retrieves the HBAR balance of a specified Hedera account
- **HederaTransferHbarTool** - Transfers HBAR from one account to another

### HCS (Hedera Consensus Service) Tools

- **HederaCreateTopicTool** - Creates a new topic on the Hedera Consensus Service
- **HederaDeleteTopicTool** - Deletes an existing topic
- **HederaGetTopicInfoTool** - Retrieves information about a specific topic
- **HederaGetTopicMessagesTool** - Retrieves messages from a specific topic
- **HederaSubmitTopicMessageTool** - Submits a message to a specific topic

### HTS (Hedera Token Service) Tools

- **HederaAirdropTokenTool** - Airdrops tokens to multiple accounts
- **HederaAssociateTokenTool** - Associates a token with an account
- **HederaClaimAirdropTool** - Claims tokens from an airdrop
- **HederaCreateFungibleTokenTool** - Creates a new fungible token
- **HederaCreateNonFungibleTokenTool** - Creates a new non-fungible token
- **HederaDissociateTokenTool** - Dissociates a token from an account
- **HederaGetAllTokenBalancesTool** - Retrieves all token balances for an account
- **HederaGetHtsBalanceTool** - Retrieves the balance of a specific token for an account
- **HederaGetPendingAirdropTool** - Retrieves information about pending airdrops
- **HederaGetTokenHoldersTool** - Retrieves a list of token holders for a specific token
- **HederaMintFungibleTokenTool** - Mints additional supply of a fungible token
- **HederaMintNFTTool** - Mints a new NFT
- **HederaRejectTokenTool** - Rejects a token that was associated with an account
- **HederaTransferTokenTool** - Transfers tokens from one account to another

## Tool Structure

Each tool follows a consistent structure:

1. A `name` property that identifies the tool
2. A `description` property that explains what the tool does, its inputs, and example usage
3. A constructor that takes a `HederaAgentKit` instance
4. An implementation of the `_call` method that handles the actual functionality

## Custodial and Non-Custodial Modes

The tools support both custodial and non-custodial modes:

- **Custodial Mode**: The agent has direct access to the private key and can sign transactions
- **Non-Custodial Mode**: The agent prepares transactions but requires external signing

To specify the mode, pass the appropriate configuration when invoking the agent:

```typescript
// For custodial mode
const response = await agent.invoke(
  { messages: [new HumanMessage(userInput)] },
  { configurable: { isCustodial: true } }
);

// For non-custodial mode with executor account details
const response = await agent.invoke(
  { messages: [new HumanMessage(userInput)] },
  { 
    configurable: { 
      isCustodial: false,
      executorAccountDetails: {
        executorPublicKey: "...",
        executorAccountId: "..."
      }
    } 
  }
);
```

## Error Handling

All tools include standardized error handling. If an error occurs during execution, the tool will return a JSON string with:

- `status`: "error"
- `message`: The error message
- `code`: The error code (if available) or "UNKNOWN_ERROR"

## Examples

For examples of how to use these tools in a complete application, see the `tests/index.ts` file in the repository.