import {
  AccountCreateTransaction,
  AccountUpdateTransaction,
  AccountDeleteTransaction,
  Hbar,
  TransferTransaction,
  Long,
  AccountAllowanceApproveTransaction,
  AccountAllowanceDeleteTransaction,
  TokenId,
  NftId,
  Key,
  AccountId,
  ScheduleId,
  ScheduleSignTransaction,
} from '@hashgraph/sdk';
import BigNumber from 'bignumber.js';
import {
  CreateAccountParams,
  HbarTransferParams,
  UpdateAccountParams,
  DeleteAccountParams,
  ApproveHbarAllowanceParams,
  ApproveTokenNftAllowanceParams,
  ApproveFungibleTokenAllowanceParams,
  RevokeHbarAllowanceParams,
  RevokeFungibleTokenAllowanceParams,
  DeleteNftSpenderAllowanceParams,
  DeleteNftSpenderAllowanceToolParams,
  DeleteNftSerialAllowancesParams,
  SignScheduledTransactionParams,
} from '../../types';
import { BaseServiceBuilder } from '../base-service-builder';
import { HederaAgentKit } from '../../agent/agent';
import { detectKeyTypeFromMirrorNode } from '../../utils/key-type-detector';

const DEFAULT_ACCOUNT_AUTORENEW_PERIOD_SECONDS = 7776000;

/**
 * AccountBuilder facilitates the construction and execution of Hedera account-related transactions.
 */
export class AccountBuilder extends BaseServiceBuilder {
  constructor(hederaKit: HederaAgentKit) {
    super(hederaKit);
  }

