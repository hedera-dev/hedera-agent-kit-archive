import { AccountId, Client, TokenId, TopicId, Transaction, TransactionId } from '@hashgraph/sdk';
import { AgentMode, Context } from '@/shared/configuration';

interface TxModeStrategy {
  handle<T extends Transaction>(tx: T, client: Client, context: Context): Promise<unknown>;
}

export interface ExecuteStrategyResult {
  status: number;
  accountId: AccountId;
  tokenId: TokenId;
  transactionId: string;
  topicId: TopicId;
}

class ExecuteStrategy implements TxModeStrategy {
  async handle(tx: Transaction, client: Client) {
    const submit = await tx.execute(client);
    const receipt = await submit.getReceipt(client);
    return {
      status: receipt.status._code,
      accountId: receipt.accountId,
      tokenId: receipt.tokenId,
      transactionId: tx.transactionId?.toString(),
      topicId: receipt.topicId,
      contractId: receipt.contractId,
      receipt: receipt,
    } as ExecuteStrategyResult;
  }
}

class ReturnBytesStrategy implements TxModeStrategy {
  async handle(tx: Transaction, _client: Client, context: Context) {
    if (!context.accountId) throw new Error('…');
    const id = TransactionId.generate(context.accountId);
    tx.setNodeAccountIds([new AccountId(4), new AccountId(5)])
      .setTransactionId(id)
      .freeze();
    return { bytes: tx.toBytes() };
  }
}

const getStrategyFromContext = (context: Context) => {
  if (context.mode === AgentMode.RETURN_BYTES) {
    return new ReturnBytesStrategy();
  }
  return new ExecuteStrategy();
};

export const handleTransaction = async (tx: Transaction, client: Client, context: Context) => {
  const strategy = getStrategyFromContext(context);
  return await strategy.handle(tx, client, context);
};
