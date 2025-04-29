import {
    AccountAllowanceApproveTransaction,
    AccountId,
    TokenId,
    Transaction, TransactionReceipt, TransactionResponse
} from "@hashgraph/sdk";
import { TransactionStrategy } from "../base_strategy";
import { AssetAllowanceResult } from "../../../results";

export class AssetAllowanceStrategy implements TransactionStrategy<AssetAllowanceResult> {
    constructor(
        private tokenId: TokenId | string | undefined,
        private amount: number,
        private payerAccountId: string | AccountId,
        private spenderAccountId: string | AccountId,
    ) {}

    build(): Transaction {
        const tx = new AccountAllowanceApproveTransaction();
        tx.setTransactionValidDuration(180);
        if (this.tokenId) {
            tx.approveTokenAllowance(this.tokenId, this.payerAccountId, this.spenderAccountId, this.amount)
        } else {
            tx.approveHbarAllowance(this.payerAccountId, this.spenderAccountId, this.amount)
        }
        return tx;
    }

    formatResult(txResponse: TransactionResponse, receipt:  TransactionReceipt): AssetAllowanceResult {
        return {
            status: receipt.status.toString(),
            txHash: txResponse.transactionId.toString(),
        }
    }
}