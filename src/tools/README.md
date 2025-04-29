# Hedera Agent Kit Tools

This directory contains underlying implementations for methods offered by the HederaAgentKit from src/agent/index.ts.

The implementation is divided into:

- **Queries**: Actions that use the Hedera mirror node to retrieve data and do not require creating any transaction.
- **Transactions**: Actions that perform transactions on the Hedera network:
  - **Custodial**: Executed by the Hedera Agent Kit operator (the account passed to the instance of HederaAgentKit).
  - **Non-custodial**: Generate only txBytes and do not require passing private key by the executor of the transaction.

**Operator** is the account passed to the instance of HederaAgentKit.  
**Executor** is the account requesting non-custodial action, that will later sign its bytes.

# Transactions

## HBAR
### `HbarTransactionBuilder.transferHbar(fromAccountId, toAccountId, amount)`

This static method creates a transaction builder for transferring HBAR from one account to another. The transaction can be executed in either custodial or non-custodial mode.

---

#### Parameters

- **fromAccountId**: `string | AccountId`  
  The source account from which HBAR will be transferred. This can be provided either as a string or as an `AccountId` object.

- **toAccountId**: `string | AccountId`  
  The target account to which HBAR will be transferred. This can be provided either as a string or as an `AccountId` object.

- **amount**: `string`  
  The amount of HBAR to be transferred. This value is used to debit the source account and credit the target account.

---

#### Returns

- **BaseTransactionBuilder<TransferHBARResult>**  
  A transaction builder that can be used to:
    - Execute the transaction in custodial mode using `signAndExecute(client)`
    - Get transaction bytes for non-custodial execution using `getTxBytesString(client, fromAccountId)`

---

#### Custodial Usage

```typescript
const response = await HbarTransactionBuilder
    .transferHbar(operatorAccountId, toAccountId, amount)
    .signAndExecute(client);
```

Returns a `CustodialTransferHbarResult` containing:
- **txHash**: `string` — The transaction hash (transaction ID) of the executed transfer.
- **status**: `string` — The status of the transaction receipt.

#### Non-custodial Usage

```typescript
const txBytes = await HbarTransactionBuilder
    .transferHbar(executorAccountId, toAccountId, amount)
    .getTxBytesString(client, executorAccountId);
```

Returns a `NonCustodialTransferHbarResult` containing:
- **txBytes**: `string` — The base64-encoded transaction bytes that can be signed and executed elsewhere.

---

#### Behavior & Error Handling

1. **Transaction Construction**:  
   It creates a `TransferTransaction` using the `TransferHbarStrategy` that:
    - Debits the source account by the specified amount.
    - Credits the target account by the same amount.

2. **For Custodial Execution**:
    - The transaction is executed on the network using the provided client.
    - The receipt is obtained and the status is checked.
    - If the status does not include `"SUCCESS"`, an error is thrown.

3. **For Non-custodial Execution**:
    - The transaction is built and frozen with the client.
    - The transaction bytes are returned as a base64-encoded string.
    - No execution happens on the network.

----

## HCS - Hedera Consensus Service

### `HcsTransactionBuilder.createTopic(memo, publicKey, isSubmitKey)`

This static method creates a transaction builder for creating a new topic on the Hedera Consensus Service.

---

#### Parameters

- **memo**: `string`  
  A descriptive memo or note for the topic.

- **publicKey**: `PublicKey`  
  The public key to be used as the admin key for the topic.

- **isSubmitKey**: `boolean`  
  A flag indicating whether to set the submit key for the topic. If `true`, the provided public key is used as the submit key.

---

#### Returns

- **BaseTransactionBuilder<CreateTopicResult>**  
  A transaction builder that can be used to:
    - Execute the transaction in custodial mode using `signAndExecute(client)`
    - Get transaction bytes for non-custodial execution using `getTxBytesString(client, accountId)`

---

#### Custodial Usage

```typescript
const response = await HcsTransactionBuilder
    .createTopic(memo, client.operatorPublicKey, isSubmitKey)
    .signAndExecute(client);
```

Returns a `CustodialCreateTopicResult` containing:
- **txHash**: `string` — The transaction hash (transaction ID) of the executed topic creation.
- **status**: `string` — The status of the transaction receipt.
- **topicId**: `string` — The identifier of the newly created topic.

#### Non-custodial Usage

```typescript
const txBytes = await HcsTransactionBuilder
    .createTopic(memo, executorPublicKey, isSubmitKey)
    .getTxBytesString(client, executorAccountId);
```

Returns a `NonCustodialCreateTopicResult` containing:
- **txBytes**: `string` — The base64-encoded transaction bytes that can be signed and executed elsewhere.

---

#### Behavior & Error Handling

1. **Transaction Construction**:  
   It creates a `TopicCreateTransaction` using the `CreateTopicStrategy` that:
    - Sets the topic memo to the provided memo.
    - Sets the admin key to the provided public key.
    - Sets the submit key to the provided public key if isSubmitKey is true.

2. **For Custodial Execution**:
    - The transaction is executed on the network using the provided client.
    - The receipt is obtained and the status is checked.
    - If the status does not include `"SUCCESS"`, an error is thrown.

3. **For Non-custodial Execution**:
    - The transaction is built and frozen with the client.
    - The transaction bytes are returned as a base64-encoded string.
    - No execution happens on the network.

---

### `HcsTransactionBuilder.submitTopicMessage(topicId, message)`

