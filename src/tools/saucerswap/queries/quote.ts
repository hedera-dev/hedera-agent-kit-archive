import { ethers } from 'ethers';
import { ContractId } from '@hashgraph/sdk';
import { hexToUint8Array } from '../../../utils/conversion';
import { QuoteResult } from '../../../types';

export const get_swap_quote = async (
    provider: ethers.JsonRpcProvider,
    quoterContractId: ContractId,
    quoterAbi: any,
    path: string[],
    amount: string,
    isExactInput: boolean = true
): Promise<QuoteResult> => {
    const abiInterfaces = new ethers.Interface(quoterAbi);
    const quoterEvmAddress = `0x${quoterContractId.toSolidityAddress()}`;

    // If exactOutput, reverse the path as per documentation
    const pathToUse = isExactInput ? path : [...path].reverse();
    const encodedPathData = hexToUint8Array(pathToUse.join(''));

    const functionName = isExactInput ? 'quoteExactInput' : 'quoteExactOutput';
    const data = abiInterfaces.encodeFunctionData(functionName, [
        encodedPathData,
        amount
    ]);

    const result = await provider.call({
        to: quoterEvmAddress,
        data: data,
    });

    const decoded = abiInterfaces.decodeFunctionResult(functionName, result);
    
    return {
        amountIn: isExactInput ? amount : decoded.amountIn.toString(),
        amountOut: isExactInput ? decoded.amountOut.toString() : amount
    };
} 