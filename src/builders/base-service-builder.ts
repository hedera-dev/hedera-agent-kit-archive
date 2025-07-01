import {
  AccountId,
  Transaction,
  TransactionId,
  TransactionReceipt,
  ScheduleCreateTransaction,
  ScheduleId,
  Key,
  PublicKey,
  PrivateKey,
  KeyList,
  Long,
} from '@hashgraph/sdk';
import { Buffer } from 'buffer';
import { AbstractSigner } from '../signer/abstract-signer';
import { Logger } from '../utils/logger';
import { detectKeyTypeFromMirrorNode } from '../utils/key-type-detector';
import type { HederaAgentKit } from '../agent/agent';

/**
 * Defines the structure for the result of an execute operation.
 */
export interface ExecuteResult {
  success: boolean;
  receipt?: TransactionReceipt;
  scheduleId?: ScheduleId | string | undefined;
  error?: string;
  transactionId?: string | undefined;
}

/**
 * BaseServiceBuilder provides common functionality for service-specific builders.
 * It manages the current transaction being built and offers common execution and byte generation methods.
 */
export abstract class BaseServiceBuilder {
  protected currentTransaction: Transaction | null = null;
  protected logger: Logger;
  protected kit: HederaAgentKit;
  protected notes: string[] = [];

  /**
   * @param {HederaAgentKit} kit - The HederaAgentKit instance
   */
  constructor(protected readonly hederaKit: HederaAgentKit) {
    this.kit = hederaKit;

    const shouldDisableLogs = process.env.DISABLE_LOGS === 'true';

    this.logger = new Logger({
      module: 'ServiceBuilder',
      level: shouldDisableLogs ? 'silent' : 'info',
      silent: shouldDisableLogs,
    });
  }

  /**
   * Helper method to get the effective sender account to use for transactions.
   * In user-centric contexts, this will be the user's account. Otherwise, it falls back to the signer's account.
   * @returns {AccountId} The account ID to use as sender
   */
  protected getEffectiveSenderAccountId(): AccountId {
    if (this.kit.userAccountId) {
      return AccountId.fromString(this.kit.userAccountId);
    }
    return this.kit.signer.getAccountId();
  }

  /**
   * Helper method to determine if a transaction is a user-initiated transfer.
   * Used for properly constructing transfer arrays.
   * @param {boolean} isUserInitiated Whether this is a user-initiated transfer
   * @returns {AccountId} The account that should be used as the sender
   */
  protected getTransferSourceAccount(
    isUserInitiated: boolean = true
  ): AccountId {
    if (isUserInitiated && this.kit.userAccountId) {
      return AccountId.fromString(this.kit.userAccountId);
    }
    return this.kit.signer.getAccountId();
  }

  /**
   * @param {string} memo
   * @returns {this}
   * @throws {Error}
   */
  public setTransactionMemo(memo: string): this {
    if (!this.currentTransaction) {
      throw new Error(
        'No transaction is currently being built. Call a specific transaction method first (e.g., createTopic).'
      );
    }
    this.currentTransaction.setTransactionMemo(memo);
    return this;
  }

  /**
   * @param {TransactionId} transactionId
   * @returns {this}
   * @throws {Error}
   */
  public setTransactionId(transactionId: TransactionId): this {
    if (!this.currentTransaction) {
      throw new Error(
        'No transaction is currently being built. Call a specific transaction method first.'
      );
    }
    this.currentTransaction.setTransactionId(transactionId);
    return this;
  }

  /**
   * @param {AccountId[]} nodeAccountIds
   * @returns {this}
   * @throws {Error}
   */
  public setNodeAccountIds(nodeAccountIds: AccountId[]): this {
    if (!this.currentTransaction) {
      throw new Error(
        'No transaction is currently being built. Call a specific transaction method first.'
      );
    }
    this.currentTransaction.setNodeAccountIds(nodeAccountIds);
    return this;
  }

