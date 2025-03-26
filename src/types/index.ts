import BigNumber from "bignumber.js";
import { TokenId } from "@hashgraph/sdk";
import { CreateTokenOptions } from "../tools/hts/transactions/create_token";

export type HederaNetworkType = "mainnet" | "testnet" | "previewnet";

export type TokenBalance = {
    account: string;
    balance: number;
    decimals: number;
};

export type TokenHoldersBalancesApiResponse = {
    timestamp: string;
    balances: TokenBalance[];
    links: {
        next: string; // link to the next page
    };
};

export type DetailedTokenBalance= {
    tokenId: string;
    tokenSymbol: string;
    tokenName: string;
    tokenDecimals: string;
    balance: number;
    balanceInDisplayUnit: BigNumber;
}

export type HtsTokenBalanceApiReponse = {
    timestamp: string;
    balances: TokenBalance[];
    links: {
        next: string;
    };
};

type ProtobufEncodedKey = {
    _type: "ProtobufEncoded";
    key: string;
};

type CustomFees = {
    created_timestamp: string;
    fixed_fees: any[];
    fractional_fees: any[];
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
    pause_status: "PAUSED" | "UNPAUSED";
    supply_key: ProtobufEncodedKey;
    supply_type: "FINITE" | "INFINITE";
    symbol: string;
    token_id: string;
    total_supply: string;
    treasury_account_id: string;
    type: "FUNGIBLE_COMMON" | "NON_FUNGIBLE_UNIQUE";
    wipe_key: ProtobufEncodedKey;
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
}

export type RejectTokenResult = {
    status: string,
    txHash: string,
}

export type AssociateTokenResult = {
    status: string,
    txHash: string,
}

export type DissociateTokenResult = {
    status: string,
    txHash: string,
}

export type Airdrop = {
    amount: number;
    receiver_id: string;
    sender_id: string;
    token_id: string;
}

export type AirdropResult = {
    status: string,
    txHash: string,
}

export type ClaimAirdropResult = {
    status: string,
    txHash: string,
}

export type CreateTokenResult = {
    status: string,
    txHash: string,
    tokenId: TokenId,
}

export type TransferTokenResult = {
    status: string,
    txHash: string,
}

export type TransferHBARResult = {
    status: string,
    txHash: string,
}

export type SubmitMessageResult = {
    status: string,
    txHash: string,
}

export type CreateTopicResult = {
    status: string,
    txHash: string,
    topicId: string,
}

export type DeleteTopicResult = {
    status: string,
    txHash: string,
}

export type MintTokenResult = {
    status: string,
    txHash: string,
}

export type MintNFTResult = {
    status: string,
    txHash: string,
}

export type AssetAllowanceResult = {
    status: string,
    txHash: string,
}

export type PendingAirdropsApiResponse = {
    airdrops: Airdrop[];
    links: {
        next: string | null;
    };
}

type Key = {
    _type: "ECDSA_SECP256K1" | "ED25519" | "ProtobufEncoded";
    key: string;
};

type TimestampRange = {
    from: string; // Unix timestamp in seconds.nanoseconds format
    to?: string | null; // Nullable Unix timestamp
};

export type TopicInfoApiResponse = {
    admin_key?: Key | null;
    auto_renew_account?: string | null; // Format: shard.realm.num (e.g., "0.0.2")
    auto_renew_period?: number | null; // 64-bit integer
    created_timestamp?: string | null; // Unix timestamp (e.g., "1586567700.453054000")
    deleted?: boolean | null;
    memo?: string;
    submit_key?: Key | null;
    timestamp?: TimestampRange;
    topic_id?: string | null; // Format: shard.realm.num (e.g., "0.0.2")
};

export type HCSMessage = {
    chunk_info: null | any;
    consensus_timestamp: string;
    message: string;
    payer_account_id: string;
    running_hash: string;
    running_hash_version: number;
    sequence_number: number;
    topic_id: string;
};

export type HCSMessageApiResponse = {
    messages: HCSMessage[];
    links: {
        next: string | null;
    };
};

export interface CreateNFTOptions extends Omit<CreateTokenOptions, "tokenType" | "client" | "decimals" | "initialSupply">{

}

export interface CreateFTOptions extends Omit<CreateTokenOptions, "tokenType" | "client"> {
}

