import BigNumber from 'bignumber.js';
import {
  PublicKey,
  AccountId,
  TopicId,
  PrivateKey,
  CustomFee,
  TokenType,
  TokenSupplyType,
  TokenId,
  Long,
  NftId,
  CustomFixedFee,
  Key,
  FileId,
  ContractFunctionParameters,
  KeyList,
  ContractId,
  Hbar,
  EvmAddress,
  PendingAirdropId,
  TransactionId,
  ScheduleId,
} from '@hashgraph/sdk';

export {
  PublicKey,
  AccountId,
  TopicId,
  PrivateKey,
  CustomFee,
  TokenType,
  TokenSupplyType,
  TokenId,
  Long,
  NftId,
  CustomFixedFee,
  Key,
  FileId,
  ContractFunctionParameters,
  KeyList,
  ContractId,
  Hbar,
  EvmAddress,
  PendingAirdropId,
  TransactionId,
  ScheduleId,
};

export type AgentOperationalMode = 'autonomous' | 'returnBytes';
export type HederaNetworkType = 'mainnet' | 'testnet' | 'previewnet';

/**
 * Configuration for custom mirror node providers.
 *
 * @example
 * // Using HGraph with API key in URL
 * const config = {
 *   customUrl: 'https://mainnet.hedera.api.hgraph.dev/v1/<API-KEY>',
 *   apiKey: 'your-api-key-here'
 * };
 *
 * @example
 * // Using custom provider with API key in headers
 * const config = {
 *   customUrl: 'https://custom-mirror-node.com',
 *   apiKey: 'your-api-key',
 *   headers: {
 *     'X-Custom-Header': 'value'
 *   }
 * };
 */
export interface MirrorNodeConfig {
  /** Custom mirror node URL. Can include <API-KEY> placeholder for URL-based API keys. */
  customUrl?: string;
  /** API key for authentication. Will be used in both Authorization header and URL replacement. */
  apiKey?: string;
  /** Additional custom headers to include with requests. */
  headers?: Record<string, string>;
}

export type TokenBalance = {
  account: string;
  balance: number;
  decimals: number;
};

export type TokenHoldersBalancesApiResponse = {
  timestamp: string;
  balances: TokenBalance[];
  links: {
    next: string;
  };
};

export type DetailedTokenBalance = {
  tokenId: string;
  tokenSymbol: string;
  tokenName: string;
  tokenDecimals: string;
  balance: number;
  balanceInDisplayUnit: BigNumber;
  timestamp: string;
  balances: {
    account: string;
    balance: number;
    tokens: {
      token_id: string;
      balance: number;
    }[];
  }[];
  links: {
    next: string | null;
  };
};

export type HtsTokenBalanceApiReponse = {
  timestamp: string;
  balances: TokenBalance[];
  links: {
    next: string;
  };
};

type ProtobufEncodedKey = {
  _type: 'ProtobufEncoded';
  key: string;
};

export type CustomFees = {
  created_timestamp: string;
  fixed_fees: unknown[];
  fractional_fees: unknown[];
};

export type HtsTokenDetails = {
  admin_key: ProtobufEncodedKey;
  auto_renew_account: string;
  auto_renew_period: number;
  created_timestamp: string;
  custom_fees: CustomFees;
  decimals: string;
  deleted: boolean;
  expiry_timestamp: number;
  fee_schedule_key: ProtobufEncodedKey;
  freeze_default: boolean;
  freeze_key: ProtobufEncodedKey;
  initial_supply: string;
  kyc_key: ProtobufEncodedKey;
  max_supply: string;
  memo: string;
  metadata: string;
  metadata_key: ProtobufEncodedKey | null;
  modified_timestamp: string;
  name: string;
  pause_key: ProtobufEncodedKey;
  pause_status: 'PAUSED' | 'UNPAUSED';
  supply_key: ProtobufEncodedKey;
  supply_type: 'FINITE' | 'INFINITE';
  symbol: string;
  token_id: string;
  total_supply: string;
  treasury_account_id: string;
  type: 'FUNGIBLE_COMMON' | 'NON_FUNGIBLE_UNIQUE';
  wipe_key: ProtobufEncodedKey;
  supplyType: TokenSupplyType;
  maxSupply?: number | BigNumber;
};

export type AllTokensBalancesApiResponse = {
  timestamp: string;
  balances: {
    account: string; // Account ID in the format "0.0.x"
    balance: number; // Total balance equivalent in HBAR
    tokens: {
      token_id: string; // Token ID in the format "0.0.x"
      balance: number; // Balance of the specific token
    }[];
  }[];
  links: {
    next: string | null; // link to next page
  };
};

export type Airdrop = {
  amount: number;
  receiver_id: string;
  sender_id: string;
  token_id: string;
};

export type PendingAirdropsApiResponse = {
  airdrops: Airdrop[];
  links: {
    next: string | null;
  };
};

type TimestampRange = {
  from: string;
  to?: string | null;
};

export type TopicInfoApiResponse = {
  admin_key?: Key | null;
  auto_renew_account?: string | null;
  auto_renew_period?: number | null;
  created_timestamp?: string | null;
  deleted?: boolean | null;
  memo?: string;
  submit_key?: Key | null;
  timestamp?: TimestampRange;
  topic_id?: string | null;
};

export type HCSMessage = {
  chunk_info: unknown | null;
  consensus_timestamp: string;
  message: string;
  payer_account_id: string;
  running_hash: string;
  running_hash_version: number;
  sequence_number: number;
  topic_id: string;
  supplyType: TokenSupplyType;
  maxSupply?: number | BigNumber;
  raw_content?: string;
};

export type HCSMessageApiResponse = {
  messages: HCSMessage[];
  links: {
    next: string | null;
  };
};