  /**
   * Creates a new Hedera account.
   * @param {CreateAccountParams} params Parameters for creating an account.
   * @returns {this} The builder instance for chaining.
   * @throws {Error} If required parameters are missing.
   */
  public async createAccount(params: CreateAccountParams): Promise<this> {
    this.clearNotes();
    const transaction = new AccountCreateTransaction();
    let autoRenewPeriodSetByUser = false;

    if (typeof params.key !== 'undefined') {
      if (params.key === null) {
        this.logger.warn(
          'Received null for key in createAccount. A key or alias is typically required.'
        );
      } else if (typeof params.key === 'string') {
        const keyDetection = await detectKeyTypeFromMirrorNode(this.kit.mirrorNode, this.kit.userAccountId! , params.key);
        transaction.setKeyWithoutAlias(keyDetection.privateKey);
      } else {
        transaction.setKeyWithoutAlias(params.key as Key);
      }
    }

    if (typeof params.initialBalance !== 'undefined') {
      if (params.initialBalance === null) {
        this.logger.warn('Received null for initialBalance in createAccount.');
      } else if (typeof params.initialBalance === 'string') {
        transaction.setInitialBalance(Hbar.fromString(params.initialBalance));
      } else if (typeof params.initialBalance === 'number') {
        transaction.setInitialBalance(new Hbar(params.initialBalance));
      } else {
        transaction.setInitialBalance(params.initialBalance);
      }
    }

    if (typeof params.receiverSignatureRequired !== 'undefined') {
      if (params.receiverSignatureRequired === null) {
        this.logger.warn(
          'Received null for receiverSignatureRequired in createAccount.'
        );
      } else {
        transaction.setReceiverSignatureRequired(
          params.receiverSignatureRequired
        );
      }
    }

    if (typeof params.autoRenewPeriod !== 'undefined') {
      if (params.autoRenewPeriod === null) {
        this.logger.warn('Received null for autoRenewPeriod in createAccount.');
      } else if (
        typeof params.autoRenewPeriod === 'number' ||
        (params.autoRenewPeriod as unknown) instanceof Long
      ) {
        transaction.setAutoRenewPeriod(params.autoRenewPeriod as number | Long);
        autoRenewPeriodSetByUser = true;
      } else if (
        typeof params.autoRenewPeriod === 'object' &&
        typeof (params.autoRenewPeriod as unknown as { seconds?: number }).seconds === 'number'
      ) {
        transaction.setAutoRenewPeriod(
          (params.autoRenewPeriod as { seconds: number }).seconds
        );
        autoRenewPeriodSetByUser = true;
      } else {
        this.logger.warn(
          'Invalid autoRenewPeriod in createAccount, using default.'
        );
        transaction.setAutoRenewPeriod(
          DEFAULT_ACCOUNT_AUTORENEW_PERIOD_SECONDS
        );
      }
    } else {
      transaction.setAutoRenewPeriod(DEFAULT_ACCOUNT_AUTORENEW_PERIOD_SECONDS);
    }

    if (!autoRenewPeriodSetByUser) {
      this.addNote(
        `Default auto-renew period of ${DEFAULT_ACCOUNT_AUTORENEW_PERIOD_SECONDS} seconds applied.`
      );
    }

    if (typeof params.memo !== 'undefined') {
      if (params.memo === null) {
        this.logger.warn('Received null for memo in createAccount.');
      } else {
        transaction.setAccountMemo(params.memo);
      }
    }

    if (typeof params.maxAutomaticTokenAssociations !== 'undefined') {
      if (params.maxAutomaticTokenAssociations === null) {
        this.logger.warn(
          'Received null for maxAutomaticTokenAssociations in createAccount.'
        );
      } else {
        transaction.setMaxAutomaticTokenAssociations(
          params.maxAutomaticTokenAssociations
        );
      }
    }

    if (typeof params.stakedAccountId !== 'undefined') {
      if (params.stakedAccountId === null) {
        this.logger.warn('Received null for stakedAccountId in createAccount.');
      } else {
        transaction.setStakedAccountId(params.stakedAccountId);
      }
    }

    if (typeof params.stakedNodeId !== 'undefined') {
      if (params.stakedNodeId === null) {
        this.logger.warn('Received null for stakedNodeId in createAccount.');
      } else {
        transaction.setStakedNodeId(params.stakedNodeId);
      }
    }

    if (typeof params.declineStakingReward !== 'undefined') {
      if (params.declineStakingReward === null) {
        this.logger.warn(
          'Received null for declineStakingReward in createAccount.'
        );
      } else {
        transaction.setDeclineStakingReward(params.declineStakingReward);
      }
    }

    if (typeof params.alias !== 'undefined') {
      if (params.alias === null) {
        this.logger.warn('Received null for alias in createAccount.');
      } else {
        transaction.setAlias(params.alias);
      }
    }

    if (!params.key && !params.alias) {
      this.logger.warn(
        'AccountCreateTransaction: Neither key nor a usable alias (PublicKey/EvmAddress) was provided. Transaction might fail.'
      );
    }

    this.setCurrentTransaction(transaction);
    return this;
  }

