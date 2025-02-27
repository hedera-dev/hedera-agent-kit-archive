export const SAUCERSWAP_CONTRACTS = {
    mainnet: {
        router: "0.0.1150", // SaucerSwapV2SwapRouter
        nftManager: "0.0.1151", // SaucerSwapV2NonfungiblePositionManager
        quoter: "0.0.1152" // SaucerSwapV2QuoterV2
    },
    testnet: {
        router: "0.0.1153", // SaucerSwapV2SwapRouter testnet
        nftManager: "0.0.1154", // SaucerSwapV2NonfungiblePositionManager testnet
        quoter: "0.0.1155" // SaucerSwapV2QuoterV2 testnet
    }
};

export const SAUCERSWAP_ABIS = {
    router: [
        "function exactInput(tuple(bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)",
        "function exactOutput(tuple(bytes path, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum)) external payable returns (uint256 amountIn)",
        "function refundETH() external",
        "function unwrapWHBAR(uint256 minAmount, address recipient) external",
        "function multicall(bytes[] data) external payable returns (bytes[] results)"
    ],
    quoter: [
        "function quoteExactInput(bytes path, uint256 amountIn) external returns (uint256 amountOut, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)",
        "function quoteExactOutput(bytes path, uint256 amountOut) external returns (uint256 amountIn, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)"
    ],
    nftManager: [
        // Mint new position
        "function mint(tuple(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenSN, uint128 liquidity, uint256 amount0, uint256 amount1)",
        // Increase liquidity
        "function increaseLiquidity(tuple(uint256 tokenSN, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, uint256 deadline)) external payable returns (uint128 liquidity, uint256 amount0, uint256 amount1)",
        // Decrease liquidity
        "function decreaseLiquidity(tuple(uint256 tokenSN, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline)) external returns (uint256 amount0, uint256 amount1)",
        // Collect fees
        "function collect(tuple(uint256 tokenSN, address recipient, uint128 amount0Max, uint128 amount1Max)) external returns (uint256 amount0, uint256 amount1)",
        // Burn position
        "function burn(uint256 tokenSN) external",
        // Utility functions
        "function refundETH() external",
        "function unwrapWHBAR(uint256 minAmount, address recipient) external",
        "function multicall(bytes[] data) external payable returns (bytes[] results)",
        // Position info
        "function positions(uint256 tokenSN) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)"
    ]
};

// Add common fee tiers
export const SAUCERSWAP_FEE_TIERS = {
    LOWEST: 100,    // 0.01%
    LOW: 500,       // 0.05%
    MEDIUM: 3000,   // 0.3%
    HIGH: 10000     // 1%
}; 