  /**
   * @param {object} [options]
   * @param {boolean} [options.schedule]
   * @param {string} [options.scheduleMemo]
   * @param {string | AccountId} [options.schedulePayerAccountId]
   * @returns {Promise<ExecuteResult>}
   * @throws {Error}
   */
  public async execute(options?: {
    schedule?: boolean;
    scheduleMemo?: string;
    schedulePayerAccountId?: string | AccountId;
  }): Promise<ExecuteResult> {
    const innerTx = this.currentTransaction;

    if (!innerTx) {
      return { success: false, error: 'No transaction to execute.' };
    }

    let transactionToExecute: Transaction = innerTx;
    let originalTransactionIdForReporting = innerTx.transactionId?.toString();

    if (options?.schedule) {
      if (!innerTx.isFrozen() && this.kit.userAccountId) {
        innerTx.setTransactionId(
          TransactionId.generate(this.kit.userAccountId)
        );
      }

      const scheduleCreateTx =
        new ScheduleCreateTransaction().setScheduledTransaction(innerTx);

      if (options.scheduleMemo) {
        scheduleCreateTx.setScheduleMemo(options.scheduleMemo);
      }

      if (this.kit.userAccountId) {
        scheduleCreateTx.setPayerAccountId(
          AccountId.fromString(this.kit.userAccountId)
        );
      } else if (options.schedulePayerAccountId) {
        const payerForScheduleCreate =
          typeof options.schedulePayerAccountId === 'string'
            ? AccountId.fromString(options.schedulePayerAccountId)
            : options.schedulePayerAccountId;
        scheduleCreateTx.setPayerAccountId(payerForScheduleCreate);
      } else {
        scheduleCreateTx.setPayerAccountId(this.kit.signer.getAccountId());
        this.addNote(
          `Your agent account (${this.kit.signer
            .getAccountId()
            .toString()}) will pay the fee to create this schedule.`
        );
      }

      const agentOperator = await this.kit.getOperator();
      const adminKeyList = new KeyList().setThreshold(1);
      if (agentOperator.publicKey) {
        adminKeyList.push(agentOperator.publicKey);
        this.addNote(
          `The schedule admin key allows both your agent and user (${this.kit.userAccountId}) to manage the schedule.`
        );
      }

      if (this.kit.userAccountId) {
        try {
          const mirrorNode = this.kit.mirrorNode;
          const userAccountInfo = await mirrorNode.requestAccount(
            this.kit.userAccountId
          );
          if (userAccountInfo?.key?.key) {
            adminKeyList.push(PublicKey.fromString(userAccountInfo.key.key));
            this.addNote(
              `The schedule admin key allows both your agent and user (${this.kit.userAccountId}) to manage the schedule.`
            );
          } else {
            this.addNote(
              `The schedule admin key is set to your agent. User (${this.kit.userAccountId}) key not found or not a single key.`
            );
          }
        } catch (e) {
          this.logger.warn(
            `Failed to get user key for schedule admin key for ${
              this.kit.userAccountId
            }: ${(e as Error).message}`
          );
          this.addNote(
            `The schedule admin key is set to your agent. Could not retrieve user (${this.kit.userAccountId}) key.`
          );
        }
      }
      if (Array.from(adminKeyList).length > 0) {
        scheduleCreateTx.setAdminKey(adminKeyList);
      } else {
        this.addNote(
          'No admin key could be set for the schedule (agent key missing and user key not found/retrieved).'
        );
      }

      transactionToExecute = scheduleCreateTx;
    }

    try {
      if (
        !transactionToExecute.isFrozen() &&
        !transactionToExecute.transactionId
      ) {
        await transactionToExecute.freezeWith(this.kit.client);
      }
      if (options?.schedule && transactionToExecute.transactionId) {
        originalTransactionIdForReporting =
          transactionToExecute.transactionId.toString();
      }

      const receipt = await this.kit.signer.signAndExecuteTransaction(
        transactionToExecute
      );
      const finalTransactionId =
        transactionToExecute.transactionId?.toString() ||
        originalTransactionIdForReporting;

      const result: ExecuteResult = {
        success: true,
        receipt: receipt,
        transactionId: finalTransactionId,
      };

      if (options?.schedule && receipt.scheduleId) {
        result.scheduleId = receipt.scheduleId.toString();
      }
      return result;
    } catch (e: unknown) {
      console.log('error is:', e);
      const error = e as Error;
      this.logger.error(
        `Transaction execution failed: ${error.message}`,
        error
      );
      const errorResult: ExecuteResult = {
        success: false,
        error:
          error.message ||
          'An unknown error occurred during transaction execution.',
        transactionId: originalTransactionIdForReporting,
      };
      return errorResult;
    }
  }

  /**
   * @param {object} [options]
   * @param {boolean} [options.schedule]
   * @param {string} [options.scheduleMemo]
   * @param {string | AccountId} [options.schedulePayerAccountId]
   * @param {Key} [options.scheduleAdminKey]
   * @returns {Promise<string>}
   * @throws {Error}
   */
  public async getTransactionBytes(options?: {
    schedule?: boolean;
    scheduleMemo?: string;
    schedulePayerAccountId?: string | AccountId;
    scheduleAdminKey?: Key;
  }): Promise<string> {
    if (!this.currentTransaction) {
      throw new Error(
        'No transaction to get bytes for. Call a specific transaction method first.'
      );
    }

    let transactionForBytes: Transaction = this.currentTransaction;

    if (options?.schedule) {
      const scheduleCreateTx =
        new ScheduleCreateTransaction().setScheduledTransaction(
          this.currentTransaction
        );

      if (options.scheduleMemo) {
        scheduleCreateTx.setScheduleMemo(options.scheduleMemo);
      }
      if (options.schedulePayerAccountId) {
        const payerAccountId =
          typeof options.schedulePayerAccountId === 'string'
            ? AccountId.fromString(options.schedulePayerAccountId)
            : options.schedulePayerAccountId;
        scheduleCreateTx.setPayerAccountId(payerAccountId);
      }
      if (options.scheduleAdminKey) {
        scheduleCreateTx.setAdminKey(options.scheduleAdminKey);
      }
      transactionForBytes = scheduleCreateTx;
    }

    return Buffer.from(transactionForBytes.toBytes()).toString('base64');
  }

