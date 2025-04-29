import {
    PendingAirdropId,
    TokenClaimAirdropTransaction,
    Transaction, TransactionReceipt, TransactionResponse
} from "@hashgraph/sdk";
import { TransactionStrategy } from "../base_strategy";
import { ClaimAirdropResult } from "../../../results";

export class ClaimAirdropStrategy implements TransactionStrategy<ClaimAirdropResult> {
    constructor(
        private airdropId: PendingAirdropId,
    ) {}

    build(): Transaction {
        return new TokenClaimAirdropTransaction()
            .addPendingAirdropId(this.airdropId)
            .setTransactionValidDuration(180);
    }

    formatResult(txResponse: TransactionResponse, receipt:  TransactionReceipt): ClaimAirdropResult {
        return {
            status: receipt.status.toString(),
            txHash: txResponse.transactionId.toString(),
        }
    }
}