export enum AgentKitActionName {
  CREATE_TOPIC_CUSTODIAL = 'createTopicCustodial',
  CREATE_TOPIC_NON_CUSTODIAL = 'createTopicNonCustodial',
  DELETE_TOPIC_CUSTODIAL = 'deleteTopicCustodial',
  DELETE_TOPIC_NON_CUSTODIAL = 'deleteTopicNonCustodial',
  SUBMIT_TOPIC_MESSAGE_CUSTODIAL = 'submitTopicMessageCustodial',
  SUBMIT_TOPIC_MESSAGE_NON_CUSTODIAL = 'submitTopicMessageCustodial',
  CREATE_TOKEN_CUSTODIAL = 'createTokenCustodial',
  CREATE_TOKEN_NON_CUSTODIAL = 'createTokenNonCustodial',
  ASSOCIATE_TOKEN_CUSTODIAL = 'associateTokenCustodial',
  ASSOCIATE_TOKEN_NON_CUSTODIAL = 'associateTokenNonCustodial',
  DISSOCIATE_TOKEN_CUSTODIAL = 'dissociateTokenCustodial',
  DISSOCIATE_TOKEN_NON_CUSTODIAL = 'dissociateTokenNonCustodial',
  AIRDROP_TOKEN_CUSTODIAL = 'airdropTokenCustodial',
  AIRDROP_TOKEN_NON_CUSTODIAL = 'airdropTokenNonCustodial',
  REJECT_TOKEN_CUSTODIAL = 'rejectedTokenCustodial',
  REJECT_TOKEN_NON_CUSTODIAL = 'rejectedTokenNonCustodial',
  MINT_TOKEN_CUSTODIAL = 'mintTokenCustodial',
  MINT_TOKEN_NON_CUSTODIAL = 'mintTokenNonCustodial',
  MINT_NFT_TOKEN_CUSTODIAL = 'mintNFTTokenCustodial',
  MINT_NFT_TOKEN_NON_CUSTODIAL = 'mintNFTTokenNonCustodial',
  CLAIM_AIRDROP_CUSTODIAL = 'claimAirdropCustodial',
  CLAIM_AIRDROP_NON_CUSTODIAL = 'claimAirdropNonCustodial',
  TRANSFER_TOKEN_CUSTODIAL = 'transferTokenCustodial',
  TRANSFER_TOKEN_NON_CUSTODIAL = 'transferTokenNonCustodial',
  TRANSFER_HBAR_CUSTODIAL = 'transferHbarCustodial',
  TRANSFER_HBAR_NON_CUSTODIAL = 'transferHbarNonCustodial',
  ASSET_ALLOWANCE_CUSTODIAL = 'assetAllowedCustodial',
  ASSET_ALLOWANCE_NON_CUSTODIAL = 'assetAllowedNonCustodial',
}

/**
 * Parameters for creating a new Hedera Consensus Service (HCS) topic.
 */
export interface CreateTopicParams {
  /** Optional. The publicly visible memo for the topic. */
  memo?: string;
  /**
   * Optional. The administrative key for the topic.
   * Can be a PrivateKey string (for the builder to derive public key and potentially sign if different from operator)
   * or a PublicKey object.
   * If not provided, the topic might be immutable depending on Hedera defaults, or operator may become admin.
   */
  adminKey?: string | Key;
  /**
   * Optional. The key authorized to submit messages to the topic.
   * Can be a PrivateKey string or a PublicKey object.
   * If not provided, anyone can submit.
   */
  submitKey?: string | Key;
  /**
   * Optional. The auto-renewal period for the topic, in seconds.
   * Defaults to 7776000 (approximately 90 days) if not specified by the user; the builder will apply this default.
   */
  autoRenewPeriod?: number;
  /**
   * Optional. The account ID to be used for auto-renewal payments.
   * If not provided, and if an adminKey is the current signer, the signer's account may be used by default by Hedera.
   * Can be an AccountId object or a string representation (e.g., "0.0.xxxx").
   */
  autoRenewAccountId?: string | AccountId;
  /** Optional. The key which can change the token's custom fee schedule. If not set, the adminKey may control this. */
  feeScheduleKey?: string | Key;
  /** Optional. A list of account IDs that should be exempt from custom fees. */
  exemptAccountIds?: string[];
  /** Optional. A list of custom fees to be applied to the topic. */
  customFees?: CustomFixedFee[];
}

/**
 * Parameters for submitting a message to an HCS topic.
 */
export interface SubmitMessageParams {
  /** The ID of the topic to submit the message to. */
  topicId: string | TopicId;
  /** The message content. Can be a string or Uint8Array for binary data. */
  message: string | Uint8Array;
  /**
   * Optional. The maximum number of chunks to divide the message into if it exceeds single transaction limits.
   * The builder will handle chunking if necessary.
   */
  maxChunks?: number;
  /**
   * Optional. The size of each chunk in bytes if chunking is performed.
   * Defaults to a reasonable value (e.g., 1024 bytes) if not specified and chunking is needed.
   */
  chunkSize?: number;
  /**
   * Optional. A specific private key to sign message submission if the topic requires it
   * and it's different from the main operator/signer.
   * Can be a PrivateKey object or its string representation.
   */
  submitKey?: string | PrivateKey;
}

/**
 * Parameters for deleting an HCS topic.
 */
export interface DeleteTopicParams {
  /** The ID of the topic to be deleted. */
  topicId: string | TopicId;
}

/**
 * Represents a single hbar transfer operation.
 * Amount is in hbars (positive for credit, negative for debit).
 */
export interface HbarTransfer {
  accountId: string | AccountId;
  amount: Hbar;
}

/**
 * Parameters for an HBAR transfer operation, potentially involving multiple accounts.
 * The sum of all transfer amounts must be zero.
 */