This static method creates a transaction builder for submitting a message to a specified topic on the Hedera Consensus Service.

---

#### Parameters

- **topicId**: `TopicId`  
  The identifier of the topic to which the message will be submitted.

- **message**: `string`  
  The content of the message to be submitted to the topic.

---

#### Returns

- **BaseTransactionBuilder<SubmitMessageResult>**  
  A transaction builder that can be used to:
    - Execute the transaction in custodial mode using `signAndExecute(client)`
    - Get transaction bytes for non-custodial execution using `getTxBytesString(client, accountId)`

---

#### Custodial Usage

```typescript
const response = await HcsTransactionBuilder
    .submitTopicMessage(topicId, message)
    .signAndExecute(client);
```

Returns a `CustodialSubmitMessageResult` containing:
- **txHash**: `string` — The transaction hash (transaction ID) of the executed message submission.
- **status**: `string` — The status of the transaction receipt.

#### Non-custodial Usage

```typescript
const txBytes = await HcsTransactionBuilder
    .submitTopicMessage(topicId, message)
    .getTxBytesString(client, executorAccountId);
```

Returns a `NonCustodialSubmitMessageResult` containing:
- **txBytes**: `string` — The base64-encoded transaction bytes that can be signed and executed elsewhere.

---

#### Behavior & Error Handling

1. **Transaction Construction**:  
   It creates a `TopicMessageSubmitTransaction` using the `SubmitTopicMessageStrategy` that:
    - Sets the topic ID to the provided topic ID.
    - Sets the message to the provided message.

2. **For Custodial Execution**:
    - The transaction is executed on the network using the provided client.
    - The receipt is obtained and the status is checked.
    - If the status does not include `"SUCCESS"`, an error is thrown.

3. **For Non-custodial Execution**:
    - The transaction is built and frozen with the client.
    - The transaction bytes are returned as a base64-encoded string.
    - No execution happens on the network.

---

### `HcsTransactionBuilder.deleteTopic(topicId)`

This static method creates a transaction builder for deleting a specified topic on the Hedera Consensus Service.

---

#### Parameters

- **topicId**: `TopicId | string`  
  The identifier of the topic to be deleted.

---

#### Returns

- **BaseTransactionBuilder<DeleteTopicResult>**  
  A transaction builder that can be used to:
    - Execute the transaction in custodial mode using `signAndExecute(client)`
    - Get transaction bytes for non-custodial execution using `getTxBytesString(client, accountId)`

---

#### Custodial Usage

```typescript
const response = await HcsTransactionBuilder
    .deleteTopic(topicId)
    .signAndExecute(client);
```

Returns a `CustodialDeleteTopicResult` containing:
- **txHash**: `string` — The transaction hash (transaction ID) of the executed topic deletion.
- **status**: `string` — The status of the transaction receipt.

#### Non-custodial Usage

```typescript
const txBytes = await HcsTransactionBuilder
    .deleteTopic(topicId)
    .getTxBytesString(client, executorAccountId);
```

Returns a `NonCustodialDeleteTopicResult` containing:
- **txBytes**: `string` — The base64-encoded transaction bytes that can be signed and executed elsewhere.

---

#### Behavior & Error Handling

1. **Transaction Construction**:  
   It creates a `TopicDeleteTransaction` using the `DeleteTopicStrategy` that:
    - Sets the topic ID to the provided topic ID.

2. **For Custodial Execution**:
    - The transaction is executed on the network using the provided client.
    - The receipt is obtained and the status is checked.
    - If the status does not include `"SUCCESS"`, an error is thrown.

3. **For Non-custodial Execution**:
    - The transaction is built and frozen with the client.
    - The transaction bytes are returned as a base64-encoded string.
    - No execution happens on the network.

---

## HTS - Hedera Token Service

### `HtsTransactionBuilder.airdropToken(tokenId, recipients, issuerAccountId)`

This static method creates a transaction builder for airdropping tokens to multiple recipients.

---

#### Parameters

- **tokenId**: `TokenId | string`  
  The identifier of the token to be airdropped.

- **recipients**: `AirdropRecipient[]`  
  An array of recipient objects. Each object must include:
    - **accountId**: `string | AccountId` — The recipient's account identifier.
    - **amount**: `number` — The number of tokens to transfer to the recipient.

- **issuerAccountId**: `string | AccountId`  
  The account from which the tokens will be transferred. This can be provided either as a string or as an `AccountId` object.

---

#### Returns

- **BaseTransactionBuilder<AirdropResult>**  
  A transaction builder that can be used to:
    - Execute the transaction in custodial mode using `signAndExecute(client)`
    - Get transaction bytes for non-custodial execution using `getTxBytesString(client, issuerAccountId)`

---

#### Custodial Usage

```typescript
const response = await HtsTransactionBuilder
    .airdropToken(tokenId, recipients, operatorAccountId)
    .signAndExecute(client);
```

Returns a `CustodialAirdropTokenResult` containing:
- **txHash**: `string` — The transaction hash (transaction ID) of the executed airdrop.
- **status**: `string` — The status of the transaction receipt.

#### Non-custodial Usage

```typescript
const txBytes = await HtsTransactionBuilder
    .airdropToken(tokenId, recipients, executorAccountId)
    .getTxBytesString(client, executorAccountId);
```

Returns a `NonCustodialAirdropTokenResult` containing:
- **txBytes**: `string` — The base64-encoded transaction bytes that can be signed and executed elsewhere.

---

