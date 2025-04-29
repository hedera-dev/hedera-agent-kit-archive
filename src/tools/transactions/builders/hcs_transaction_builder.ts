import { BaseTransactionBuilder } from "./base_transaction_builder";
import { CreateTopicStrategy } from "../strategies";
import { PublicKey, TopicId } from "@hashgraph/sdk";
import { SubmitTopicMessageStrategy } from "../strategies";
import { DeleteTopicStrategy } from "../strategies";
import { CreateTopicResult, DeleteTopicResult, SubmitMessageResult } from "../../results";

export class HcsTransactionBuilder {
    static createTopic(
        memo: string,
        publicKey: PublicKey,
        isSubmitKey: boolean
    ): BaseTransactionBuilder<CreateTopicResult> {
        const strategy = new CreateTopicStrategy(memo, publicKey, isSubmitKey);
        return new BaseTransactionBuilder<CreateTopicResult>(strategy);
    }

    static submitTopicMessage(
        topicId: TopicId,
        message: string,
    ): BaseTransactionBuilder<SubmitMessageResult> {
        const strategy = new SubmitTopicMessageStrategy(topicId.toString(), message);
        return new BaseTransactionBuilder<SubmitMessageResult>(strategy);
    }

    static deleteTopic(
        topicId: TopicId | string,
    ): BaseTransactionBuilder<DeleteTopicResult> {
        const strategy = new DeleteTopicStrategy(topicId)
        return new BaseTransactionBuilder<DeleteTopicResult>(strategy);
    }
}