export interface HbarTransferParams {
  transfers: HbarTransfer[];
  /** Optional memo for the transaction. */
  memo?: string;
}

/**
 * Parameters for creating a new Hedera Fungible Token.
 */
export interface FTCreateParams {
  /** The publicly visible name of the token. Max 100 characters. */
  tokenName: string;
  /** The publicly visible symbol of the token. Max 100 characters. */
  tokenSymbol: string;
  /** The account which will act as a treasury for the token. This account will receive the initial supply. */
  treasuryAccountId: string | AccountId;
  /** The initial supply of tokens to be minted to the treasury account. In the smallest denomination. */
  initialSupply: number | BigNumber;
  /** The number of decimal places a token is divisible by. */
  decimals: number;
  /** The key which can perform update/delete operations on the token. */
  adminKey?: string | Key;
  /** The key which can grant or revoke KYC of an account for the token. */
  kycKey?: string | Key;
  /** The key which can sign to freeze or unfreeze an account for token transactions. */
  freezeKey?: string | Key;
  /** The key which can wipe the token balance of an account. */
  wipeKey?: string | Key;
  /** The key which can change the total supply of a token. */
  supplyKey?: string | Key;
  /** The key which can change the token's custom fee schedule. */
  feeScheduleKey?: string | Key;
  /** The key which can pause or unpause the token. */
  pauseKey?: string | Key;
  /** The account which will be automatically charged to renew the token's expiration. */
  autoRenewAccountId?: string | AccountId;
  /** The period that the auto-renew account will be charged to extend the token's expiry. In seconds. Defaults to 7776000 (90 days). */
  autoRenewPeriod?: number;
  /** The memo associated with the token. Max 100 characters. */
  memo?: string;
  /** The default freeze status (frozen or unfrozen) of accounts signed up for this token. Defaults to false (unfrozen). */
  freezeDefault?: boolean;
  /** The custom fees to be assessed during atomic swaps for this token. */
  customFees?: CustomFee[] | undefined;
  /** The supply type of the token (Finite or Infinite). */
  supplyType: TokenSupplyType;
  /** The maximum number of tokens that can be in circulation. Required if supplyType is Finite. */
  maxSupply?: number | BigNumber;
}

/**
 * Parameters for creating a new Hedera Non-Fungible Token (NFT).
 */
export interface NFTCreateParams {
  /** The publicly visible name of the token. Max 100 characters. */
  tokenName: string;
  /** The publicly visible symbol of the token. Max 100 characters. */
  tokenSymbol: string;
  /** The account which will act as a treasury for the token. */
  treasuryAccountId: string | AccountId;
  /** The key which can perform update/delete operations on the token. */
  adminKey?: string | Key;
  /** The key which can grant or revoke KYC of an account for the token. */
  kycKey?: string | Key;
  /** The key which can sign to freeze or unfreeze an account for token transactions. */
  freezeKey?: string | Key;
  /** The key which can wipe the token balance of an account. */
  wipeKey?: string | Key;
  /** The key which can change the total supply of a token (mint/burn). */
  supplyKey?: string | Key;
  /** The key which can change the token's custom fee schedule. */
  feeScheduleKey?: string | Key;
  /** The key which can pause or unpause the token. */
  pauseKey?: string | Key;
  /** The account which will be automatically charged to renew the token's expiration. */
  autoRenewAccountId?: string | AccountId;
  /** The period that the auto-renew account will be charged to extend the token's expiry. In seconds. Defaults to 7776000 (90 days). */
  autoRenewPeriod?: number;
  /** The memo associated with the token. Max 100 characters. */
  memo?: string;
  /** The default freeze status (frozen or unfrozen) of accounts signed up for this token. Defaults to false (unfrozen). */
  freezeDefault?: boolean;
  /** The custom fees to be assessed. Instances of FixedFee, FractionalFee, RoyaltyFee (all extend CustomFee). */
  customFees?: CustomFee[];
  /** The supply type, typically Finite for NFTs. Max supply also needed for Finite. */
  supplyType: TokenSupplyType; // e.g., TokenSupplyType.Finite
  /** The maximum number of NFTs that can be minted. Required if supplyType is Finite. */
  maxSupply?: number | BigNumber; // BigNumber for consistency, though NFTs are u64
}

/**
 * Parameters for minting new NFTs for a given NFT token.
 */
export interface MintNFTParams {
  /** The ID of the NFT token to mint for. */
  tokenId: string | TokenId;
  /** An array of metadata for each NFT to be minted. Each Uint8Array is one NFT's metadata (max 100 bytes each). */
  metadata: Uint8Array[];
  /** Optional. The batch size for minting transactions if many NFTs are minted. Defaults to 10. */
  batchSize?: number | undefined;
  nftId?: NftId | undefined;
  senderAccountId?: string | AccountId | undefined;
  receiverAccountId?: string | AccountId | undefined;
  isApproved?: boolean | undefined;
  memo?: string | undefined;
}

/**
 * Parameters for updating an existing HCS topic.
 * All fields are optional except topicId. Providing `null` to a key field typically clears it.
 * Using an empty string for memo clears it.
 */
export interface UpdateTopicParams {
  /** The ID of the topic to update. */
  topicId: string | TopicId;
  /** New memo for the topic. An empty string effectively clears the memo. `null` can also be used to signal clearing. */
  memo?: string | null;
  /** New admin key for the topic. `null` to clear the admin key (if permissible). */
  adminKey?: string | Key | null;
  /** New submit key for the topic. `null` to clear the submit key. */
  submitKey?: string | Key | null;
  /** New auto-renewal period in seconds. */
  autoRenewPeriod?: number;
  /** New account ID for auto-renewal. `null` to clear the auto-renew account. */
  autoRenewAccountId?: string | AccountId | null;
  /** New fee schedule key for the topic. `null` to clear. */
  feeScheduleKey?: string | Key | null;
  /** Optional. A list of account IDs that should be exempt from custom fees. This will overwrite any existing exemptions. To clear all exemptions, provide an empty array. */
  exemptAccountIds?: string[];
}