#### Behavior & Error Handling

1. **Transaction Construction**:  
   It creates a `TransferTransaction` using the `AirdropTokenStrategy` that:
    - For each recipient, deducts the specified token amount from the issuer account.
    - Credits the same amount to each recipient's account.

2. **For Custodial Execution**:
    - The transaction is executed on the network using the provided client.
    - The receipt is obtained and the status is checked.
    - If the status does not include `"SUCCESS"`, an error is thrown.

3. **For Non-custodial Execution**:
    - The transaction is built and frozen with the client.
    - The transaction bytes are returned as a base64-encoded string.
    - No execution happens on the network.

---

### `HtsTransactionBuilder.associateToken(tokenId, issuerAccountId)`

This static method creates a transaction builder for associating a token with an account.

---

#### Parameters

- **tokenId**: `string | TokenId`  
  The identifier of the token to be associated.

- **issuerAccountId**: `string | AccountId`  
  The account to associate the token with. This can be provided either as a string or as an `AccountId` object.

---

#### Returns

- **BaseTransactionBuilder<AirdropResult>**  
  A transaction builder that can be used to:
    - Execute the transaction in custodial mode using `signAndExecute(client)`
    - Get transaction bytes for non-custodial execution using `getTxBytesString(client, issuerAccountId)`

---

#### Custodial Usage

```typescript
const response = await HtsTransactionBuilder
    .associateToken(tokenId, operatorAccountId)
    .signAndExecute(client);
```

Returns a `CustodialAssociateTokenResult` containing:
- **txHash**: `string` — The transaction hash (transaction ID) of the executed association.
- **status**: `string` — The status of the transaction receipt.

#### Non-custodial Usage

```typescript
const txBytes = await HtsTransactionBuilder
    .associateToken(tokenId, executorAccountId)
    .getTxBytesString(client, executorAccountId);
```

Returns a `NonCustodialAssociateTokenResult` containing:
- **txBytes**: `string` — The base64-encoded transaction bytes that can be signed and executed elsewhere.

---

#### Behavior & Error Handling

1. **Transaction Construction**:  
   It creates a `TokenAssociateTransaction` using the `AssociateTokenStrategy` that:
    - Associates the specified token with the issuer account.

2. **For Custodial Execution**:
    - The transaction is executed on the network using the provided client.
    - The receipt is obtained and the status is checked.
    - If the status does not include `"SUCCESS"`, an error is thrown.

3. **For Non-custodial Execution**:
    - The transaction is built and frozen with the client.
    - The transaction bytes are returned as a base64-encoded string.
    - No execution happens on the network.

---

### `HtsTransactionBuilder.claimAirdrop(airdropId)`

This static method creates a transaction builder for claiming a pending airdrop.

---

#### Parameters

- **airdropId**: `PendingAirdropId`  
  The identifier of the airdrop to claim.

---

#### Returns

- **BaseTransactionBuilder<ClaimAirdropResult>**  
  A transaction builder that can be used to:
    - Execute the transaction in custodial mode using `signAndExecute(client)`
    - Get transaction bytes for non-custodial execution using `getTxBytesString(client, accountId)`

---

#### Custodial Usage

```typescript
const response = await HtsTransactionBuilder
    .claimAirdrop(airdropId)
    .signAndExecute(client);
```

Returns a `CustodialClaimAirdropResult` containing:
- **txHash**: `string` — The transaction hash (transaction ID) of the executed claim.
- **status**: `string` — The status of the transaction receipt.

#### Non-custodial Usage

```typescript
const txBytes = await HtsTransactionBuilder
    .claimAirdrop(airdropId)
    .getTxBytesString(client, executorAccountId);
```

Returns a `NonCustodialClaimAirdropResult` containing:
- **txBytes**: `string` — The base64-encoded transaction bytes that can be signed and executed elsewhere.

---

#### Behavior & Error Handling

1. **Transaction Construction**:  
   It creates a `ClaimAirdropTransaction` using the `ClaimAirdropStrategy` that:
    - Claims the specified airdrop.

2. **For Custodial Execution**:
    - The transaction is executed on the network using the provided client.
    - The receipt is obtained and the status is checked.
    - If the status does not include `"SUCCESS"`, an error is thrown.

3. **For Non-custodial Execution**:
    - The transaction is built and frozen with the client.
    - The transaction bytes are returned as a base64-encoded string.
    - No execution happens on the network.

---

### `HtsTransactionBuilder.createToken(options, publicKey, issuerAccountId)`

This static method creates a transaction builder for creating a new token.

---

#### Parameters

- **options**: `CreateTokenOptions`  
  The options for creating the token. This object should include:
    - **name**: `string` — The name of the token.
    - **symbol**: `string` — The symbol representing the token.
    - **decimals**: `number` (optional) — The number of decimal places for the token. Default is `0`.
    - **initialSupply**: `number` (optional) — The initial supply of tokens. Default is `0`.
    - **isSupplyKey**: `boolean` (optional) — A flag indicating whether to set the supply key. Default is `false`.
    - **tokenType**: `TokenType` — The type of token to create (fungible or non-fungible).
    - **maxSupply**: `number` (optional) — The maximum supply of tokens for finite supply tokens.
    - **isMetadataKey**: `boolean` (optional) — A flag indicating whether to set the metadata key. Default is `false`.
    - **isAdminKey**: `boolean` (optional) — A flag indicating whether to set the admin key. Default is `false`.
    - **tokenMetadata**: `Uint8Array` (optional) — Metadata for the token. This is only applicable for NFTs.
    - **client**: `Client` — An instance of the Hedera SDK client used to execute the transaction.

