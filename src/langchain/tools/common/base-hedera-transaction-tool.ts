import { z } from 'zod';
import { StructuredTool, ToolParams } from '@langchain/core/tools';
import { HederaAgentKit } from '../../../agent/agent';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { BaseServiceBuilder } from '../../../builders/base-service-builder';
import { AccountId, Key, TransactionId } from '@hashgraph/sdk';
import { parseKey } from '../../../utils/key-utils';
import { Logger } from '../../../utils/logger';

/**
 * Zod schema for transaction meta options that can be used with any Hedera transaction tool.
 */
export const HederaTransactionMetaOptionsSchema = z
  .object({
    transactionMemo: z
      .string()
      .optional()
      .describe('Optional memo for the Hedera transaction.'),
    transactionId: z
      .string()
      .optional()
      .describe(
        'Optional transaction ID to use (e.g., for pre-generated IDs).'
      ),
    nodeAccountIds: z
      .array(z.string())
      .optional()
      .describe(
        'Optional specific node account IDs to target for the transaction.'
      ),
    schedule: z
      .boolean()
      .optional()
      .describe(
        'Set to true to schedule the transaction. If true, output will be for a ScheduleCreate transaction.'
      ),
    scheduleMemo: z
      .string()
      .optional()
      .describe('Optional memo for the ScheduleCreate transaction itself.'),
    schedulePayerAccountId: z
      .string()
      .optional()
      .describe(
        'Optional payer account ID for the ScheduleCreate transaction.'
      ),
    scheduleAdminKey: z
      .string()
      .optional()
      .describe(
        'Optional admin key (serialized string) for the ScheduleCreate transaction. Builder parses.'
      ),
  })
  .optional();

export type HederaTransactionMetaOptions = z.infer<
  typeof HederaTransactionMetaOptionsSchema
>;

/**
 * Parameters required to initialize a BaseHederaTransactionTool.
 */
export interface BaseHederaTransactionToolParams extends ToolParams {
  hederaKit: HederaAgentKit;
  logger?: Logger;
}

/**
 * Schedule options used when executing transactions.
 */
interface ScheduleExecutionOptions {
  schedule?: boolean;
  scheduleMemo?: string;
  schedulePayerAccountId?: string | AccountId;
  scheduleAdminKey?: Key;
}

/**
 * Base class for all Hedera transaction tools.
 * Handles common transaction processing logic across different tool types.
 *
 * @template S - The Zod schema that defines the input parameters for the specific tool
 */
export abstract class BaseHederaTransactionTool<
  //@ts-ignore
  S extends z.ZodObject<z.ZodRawShape, z.UnknownKeysParam, z.ZodTypeAny>
> extends StructuredTool<
  //@ts-ignore
  z.ZodObject<
    S['shape'] & { metaOptions: typeof HederaTransactionMetaOptionsSchema },
    z.UnknownKeysParam,
    z.ZodTypeAny,
    z.infer<S> & { metaOptions?: HederaTransactionMetaOptions },
    z.infer<S> & { metaOptions?: HederaTransactionMetaOptions }
  >
