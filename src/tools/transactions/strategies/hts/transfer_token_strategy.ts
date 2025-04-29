import {
    AccountId,
    TokenId,
    Transaction,
    TransactionReceipt,
    TransactionResponse,
    TransferTransaction
} from "@hashgraph/sdk";
import { TransactionStrategy } from "../base_strategy";
import { TransferTokenResult } from "../../../results";

export class TransferTokenStrategy implements TransactionStrategy<TransferTokenResult> {
    constructor(
        private tokenId: TokenId | string,
        private amount: number,
        private targetAccountId: AccountId | string,
        private issuerAccountId: AccountId | string,
    ) {}

    build(): Transaction {
        return new TransferTransaction()
            .addTokenTransfer(this.tokenId, this.issuerAccountId, -this.amount)
            .addTokenTransfer(this.tokenId, this.targetAccountId, this.amount)
             .setTransactionValidDuration(180);
    }

    formatResult(txResponse: TransactionResponse, receipt:  TransactionReceipt): TransferTokenResult {
        return {
            status: receipt.status.toString(),
            txHash: txResponse.transactionId.toString(),
        }
    }
}