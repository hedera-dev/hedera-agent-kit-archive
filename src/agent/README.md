# HederaAgentKit Documentation

HederaAgentKit is a comprehensive SDK for interacting with the Hedera Hashgraph network. It simplifies operations like token creation, transfers, topic management, and querying the network.

## Overview

HederaAgentKit wraps the underlying Hedera SDK, providing convenience methods for common operations while supporting both custodial and non-custodial transaction flows. This flexibility makes it suitable for various application architectures and security requirements.

## Installation

```sh
npm install hedera-agent-kit
```

## Initialization

### Basic Initialization

```ts
import HederaAgentKit from "hedera-agent-kit";

// Custodial mode (with private key)
const kit = new HederaAgentKit(
    "0.0.123456",  // Account ID
    "your-private-key",  // Private key
    "testnet"  // Network: 'mainnet', 'testnet', or 'previewnet'
);

// Non-custodial mode (without private key)
const nonCustodialKit = new HederaAgentKit(
    "0.0.123456",  // Account ID
    undefined,  // No private key
    "testnet"  // Network
);
```

## Transaction Flow Modes

HederaAgentKit supports two transaction modes:

### Custodial Flow

In custodial flow, the SDK handles the entire transaction process including signing and execution. This requires providing your private key during initialization.

### Non-Custodial Flow

In non-custodial flow, the SDK prepares transaction bytes that can be signed and executed elsewhere. This keeps private keys separate from the SDK.

**Note:** For non-custodial operations, you'll need to provide `executorAccountDetails`:

```ts
const executorAccountDetails = {
    executorAccountId: "0.0.123456",
    executorPublicKey: "your-public-key" // Required for some operations
};
```

## Token Operations

### Create a Fungible Token (FT)

```ts
const options = {
    name: "MyToken",
    symbol: "MTK",
    decimals: 2,
    initialSupply: 1000,
    isSupplyKey: true,
    maxSupply: 10000,
    isMetadataKey: true,
    isAdminKey: true,
    tokenMetadata: new TextEncoder().encode("Metadata Info"),
    memo: "Initial Token Creation"
};

// Custodial flow
const custodialResult = await kit.createFT(options, true);
console.log("Token created with ID:", custodialResult.tokenId);

// Non-custodial flow
const executorAccountDetails = {
    executorAccountId: "0.0.123456",
    executorPublicKey: "your-public-key"
};
const nonCustodialResult = await kit.createFT(options, false, executorAccountDetails);
console.log("Transaction bytes:", nonCustodialResult.txBytes);
```

### Create a Non-Fungible Token (NFT)

```ts
const options = {
    name: "MyNFT",
    symbol: "NFT",
    maxSupply: 100,
    isMetadataKey: true,
    isAdminKey: true,
    tokenMetadata: new TextEncoder().encode("NFT Collection Metadata"),
    memo: "Initial NFT Collection Creation"
};

// Custodial flow
const custodialResult = await kit.createNFT(options, true);
console.log("NFT created with ID:", custodialResult.tokenId);

// Non-custodial flow
const executorAccountDetails = {
    executorAccountId: "0.0.123456",
    executorPublicKey: "your-public-key"
};
const nonCustodialResult = await kit.createNFT(options, false, executorAccountDetails);
console.log("Transaction bytes:", nonCustodialResult.txBytes);
```

### Transfer Tokens

```ts
// Custodial flow
const custodialResult = await kit.transferToken(
    TokenId.fromString("0.0.123"),  // Token ID
    "0.0.456",  // Recipient account ID
    100,  // Amount
    true  // Use custodial flow
);
console.log("Transfer status:", custodialResult.status);

// Non-custodial flow
const executorAccountDetails = {
    executorAccountId: "0.0.123456"
};
const nonCustodialResult = await kit.transferToken(
    TokenId.fromString("0.0.123"),  // Token ID
    "0.0.456",  // Recipient account ID
    100,  // Amount
    false,  // Use non-custodial flow
    executorAccountDetails
);
console.log("Transaction bytes:", nonCustodialResult.txBytes);
```

### Associate a Token

```ts
// Custodial flow
const custodialResult = await kit.associateToken(
    TokenId.fromString("0.0.123"),
    true  // Use custodial flow
);
console.log("Association status:", custodialResult.status);

// Non-custodial flow
const executorAccountDetails = {
    executorAccountId: "0.0.123456"
};
const nonCustodialResult = await kit.associateToken(
    TokenId.fromString("0.0.123"),
    false,  // Use non-custodial flow
    executorAccountDetails
);
console.log("Transaction bytes:", nonCustodialResult.txBytes);
```