- **publicKey**: `PublicKey`  
  The public key to be used for various token keys (admin, supply, etc.) based on the options.

- **issuerAccountId**: `string | AccountId`  
  The account ID of the token creator. This account will be the initial treasury for the token.

---

#### Returns

- **BaseTransactionBuilder<CreateTokenResult>**  
  A transaction builder that can be used to:
    - Execute the transaction in custodial mode using `signAndExecute(client)`
    - Get transaction bytes for non-custodial execution using `getTxBytesString(client, issuerAccountId)`

---

#### Custodial Usage

```typescript
const response = await HtsTransactionBuilder
    .createToken(options, client.operatorPublicKey, operatorAccountId)
    .signAndExecute(client);
```

Returns a `CustodialCreateTokenResult` containing:
- **txHash**: `string` — The transaction hash (transaction ID) of the executed token creation.
- **status**: `string` — The status of the transaction receipt.
- **tokenId**: `string` — The identifier of the newly created token.

#### Non-custodial Usage

```typescript
const txBytes = await HtsTransactionBuilder
    .createToken(options, executorPublicKey, executorAccountId)
    .getTxBytesString(client, executorAccountId);
```

Returns a `NonCustodialCreateTokenResult` containing:
- **txBytes**: `string` — The base64-encoded transaction bytes that can be signed and executed elsewhere.

---

#### Behavior & Error Handling

1. **Transaction Construction**:  
   It creates a `TokenCreateTransaction` using the `CreateTokenStrategy` that:
    - Sets the token name, symbol, and decimals.
    - Sets the initial supply if provided.
    - Sets the treasury account to the provided account ID.
    - Sets various keys (admin, supply, metadata) based on the options.
    - Sets the token type and supply type.

2. **For Custodial Execution**:
    - The transaction is executed on the network using the provided client.
    - The receipt is obtained and the status is checked.
    - If the status does not include `"SUCCESS"`, an error is thrown.

3. **For Non-custodial Execution**:
    - The transaction is built and frozen with the client.
    - The transaction bytes are returned as a base64-encoded string.
    - No execution happens on the network.

---

### `HtsTransactionBuilder.dissociateToken(tokenId, issuerAccountId)`

This static method creates a transaction builder for dissociating a token from an account.

---

#### Parameters

- **tokenId**: `string | TokenId`  
  The identifier of the token to be dissociated.

- **issuerAccountId**: `string | AccountId`  
  The account to dissociate the token from. This can be provided either as a string or as an `AccountId` object.

---

#### Returns

- **BaseTransactionBuilder<DissociateTokenResult>**  
  A transaction builder that can be used to:
    - Execute the transaction in custodial mode using `signAndExecute(client)`
    - Get transaction bytes for non-custodial execution using `getTxBytesString(client, issuerAccountId)`

---

#### Custodial Usage

```typescript
const response = await HtsTransactionBuilder
    .dissociateToken(tokenId, operatorAccountId)
    .signAndExecute(client);
```

Returns a `CustodialDissociateTokenResult` containing:
- **txHash**: `string` — The transaction hash (transaction ID) of the executed dissociation.
- **status**: `string` — The status of the transaction receipt.

#### Non-custodial Usage

```typescript
const txBytes = await HtsTransactionBuilder
    .dissociateToken(tokenId, executorAccountId)
    .getTxBytesString(client, executorAccountId);
```

Returns a `NonCustodialDissociateTokenResult` containing:
- **txBytes**: `string` — The base64-encoded transaction bytes that can be signed and executed elsewhere.

---

#### Behavior & Error Handling

1. **Transaction Construction**:  
   It creates a `TokenDissociateTransaction` using the `DissociateTokenStrategy` that:
    - Dissociates the specified token from the issuer account.

2. **For Custodial Execution**:
    - The transaction is executed on the network using the provided client.
    - The receipt is obtained and the status is checked.
    - If the status does not include `"SUCCESS"`, an error is thrown.

3. **For Non-custodial Execution**:
    - The transaction is built and frozen with the client.
    - The transaction bytes are returned as a base64-encoded string.
    - No execution happens on the network.

---

### `HtsTransactionBuilder.mintNft(tokenId, tokenMetadata)`

This static method creates a transaction builder for minting a non-fungible token (NFT).

---

#### Parameters

- **tokenId**: `string | TokenId`  
  The identifier of the token to mint.

- **tokenMetadata**: `Uint8Array`  
  The metadata for the NFT.

---

#### Returns

- **BaseTransactionBuilder<MintNFTResult>**  
  A transaction builder that can be used to:
    - Execute the transaction in custodial mode using `signAndExecute(client)`
    - Get transaction bytes for non-custodial execution using `getTxBytesString(client, accountId)`

---

#### Custodial Usage

```typescript
const response = await HtsTransactionBuilder
    .mintNft(tokenId, tokenMetadata)
    .signAndExecute(client);
```

Returns a `CustodialMintNFTResult` containing:
- **txHash**: `string` — The transaction hash (transaction ID) of the executed NFT minting.
- **status**: `string` — The status of the transaction receipt.

#### Non-custodial Usage

```typescript
const txBytes = await HtsTransactionBuilder
    .mintNft(tokenId, tokenMetadata)
    .getTxBytesString(client, executorAccountId);
```

