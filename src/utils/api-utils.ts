import { HederaNetworkType } from "../types";

export const createBaseMirrorNodeApiUrl = (networkType: HederaNetworkType) => {
    const networkBase = networkType === 'mainnet' ? `${networkType}-public` : networkType;
    return `https://${networkBase}.mirrornode.hedera.com`
}

export const getPublicKeyByAccountId = async (networkType: HederaNetworkType, accountId: string): Promise<string> => {
    const baseUrl = createBaseMirrorNodeApiUrl(networkType);
    const url = `${baseUrl}/api/v1/accounts/${accountId}?limit=1&transactions=true`;
    const response = await fetch(url).then(response => response.json());
    return response.key.key;
}
