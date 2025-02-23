import { ApiLiquidityPoolV2 } from '../../../types';
import axios from 'axios';

export const get_pools = async (
    networkType: 'mainnet' | 'testnet'
): Promise<ApiLiquidityPoolV2[]> => {
    const baseUrl = networkType === 'mainnet' 
        ? 'https://api.saucerswap.finance/v2/pools/'
        : 'https://test-api.saucerswap.finance/v2/pools/';

    try {
        const response = await axios.get(baseUrl);
        return response.data as ApiLiquidityPoolV2[];
    } catch (error) {
        console.error("Failed to fetch SaucerSwap pools:", error);
        throw error;
    }
} 