Returns a `NonCustodialMintNFTResult` containing:
- **txBytes**: `string` — The base64-encoded transaction bytes that can be signed and executed elsewhere.

---

#### Behavior & Error Handling

1. **Transaction Construction**:  
   It creates a `TokenMintTransaction` using the `MintNftStrategy` that:
    - Sets the token ID to the provided token ID.
    - Sets the metadata for the NFT.

2. **For Custodial Execution**:
    - The transaction is executed on the network using the provided client.
    - The receipt is obtained and the status is checked.
    - If the status does not include `"SUCCESS"`, an error is thrown.

3. **For Non-custodial Execution**:
    - The transaction is built and frozen with the client.
    - The transaction bytes are returned as a base64-encoded string.
    - No execution happens on the network.

---

### `HtsTransactionBuilder.mintToken(tokenId, amount)`

This static method creates a transaction builder for minting fungible tokens.

---

#### Parameters

- **tokenId**: `string | TokenId`  
  The identifier of the token to mint.

- **amount**: `number`  
  The amount of tokens to mint.

---

#### Returns

- **BaseTransactionBuilder<MintTokenResult>**  
  A transaction builder that can be used to:
    - Execute the transaction in custodial mode using `signAndExecute(client)`
    - Get transaction bytes for non-custodial execution using `getTxBytesString(client, accountId)`

---

#### Custodial Usage

```typescript
const response = await HtsTransactionBuilder
    .mintToken(tokenId, amount)
    .signAndExecute(client);
```

Returns a `CustodialMintTokenResult` containing:
- **txHash**: `string` — The transaction hash (transaction ID) of the executed token minting.
- **status**: `string` — The status of the transaction receipt.

#### Non-custodial Usage

```typescript
const txBytes = await HtsTransactionBuilder
    .mintToken(tokenId, amount)
    .getTxBytesString(client, executorAccountId);
```

Returns a `NonCustodialMintTokenResult` containing:
- **txBytes**: `string` — The base64-encoded transaction bytes that can be signed and executed elsewhere.

---

#### Behavior & Error Handling

1. **Transaction Construction**:  
   It creates a `TokenMintTransaction` using the `MintTokenStrategy` that:
    - Sets the token ID to the provided token ID.
    - Sets the amount of tokens to mint.

2. **For Custodial Execution**:
    - The transaction is executed on the network using the provided client.
    - The receipt is obtained and the status is checked.
    - If the status does not include `"SUCCESS"`, an error is thrown.

3. **For Non-custodial Execution**:
    - The transaction is built and frozen with the client.
    - The transaction bytes are returned as a base64-encoded string.
    - No execution happens on the network.

---

### `HtsTransactionBuilder.rejectToken(tokenId, issuerAccountId)`

This static method creates a transaction builder for rejecting a token.

---

#### Parameters

- **tokenId**: `TokenId`  
  The identifier of the token to reject.

- **issuerAccountId**: `AccountId`  
  The account rejecting the token. This must be provided as an `AccountId` object.

---

#### Returns

- **BaseTransactionBuilder<RejectTokenResult>**  
  A transaction builder that can be used to:
    - Execute the transaction in custodial mode using `signAndExecute(client)`
    - Get transaction bytes for non-custodial execution using `getTxBytesString(client, issuerAccountId)`

---

#### Custodial Usage

```typescript
const response = await HtsTransactionBuilder
    .rejectToken(tokenId, operatorAccountId)
    .signAndExecute(client);
```

Returns a `CustodialRejectTokenResult` containing:
- **txHash**: `string` — The transaction hash (transaction ID) of the executed token rejection.
- **status**: `string` — The status of the transaction receipt.

#### Non-custodial Usage

```typescript
const txBytes = await HtsTransactionBuilder
    .rejectToken(tokenId, executorAccountId)
    .getTxBytesString(client, executorAccountId);
```

Returns a `NonCustodialRejectTokenResult` containing:
- **txBytes**: `string` — The base64-encoded transaction bytes that can be signed and executed elsewhere.

---

#### Behavior & Error Handling

1. **Transaction Construction**:  
   It creates a `TokenRevokeKycTransaction` using the `RejectTokenStrategy` that:
    - Rejects the specified token for the issuer account.

2. **For Custodial Execution**:
    - The transaction is executed on the network using the provided client.
    - The receipt is obtained and the status is checked.
    - If the status does not include `"SUCCESS"`, an error is thrown.

3. **For Non-custodial Execution**:
    - The transaction is built and frozen with the client.
    - The transaction bytes are returned as a base64-encoded string.
    - No execution happens on the network.

---

### `HtsTransactionBuilder.transferToken(tokenId, amount, targetAccountId, issuerAccountId)`

This static method creates a transaction builder for transferring tokens from one account to another.

---

#### Parameters

- **tokenId**: `TokenId | string`  
  The identifier of the token to transfer.

- **amount**: `number`  
  The amount of tokens to transfer.

- **targetAccountId**: `AccountId | string`  
  The account to which the tokens will be transferred. This can be provided either as a string or as an `AccountId` object.

- **issuerAccountId**: `AccountId | string`  
  The account from which the tokens will be transferred. This can be provided either as a string or as an `AccountId` object.

---

#### Returns

- **BaseTransactionBuilder<TransferTokenResult>**  
  A transaction builder that can be used to:
    - Execute the transaction in custodial mode using `signAndExecute(client)`
    - Get transaction bytes for non-custodial execution using `getTxBytesString(client, issuerAccountId)`

