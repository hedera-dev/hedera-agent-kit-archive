import { ApiNftPositionV2 } from '../../../types';
import axios from 'axios';

export const get_user_positions = async (
    accountId: string,
    networkType: 'mainnet' | 'testnet'
): Promise<ApiNftPositionV2[]> => {
    const baseUrl = networkType === 'mainnet'
        ? 'https://api.saucerswap.finance'
        : 'https://test-api.saucerswap.finance';
    
    const url = `${baseUrl}/V2/nfts/${accountId}/positions`;

    try {
        const response = await axios.get(url);
        return response.data as ApiNftPositionV2[];
    } catch (error) {
        console.error("Failed to fetch user positions:", error);
        throw error;
    }
}; 