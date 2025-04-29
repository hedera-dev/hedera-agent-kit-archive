import {
    AccountId,
    TokenAssociateTransaction,
    TokenId,
    Transaction,
    TransactionReceipt,
    TransactionResponse
} from "@hashgraph/sdk";
import { TransactionStrategy } from "../base_strategy";
import { AssociateTokenResult } from "../../../results";

export class AssociateTokenStrategy implements TransactionStrategy<AssociateTokenResult> {
    constructor(
        private tokenId: string | TokenId,
        private issuerAccountId: string | AccountId,
    ) {}

    build(): Transaction {
        return new TokenAssociateTransaction()
            .setAccountId(this.issuerAccountId)
            .setTokenIds([this.tokenId])
            .setTransactionValidDuration(180);
    }

    formatResult(txResponse: TransactionResponse, receipt:  TransactionReceipt): AssociateTokenResult {
        return {
            status: receipt.status.toString(),
            txHash: txResponse.transactionId.toString(),
        }
    }
}