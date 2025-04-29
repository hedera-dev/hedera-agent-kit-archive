import {
    AccountId,
    TokenAirdropTransaction,
    TokenId,
    Transaction,
    TransactionReceipt,
    TransactionResponse
} from "@hashgraph/sdk";
import { TransactionStrategy } from "../base_strategy";
import { AirdropResult } from "../../../results";

export interface AirdropRecipient {
    accountId: string | AccountId;
    amount: number;
}

export class AirdropTokenStrategy implements TransactionStrategy<AirdropResult> {
    constructor(
        private tokenId: TokenId | string,
        private recipients: AirdropRecipient[],
        private payerAccountId: string | AccountId,
    ) {}

    build(): Transaction {
        const tx = new TokenAirdropTransaction();
        tx.setTransactionValidDuration(180);
        for (const recipient of this.recipients) {
            // Deduct from sender
            tx.addTokenTransfer(this.tokenId, this.payerAccountId, -recipient.amount);
            // Add to recipient
            tx.addTokenTransfer(this.tokenId, recipient.accountId, recipient.amount);
        }
        return tx;
    }

    formatResult(txResponse: TransactionResponse, receipt:  TransactionReceipt): AirdropResult {
        return {
            status: receipt.status.toString(),
            txHash: txResponse.transactionId.toString(),
        }
    }
}