/**
 * Parameters for minting more fungible tokens.
 */
export interface MintFTParams {
  /** The ID of the fungible token to mint for. */
  tokenId: string | TokenId;
  /** The amount of tokens to mint, in the smallest unit of the token. */
  amount: number | BigNumber;
}

/**
 * Parameters for burning fungible tokens.
 */
export interface BurnFTParams {
  /** The ID of the fungible token to burn. */
  tokenId: string | TokenId;
  /** The amount of tokens to burn, in the smallest unit of the token. */
  amount: number | BigNumber;
}

/**
 * Parameters for burning Non-Fungible Tokens.
 */
export interface BurnNFTParams {
  /** The ID of the NFT token whose serials are to be burned. */
  tokenId: string | TokenId;
  /** An array of serial numbers to burn. Values can be number, Long, or BigNumber for large serials. */
  serials: Array<number | Long | BigNumber>;
}

/**
 * Parameters for transferring a single Non-Fungible Token (NFT).
 */
export interface TransferNFTParams {
  /** The specific NFT to transfer, identified by its token ID and serial number. */
  nftId: NftId; // Using NftId directly, e.g., TokenId.fromString(id).nft(serial)
  /** The account ID of the sender. */
  senderAccountId: string | AccountId;
  /** The account ID of the receiver. */
  receiverAccountId: string | AccountId;
  /**
   * Optional. Set to true if the sender is not the owner of the NFT but is an approved operator for it (or for all of owner's NFTs).
   * Defaults to false, indicating the sender is the owner.
   */
  isApproved?: boolean;
  /** Optional memo for the transaction. */
  memo?: string;
}

/**
 * Parameters for associating tokens with an account.
 */
export interface AssociateTokensParams {
  /** The account ID to associate tokens with. */
  accountId: string | AccountId;
  /** An array of token IDs to associate. */
  tokenIds: Array<string | TokenId>;
  initialBalance?: number | BigNumber | undefined;
  key: string | PublicKey;
  memo?: string;
  autoRenewAccountId?: string | AccountId;
  autoRenewPeriod?: number;
  receiverSignatureRequired?: boolean;
  maxAutomaticTokenAssociations?: number;
  stakedAccountId?: string | AccountId;
  stakedNodeId?: number | Long;
  declineStakingReward?: boolean;
  alias?: EvmAddress | string;
}

/**
 * Parameters for dissociating tokens from an account.
 */
export interface DissociateTokensParams {
  /** The account ID to dissociate tokens from. */
  accountId: string | AccountId;
  /** An array of token IDs to dissociate. */
  tokenIds: Array<string | TokenId>;
}

/**
 * Represents a single fungible token transfer operation.
 * Amount is in the smallest unit (positive for credit, negative for debit).
 */
export interface FungibleTokenTransferSpec {
  type: 'fungible';
  tokenId: string | TokenId;
  accountId: string | AccountId;
  amount: number | BigNumber;
}

/**
 * Represents a single non-fungible token (NFT) transfer operation.
 */
export interface NonFungibleTokenTransferSpec {
  type: 'nft';
  nftId: NftId;
  senderAccountId: string | AccountId;
  receiverAccountId: string | AccountId;
  isApproved?: boolean;
}

/**
 * Union type for different kinds of token transfers.
 */
export type TokenTransferSpec =
  | FungibleTokenTransferSpec
  | NonFungibleTokenTransferSpec;

/**
 * Parameters for a generic token transfer operation, potentially involving multiple tokens and NFTs.
 */
export interface TransferTokensParams {
  /** An array of token transfer specifications (fungible or NFT). */
  tokenTransfers: TokenTransferSpec[];
  /** Optional. An array of HBAR transfer specifications. */
  hbarTransfers?: HbarTransfer[];
  /** Optional memo for the transaction. */
  memo?: string;
}

/**
 * Parameters for wiping tokens (fungible or non-fungible) from an account.
 */
export interface WipeTokenAccountParams {
  /** The ID of the token to wipe. */
  tokenId: string | TokenId;
  /** The account ID from which tokens will be wiped. */
  accountId: string | AccountId;
  /** For Fungible Tokens: the amount to wipe. In the smallest unit. */
  amount?: number | BigNumber;
  /** For Non-Fungible Tokens: an array of serial numbers to wipe. */
  serials?: Array<number | Long | BigNumber>;
}

/**
 * Parameters for freezing an account for a specific token.
 */
export interface FreezeTokenAccountParams {
  /** The ID of the token. */
  tokenId: string | TokenId;
  /** The account ID to be frozen for the token. */
  accountId: string | AccountId;
}

/**
 * Parameters for unfreezing an account for a specific token.
 */
export interface UnfreezeTokenAccountParams {
  /** The ID of the token. */
  tokenId: string | TokenId;
  /** The account ID to be unfrozen for the token. */
  accountId: string | AccountId;
}

/**
 * Parameters for granting KYC to an account for a specific token.
 */
export interface GrantKycTokenParams {
  /** The ID of the token. */
  tokenId: string | TokenId;
  /** The account ID to be granted KYC for the token. */
  accountId: string | AccountId;
}

/**
 * Parameters for revoking KYC from an account for a specific token.
 */
export interface RevokeKycTokenParams {
  /** The ID of the token. */
  tokenId: string | TokenId;
  /** The account ID to have KYC revoked for the token. */
  accountId: string | AccountId;
}

