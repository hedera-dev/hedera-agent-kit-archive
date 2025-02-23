import { ContractExecuteTransaction, ContractId, Hbar, HbarUnit } from "@hashgraph/sdk";
import { ethers } from "ethers";
import { hexToUint8Array } from "../../../utils/conversion";
import { AddLiquidityParams, RemoveLiquidityParams, LiquidityResult } from "../../../types";

export const add_liquidity = async (
    params: AddLiquidityParams
): Promise<LiquidityResult> => {
    const {
        client,
        nftManagerContractId,
        nftManagerAbi,
        token0,
        token1,
        fee,
        tickLower,
        tickUpper,
        amount0Desired,
        amount1Desired,
        amount0Min,
        amount1Min,
        recipient,
        deadline,
        hbarAmount
    } = params;

    const abiInterfaces = new ethers.Interface(nftManagerAbi);

    const mintParams = {
        token0,
        token1,
        fee,
        tickLower,
        tickUpper,
        amount0Desired,
        amount1Desired,
        amount0Min,
        amount1Min,
        recipient,
        deadline
    };

    // Encode function calls
    const mintEncoded = abiInterfaces.encodeFunctionData('mint', [mintParams]);
    const refundEncoded = abiInterfaces.encodeFunctionData('refundETH');

    // Encode multicall
    const encodedData = abiInterfaces.encodeFunctionData('multicall', [[mintEncoded, refundEncoded]]);
    const encodedDataAsUint8Array = hexToUint8Array(encodedData.substring(2));

    // Execute transaction
    const tx = new ContractExecuteTransaction()
        .setContractId(nftManagerContractId)
        .setGas(900000);

    if (hbarAmount) {
        tx.setPayableAmount(Hbar.from(hbarAmount, HbarUnit.Tinybar));
    }

    tx.setFunctionParameters(encodedDataAsUint8Array);

    const response = await tx.execute(client);
    const record = await response.getRecord(client);
    const result = record.contractFunctionResult!;

    const decodedResults = abiInterfaces.decodeFunctionResult('multicall', result.bytes)[0];
    const mintResult = abiInterfaces.decodeFunctionResult('mint', decodedResults[0]);

    return {
        status: "SUCCESS",
        txHash: response.transactionId.toString(),
        tokenId: mintResult.tokenId.toString(),
        liquidity: mintResult.liquidity.toString(),
        amount0: mintResult.amount0.toString(),
        amount1: mintResult.amount1.toString()
    };
};

export const remove_liquidity = async (
    params: RemoveLiquidityParams
): Promise<LiquidityResult> => {
    const {
        client,
        nftManagerContractId,
        nftManagerAbi,
        tokenSN,
        liquidity,
        amount0Min,
        amount1Min,
        deadline,
        recipient,
        unwrapWHBAR = false
    } = params;

    const abiInterfaces = new ethers.Interface(nftManagerAbi);

    const decreaseParams = {
        tokenSN,
        liquidity,
        amount0Min,
        amount1Min,
        deadline
    };

    // Encode function calls
    const decreaseEncoded = abiInterfaces.encodeFunctionData('decreaseLiquidity', [decreaseParams]);
    
    const collectParams = {
        tokenSN,
        recipient: unwrapWHBAR ? nftManagerContractId.toSolidityAddress() : recipient,
        amount0Max: ethers.MaxUint256,
        amount1Max: ethers.MaxUint256
    };
    
    const collectEncoded = abiInterfaces.encodeFunctionData('collect', [collectParams]);
    
    const functionCalls = [decreaseEncoded, collectEncoded];
    
    if (unwrapWHBAR) {
        const unwrapEncoded = abiInterfaces.encodeFunctionData('unwrapWHBAR', [0, recipient]);
        functionCalls.push(unwrapEncoded);
    }

    // Encode multicall
    const encodedData = abiInterfaces.encodeFunctionData('multicall', [functionCalls]);
    const encodedDataAsUint8Array = hexToUint8Array(encodedData.substring(2));

    // Execute transaction
    const response = await new ContractExecuteTransaction()
        .setContractId(nftManagerContractId)
        .setGas(300000)
        .setFunctionParameters(encodedDataAsUint8Array)
        .execute(client);

    const record = await response.getRecord(client);
    const result = record.contractFunctionResult!;

    const decodedResults = abiInterfaces.decodeFunctionResult('multicall', result.bytes)[0];
    const collectResult = abiInterfaces.decodeFunctionResult('collect', decodedResults[1]);

    return {
        status: "SUCCESS",
        txHash: response.transactionId.toString(),
        tokenId: tokenSN.toString(),
        liquidity: "0",
        amount0: collectResult.amount0.toString(),
        amount1: collectResult.amount1.toString()
    };
}; 