---

#### Custodial Usage

```typescript
const response = await HtsTransactionBuilder
    .transferToken(tokenId, amount, targetAccountId, operatorAccountId)
    .signAndExecute(client);
```

Returns a `CustodialTransferTokenResult` containing:
- **txHash**: `string` — The transaction hash (transaction ID) of the executed token transfer.
- **status**: `string` — The status of the transaction receipt.

#### Non-custodial Usage

```typescript
const txBytes = await HtsTransactionBuilder
    .transferToken(tokenId, amount, targetAccountId, executorAccountId)
    .getTxBytesString(client, executorAccountId);
```

Returns a `NonCustodialTransferTokenResult` containing:
- **txBytes**: `string` — The base64-encoded transaction bytes that can be signed and executed elsewhere.

---

#### Behavior & Error Handling

1. **Transaction Construction**:  
   It creates a `TransferTransaction` using the `TransferTokenStrategy` that:
    - Deducts the specified token amount from the issuer account.
    - Credits the same amount to the target account.

2. **For Custodial Execution**:
    - The transaction is executed on the network using the provided client.
    - The receipt is obtained and the status is checked.
    - If the status does not include `"SUCCESS"`, an error is thrown.

3. **For Non-custodial Execution**:
    - The transaction is built and frozen with the client.
    - The transaction bytes are returned as a base64-encoded string.
    - No execution happens on the network.


- ## Account

### `AccountTransactionBuilder.approveAssetAllowance(spenderAccount, amount, issuerAccountId, tokenId?)`

This static method creates a transaction builder for approving an allowance for a spender account to spend either HBAR or a specific token from the issuer account.

---

#### Parameters

- **spenderAccount**: `string | AccountId`  
  The account that will be granted the allowance to spend assets. This can be provided either as a string or as an `AccountId` object.

- **amount**: `number`  
  The amount of the allowance in base units.

- **issuerAccountId**: `string | AccountId`  
  The account granting the spending allowance. This can be provided either as a string or as an `AccountId` object.

- **tokenId** (optional): `TokenId`  
  The identifier of the token to be allowed for spending. If not provided, the allowance will be for HBAR.

---

#### Returns

- **BaseTransactionBuilder<AssetAllowanceResult>**  
  A transaction builder that can be used to:
    - Execute the transaction in custodial mode using `signAndExecute(client)`
    - Get transaction bytes for non-custodial execution using `getTxBytesString(client, issuerAccountId)`

---

#### Custodial Usage

```typescript
const response = await AccountTransactionBuilder
    .approveAssetAllowance(spenderAccount, amount, operatorAccountId, tokenId)
    .signAndExecute(client);
```

Returns a `CustodialAssetAllowanceResult` containing:
- **txHash**: `string` — The transaction hash (transaction ID) of the executed allowance approval.
- **status**: `string` — The status of the transaction receipt.

#### Non-custodial Usage

```typescript
const txBytes = await AccountTransactionBuilder
    .approveAssetAllowance(spenderAccount, amount, executorAccountId, tokenId)
    .getTxBytesString(client, executorAccountId);
```

Returns a `NonCustodialAssetAllowanceResult` containing:
- **txBytes**: `string` — The base64-encoded transaction bytes that can be signed and executed elsewhere.

---

#### Behavior & Error Handling

1. **Transaction Construction**:  
   It creates an `AccountAllowanceApproveTransaction` using the `AssetAllowanceStrategy` that:
    - Approves the specified amount of HBAR or token for the spender account.

2. **For Custodial Execution**:
    - The transaction is executed on the network using the provided client.
    - The receipt is obtained and the status is checked.
    - If the status does not include `"SUCCESS"`, an error is thrown.

3. **For Non-custodial Execution**:
    - The transaction is built and frozen with the client.
    - The transaction bytes are returned as a base64-encoded string.
    - No execution happens on the network.

---

# Queries

## HBAR - native token operations

### `get_hbar_balance(accountId, networkType)`

This asynchronous function retrieves the HBAR balance of a given account using the Hedera SDK.

---

#### Parameters

- **client**: `Client`  
  An instance of the Hedera `Client`, configured for the appropriate network (e.g., testnet, mainnet).

- **accountId**: `string | AccountId`
  The identifier of the account for which to retrieve the HBAR balance. If null or undefined, an error is thrown.

---

#### Returns

- **Promise<number>**  
  A promise that resolves to the HBAR balance of the account as a number, represented in HBAR.

---

#### Behavior & Error Handling

1. **Validation:**:
    - Checks if accountId is provided.
    - Throws an error if accountId is null or not supplied.

2. **Query Construction & Execution**:
    - Constructs an `AccountBalanceQuery` using the provided `accountId`.
    - Executes the query using the provided `client`.

3. **Result Formation**:
    - Retrieves the balance in HBAR from the query result.

---


## HCS - Hedera Consensus Service

### `get_topic_info(topicId, networkType)`

This asynchronous function fetches topic information from the Hedera mirror node API based on the provided topic identifier and network type.

---

#### Parameters

- **topicId**: `TopicId`  
  The identifier of the topic for which to retrieve information.

- **networkType**: `HederaNetworkType`  
  The Hedera network type (e.g., testnet, mainnet) used to construct the base URL for the mirror node API.

---

#### Returns

- **Promise<TopicInfoApiResponse>**  
  A promise that resolves to the topic information retrieved from the mirror node API.