// Bonzo Finance API Types
export type BalanceInfo = {
  tiny_token: string;     // Hex string of smallest denomination
  token_display: string;  // Human-readable token amount
  hbar_tinybar: string;   // Hex string of HBAR equivalent in tinybars
  hbar_display: string;   // Human-readable HBAR equivalent
  usd_wad: string;        // Hex string of USD value in WAD
  usd_display: string;    // Human-readable USD value
};

export type BonzoReserve = {
  id: number;
  name: string;
  symbol: string;
  coingecko_id: string;
  hts_address: string;
  evm_address: string;
  atoken_address: string;
  stable_debt_address: string;
  variable_debt_address: string;
  protocol_treasury_address: string;
  decimals: number;
  ltv: number;
  liquidation_threshold: number;
  liquidation_bonus: number;
  active: boolean;
  frozen: boolean;
  variable_borrowing_enabled: boolean;
  stable_borrowing_enabled: boolean;
  reserve_factor: number;
  token_balance?: BalanceInfo;
  atoken_balance?: BalanceInfo;
  stable_debt_balance?: BalanceInfo;
  variable_debt_balance?: BalanceInfo;
  available_liquidity?: BalanceInfo;
  total_stable_debt?: BalanceInfo;
  total_variable_debt?: BalanceInfo;
  total_supply?: BalanceInfo;
  borrow_cap?: BalanceInfo;
  supply_cap?: BalanceInfo;
  utilization_rate?: number;
  supply_apy?: number;
  variable_borrow_apy?: number;
  stable_borrow_apy?: number;
  use_as_collateral_enabled?: boolean;
  price_weibars?: string;
  price_usd_wad?: string;
  price_usd_display?: string;
};

export type BonzoUserCredit = {
  hbar_balance: BalanceInfo;
  total_supply: BalanceInfo;
  total_collateral: BalanceInfo;
  total_debt: BalanceInfo;
  credit_limit: BalanceInfo;
  liquidation_ltv: number;
  current_ltv: number;
  max_ltv: number;
  health_factor: number;
};

export type BonzoDashboardResponse = {
  chain_id: string;
  network_name: string;
  hts_address: string;
  evm_address: string;
  reserves: BonzoReserve[];
  user_credit: BonzoUserCredit;
  average_supply_apy: number;
  average_borrow_apy: number;
  average_net_apy: number;
  timestamp: string;
};

export type BonzoDebtorsResponse = {
  chain_id: string;
  network_name: string;
  debtors: string[];
  timestamp: string;
};

export type BonzoMarketResponse = {
  chain_id: string;
  network_name: string;
  reserves: BonzoReserve[];
  timestamp: string;
};

export type BonzoTreasury = {
  address: string;
  name: string;
  balance: string;
};

export type BonzoTokenResponse = {
  chain_id: string;
  network_name: string;
  token_id: string;
  symbol: string;
  name: string;
  memo: string;
  total_supply: string;
  circulating_supply: string;
  decimals: number;
  treasuries: BonzoTreasury[];
  timestamp: string;
};

export type BonzoStatsResponse = {
  chain_id: string;
  network_name: string;
  total_supply_value: BalanceInfo;
  total_borrowed_value: BalanceInfo;
  total_liquidity_value: BalanceInfo;
  total_deposits_count: number;
  total_withdraws_count: number;
  total_borrows_count: number;
  total_repays_count: number;
  total_enable_collateral_count: number;
  total_disable_collateral_count: number;
  total_flash_loan_count: number;
  total_flash_loan_fees: BalanceInfo;
  total_liquidations_count: number;
  total_liquidation_payoffs: BalanceInfo;
  total_liquidation_rewards: BalanceInfo;
  total_liquidation_bonuses: BalanceInfo;
  total_protocol_fees: BalanceInfo;
  total_interest_earned: BalanceInfo;
  total_gas_consumed: number;
  total_gas_charged: number;
  total_network_fees: number;
  total_successful_transactions: number;
  total_failed_transactions: number;
  active_users: string[];
  reserves: BonzoReserve[];
  timestamp_start: string;
  timestamp_end: string;
};

export type BonzoInfoResponse = {
  chain_id: string;
  network_name: string;
  mirror_node: string;
  lending_pool_address: string;
  price_oracle_address: string;
  protocol_data_provider_address: string;
  lending_pool_configurator_address: string;
  whbar_hts_address: string;
  whbar_evm_address: string;
  reserves: BonzoReserve[];
};