### Dissociate a Token

```ts
// Custodial flow
const custodialResult = await kit.dissociateToken(
    TokenId.fromString("0.0.123"),
    true  // Use custodial flow
);
console.log("Dissociation status:", custodialResult.status);

// Non-custodial flow
const executorAccountDetails = {
    executorAccountId: "0.0.123456"
};
const nonCustodialResult = await kit.dissociateToken(
    TokenId.fromString("0.0.123"),
    false,  // Use non-custodial flow
    executorAccountDetails
);
console.log("Transaction bytes:", nonCustodialResult.txBytes);
```

### Reject a Token

```ts
// Custodial flow
const custodialResult = await kit.rejectToken(
    TokenId.fromString("0.0.123"),
    true  // Use custodial flow
);
console.log("Rejection status:", custodialResult.status);

// Non-custodial flow
const executorAccountDetails = {
    executorAccountId: "0.0.123456"
};
const nonCustodialResult = await kit.rejectToken(
    TokenId.fromString("0.0.123"),
    false,  // Use non-custodial flow
    executorAccountDetails
);
console.log("Transaction bytes:", nonCustodialResult.txBytes);
```

### Mint Fungible Tokens

```ts
// Custodial flow
const custodialResult = await kit.mintToken(
    TokenId.fromString("0.0.123"),  // Token ID
    1000,  // Amount to mint
    true  // Use custodial flow
);
console.log("Minting status:", custodialResult.status);

// Non-custodial flow
const executorAccountDetails = {
    executorAccountId: "0.0.123456"
};
const nonCustodialResult = await kit.mintToken(
    TokenId.fromString("0.0.123"),  // Token ID
    1000,  // Amount to mint
    false,  // Use non-custodial flow
    executorAccountDetails
);
console.log("Transaction bytes:", nonCustodialResult.txBytes);
```

### Mint Non-Fungible Tokens (NFTs)

```ts
// Custodial flow
const custodialResult = await kit.mintNFTToken(
    TokenId.fromString("0.0.123"),  // Token ID
    new TextEncoder().encode("NFT Metadata"),  // Metadata for the NFT
    true  // Use custodial flow
);
console.log("NFT minting status:", custodialResult.status);

// Non-custodial flow
const executorAccountDetails = {
    executorAccountId: "0.0.123456"
};
const nonCustodialResult = await kit.mintNFTToken(
    TokenId.fromString("0.0.123"),  // Token ID
    new TextEncoder().encode("NFT Metadata"),  // Metadata for the NFT
    false,  // Use non-custodial flow
    executorAccountDetails
);
console.log("Transaction bytes:", nonCustodialResult.txBytes);
```

## HBAR Operations

### Transfer HBAR

```ts
// Custodial flow
const custodialResult = await kit.transferHbar(
    "0.0.456",  // Recipient account ID
    "10",  // Amount in HBAR (as string)
    true  // Use custodial flow
);
console.log("Transfer status:", custodialResult.status);

// Non-custodial flow
const executorAccountDetails = {
    executorAccountId: "0.0.123456"
};
const nonCustodialResult = await kit.transferHbar(
    "0.0.456",  // Recipient account ID
    "10",  // Amount in HBAR (as string)
    false,  // Use non-custodial flow
    executorAccountDetails
);
console.log("Transaction bytes:", nonCustodialResult.txBytes);
```

## Airdrop Management

### Create an Airdrop

```ts
const recipients = [
    { accountId: "0.0.456", amount: 10 },
    { accountId: "0.0.789", amount: 20 }
];

// Custodial flow
const custodialResult = await kit.airdropToken(
    TokenId.fromString("0.0.123"),  // Token ID
    recipients,  // Array of recipients
    true  // Use custodial flow
);
console.log("Airdrop status:", custodialResult.status);

// Non-custodial flow
const executorAccountDetails = {
    executorAccountId: "0.0.123456"
};
const nonCustodialResult = await kit.airdropToken(
    TokenId.fromString("0.0.123"),  // Token ID
    recipients,  // Array of recipients
    false,  // Use non-custodial flow
    executorAccountDetails
);
console.log("Transaction bytes:", nonCustodialResult.txBytes);
```

### Claim an Airdrop