/**
 * Parameters for pausing a token.
 */
export interface PauseTokenParams {
  /** The ID of the token to pause. */
  tokenId: string | TokenId;
}

/**
 * Parameters for unpausing a token.
 */
export interface UnpauseTokenParams {
  /** The ID of the token to unpause. */
  tokenId: string | TokenId;
}

/**
 * Parameters for updating an existing Hedera token (fungible or non-fungible).
 * All fields are optional except `tokenId`. Providing `null` to a key field clears it.
 * Using an empty string for memo/name/symbol clears them if applicable by SDK.
 */
export interface UpdateTokenParams {
  /** The ID of the token to update. */
  tokenId: string | TokenId;
  /** New name for the token. */
  tokenName?: string | null; // null or empty to clear/reset if SDK allows
  /** New symbol for the token. */
  tokenSymbol?: string | null; // null or empty to clear/reset if SDK allows
  /** New treasury account for the token. */
  treasuryAccountId?: string | AccountId;
  /** New admin key for the token. `null` to clear. */
  adminKey?: string | Key | null;
  /** New KYC key for the token. `null` to clear. */
  kycKey?: string | Key | null;
  /** New freeze key for the token. `null` to clear. */
  freezeKey?: string | Key | null;
  /** New wipe key for the token. `null` to clear. */
  wipeKey?: string | Key | null;
  /** New supply key for the token. `null` to clear. */
  supplyKey?: string | Key | null;
  /** New fee schedule key for the token. `null` to clear. */
  feeScheduleKey?: string | Key | null;
  /** New pause key for the token. `null` to clear. */
  pauseKey?: string | Key | null;
  /** New auto-renew account for the token. `null` to clear. */
  autoRenewAccountId?: string | AccountId | null;
  /** New auto-renewal period in seconds. */
  autoRenewPeriod?: number;
  /** New memo for the token. An empty string or `null` to clear. */
  memo?: string | null;
  // Note: Custom fees are not updated via TokenUpdateTransaction. Use TokenFeeScheduleUpdateTransaction.
}

/**
 * Parameters for deleting a token.
 */
export interface DeleteTokenParams {
  /** The ID of the token to delete. */
  tokenId: string | TokenId;
}

/**
 * Parameters for updating the fee schedule of a token.
 */
export interface TokenFeeScheduleUpdateParams {
  /** The ID of the token whose fee schedule is to be updated. */
  tokenId: string | TokenId;
  /** An array of new custom fees for the token. This will replace the existing fee schedule. */
  customFees: CustomFee[];
}

/**
 * Parameters for creating a new Hedera account.
 */
export interface CreateAccountParams {
  /** The initial balance of the new account in HBAR. Defaults to 0 if not specified. */
  initialBalance?: number | BigNumber | undefined;
  /**
   * The public key for the new account.
   * Can be a PublicKey object or a string representation of a PrivateKey
   * from which the PublicKey will be derived by the builder.
   * If a PrivateKey string is provided, it is used ONLY to derive the public key for account creation
   * and is NOT stored or used for signing by the builder itself.
   */
  key: string | PublicKey;
  /** Optional. The memo for the account. */
  memo?: string;
  /** Optional. The account to be used for auto-renewal payments. */
  autoRenewAccountId?: string | AccountId;
  /** Optional. The auto-renewal period for the account, in seconds. Defaults to ~90 days. */
  autoRenewPeriod?: number;
  /** Optional. If true, the account must sign any transaction transferring hbar out of this account. Defaults to false. */
  receiverSignatureRequired?: boolean;
  /** Optional. The maximum number of tokens that an Account can be implicitly associated with. Defaults to 0. */
  maxAutomaticTokenAssociations?: number;
  /** Optional. The account to which this account is staked. */
  stakedAccountId?: string | AccountId;
  /** Optional. The node ID to which this account is staked. */
  stakedNodeId?: number | Long;
  /** Optional. If true, the account declines receiving a staking reward. Defaults to false. */
  declineStakingReward?: boolean;
  /** Optional. The alias for the account. If an alias is set, the key property is not used. */
  alias?: EvmAddress | string; // string could be an EVM address string
}

/**
 * Parameters for querying a smart contract function (local call).
 */
export interface ContractCallQueryParams {
  /** The ID of the contract to call. */
  contractId: string | ContractId;
  /** The gas to use for the query. Often less critical for local queries but can be set. */
  gas?: number | Long; // Optional, as SDK might default or it might not be needed for all local queries
  /** The function name and optionally its parameter types, e.g., "getBalance(address)". */
  functionName: string;
  /** The parameters to pass to the function. */
  functionParameters?: ContractFunctionParameters;
  /** Optional: The maximum payment allowed for this query. If not set, defaults to a value set by the SDK or node. */
  maxQueryPayment?: Hbar;
  /** Optional: Payment transaction ID for this query. */
  paymentTransactionId?: string | TransactionId;
}

/**
 * Parameters for creating a new smart contract.
 */
export interface CreateContractParams {
  /** The ID of the file containing the contract bytecode. Use this OR `bytecode`. */
  bytecodeFileId?: string | FileId;
  /** The contract bytecode as a hex-encoded string or Uint8Array. Use this OR `bytecodeFileId`. */
  bytecode?: string | Uint8Array;
  /** The admin key for the contract. */
  adminKey?: string | Key;
  /** The gas to deploy the contract. */
  gas: number | Long;
  /** Initial balance to send to the contract (payable constructor). In HBAR. */
  initialBalance?: number | BigNumber;
  /** The parameters to pass to the constructor. */
  constructorParameters?: Uint8Array | ContractFunctionParameters;
  /** Memo for the contract creation transaction. */
  memo?: string;
  /** Auto-renewal period for the contract. In seconds. */
  autoRenewPeriod?: number;
  /** Account to which this contract is staked. */
  stakedAccountId?: string | AccountId;
  /** Node ID to which this contract is staked. */
  stakedNodeId?: number | Long;
  /** If true, the contract declines receiving a staking reward. */
  declineStakingReward?: boolean;
  /** Max automatic token associations for the contract. */
  maxAutomaticTokenAssociations?: number;
  contractId: string | ContractId;
  functionName: string;
  functionParameters?: ContractFunctionParameters;
  payableAmount?: number | BigNumber | Hbar;
}

