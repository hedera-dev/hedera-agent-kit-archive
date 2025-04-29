import {TokenId, TokenMintTransaction, Transaction, TransactionReceipt, TransactionResponse} from "@hashgraph/sdk";
import { TransactionStrategy } from "../base_strategy";
import { MintTokenResult } from "../../../results";

export class MintTokenStrategy implements TransactionStrategy<MintTokenResult> {
    constructor(
        private tokenId: string | TokenId,
        private amount: number,
    ) {}

    build(): Transaction {
        return new TokenMintTransaction()
            .setTokenId(this.tokenId)
            .setAmount(this.amount)
            .setTransactionValidDuration(180);
    }

    formatResult(txResponse: TransactionResponse, receipt:  TransactionReceipt): MintTokenResult {
        return {
            status: receipt.status.toString(),
            txHash: txResponse.transactionId.toString(),
        }
    }
}