  /**
   * Transfers HBAR between accounts.
   * @param {HbarTransferParams} params Parameters for the HBAR transfer.
   * @param {boolean} [isUserInitiated=true] Whether this transfer was initiated by the user (vs. system/agent)
   * @returns {this} The builder instance for chaining.
   * @throws {Error} If transfers are missing or do not sum to zero.
   */
  public transferHbar(
    params: HbarTransferParams,
    isUserInitiated: boolean = true
  ): this {
    this.clearNotes();
    const transaction = new TransferTransaction();
    if (!params.transfers || params.transfers.length === 0) {
      throw new Error('HbarTransferParams must include at least one transfer.');
    }

    let netZeroInTinybars = new BigNumber(0);
    let userTransferProcessedForScheduling = false;

    if (
      isUserInitiated &&
      this.kit.userAccountId &&
      this.kit.operationalMode === 'provideBytes' &&
      params.transfers.length === 1
    ) {
      const receiverTransfer = params.transfers[0];
      const amountValue =
        typeof receiverTransfer.amount === 'string' ||
        typeof receiverTransfer.amount === 'number'
          ? receiverTransfer.amount
          : receiverTransfer.amount.toString();

      const amountBigNum = new BigNumber(amountValue);

      if (amountBigNum.isPositive()) {
        const recipientAccountId =
          typeof receiverTransfer.accountId === 'string'
            ? AccountId.fromString(receiverTransfer.accountId)
            : receiverTransfer.accountId;

        const sdkHbarAmount = Hbar.fromString(amountValue.toString());

        this.logger.info(
          `[AccountBuilder.transferHbar] Configuring user-initiated scheduled transfer: ${sdkHbarAmount.toString()} from ${
            this.kit.userAccountId
          } to ${recipientAccountId.toString()}`
        );
        this.addNote(
          `Configured HBAR transfer from your account (${
            this.kit.userAccountId
          }) to ${recipientAccountId.toString()} for ${sdkHbarAmount.toString()}.`
        );

        transaction.addHbarTransfer(recipientAccountId, sdkHbarAmount);
        transaction.addHbarTransfer(
          AccountId.fromString(this.kit.userAccountId),
          sdkHbarAmount.negated()
        );

        userTransferProcessedForScheduling = true;
      }
    }

    if (!userTransferProcessedForScheduling) {
      for (const transferInput of params.transfers) {
        const accountId =
          typeof transferInput.accountId === 'string'
            ? AccountId.fromString(transferInput.accountId)
            : transferInput.accountId;

        const amountValue =
          typeof transferInput.amount === 'string' ||
          typeof transferInput.amount === 'number'
            ? transferInput.amount
            : transferInput.amount.toString();

        const sdkHbarAmount = Hbar.fromString(amountValue.toString());

        transaction.addHbarTransfer(accountId, sdkHbarAmount);

        const tinybarsContribution = sdkHbarAmount.toTinybars();
        netZeroInTinybars = netZeroInTinybars.plus(
          tinybarsContribution.toString()
        );
      }

      if (!netZeroInTinybars.isZero()) {
        throw new Error('The sum of all HBAR transfers must be zero.');
      }
    }

    if (typeof params.memo !== 'undefined') {
      if (params.memo === null) {
        this.logger.warn('Received null for memo in transferHbar.');
      } else {
        transaction.setTransactionMemo(params.memo);
      }
    }
    this.setCurrentTransaction(transaction);
    return this;
  }

  /**
   * Updates an existing Hedera account.
   * If an optional field in `params` is `undefined`, that aspect of the account is not changed.
   * Specific string or number values (e.g., memo: "", stakedAccountId: "0.0.0", stakedNodeId: -1)
   * provided by the LLM (and allowed by the Zod schema in the tool) will be applied directly.
   * @param {UpdateAccountParams} params Parameters for updating an account.
   * @returns {this} The builder instance for chaining.
   * @throws {Error} If accountIdToUpdate is missing or key parsing fails.
   */
  public async updateAccount(params: UpdateAccountParams): Promise<this> {
    if (!params.accountIdToUpdate) {
      throw new Error('accountIdToUpdate is required for updating an account.');
    }
    const transaction = new AccountUpdateTransaction().setAccountId(
      params.accountIdToUpdate
    );

    if (typeof params.key !== 'undefined') {
      if (params.key === null) {
        this.logger.warn('Received null for key, skipping update for key.');
      } else if (typeof params.key === 'string') {
        try {
          const keyDetection = await detectKeyTypeFromMirrorNode(this.kit.mirrorNode, this.kit.userAccountId!, params.key);
          transaction.setKey(keyDetection.privateKey);
        } catch (e) {
          this.logger.error(`Failed to parse key string: ${params.key}`, e);
          throw new Error(`Invalid key string provided: ${params.key}`);
        }
      } else {
        transaction.setKey(params.key as Key);
      }
    }

    if (typeof params.autoRenewPeriod !== 'undefined') {
      if (params.autoRenewPeriod === null) {
        this.logger.warn('Received null for autoRenewPeriod, skipping update.');
      } else if (typeof params.autoRenewPeriod === 'number') {
        transaction.setAutoRenewPeriod(params.autoRenewPeriod);
      } else {
        this.logger.warn(
          `Invalid autoRenewPeriod format: ${JSON.stringify(
            params.autoRenewPeriod
          )}. Skipping.`
        );
      }
    }

    if (typeof params.receiverSignatureRequired !== 'undefined') {
      if (params.receiverSignatureRequired === null) {
        this.logger.warn(
          'Received null for receiverSignatureRequired, skipping update.'
        );
      } else {
        transaction.setReceiverSignatureRequired(
          params.receiverSignatureRequired
        );
      }
    }

    if (typeof params.stakedAccountId !== 'undefined') {
      if (params.stakedAccountId === null) {
        this.logger.warn('Received null for stakedAccountId, skipping update.');
      } else {
        const saId = String(params.stakedAccountId);
        if (saId === '0.0.0' || /^\d+\.\d+\.\d+$/.test(saId)) {
          transaction.setStakedAccountId(saId);
        } else {
          this.logger.warn(
            `Invalid stakedAccountId format: ${saId}. Skipping.`
          );
        }
      }
    }

    if (typeof params.stakedNodeId !== 'undefined') {
      if (params.stakedNodeId === null) {
        this.logger.warn('Received null for stakedNodeId, skipping update.');
      } else {
        transaction.setStakedNodeId(params.stakedNodeId);
      }
    }

    if (typeof params.declineStakingReward !== 'undefined') {
      if (params.declineStakingReward === null) {
        this.logger.warn(
          'Received null for declineStakingReward, skipping update.'
        );
      } else {
        transaction.setDeclineStakingReward(params.declineStakingReward);
      }
    }

    if (typeof params.memo !== 'undefined') {
      if (params.memo === null) {
        this.logger.warn('Received null for memo, skipping update.');
      } else {
        transaction.setAccountMemo(params.memo);
      }
    }

    if (typeof params.maxAutomaticTokenAssociations !== 'undefined') {
      if (params.maxAutomaticTokenAssociations === null) {
        this.logger.warn(
          'Received null for maxAutomaticTokenAssociations, skipping update.'
        );
      } else if (typeof params.maxAutomaticTokenAssociations === 'number') {
        transaction.setMaxAutomaticTokenAssociations(
          params.maxAutomaticTokenAssociations
        );
      } else {
        this.logger.warn(
          `Invalid type for maxAutomaticTokenAssociations: ${typeof params.maxAutomaticTokenAssociations}. Skipping.`
        );
      }
    }

    this.setCurrentTransaction(transaction);
    return this;
  }