/**
 * Parameters for executing a function of a smart contract.
 */
export interface ExecuteContractParams {
  /** The ID of the contract to call. */
  contractId: string | ContractId; // ContractId from SDK
  /** The gas to use for the call. */
  gas: number | Long;
  /** The function to call. Can be just the name or name with parameters like "functionName(uint32,string)". */
  functionName: string;
  /** The parameters to pass to the function. */
  functionParameters?: ContractFunctionParameters;
  /** Amount of HBAR to send with the call (for payable functions). */
  payableAmount?: number | BigNumber | Hbar;
  /** Optional memo for the transaction. */
  memo?: string;
}

/**
 * Parameters for creating a new file on Hedera File Service.
 */
export interface CreateFileParams {
  /** The contents of the file. */
  contents: string | Uint8Array;
  /**
   * The keys that must sign any transaction to modify or delete the file.
   * If not set, the file is immutable (except for append if no keys are set at all).
   * Each element can be a PrivateKey string (to derive PublicKey), a PublicKey object, or a KeyList object.
   */
  keys?: Array<string | Key | KeyList>;
  /** A memo associated with the file. Max 100 characters. */
  adminKey?: string | Key | null;
  autoRenewPeriod?: number;
  memo?: string | null;
  stakedAccountId?: string | AccountId | '0.0.0' | null;
  stakedNodeId?: number | Long | null;
  declineStakingReward?: boolean;
  maxAutomaticTokenAssociations?: number;
  proxyAccountId?: string | AccountId | '0.0.0' | null;
}

/**
 * Parameters for appending content to an existing file on Hedera File Service.
 */
export interface AppendFileParams {
  /** The ID of the file to append to. */
  fileId: string | FileId;
  /** The content to append. */
  contents: string | Uint8Array;
  /** Optional. The number of chunks to break the content into if it exceeds the transaction size limit. */
  maxChunks?: number;
  /** Optional. The size of each chunk in bytes. Defaults to a value like 4KB or 6KB minus overhead. */
  chunkSize?: number;
}

/**
 * Parameters for updating the attributes of an existing file on Hedera File Service.
 * Note: This does not replace file contents; use FileAppend or recreate for that.
 */
export interface UpdateFileParams {
  /** The ID of the file to update. */
  fileId: string | FileId;
  /** New keys for the file. An empty array can be used to remove all keys, making the file immutable. */
  keys?: Array<string | Key | KeyList> | null; // null or empty array to clear keys
  /** New memo for the file. An empty string or `null` to clear. */
  memo?: string | null;
  /** New contents for the file. */
  contents?: string | Uint8Array;
}

/**
 * Parameters for deleting a file from Hedera File Service.
 */
export interface DeleteFileParams {
  /** The ID of the file to delete. */
  fileId: string | FileId;
}

/**
 * Parameters for updating an existing smart contract.
 * All fields are optional except `contractId`.
 */
export interface UpdateContractParams {
  /** The ID of the contract to update. */
  contractId: string | ContractId;
  /** New admin key for the contract. `null` to clear. */
  adminKey?: string | Key | null;
  /** New auto-renewal period in seconds. */
  autoRenewPeriod?: number;
  /** New memo for the contract. An empty string or `null` to clear. */
  memo?: string | null;
  /** New account to which this contract is staked. `null` to unstake. */
  stakedAccountId?: string | AccountId | '0.0.0' | null; // "0.0.0" to remove staking
  /** New node ID to which this contract is staked. `-1` to remove staking. */
  stakedNodeId?: number | Long | null;
  /** If true, the contract declines receiving a staking reward. */
  declineStakingReward?: boolean;
  /** New max automatic token associations for the contract. */
  maxAutomaticTokenAssociations?: number;
  /** New proxy account ID for the contract. `null` or `"0.0.0"` to clear. */
  proxyAccountId?: string | AccountId | '0.0.0' | null;
  // Updating bytecode (bytecodeFileId) is not part of ContractUpdateTransaction.
}

/**
 * Parameters for deleting a smart contract.
 */
export interface DeleteContractParams {
  /** The ID of the contract to delete. */
  contractId: string | ContractId;
  /**
   * Optional. The account ID to transfer the contract's remaining HBAR balance to.
   * Required if the contract has a non-zero balance. Use this OR `transferContractId`.
   */
  transferAccountId?: string | AccountId;
  /**
   * Optional. The contract ID to transfer the contract's remaining HBAR balance to.
   * Required if the contract has a non-zero balance. Use this OR `transferAccountId`.
   */
  transferContractId?: string | ContractId;
  // Note: If contract has balance, one of transferAccountId or transferContractId must be set.
  // The builder method will need to enforce this or document it clearly.
}

/**
 * Parameters for updating an existing Hedera account.
 * All fields are optional except `accountIdToUpdate`.
 */