---

#### Behavior & Error Handling

1. **API URL Construction**:  
   The function uses the helper `createBaseMirrorNodeApiUrl` with the provided `networkType` to generate the base URL. It then appends the topic ID to form the full endpoint URL.

2. **Fetching Data**:  
   It performs a GET request to the constructed URL using the `fetch` API, and parses the JSON response into a `TopicInfoApiResponse` object.

3. **Error Handling**:  
   If the response does not contain valid data, the function throws an error with the message `"Could not find or fetch topic info"`.

4. **Result Formation**:  
   On a successful fetch, the function returns the parsed topic information data.

---

### `get_topic_messages(topicId, networkType, lowerTimestamp?, upperTimestamp?)`

This asynchronous function retrieves messages for a given topic from the Hedera mirror node API. It supports optional filtering by timestamps and handles pagination automatically, fetching up to 100 messages per page until all messages are retrieved.

---

#### Parameters

- **topicId**: `TopicId`  
  The identifier of the topic from which messages will be fetched.

- **networkType**: `HederaNetworkType`  
  The network (e.g., testnet, mainnet) where the topic is hosted. This is used to construct the base URL for the mirror node API.

- **lowerTimestamp** *(optional)*: `number`  
  An optional Unix timestamp (in seconds.milliseconds format) serving as a lower bound filter. Only messages with timestamps greater than or equal to this value will be returned.

- **upperTimestamp** *(optional)*: `number`  
  An optional Unix timestamp (in seconds.milliseconds format) serving as an upper bound filter. Only messages with timestamps less than or equal to this value will be returned.

---

#### Returns

- **Promise<Array<HCSMessage>>**  
  A promise that resolves to an array of `HCSMessage` objects containing the messages fetched from the topic.

---

#### Behavior & Error Handling

1. **URL Construction**:
    - Constructs a base URL using `createBaseMirrorNodeApiUrl(networkType)`.
    - Appends the topic ID and query parameters including encoding (set to UTF-8), a limit of 100 messages per page, and order (descending).
    - Optionally adds timestamp filters if `lowerTimestamp` and/or `upperTimestamp` are provided.

2. **Pagination Handling**:
    - The function enters a loop to fetch paginated results.
    - After each fetch, it appends the messages from the current page to an array.
    - It updates the URL using the `data.links.next` value (if present) to fetch the next page of messages.

3. **Error Handling**:
    - Checks if the HTTP response is OK. If not, it throws an error with the HTTP status and status text.
    - Any errors encountered during fetching or JSON parsing are logged and re-thrown.

4. **Result Formation**:
    - Once all pages have been fetched, the function returns the aggregated array of `HCSMessage` objects.

---


## HTS - Hedera Token Service

### `get_hts_token_details(tokenId, networkType)`

This asynchronous function retrieves detailed information about a specific Hedera Token Service (HTS) token from the Hedera mirror node API.

---

#### Parameters

- **tokenId**: `TokenId`  
  The identifier of the token for which to retrieve details.

- **networkType**: `HederaNetworkType`  
  The Hedera network type (e.g., testnet, mainnet) used to construct the base URL for the mirror node API.

---

#### Returns

- **Promise<HtsTokenDetails>**  
  A promise that resolves to an object containing detailed information about the token, including:
    - **token_id**: `string` — The token's identifier.
    - **name**: `string` — The token's name.
    - **symbol**: `string` — The token's symbol.
    - **decimals**: `number` — The number of decimal places for the token.
    - **total_supply**: `string` — The total supply of the token.
    - **treasury_account_id**: `string` — The account ID of the token's treasury.
    - **custom_fees**: `object` — Information about custom fees associated with the token.
    - **admin_key**: `object` — Information about the token's admin key.
    - **supply_key**: `object` — Information about the token's supply key.
    - **metadata_key**: `object` — Information about the token's metadata key.
    - **type**: `string` — The token type (e.g., "FUNGIBLE_COMMON", "NON_FUNGIBLE_UNIQUE").
    - **supply_type**: `string` — The supply type (e.g., "INFINITE", "FINITE").
    - **max_supply**: `string` — The maximum supply for finite supply tokens.
    - **initial_supply**: `string` — The initial supply of the token.
    - **created_timestamp**: `string` — The timestamp when the token was created.
    - **modified_timestamp**: `string` — The timestamp when the token was last modified.
    - **deleted**: `boolean` — Whether the token has been deleted.
    - **auto_renew_account_id**: `string` — The account ID for auto-renewal.
    - **auto_renew_period**: `string` — The auto-renewal period.
    - **expiry_timestamp**: `string` — The timestamp when the token will expire.
    - **memo**: `string` — The token's memo.
    - **pause_key**: `object` — Information about the token's pause key.
    - **pause_status**: `string` — The token's pause status.
    - **kyc_key**: `object` — Information about the token's KYC key.
    - **freeze_key**: `object` — Information about the token's freeze key.
    - **fee_schedule_key**: `object` — Information about the token's fee schedule key.
    - **custom_fees**: `object` — Information about custom fees associated with the token.

---

#### Behavior & Error Handling

1. **API URL Construction**:
    - Constructs a base URL using `createBaseMirrorNodeApiUrl(networkType)`.
    - Appends the token ID to form the full endpoint URL.

2. **Fetching Data**:
    - Performs a GET request to the constructed URL using the `fetch` API.
    - Parses the JSON response into an `HtsTokenDetails` object.

