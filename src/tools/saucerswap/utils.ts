import { ethers } from "ethers";
import { ContractId } from "@hashgraph/sdk";

export const createSaucerSwapProvider = (jsonRpcUrl: string): ethers.JsonRpcProvider => {
    return new ethers.JsonRpcProvider(jsonRpcUrl, '', {
        batchMaxCount: 1
    });
};

export const contractIdToEvmAddress = (contractId: ContractId): string => {
    return `0x${contractId.toSolidityAddress()}`;
};

export const encodePath = (path: string[], fees: number[]): string => {
    if (path.length !== fees.length + 1) {
        throw new Error('path/fee lengths do not match');
    }

    let encoded = path[0];
    for (let i = 0; i < fees.length; i++) {
        // Convert fee to hex and pad to 3 bytes (6 characters)
        const fee = fees[i].toString(16).padStart(6, '0');
        encoded += fee + path[i + 1];
    }
    return encoded;
}; 