  /**
   * Executes the current transaction using a provided signer.
   * This is useful if the transaction needs to be signed and paid for by a different account
   * than the one initially configured with the HederaAgentKit/builder instance.
   * Note: The transaction should ideally not be frozen, or if frozen, its transactionId
   * should be compatible with the newSigner's accountId as the payer.
   * @param {AbstractSigner} newSigner - The signer to use for this specific execution.
   * @returns {Promise<ExecuteResult>}
   * @throws {Error}
   */
  public async executeWithSigner(
    newSigner: AbstractSigner
  ): Promise<ExecuteResult> {
    if (!this.currentTransaction) {
      return {
        success: false,
        error:
          'No transaction to execute. Call a specific transaction method first.',
      };
    }

    let transactionToExecute = this.currentTransaction;

    if (transactionToExecute.isFrozen()) {
      throw new Error(
        'Transaction is frozen, try to call the builder method again and then executeWithSigner.'
      );
    }

    try {
      const receipt = await newSigner.signAndExecuteTransaction(
        transactionToExecute
      );
      const transactionId = transactionToExecute.transactionId?.toString();
      return {
        success: true,
        receipt: receipt,
        transactionId: transactionId,
      };
    } catch (e: unknown) {
      const error = e as Error;
      this.logger.error(
        `Transaction execution with new signer failed: ${error.message}`
      );
      return {
        success: false,
        error:
          error.message ||
          'An unknown error occurred during transaction execution with new signer.',
      };
    }
  }

  /**
   * @param {Transaction} transaction
   */
  protected setCurrentTransaction(transaction: Transaction): void {
    this.currentTransaction = transaction;
  }

  /**
   * Retrieves the current transaction object being built.
   * @returns {Transaction | null} The current transaction or null.
   */
  public getCurrentTransaction(): Transaction | null {
    return this.currentTransaction;
  }

  public addNote(note: string): void {
    this.notes.push(note);
  }

  public getNotes(): string[] {
    return this.notes;
  }

  public clearNotes(): void {
    this.notes = [];
  }

  protected async parseKey(
    keyInput?: string | PublicKey | Key | null
  ): Promise<Key | undefined> {
    if (keyInput === undefined || keyInput === null) {
      return undefined;
    }
    if (
      typeof keyInput === 'object' &&
      ('_key' in keyInput ||
        keyInput instanceof PublicKey ||
        keyInput instanceof PrivateKey ||
        keyInput instanceof KeyList)
    ) {
      return keyInput as Key;
    }
    if (typeof keyInput === 'string') {
      if (keyInput.toLowerCase() === 'current_signer') {
        if (this.kit.signer) {
          this.logger.info(
            `[BaseServiceBuilder.parseKey] Substituting "current_signer" with signer's public key.`
          );
          return await this.kit.signer.getPublicKey();
        } else {
          throw new Error(
            '[BaseServiceBuilder.parseKey] Signer is not available to resolve "current_signer".'
          );
        }
      }
      try {
        return PublicKey.fromString(keyInput);
      } catch (e: unknown) {
        const error = e as Error;
        try {
          this.logger.warn(
            '[BaseServiceBuilder.parseKey] Attempting to parse key string as PrivateKey to derive PublicKey. This is generally not recommended for public-facing keys.',
            { error: error.message }
          );
          const keyDetection = await detectKeyTypeFromMirrorNode(this.kit.mirrorNode, this.kit.userAccountId!, keyInput);
          return keyDetection.privateKey;
        } catch (e2: unknown) {
          const error2 = e2 as Error;
          this.logger.error(
            `[BaseServiceBuilder.parseKey] Failed to parse key string as PublicKey or PrivateKey: ${keyInput.substring(
              0,
              30
            )}...`,
            { error: error2.message }
          );
          throw new Error(
            `[BaseServiceBuilder.parseKey] Invalid key string format: ${keyInput.substring(
              0,
              30
            )}...`
          );
        }
      }
    }
    this.logger.warn(
      `[BaseServiceBuilder.parseKey] Received an object that is not an SDK Key instance or a recognized string format: ${JSON.stringify(
        keyInput
      )}`
    );
    return undefined;
  }

  protected parseAmount(amount?: number | string | Long | BigNumber): Long {
    if (amount === undefined) {
      return Long.fromNumber(0);
    }
    if (typeof amount === 'number') {
      return Long.fromNumber(amount);
    }
    if (typeof amount === 'string') {
      return Long.fromString(amount);
    }
    if (amount instanceof BigNumber) {
      return Long.fromString(amount.toString());
    }
    return amount;
  }
}