  /**
   * Deletes an existing Hedera account.
   * @param {DeleteAccountParams} params Parameters for deleting an account.
   * @returns {this} The builder instance for chaining.
   * @throws {Error} If required parameters are missing.
   */
  public deleteAccount(params: DeleteAccountParams): this {
    if (!params.deleteAccountId) {
      throw new Error('deleteAccountId is required for deleting an account.');
    }
    if (!params.transferAccountId) {
      throw new Error('transferAccountId is required for deleting an account.');
    }

    const transaction = new AccountDeleteTransaction()
      .setAccountId(params.deleteAccountId)
      .setTransferAccountId(params.transferAccountId);

    this.setCurrentTransaction(transaction);
    return this;
  }

  /**
   * Approves an HBAR allowance for a spender.
   * @param {ApproveHbarAllowanceParams} params Parameters for approving HBAR allowance.
   * @returns {this} The builder instance for chaining.
   */
  public approveHbarAllowance(params: ApproveHbarAllowanceParams): this {
    const transaction =
      new AccountAllowanceApproveTransaction().approveHbarAllowance(
        params.ownerAccountId || this.kit.signer.getAccountId(),
        params.spenderAccountId,
        params.amount
      );
    this.setCurrentTransaction(transaction);
    return this;
  }

  /**
   * Approves an NFT allowance for a spender.
   * @param {ApproveTokenNftAllowanceParams} params Parameters for approving NFT allowance.
   * @returns {this} The builder instance for chaining.
   * @throws {Error} If NFT allowance parameters are invalid.
   */
  public approveTokenNftAllowance(
    params: ApproveTokenNftAllowanceParams
  ): this {
    const transaction = new AccountAllowanceApproveTransaction();
    const owner = params.ownerAccountId || this.kit.signer.getAccountId();
    const tokenId =
      typeof params.tokenId === 'string'
        ? TokenId.fromString(params.tokenId)
        : params.tokenId;

    if (params.allSerials) {
      transaction.approveTokenNftAllowanceAllSerials(
        tokenId,
        owner,
        params.spenderAccountId
      );
    } else if (params.serials && params.serials.length > 0) {
      for (const serial of params.serials) {
        let serialLong: Long;
        if (typeof serial === 'number') {
          serialLong = Long.fromNumber(serial);
        } else if (serial instanceof BigNumber) {
          serialLong = Long.fromString(serial.toString());
        } else {
          serialLong = serial as Long;
        }
        transaction.approveTokenNftAllowance(
          new NftId(tokenId, serialLong),
          owner,
          params.spenderAccountId
        );
      }
    } else {
      throw new Error(
        "Either allSerials must be true or 'serials' (with serial numbers) must be provided for NFT allowance."
      );
    }

    if (typeof params.memo !== 'undefined') {
      if (params.memo === null) {
        this.logger.warn('Received null for memo in approveTokenNftAllowance.');
      } else {
        transaction.setTransactionMemo(params.memo);
      }
    }

    this.setCurrentTransaction(transaction);
    return this;
  }