export interface UpdateAccountParams {
  /** The ID of the account to update. */
  accountIdToUpdate: string | AccountId;
  /** New key for the account. `null` to clear (not typically allowed unless other conditions met). */
  key?: string | Key | null;
  /** New auto-renewal period in seconds. */
  autoRenewPeriod?: number;
  /** New memo for the account. An empty string or `null` to clear. */
  memo?: string | null;
  /** New max automatic token associations for the account. */
  maxAutomaticTokenAssociations?: number;
  /** New account to which this account is staked. "0.0.0" or `null` to remove staking. */
  stakedAccountId?: string | AccountId | '0.0.0' | null;
  /** New node ID to which this account is staked. `-1` or `null` to remove staking. */
  stakedNodeId?: number | Long | null;
  /** If true, the account declines receiving a staking reward. */
  declineStakingReward?: boolean;
  /** If true, the account must sign any transaction transferring hbar out of this account. */
  receiverSignatureRequired?: boolean;
  amount: number | Long;
}

/**
 * Parameters for deleting an account.
 */
export interface DeleteAccountParams {
  /** The ID of the account to be deleted. This account must sign the transaction. */
  deleteAccountId: string | AccountId;
  /** The ID of the account to transfer the remaining HBAR balance to. */
  transferAccountId: string | AccountId;
}

/**
 * Parameters for approving an HBAR allowance.
 */
export interface ApproveHbarAllowanceParams {
  /** The account ID of the HBAR owner. Defaults to the operator/signer account ID if not provided. */
  ownerAccountId?: string | AccountId;
  /** The account ID of the spender who is being granted the allowance. */
  spenderAccountId: string | AccountId;
  /** The maximum HBAR amount that the spender can use from the owner's account. */
  amount: Hbar;
  /** Optional. A memo for the transaction. */
  memo?: string;
}

/**
 * Parameters for approving an NFT allowance.
 */
export interface ApproveTokenNftAllowanceParams {
  /** The account ID of the NFT owner. Defaults to the operator/signer account ID if not provided. */
  ownerAccountId?: string | AccountId;
  /** The account ID of the spender who is being granted the allowance. */
  spenderAccountId: string | AccountId;
  /** The ID of the NFT collection. */
  tokenId: string | TokenId;
  /** Optional. Specific serial numbers to approve. Use this OR `allSerials`. */
  serials?: Array<number | Long | BigNumber>;
  /** Optional. If true, approves the spender for all serials of the given NFT ID owned by the owner. Use this OR `serials`. */
  allSerials?: boolean;
  /** Optional. A memo for the transaction. */
  memo?: string;
}

/**
 * Parameters for approving a fungible token allowance.
 */
export interface ApproveFungibleTokenAllowanceParams {
  /** The account ID of the token owner. Defaults to the operator/signer account ID if not provided. */
  ownerAccountId?: string | AccountId;
  /** The account ID of the spender who is being granted the allowance. */
  spenderAccountId: string | AccountId;
  /** The ID of the fungible token. */
  tokenId: string | TokenId;
  /** The maximum amount of the token that the spender can use from the owner's account. In smallest unit. */
  amount: number | BigNumber;
  /** Optional. A memo for the transaction. */
  memo?: string;
}

/**
 * Parameters for deleting all NFT allowances for a specific token collection granted by an owner.
 * This removes allowances for all spenders for all serials of the specified token type from this owner.
 */
export interface DeleteNftAllowanceAllSerialsParams {
  /** The account ID of the NFT owner whose allowances are being deleted. Defaults to the operator/signer account ID if not provided. */
  ownerAccountId?: string | AccountId;
  /** The ID of the NFT collection (token ID) for which all serial allowances will be deleted. */
  tokenId: string | TokenId;
  /** Optional. A memo for the transaction. */
  memo?: string;
}

/**
 * Parameters for revoking/clearing an HBAR allowance for a specific spender.
 */
export interface RevokeHbarAllowanceParams {
  /** The account ID of the HBAR owner. Defaults to the operator/signer account ID if not provided. */
  ownerAccountId?: string | AccountId;
  /** The account ID of the spender whose HBAR allowance is to be revoked (set to zero). */
  spenderAccountId: string | AccountId;
  /** Optional. A memo for the transaction. */
  memo?: string;
}

/**
 * Parameters for revoking/clearing a fungible token allowance for a specific spender.
 */
export interface RevokeFungibleTokenAllowanceParams {
  /** The account ID of the token owner. Defaults to the operator/signer account ID if not provided. */
  ownerAccountId?: string | AccountId;
  /** The account ID of the spender whose token allowance is to be revoked (set to zero). */
  spenderAccountId: string | AccountId;
  /** The ID of the fungible token. */
  tokenId: string | TokenId;
  /** Optional. A memo for the transaction. */
  memo?: string;
}

/**
 * Represents a recipient for a token airdrop.
 */
export interface AirdropRecipient {
  /** The account ID of the recipient. */
  accountId: string | AccountId;
  /** The amount of tokens to send (in smallest denomination). */
  amount: number | Long; // Consistent with other token amounts
}

/**
 * Parameters for airdropping fungible tokens from the operator's account.
 * The operator (signer) is implicitly the sender of all amounts.
 */
export interface AirdropTokenParams {
  /** The ID of the fungible token to airdrop. */
  tokenId: string | TokenId;
  /** An array of recipient objects, each specifying an account and an amount. */
  recipients: AirdropRecipient[];
  /** Optional memo for the transaction. */
  memo?: string;
  pendingAirdropIds: PendingAirdropId[];
}

/**
 * Parameters for rejecting a pending airdrop or future tokens.
 */
export interface RejectAirdropParams {
  /** The ID of the token that was airdropped. */
  tokenId: string | TokenId;
  /** Optional memo for the transaction. */
  memo?: string;
}

/**
 * Parameters for claiming pending airdrops.
 */
export interface ClaimAirdropParams {
  /** An array of SDK PendingAirdropId objects to claim. The operator (signer) is the recipient. */
  pendingAirdropIds: PendingAirdropId[]; // Assuming PendingAirdropId is imported from @hashgraph/sdk
  /** Optional memo for the transaction. */
  memo?: string;
}