3. **Error Handling**:
    - If the response does not contain valid data, it throws an error with the message `"Could not find or fetch token details"`.

4. **Result Formation**:
    - On successful fetch, it returns the parsed token details.

---

### `get_hts_balance(accountId, tokenId, networkType)`

This asynchronous function retrieves the balance of a specific token for a given account from the Hedera mirror node API.

---

#### Parameters

- **accountId**: `AccountId`  
  The identifier of the account for which to retrieve the token balance.

- **tokenId**: `TokenId`  
  The identifier of the token for which to retrieve the balance.

- **networkType**: `HederaNetworkType`  
  The Hedera network type (e.g., testnet, mainnet) used to construct the base URL for the mirror node API.

---

#### Returns

- **Promise<TokenBalance>**  
  A promise that resolves to an object containing:
    - **balance**: `number` — The token balance of the account.
    - **tokenId**: `string` — The identifier of the token.

---

#### Behavior & Error Handling

1. **API URL Construction**:
    - Constructs a base URL using `createBaseMirrorNodeApiUrl(networkType)`.
    - Appends the account ID and token relationship endpoint to form the full URL.

2. **Fetching Data**:
    - Performs a GET request to the constructed URL using the `fetch` API.
    - Parses the JSON response to extract the token balance.

3. **Error Handling**:
    - If the response does not contain valid data or the token is not found, it returns a balance of `0`.

4. **Result Formation**:
    - On successful fetch, it returns an object containing the token balance and token ID.

---

### `get_all_tokens_balances(accountId, networkType)`

This asynchronous function retrieves the balances of all tokens associated with a given account from the Hedera mirror node API.

---

#### Parameters

- **accountId**: `AccountId`  
  The identifier of the account for which to retrieve token balances.

- **networkType**: `HederaNetworkType`  
  The Hedera network type (e.g., testnet, mainnet) used to construct the base URL for the mirror node API.

---

#### Returns

- **Promise<TokenBalance[]>**  
  A promise that resolves to an array of objects, each containing:
    - **balance**: `number` — The token balance of the account.
    - **tokenId**: `string` — The identifier of the token.

---

#### Behavior & Error Handling

1. **API URL Construction**:
    - Constructs a base URL using `createBaseMirrorNodeApiUrl(networkType)`.
    - Appends the account ID and token relationship endpoint to form the full URL.

2. **Fetching Data**:
    - Performs a GET request to the constructed URL using the `fetch` API.
    - Parses the JSON response to extract the token balances.

3. **Error Handling**:
    - If the response does not contain valid data, it returns an empty array.

4. **Result Formation**:
    - On successful fetch, it returns an array of objects, each containing a token balance and token ID.

---

### `get_token_holders(tokenId, networkType)`

This asynchronous function retrieves a list of accounts that hold a specific token from the Hedera mirror node API.

---

#### Parameters

- **tokenId**: `TokenId`  
  The identifier of the token for which to retrieve holders.

- **networkType**: `HederaNetworkType`  
  The Hedera network type (e.g., testnet, mainnet) used to construct the base URL for the mirror node API.

---

#### Returns

- **Promise<TokenBalance[]>**  
  A promise that resolves to an array of objects, each containing:
    - **balance**: `number` — The token balance of the account.
    - **tokenId**: `string` — The identifier of the token.
    - **accountId**: `string` — The identifier of the account holding the token.

---

#### Behavior & Error Handling

1. **API URL Construction**:
    - Constructs a base URL using `createBaseMirrorNodeApiUrl(networkType)`.
    - Appends the token ID and balances endpoint to form the full URL.

2. **Fetching Data**:
    - Performs a GET request to the constructed URL using the `fetch` API.
    - Parses the JSON response to extract the token holders.

3. **Error Handling**:
    - If the response does not contain valid data, it returns an empty array.

4. **Result Formation**:
    - On successful fetch, it returns an array of objects, each containing a token balance, token ID, and account ID.

---

### `get_pending_airdrops(accountId, networkType)`

This asynchronous function retrieves a list of pending airdrops for a given account from the Hedera mirror node API.

---

#### Parameters

- **accountId**: `AccountId`  
  The identifier of the account for which to retrieve pending airdrops.

- **networkType**: `HederaNetworkType`  
  The Hedera network type (e.g., testnet, mainnet) used to construct the base URL for the mirror node API.

---

#### Returns

- **Promise<Airdrop[]>**  
  A promise that resolves to an array of objects, each containing:
    - **airdropId**: `string` — The identifier of the airdrop.
    - **tokenId**: `string` — The identifier of the token being airdropped.
    - **amount**: `number` — The amount of tokens being airdropped.
    - **status**: `string` — The status of the airdrop.
    - **createdAt**: `string` — The timestamp when the airdrop was created.
    - **updatedAt**: `string` — The timestamp when the airdrop was last updated.

---

#### Behavior & Error Handling

1. **API URL Construction**:
    - Constructs a base URL using `createBaseMirrorNodeApiUrl(networkType)`.
    - Appends the account ID and pending airdrops endpoint to form the full URL.

2. **Fetching Data**:
    - Performs a GET request to the constructed URL using the `fetch` API.
    - Parses the JSON response to extract the pending airdrops.

3. **Error Handling**:
    - If the response does not contain valid data, it returns an empty array.

4. **Result Formation**:
    - On successful fetch, it returns an array of objects, each containing details about a pending airdrop.

---