  /**
   * Approves a fungible token allowance for a spender.
   * @param {ApproveFungibleTokenAllowanceParams} params Parameters for approving fungible token allowance.
   * @returns {this} The builder instance for chaining.
   */
  public approveFungibleTokenAllowance(
    params: ApproveFungibleTokenAllowanceParams
  ): this {
    const tokenId =
      typeof params.tokenId === 'string'
        ? TokenId.fromString(params.tokenId)
        : params.tokenId;
    let amountLong: Long;

    if (typeof params.amount === 'string') {
      amountLong = Long.fromString(params.amount);
    } else if (typeof params.amount === 'number') {
      amountLong = Long.fromNumber(params.amount);
    } else if (params.amount instanceof BigNumber) {
      amountLong = Long.fromString(params.amount.toString());
    } else {
      amountLong = params.amount as Long;
    }

    const transaction =
      new AccountAllowanceApproveTransaction().approveTokenAllowance(
        tokenId,
        params.ownerAccountId || this.kit.signer.getAccountId(),
        params.spenderAccountId,
        amountLong
      );
    this.setCurrentTransaction(transaction);
    return this;
  }

  /**
   * Deletes NFT allowances.
   * Note: This method is currently stubbed and non-functional due to SDK considerations.
   * @returns {this} The builder instance.
   * @throws {Error} Method is temporarily disabled.
   */
  public deleteNftSpenderAllowance(
    params: DeleteNftSpenderAllowanceParams
  ): this {
    const nftId =
      typeof params.nftId === 'string'
        ? NftId.fromString(params.nftId)
        : params.nftId;
    const owner = params.ownerAccountId || this.kit.signer.getAccountId();

    const transaction =
      new AccountAllowanceDeleteTransaction().deleteAllTokenNftAllowances(
        nftId,
        owner
      );

    if (typeof params.memo !== 'undefined') {
      if (params.memo === null) {
        this.logger.warn(
          'Received null for memo in deleteNftSpenderAllowance.'
        );
      } else {
        transaction.setTransactionMemo(params.memo);
      }
    }

    this.setCurrentTransaction(transaction);
    return this;
  }

  /**
   * Revokes an HBAR allowance.
   * @param {RevokeHbarAllowanceParams} params Parameters for revoking HBAR allowance.
   * @returns {this} The builder instance for chaining.
   */
  public revokeHbarAllowance(params: RevokeHbarAllowanceParams): this {
    const transaction =
      new AccountAllowanceApproveTransaction().approveHbarAllowance(
        params.ownerAccountId || this.kit.signer.getAccountId(),
        params.spenderAccountId,
        new Hbar(0)
      );
    this.setCurrentTransaction(transaction);
    return this;
  }

  /**
   * Revokes a fungible token allowance.
   * @param {RevokeFungibleTokenAllowanceParams} params Parameters for revoking fungible token allowance.
   * @returns {this} The builder instance for chaining.
   */
  public revokeFungibleTokenAllowance(
    params: RevokeFungibleTokenAllowanceParams
  ): this {
    const tokenId =
      typeof params.tokenId === 'string'
        ? TokenId.fromString(params.tokenId)
        : params.tokenId;
    const transaction =
      new AccountAllowanceApproveTransaction().approveTokenAllowance(
        tokenId,
        params.ownerAccountId || this.kit.signer.getAccountId(),
        params.spenderAccountId,
        0
      );
    this.setCurrentTransaction(transaction);
    return this;
  }