/**
 * Parameters for cancelling previously sent (but still pending) airdrops.
 */
export interface CancelAirdropParams {
  /** An array of SDK PendingAirdropId objects to cancel. The operator (signer) must be the original sender. */
  pendingAirdropIds: PendingAirdropId[]; // Assuming PendingAirdropId is imported from @hashgraph/sdk
  /** Optional memo for the transaction. */
  memo?: string;
}

/**
 * Parameters for rejecting future auto-associations with specified token types.
 */
export interface RejectFutureAssociationsParams {
  // Implementation of this parameter is not provided in the original file or the code block
  // This parameter is mentioned in the RejectAirdropParams, but its implementation is not clear
  // It's assumed to exist as it's called in the RejectAirdropParams
}

/**
 * Parameters for signing a scheduled transaction.
 */
export interface SignScheduledTransactionParams {
  /** The ID of the schedule to add a signature to. */
  scheduleId: string | ScheduleId;
  /** Optional memo for the ScheduleSign transaction itself. */
  memo?: string;
}

/**
 * Parameters for querying topic information.
 */
export interface GetTopicInfoParams {
  /** The ID of the topic to query. */
  topicId: string | TopicId;
  /** Optional. Maximum number of retries for the query. */
  maxRetries?: number;
}

/**
 * Result of querying topic information.
 */
export interface TopicInfoResult {
  topicId: string;
  topicMemo: string;
  runningHash: string; // hex encoded
  sequenceNumber: string; // string representation of u64
  expirationTime?: string; // ISO string format
  adminKey?: string; // string representation of the key
  autoRenewAccount?: string;
  autoRenewPeriod?: string; // string representation of seconds
  ledgerId?: string;
}

/**
 * Parameters for deleting/revoking NFT allowances for a *specific spender* for a token collection.
 * This uses AccountAllowanceDeleteTransaction.deleteAllTokenNftAllowances(tokenId, owner, spender).
 */
export interface DeleteNftSpenderAllowanceParams {
  /** The account ID of the NFT owner. Defaults to the operator/signer account ID if not provided. */
  ownerAccountId?: string | AccountId;
  /** The ID of the NFT collection (token ID). */
  nftId: string | NftId;
  /** Optional. A memo for the transaction. */
  memo?: string;
}

/**
 * Parameters for deleting/revoking NFT allowances for specific serials for a specific spender.
 */
export interface DeleteNftSpenderAllowanceToolParams {
  ownerAccountId?: string | AccountId;
  spenderAccountId: string | AccountId;
  tokenId: string | TokenId;
  serials: Array<number | string | Long>;
  memo?: string;
}

/**
 * Parameters for deleting all spender allowances for a specific NFT serial, granted by an owner.
 */
export interface DeleteNftSerialAllowancesParams {
  ownerAccountId?: string | AccountId;
  nftIdString: string; // e.g., "0.0.tokenid.serial"
  memo?: string;
  pendingAirdropIds: PendingAirdropId[];
}

// Added for ClaimAirdropTool
/**
 * Parameters for claiming pending airdrops.
 * The SDK's PendingAirdropId is an object. For the tool's input,
 * we'll expect the structure that the SDK uses or a string that can be parsed into it.
 * The current HederaClaimAirdropTool Zod schema expects an array of strings.
 */
export interface ClaimAirdropParams {
  /**
   * An array of pending airdrop IDs to claim.
   * These are expected to be strings that can be parsed into SDK PendingAirdropId objects if needed,
   * or directly match the structure if SDK PendingAirdropId is serializable/deserializable simply.
   * The @hashgraph/sdk PendingAirdropId is constructed with (accountId, tokenId, serialNumber).
   * For simplicity in the tool input, we might expect an array of objects or structured strings.
   * The tool placeholder Zod schema uses `z.array(z.string())` - this will need careful implementation
   * in the actual tool to parse these strings into proper SDK PendingAirdropId objects.
   * Let's align the type with the SDK's actual PendingAirdropId for now for builder methods.
   */
  pendingAirdropIds: PendingAirdropId[];
  /** Optional memo for the transaction. */
  memo?: string;
}

// Added for GetFileContentsTool
/**
 * Parameters for querying file contents.
 */
export interface GetFileContentsParams {
  fileId: string | FileId;
  // maxRetries, payment, etc. could be added if BaseHederaQueryTool supports them
}

/**
 * Result of querying file contents.
 */
export interface FileContentsResult {
  fileId: string;
  contents: string; // Assuming string representation for simplicity, could be Uint8Array
  // Could also include other file info if the query returns more
}

// Added for CallContractQueryTool
/**
 * Parameters for calling a smart contract query function.
 * This aligns with SDK's ContractExecuteTransaction but for queries (ContractCallQuery).
 */
export interface CallContractQueryParams {
  contractId: string | ContractId;
  gas?: number | Long; // SDK: Long
  functionName: string; // For query, this is often just the function selector or name
  functionParameters?: ContractFunctionParameters;
  maxQueryPayment?: Hbar; // For queries
  paymentTransactionId?: TransactionId; // For queries
  // senderAccountId?: string | AccountId; // For queries, client usually pays
}

/**
 * Result of a smart contract query call.
 */
export interface ContractQueryResult {
  // Based on ContractFunctionResult from SDK
  contractId?: string;
  errorMessage?: string;
  gasUsed?: string; // u64
  // Various ways to get results based on type, e.getString, getInt32, etc.
  // For a generic tool, might return raw bytes or a common representation.
  resultAsBytes?: Uint8Array; // Raw result
  resultDecoded?: unknown; // If ABI is available and decoding is attempted by the tool
}
