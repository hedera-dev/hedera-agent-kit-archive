import { ContractExecuteTransaction, ContractId, Hbar, HbarUnit } from "@hashgraph/sdk";
import { ethers } from "ethers";
import { hexToUint8Array } from "../../../utils/conversion";
import { SwapExactTokensParams, SwapResult } from "../../../types";
import BigNumber from "bignumber.js";

export const swap_exact_tokens = async (
    params: SwapExactTokensParams
): Promise<SwapResult> => {
    const {
        client,
        routerContractId,
        routerAbi,
        path,
        amountIn,
        amountOutMin,
        recipient,
        deadline,
        hbarAmount,
        unwrapWHBAR = false
    } = params;

    const abiInterfaces = new ethers.Interface(routerAbi);

    // Prepare swap parameters
    const swapParams = {
        path: path.join(''),
        recipient: unwrapWHBAR ? routerContractId.toSolidityAddress() : recipient,
        deadline: deadline,
        amountIn: amountIn,
        amountOutMinimum: amountOutMin
    };

    // Encode function calls
    const swapEncoded = abiInterfaces.encodeFunctionData('exactInput', [swapParams]);
    
    // Add unwrapWHBAR if needed
    const functionCalls = [swapEncoded];
    if (unwrapWHBAR) {
        const unwrapEncoded = abiInterfaces.encodeFunctionData('unwrapWHBAR', [0, recipient]);
        functionCalls.push(unwrapEncoded);
    }

    // Encode multicall
    const encodedData = abiInterfaces.encodeFunctionData('multicall', [functionCalls]);
    const encodedDataAsUint8Array = hexToUint8Array(encodedData.substring(2));

    // Execute transaction
    const tx = new ContractExecuteTransaction()
        .setContractId(routerContractId)
        .setGas(1000000);

    if (hbarAmount) {
        tx.setPayableAmount(Hbar.fromTinybars(BigNumber(hbarAmount, 0)));
    }

    tx.setFunctionParameters(encodedDataAsUint8Array);

    const response = await tx.execute(client);
    const record = await response.getRecord(client);
    const result = record.contractFunctionResult!;

    const decodedResults = abiInterfaces.decodeFunctionResult('multicall', result.bytes)[0];
    const swapResult = abiInterfaces.decodeFunctionResult('exactInput', decodedResults[0]);

    return {
        status: "SUCCESS",
        txHash: response.transactionId.toString(),
        amountIn: swapResult.amountIn.toString(),
        amountOut: swapResult.amountOut.toString()
    };
}; 