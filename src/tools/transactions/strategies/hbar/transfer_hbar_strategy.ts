import {
    AccountId,
    Hbar,
    Transaction,
    TransactionReceipt,
    TransactionResponse,
    TransferTransaction
} from "@hashgraph/sdk";
import { TransactionStrategy } from "../base_strategy";
import { TransferHBARResult } from "../../../results";

export class TransferHbarStrategy implements TransactionStrategy<TransferHBARResult> {
    constructor(
        private fromAccountId: string | AccountId,
        private toAccountId: string | AccountId,
        private amount: string
    ) {}

    build(): Transaction {
        return new TransferTransaction()
            .addHbarTransfer(this.fromAccountId, new Hbar(-this.amount))
            .addHbarTransfer(this.toAccountId, new Hbar(this.amount))
            .setTransactionValidDuration(180);
    }

    formatResult(txResponse: TransactionResponse, receipt:  TransactionReceipt): TransferHBARResult {
        return {
            status: receipt.status.toString(),
            txHash: txResponse.transactionId.toString(),
        };
    }
}