```ts
// Custodial flow
const custodialResult = await kit.claimAirdrop(
    PendingAirdropId.fromString("0.0.123"),  // Airdrop ID
    true  // Use custodial flow
);
console.log("Claim status:", custodialResult.status);

// Non-custodial flow
const executorAccountDetails = {
    executorAccountId: "0.0.123456"
};
const nonCustodialResult = await kit.claimAirdrop(
    PendingAirdropId.fromString("0.0.123"),  // Airdrop ID
    false,  // Use non-custodial flow
    executorAccountDetails
);
console.log("Transaction bytes:", nonCustodialResult.txBytes);
```

### Get Pending Airdrops

```ts
// For operator/custodial account
const pendingAirdrops = await kit.getPendingAirdrops(
    "testnet"  // Network type
);

// For a specific account
const specificPendingAirdrops = await kit.getPendingAirdrops(
    "testnet",  // Network type
    "0.0.123"  // Account ID
);

// For non-custodial flow with executor account
const executorAccountDetails = {
    executorAccountId: "0.0.123456"
};
const nonCustodialPendingAirdrops = await kit.getPendingAirdrops(
    "testnet",  // Network type
    null,  // No specific account, will use executorAccountId
    false,  // Use non-custodial flow
    executorAccountDetails
);
```

## Balance Queries

### Get HBAR Balance

```ts
// For operator/custodial account
const balance = await kit.getHbarBalance();

// For a specific account
const specificBalance = await kit.getHbarBalance("0.0.123");

// For non-custodial flow with executor account
const executorAccountDetails = {
    executorAccountId: "0.0.123456"
};
const nonCustodialBalance = await kit.getHbarBalance(
    null,  // No specific account, will use executorAccountId
    false,  // Use non-custodial flow
    executorAccountDetails
);
```

### Get Token Balance

```ts
// For operator/custodial account
const tokenBalance = await kit.getHtsBalance(
    "0.0.123",  // Token ID
    "testnet"  // Network type
);

// For a specific account
const specificTokenBalance = await kit.getHtsBalance(
    "0.0.123",  // Token ID
    "testnet",  // Network type
    "0.0.456"  // Account ID
);

// For non-custodial flow with executor account
const executorAccountDetails = {
    executorAccountId: "0.0.123456"
};
const nonCustodialTokenBalance = await kit.getHtsBalance(
    "0.0.123",  // Token ID
    "testnet",  // Network type
    null,  // No specific account, will use executorAccountId
    false,  // Use non-custodial flow
    executorAccountDetails
);
```

### Get All Token Balances

```ts
// For operator/custodial account
const allBalances = await kit.getAllTokensBalances(
    "testnet"  // Network type
);

// For a specific account
const specificAllBalances = await kit.getAllTokensBalances(
    "testnet",  // Network type
    "0.0.123"  // Account ID
);

// For non-custodial flow with executor account
const executorAccountDetails = {
    executorAccountId: "0.0.123456"
};
const nonCustodialAllBalances = await kit.getAllTokensBalances(
    "testnet",  // Network type
    null,  // No specific account, will use executorAccountId
    false,  // Use non-custodial flow
    executorAccountDetails
);
```

### Get Token Holders

```ts
// This is a query operation, same for both custodial and non-custodial
const holders = await kit.getTokenHolders(
    "0.0.123",  // Token ID
    "testnet",  // Network type
    10  // Minimum balance threshold (optional)
);
```

## Topic Management (HCS)

### Create a Topic

```ts
// Custodial flow
const custodialResult = await kit.createTopic(
    "My Topic",  // Topic memo
    true,  // Include submit key
    true  // Use custodial flow
);
console.log("Topic created with ID:", custodialResult.topicId);

// Non-custodial flow
const executorAccountDetails = {
    executorAccountId: "0.0.123456",
    executorPublicKey: "your-public-key"
};
const nonCustodialResult = await kit.createTopic(
    "My Topic",  // Topic memo
    true,  // Include submit key
    false,  // Use non-custodial flow
    executorAccountDetails
);
console.log("Transaction bytes:", nonCustodialResult.txBytes);
```

### Submit a Message to a Topic