> {
  protected hederaKit: HederaAgentKit;
  protected logger: Logger;
  protected neverScheduleThisTool: boolean = false;

  /**
   * Indicates if this tool requires multiple transactions to complete.
   * Tools that require multiple transactions cannot be used in provideBytes mode.
   */
  protected requiresMultipleTransactions: boolean = false;

  abstract specificInputSchema: S;
  abstract namespace: string;

  //@ts-ignore: Ignoring complex type compatibility issues
  get schema(): this['lc_kwargs']['schema'] {
    //@ts-ignore: Ignoring complex type compatibility issues
    return this.specificInputSchema.extend({
      metaOptions: HederaTransactionMetaOptionsSchema,
    });
  }

  constructor({ hederaKit, logger, ...rest }: BaseHederaTransactionToolParams) {
    super(rest);
    this.hederaKit = hederaKit;
    this.logger = logger || hederaKit.logger;
  }

  /**
   * Get the appropriate service builder for this tool's operations.
   */
  protected abstract getServiceBuilder(): BaseServiceBuilder;

  /**
   * Call the appropriate builder method with the tool-specific arguments.
   */
  protected abstract callBuilderMethod(
    builder: BaseServiceBuilder,
    specificArgs: z.infer<S>,
    runManager?: CallbackManagerForToolRun
  ): Promise<void>;

  /**
   * Apply any meta options specified in the tool call to the service builder.
   */
  protected async _applyMetaOptions(
    builder: BaseServiceBuilder,
    metaOpts: HederaTransactionMetaOptions | undefined,
    specificCallArgs: z.infer<S>
  ): Promise<void> {
    await this._substituteKeyFields(specificCallArgs);
    this._applyTransactionOptions(builder, metaOpts);
  }

  /**
   * Handle substitution of special key field values like 'current_signer'
   */
  private async _substituteKeyFields(
    specificCallArgs: z.infer<S>
  ): Promise<void> {
    const keyFieldNames: (keyof typeof specificCallArgs)[] = [
      'adminKey',
      'kycKey',
      'freezeKey',
      'wipeKey',
      'supplyKey',
      'feeScheduleKey',
      'pauseKey',
    ];

    for (const keyField of keyFieldNames) {
      const originalKeyValue = (specificCallArgs as Record<string, unknown>)[
        keyField as string
      ];

      if (originalKeyValue === 'current_signer') {
        try {
          const operatorPubKey = await this.hederaKit.signer.getPublicKey();
          const pubKeyString = operatorPubKey.toStringDer();
          (specificCallArgs as Record<string, unknown>)[keyField as string] =
            pubKeyString;
          this.logger.info(
            `Substituted ${
              keyField as string
            } with current signer's public key.`
          );
        } catch (error) {
          const typedError = error as Error;
          this.logger.error(
            `Failed to get current signer's public key for ${
              keyField as string
            } substitution: ${typedError.message}`,
            error
          );
        }
      }
    }
  }

  /**
   * Apply transaction-specific options from metaOptions
   */
  private _applyTransactionOptions(
    builder: BaseServiceBuilder,
    metaOptions?: HederaTransactionMetaOptions
  ): void {
    if (!metaOptions) return;

    if (metaOptions.transactionId) {
      try {
        builder.setTransactionId(
          TransactionId.fromString(metaOptions.transactionId)
        );
      } catch {
        this.logger.warn(
          `Invalid transactionId format in metaOptions: ${metaOptions.transactionId}, ignoring.`
        );
      }
    }

    if (metaOptions.nodeAccountIds && metaOptions.nodeAccountIds.length > 0) {
      try {
        builder.setNodeAccountIds(
          metaOptions.nodeAccountIds.map((id: string) =>
            AccountId.fromString(id)
          )
        );
      } catch {
        this.logger.warn(
          `Invalid nodeAccountId format in metaOptions, ignoring.`
        );
      }
    }

    if (metaOptions.transactionMemo) {
      builder.setTransactionMemo(metaOptions.transactionMemo);
    }
  }

  /**
   * Handle direct execution mode for the transaction
   */
  private async _handleDirectExecution(
    builder: BaseServiceBuilder,
    metaOpts: HederaTransactionMetaOptions | undefined,
    allNotes: string[]
  ): Promise<string> {
    const execOptions = await this._buildScheduleOptions(metaOpts);

    this.logger.info(
      `Executing transaction directly (mode: directExecution): ${this.name}`
    );

    const result = await builder.execute(execOptions);
    return JSON.stringify({ ...result, notes: allNotes });
  }

  /**
   * Handle providing transaction bytes mode
   */
  private async _handleProvideBytes(
    builder: BaseServiceBuilder,
    metaOpts: HederaTransactionMetaOptions | undefined,
    allNotes: string[]
  ): Promise<string> {
    if (this.requiresMultipleTransactions) {
      const errorMessage =
        `The ${this.name} tool requires multiple transactions and cannot be used in provideBytes mode. ` +
        `Please use directExecution mode or break down the operation into individual steps.`;
      this.logger.warn(errorMessage);
      return JSON.stringify({
        success: false,
        error: errorMessage,
        requiresDirectExecution: true,
        notes: allNotes,
      });
    }

    const shouldSchedule = this._shouldScheduleTransaction(metaOpts);

    if (shouldSchedule) {
      return this._handleScheduledTransaction(builder, metaOpts, allNotes);
    } else {
      return this._handleUnscheduledTransaction(builder, allNotes);
    }
  }

  /**
   * Determine if a transaction should be scheduled
   */
  private _shouldScheduleTransaction(
    metaOptions?: HederaTransactionMetaOptions
  ): boolean {
    return (
      !this.neverScheduleThisTool &&
      (metaOptions?.schedule ??
        (this.hederaKit.operationalMode === 'provideBytes' &&
          this.hederaKit.scheduleUserTransactionsInBytesMode))
    );
  }

  /**
   * Handle creating a scheduled transaction
   */
  private async _handleScheduledTransaction(
    builder: BaseServiceBuilder,
    metaOpts: HederaTransactionMetaOptions | undefined,
    allNotes: string[]
  ): Promise<string> {
    this.logger.info(
      `Preparing scheduled transaction (mode: provideBytes, schedule: true): ${this.name}`
    );

    const execOptions = await this._buildScheduleOptions(metaOpts, true);
    execOptions.schedulePayerAccountId = this.hederaKit.signer.getAccountId();

    const scheduleCreateResult = await builder.execute(execOptions);

    if (scheduleCreateResult.success && scheduleCreateResult.scheduleId) {
      const description =
        metaOpts?.transactionMemo || `Scheduled ${this.name} operation.`;

      const userInfo = this.hederaKit.userAccountId
        ? ` User (${this.hederaKit.userAccountId}) will be payer of scheduled transaction.`
        : '';

      return JSON.stringify({
        success: true,
        op: 'schedule_create',
        scheduleId: scheduleCreateResult.scheduleId.toString(),
        description: description + userInfo,
        payer_account_id_scheduled_tx:
          this.hederaKit.userAccountId || 'unknown',
        memo_scheduled_tx: metaOpts?.transactionMemo,
        notes: allNotes,
      });
    } else {
      return JSON.stringify({
        success: false,
        error:
          scheduleCreateResult.error ||
          'Failed to create schedule and retrieve ID.',
        notes: allNotes,
      });
    }
  }

  /**
   * Handle returning transaction bytes for an unscheduled transaction
   */
  private async _handleUnscheduledTransaction(
    builder: BaseServiceBuilder,
    allNotes: string[]
  ): Promise<string> {
    this.logger.info(
      `Returning transaction bytes (mode: provideBytes, schedule: false): ${this.name}`
    );

    const bytes = await builder.getTransactionBytes({});
    return JSON.stringify({
      success: true,
      transactionBytes: bytes,
      transactionId: builder.getCurrentTransaction()?.transactionId?.toString(),
      notes: allNotes,
    });
  }

  /**
   * Build schedule options from meta options
   */
  private async _buildScheduleOptions(
    metaOptions?: HederaTransactionMetaOptions,
    forceSchedule = false
  ): Promise<ScheduleExecutionOptions> {
    const options: ScheduleExecutionOptions = {};

    if (forceSchedule || metaOptions?.schedule) {
      options.schedule = true;

      if (metaOptions?.scheduleMemo) {
        options.scheduleMemo = metaOptions.scheduleMemo;
      }

      if (metaOptions?.schedulePayerAccountId) {
        try {
          options.schedulePayerAccountId = AccountId.fromString(
            metaOptions.schedulePayerAccountId
          );
        } catch {
          this.logger.warn('Invalid schedulePayerAccountId');
        }
      }

      if (metaOptions?.scheduleAdminKey) {
        try {
          const parsedKey = await parseKey(this.hederaKit.mirrorNode, this.hederaKit.userAccountId!, metaOptions.scheduleAdminKey);
          if (parsedKey) options.scheduleAdminKey = parsedKey;
        } catch {
          this.logger.warn('Invalid scheduleAdminKey');
        }
      }
    }

    return options;
  }

  /**
   * Optional method for concrete tools to provide a user-friendly note for a specific Zod-defaulted parameter.
   * @param key The key of the parameter that was defaulted by Zod.
   * @param schemaDefaultValue The default value defined in the Zod schema for this key.
   * @param actualValue The current/final value of the parameter after Zod parsing.
   * @returns A user-friendly string for the note, or undefined to use a generic note.
   */
  protected getNoteForKey?(
    //eslint-disable-next-line @typescript-eslint/no-unused-vars
    key: string,
    //eslint-disable-next-line @typescript-eslint/no-unused-vars
    schemaDefaultValue: unknown,
    //eslint-disable-next-line @typescript-eslint/no-unused-vars
    actualValue: unknown
  ): string | undefined {
    return undefined;
  }

  /**
   * Main method called when the tool is executed.
   * Processes arguments, calls the specific builder method, and handles
   * transaction execution based on the kit's operational mode.
   */
  protected async _call(
    args: z.infer<ReturnType<this['schema']>>,
    runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    const llmProvidedMetaOptions = args.metaOptions;
    const specificCallArgs = this._extractSpecificArgsFromCombinedArgs(args);

    this.logger.info(
      `Executing ${this.name} with Zod-parsed specific args (schema defaults applied by LangChain):`,
      JSON.parse(JSON.stringify(specificCallArgs)),
      'and metaOptions:',
      llmProvidedMetaOptions
    );

    const zodSchemaInfoNotes: string[] = [];
    if (this.specificInputSchema && this.specificInputSchema.shape) {
      for (const key in this.specificInputSchema.shape) {
        if (
          Object.prototype.hasOwnProperty.call(
            this.specificInputSchema.shape,
            key
          )
        ) {
          const fieldSchema = this.specificInputSchema.shape[
            key
          ] as z.ZodTypeAny;

          if (
            fieldSchema._def &&
            (fieldSchema._def as z.ZodDefaultDef<z.ZodTypeAny>).typeName ===
              'ZodDefault'
          ) {
            const defaultValueOrFn = (
              fieldSchema._def as z.ZodDefaultDef<z.ZodTypeAny>
            ).defaultValue();
            let schemaDefinedDefaultValue = defaultValueOrFn;
            if (typeof defaultValueOrFn === 'function') {
              try {
                schemaDefinedDefaultValue = defaultValueOrFn();
              } catch (eDefaultFn) {
                this.logger.warn(
                  `Could not execute default value function for key ${key}. Error: ${
                    (eDefaultFn as Error).message
                  }`
                );
                schemaDefinedDefaultValue = '[dynamic schema default]';
              }
            }

            const currentValue =
              specificCallArgs[key as keyof typeof specificCallArgs];
            let noteMessage: string | undefined;

            if (this.getNoteForKey) {
              noteMessage = this.getNoteForKey(
                key,
                schemaDefinedDefaultValue,
                currentValue
              );
            }

            if (!noteMessage) {
              noteMessage = `For the parameter '${key}', the value '${JSON.stringify(
                currentValue
              )}' was used. This field has a tool schema default of '${JSON.stringify(
                schemaDefinedDefaultValue
              )}'.`;
            }
            zodSchemaInfoNotes.push(noteMessage);
          }
        }
      }
    }

    this.logger.debug('Zod Schema Default Info Notes:', zodSchemaInfoNotes);

    try {
      const builder = this.getServiceBuilder();
      builder.clearNotes();

      await this._applyMetaOptions(
        builder,
        llmProvidedMetaOptions,
        specificCallArgs
      );
      await this.callBuilderMethod(builder, specificCallArgs, runManager);

      const builderAppliedDefaultNotes = builder.getNotes();
      this.logger.debug(
        'Builder Applied Default Notes:',
        builderAppliedDefaultNotes
      );
      const allNotes = [...zodSchemaInfoNotes, ...builderAppliedDefaultNotes];
      this.logger.debug('All Notes combined:', allNotes);

      if (this.hederaKit.operationalMode === 'directExecution') {
        return this._handleDirectExecution(
          builder,
          llmProvidedMetaOptions,
          allNotes
        );
      } else {
        return this._handleProvideBytes(
          builder,
          llmProvidedMetaOptions,
          allNotes
        );
      }
    } catch (error) {
      const builder = this.getServiceBuilder();
      const builderNotesOnError = builder ? builder.getNotes() : [];
      const allNotesOnError = [...zodSchemaInfoNotes, ...builderNotesOnError];
      return this._handleError(error, allNotesOnError);
    }
  }

  private _extractSpecificArgsFromCombinedArgs(
    combinedArgs: z.infer<ReturnType<this['schema']>>
  ): z.infer<S> {
    const specificArgs: Record<string, unknown> = {};
    if (this.specificInputSchema && this.specificInputSchema.shape) {
      for (const key in this.specificInputSchema.shape) {
        if (Object.prototype.hasOwnProperty.call(combinedArgs, key)) {
          specificArgs[key] = (combinedArgs as Record<string, unknown>)[key];
        }
      }
    }
    return specificArgs as z.infer<S>;
  }

  private _handleError(error: unknown, notes?: string[]): string {
    const errorMessage =
      error instanceof Error ? error.message : JSON.stringify(error);
    this.logger.error(`Error in ${this.name}: ${errorMessage}`, error);
    return JSON.stringify({
      success: false,
      error: errorMessage,
      notes: notes || [],
    });
  }
}
