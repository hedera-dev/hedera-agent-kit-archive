import {
    TopicId,
    TopicMessageSubmitTransaction,
    Transaction,
    TransactionReceipt,
    TransactionResponse
} from "@hashgraph/sdk";
import { TransactionStrategy } from "../base_strategy";
import { SubmitMessageResult } from "../../../results";

export class SubmitTopicMessageStrategy implements TransactionStrategy<SubmitMessageResult> {
    constructor(
        private topicId: TopicId |string,
        private message: string,
    ) {}

    build(): Transaction {
        const tx = new TopicMessageSubmitTransaction({
            topicId: this.topicId,
            message: this.message,
        })
        tx.setTransactionValidDuration(180);
        return tx;
    }

    formatResult(txResponse: TransactionResponse, receipt:  TransactionReceipt): SubmitMessageResult {
        return {
            txHash: txResponse.transactionId.toString(),
            status: receipt.status.toString(),
            topicId: this.topicId.toString()
        };
    }
}