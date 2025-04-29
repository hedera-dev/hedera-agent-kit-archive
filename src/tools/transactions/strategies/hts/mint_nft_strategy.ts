import {TokenId, TokenMintTransaction, Transaction, TransactionReceipt, TransactionResponse} from "@hashgraph/sdk";
import { TransactionStrategy } from "../base_strategy";
import { MintNFTResult } from "../../../results";

export class MintNftStrategy implements TransactionStrategy<MintNFTResult> {
    constructor(
        private tokenId: string | TokenId,
        private tokenMetadata: Uint8Array,
    ) {}

    build(): Transaction {
        return new TokenMintTransaction()
            .setTokenId(this.tokenId)
            .addMetadata(this.tokenMetadata)
            .setTransactionValidDuration(180);
    }

    formatResult(txResponse: TransactionResponse, receipt:  TransactionReceipt): MintNFTResult {
        return {
            status: receipt.status.toString(),
            txHash: txResponse.transactionId.toString(),
        }
    }
}