```ts
// Custodial flow
const custodialResult = await kit.submitTopicMessage(
    TopicId.fromString("0.0.123"),  // Topic ID
    "Hello, Hedera!",  // Message content
    true  // Use custodial flow
);
console.log("Message submission status:", custodialResult.status);

// Non-custodial flow
const executorAccountDetails = {
    executorAccountId: "0.0.123456"
};
const nonCustodialResult = await kit.submitTopicMessage(
    TopicId.fromString("0.0.123"),  // Topic ID
    "Hello, Hedera!",  // Message content
    false,  // Use non-custodial flow
    executorAccountDetails
);
console.log("Transaction bytes:", nonCustodialResult.txBytes);
```

### Delete a Topic

```ts
// Custodial flow
const custodialResult = await kit.deleteTopic(
    TopicId.fromString("0.0.123"),  // Topic ID
    true  // Use custodial flow
);
console.log("Topic deletion status:", custodialResult.status);

// Non-custodial flow
const executorAccountDetails = {
    executorAccountId: "0.0.123456"
};
const nonCustodialResult = await kit.deleteTopic(
    TopicId.fromString("0.0.123"),  // Topic ID
    false,  // Use non-custodial flow
    executorAccountDetails
);
console.log("Transaction bytes:", nonCustodialResult.txBytes);
```

### Get Topic Information

```ts
// This is a query operation, same for both custodial and non-custodial
const info = await kit.getTopicInfo(
    TopicId.fromString("0.0.123"),  // Topic ID
    "testnet"  // Network type
);
```

### Get Topic Messages

```ts
// This is a query operation, same for both custodial and non-custodial
const messages = await kit.getTopicMessages(
    TopicId.fromString("0.0.123"),  // Topic ID
    "testnet",  // Network type
    1641034800000,  // Lower timestamp bound (optional)
    1641121200000  // Upper timestamp bound (optional)
);
```

## Account Management

### Approve Asset Allowance

```ts
// For HBAR - Custodial flow
const custodialHbarAllowanceResult = await kit.approveAssetAllowance(
    AccountId.fromString("0.0.456"),  // Spender account
    10,  // Amount
    undefined,  // No token ID for HBAR
    true  // Use custodial flow
);
console.log("HBAR allowance status:", custodialHbarAllowanceResult.status);

// For HBAR - Non-custodial flow
const executorAccountDetails = {
    executorAccountId: "0.0.123456"
};
const nonCustodialHbarAllowanceResult = await kit.approveAssetAllowance(
    AccountId.fromString("0.0.456"),  // Spender account
    10,  // Amount
    undefined,  // No token ID for HBAR
    false,  // Use non-custodial flow
    executorAccountDetails
);
console.log("Transaction bytes:", nonCustodialHbarAllowanceResult.txBytes);

// For tokens - Custodial flow
const custodialTokenAllowanceResult = await kit.approveAssetAllowance(
    AccountId.fromString("0.0.456"),  // Spender account
    10,  // Amount
    TokenId.fromString("0.0.123"),  // Token ID
    true  // Use custodial flow
);
console.log("Token allowance status:", custodialTokenAllowanceResult.status);

// For tokens - Non-custodial flow
const nonCustodialTokenAllowanceResult = await kit.approveAssetAllowance(
    AccountId.fromString("0.0.456"),  // Spender account
    10,  // Amount
    TokenId.fromString("0.0.123"),  // Token ID
    false,  // Use non-custodial flow
    executorAccountDetails
);
console.log("Transaction bytes:", nonCustodialTokenAllowanceResult.txBytes);
```

## Error Handling

The SDK throws descriptive error messages for various scenarios:

- Missing private key for custodial operations
- Missing executor account details for non-custodial operations
- Invalid parameters or network issues

Always implement proper try-catch blocks:

```ts
try {
    const result = await kit.transferHbar("0.0.456", "10");
} catch (error) {
    console.error("Transaction failed:", error.message);
}
```

## Result Objects

### Custodial Results

Custodial operations typically return:
- `txHash`: The transaction hash
- `status`: Transaction status
- Operation-specific data (e.g., `tokenId` for token creation)

### Non-Custodial Results

Non-custodial operations typically return:
- `txBytes`: Transaction bytes for external signing

## Working with Transaction Bytes

In non-custodial flow, transaction bytes must be signed externally:

```ts
// Get transaction bytes
const result = await kit.transferHbar("0.0.456", "10", false, {
    executorAccountId: "0.0.123456"
});

// Sign bytes with external signer
const signedBytes = await externalSigner.sign(result.txBytes);

// Execute the signed transaction
const txResponse = await executeSignedTransaction(signedBytes);
```

## License

This project is licensed under the MIT License.