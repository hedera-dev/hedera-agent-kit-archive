import {
    PublicKey,
    TopicCreateTransaction,
    Transaction,
    TransactionReceipt,
    TransactionResponse
} from "@hashgraph/sdk";
import { TransactionStrategy } from "../base_strategy";
import { CreateTopicResult } from "../../../results";

export class CreateTopicStrategy implements TransactionStrategy<CreateTopicResult> {
    constructor(
        private memo: string,
        private publicKey: PublicKey,
        private isSubmitKey: boolean
    ) {}

    build(): Transaction {
        let tx = new TopicCreateTransaction()
            .setTopicMemo(this.memo)
            .setAdminKey(this.publicKey)
            .setTransactionValidDuration(180);

        if (this.isSubmitKey) {
            tx.setSubmitKey(this.publicKey);
        }

        return tx;
    }

    formatResult(txResponse: TransactionResponse, receipt:  TransactionReceipt): CreateTopicResult {
        if (!receipt.topicId) throw new Error("Topic Create Transaction failed");

        return {
            txHash: txResponse.transactionId.toString(),
            status: receipt.status.toString(),
            topicId: receipt.topicId.toString(),
        };
    }
}

