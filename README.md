# Hedera Agent Kit

Welcome to the **Hedera Agent Kit**! This project aims to provide a LangChain-compatible toolkit for interacting with the Hedera Network. The focus is on a minimal, easy-to-use set of functions, while staying flexible for future enhancements.

## Overview

- **Agent Interaction**: Make on-chain calls to Hedera (e.g., create tokens, post messages to consensus).
- **Lightweight**: Designed to get you started quickly with a minimal set of features.
- **Community-Driven**: We encourage developers of all skill levels to contribute.

## Hedera Agent Kit Features

1. **Native Hedera Token Service (HTS)**:
    - Create fungible tokens with minimal parameters (name, symbol, decimals, supply, etc.).
    - Mint additional tokens to existing token accounts.

2. **Token Operations**:
    - **Create Fungible Tokens (FT)**: Easily create and configure new fungible tokens.
    - **Create Non-fungible Tokens (NFT)**: Easily create and configure new non-fungible tokens.
    - **Transfer Tokens**: Transfer tokens between accounts.
    - **Associate / Dissociate Tokens**: Associate a token to an account or dissociate it as needed.
    - **Reject Tokens**: Reject a token from an account.

3. **HBAR Transactions**:
    - Transfer HBAR between accounts.

4. **Airdrop Management**:
    - Airdrop tokens to multiple recipients.
    - Claim a pending airdrop.

5. **Token Balance Queries**:
    - Get HBAR balances of an account.
    - Get HTS token balances for a specific token ID.
    - Retrieve all token balances for an account.
    - Get token holders for a specific token.

6. **Topic Management (HCS)**:
    - **Create Topics**: Create new topics for Hedera Consensus Service (HCS).
    - **Delete Topics**: Delete an existing topic.
    - **Submit Topic Messages**: Send messages to a specific topic.
    - **Get Topic Info**: Retrieve information about a specific topic.
    - **Get Topic Messages**: Fetch messages from a specific topic.

### Details
For further details check [HederaAgentKit Readme](./src/agent/README.md).

## Langchain Tools
This library implements langchain tools for most of HederaAgentKit functionalities. 
Consider checking the [Langchain Readme](./src/langchain/README.md) for additional information.

## Getting Started

```bash
npm i hedera-agent-kit
```

LangChain/ LangGraph quick start:

```js
import { HederaAgentKit, createHederaTools } from 'hedera-agent-kit';
import { ToolNode } from '@langchain/langgraph/prebuilt';

const hederaAgentKit = new HederaAgentKit(
  '0.0.12345', // Replace with your account ID
  '0x.......', // Replace with your private key
  'testnet',   // Replace with your selected network
);
const hederaAgentKitTools = createHederaTools(hederaAgentKit);
const toolsNode = new ToolNode(tools);

```
- `hederaAgentKitTools` is an array of `Tool` instances
  (from `@langchain/core/tools`).
- `toolsNode` can be used in any LangGraph workflow,
  for example `workflow.addNode('toolsNode', toolsNode)`.

## Local development

1. **Clone** the repo:

```bash
git clone https://github.com/hedera-dev/hedera-agent-kit.git
```

2. Install dependencies:

```bash
cd hedera-agent-kit
npm install
```

3. Configure environment variables in a `.env` file. See the `sample.env`.

4. Test the kit:

```bash
 npm run test
```

## Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](https://github.com/hedera-dev/hedera-agent-kit/blob/main/CONTRIBUTING.md) for details on our process, how to get started, and how to sign your commits under the DCO.

## Roadmap

For details on upcoming features, check out our [ROADMAP.md](https://github.com/hedera-dev/hedera-agent-kit/blob/main/ROADMAP.md). If you’d like to tackle one of the tasks, look at the open issues on GitHub or create a new one if you don’t see what you’re looking for.

## License

Apache 2.0