  /**
   * Deletes all allowances for a specific NFT serial (for all spenders), granted by an owner.
   * The transaction must be signed by the owner of the NFTs.
   * @param {DeleteNftSerialAllowancesParams} params - Parameters for the operation.
   * @returns {this} The builder instance for chaining.
   */
  public deleteNftSerialAllowancesForAllSpenders(
    params: DeleteNftSerialAllowancesParams
  ): this {
    let ownerAccId: AccountId;
    if (params.ownerAccountId) {
      if (typeof params.ownerAccountId === 'string') {
        ownerAccId = AccountId.fromString(params.ownerAccountId);
      } else {
        ownerAccId = params.ownerAccountId;
      }
    } else {
      ownerAccId = this.kit.signer.getAccountId();
    }

    const parts = params.nftIdString.split('.');
    if (parts.length !== 4) {
      throw new Error(
        `Invalid nftIdString format: ${params.nftIdString}. Expected format like "0.0.token.serial".`
      );
    }
    const sdkTokenId = TokenId.fromString(
      `${parts[0]}.${parts[1]}.${parts[2]}`
    );
    const sdkSerial = Long.fromString(parts[3]);
    const sdkNftId = new NftId(sdkTokenId, sdkSerial);

    const transaction =
      new AccountAllowanceDeleteTransaction().deleteAllTokenNftAllowances(
        sdkNftId,
        ownerAccId
      );

    if (params.memo) {
      transaction.setTransactionMemo(params.memo);
    }

    this.setCurrentTransaction(transaction);
    return this;
  }

  /**
   * Deletes/revokes NFT allowances for specific serial numbers of a token for a specific spender.
   * The transaction must be signed by the owner of the NFTs.
   * @param {DeleteNftSpenderAllowanceToolParams} params - Parameters for the operation.
   * @returns {this} The builder instance for chaining.
   */
  public deleteTokenNftAllowanceForSpender(
    params: DeleteNftSpenderAllowanceToolParams
  ): this {
    let ownerAccIdToUse: AccountId;
    if (params.ownerAccountId) {
      ownerAccIdToUse =
        typeof params.ownerAccountId === 'string'
          ? AccountId.fromString(params.ownerAccountId)
          : params.ownerAccountId;
    } else {
      ownerAccIdToUse = this.kit.signer.getAccountId();
    }

    const sdkTokenId =
      typeof params.tokenId === 'string'
        ? TokenId.fromString(params.tokenId)
        : params.tokenId;

    const sdkSerials: Long[] = params.serials.map(
      (s: string | number | Long) => {
        if (typeof s === 'string') return Long.fromString(s);
        if (typeof s === 'number') return Long.fromNumber(s);
        return s;
      }
    );

    const transaction =
      new AccountAllowanceDeleteTransaction().deleteAllTokenNftAllowances(
        new NftId(sdkTokenId, sdkSerials[0]),
        ownerAccIdToUse
      );

    if (params.memo) {
      transaction.setTransactionMemo(params.memo);
    }

    this.setCurrentTransaction(transaction);
    return this;
  }

  /**
   * Prepares a ScheduleSignTransaction for a previously scheduled transaction.
   * @param {SignScheduledTransactionParams} params Parameters for the ScheduleSign transaction.
   * @returns {this} The builder instance for chaining.
   */
  public prepareSignScheduledTransaction(
    params: SignScheduledTransactionParams
  ): this {
    if (!params.scheduleId) {
      throw new Error(
        'scheduleId is required to prepare a ScheduleSignTransaction.'
      );
    }

    const scheduleId =
      typeof params.scheduleId === 'string'
        ? ScheduleId.fromString(params.scheduleId)
        : params.scheduleId;

    const transaction = new ScheduleSignTransaction().setScheduleId(scheduleId);

    if (params.memo) {
      transaction.setTransactionMemo(params.memo);
    }

    this.setCurrentTransaction(transaction);
    return this;
  }
}
