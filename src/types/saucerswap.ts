import { Client, ContractId } from "@hashgraph/sdk";

export interface ApiToken {
    decimals: number;
    icon?: string;
    id: string;
    name: string;
    price: string;
    priceUsd: number;
    symbol: string;
    dueDiligenceComplete: boolean;
    isFeeOnTransferToken: boolean;
    timestampSecondsLastListingChange: number;
    description: string | null;
    website: string | null;
    twitterHandle: string | null;
    sentinelReport: string | null;
}

export interface ApiLiquidityPoolV2 {
    id: number;
    contractId: string;
    tokenA: ApiToken;
    amountA: string;
    tokenB: ApiToken;
    amountB: string;
    fee: number;
    sqrtRatioX96: string;
    tickCurrent: number;
    liquidity: string;
}

export interface ApiNftPositionV2 {
    tokenSN: number;
    accountId: string;
    token0: ApiToken | undefined;
    token1: ApiToken | undefined;
    fee: number;
    tickLower: number;
    tickUpper: number;
    liquidity: number;
    feeGrowthInside0LastX128: number;
    feeGrowthInside1LastX128: number;
    tokensOwed0: number;
    tokensOwed1: number;
    createdAt: number;
    updatedAt: number;
    lastSyncedAt: number;
    deleted: boolean;
}

export interface QuoteResult {
    amountIn?: string;
    amountOut?: string;
}

export interface SwapExactTokensParams {
    client: Client;
    routerContractId: ContractId;
    routerAbi: any;
    path: string[];
    amountIn: string;
    amountOutMin: string;
    recipient: string;
    deadline: number;
    hbarAmount?: string;
    unwrapWHBAR?: boolean;
}

export interface SwapResult {
    status: string;
    txHash: string;
    amountIn: string;
    amountOut: string;
}

export interface AddLiquidityParams {
    client: Client;
    nftManagerContractId: ContractId;
    nftManagerAbi: any;
    token0: string;
    token1: string;
    fee: number;
    tickLower: number;
    tickUpper: number;
    amount0Desired: string;
    amount1Desired: string;
    amount0Min: string;
    amount1Min: string;
    recipient: string;
    deadline: number;
    hbarAmount?: string;
}

export interface RemoveLiquidityParams {
    client: Client;
    nftManagerContractId: ContractId;
    nftManagerAbi: any;
    tokenSN: number;
    liquidity: string;
    amount0Min: string;
    amount1Min: string;
    deadline: number;
    recipient: string;
    unwrapWHBAR?: boolean;
}

export interface LiquidityResult {
    status: string;
    txHash: string;
    tokenId: string;
    liquidity: string;
    amount0: string;
    amount1: string;
} 