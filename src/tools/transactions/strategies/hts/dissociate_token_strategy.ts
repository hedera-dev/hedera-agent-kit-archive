import {
    AccountId,
    TokenDissociateTransaction,
    TokenId,
    Transaction,
    TransactionReceipt,
    TransactionResponse
} from "@hashgraph/sdk";
import { TransactionStrategy } from "../base_strategy";
import { DissociateTokenResult } from "../../../results";

export class DissociateTokenStrategy implements TransactionStrategy<DissociateTokenResult> {
    constructor(
        private tokenId: string | TokenId,
        private issuerAccountId: string | AccountId,
    ) {}

    build(): Transaction {
        return new TokenDissociateTransaction()
            .setAccountId(this.issuerAccountId)
            .setTokenIds([this.tokenId])
             .setTransactionValidDuration(180);
    }

    formatResult(txResponse: TransactionResponse, receipt:  TransactionReceipt): DissociateTokenResult {
        return {
            status: receipt.status.toString(),
            txHash: txResponse.transactionId.toString(),
        }
    }
}