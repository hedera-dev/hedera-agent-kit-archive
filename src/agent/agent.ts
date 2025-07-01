import {
  AccountId,
  Client,
  PublicKey,
  TransactionId,
  TransactionReceipt,
  ScheduleSignTransaction,
  ScheduleId,
} from '@hashgraph/sdk';
import { AbstractSigner } from '../signer/abstract-signer';
import {
  SignScheduledTransactionParams,
  AgentOperationalMode,
  HederaNetworkType,
  MirrorNodeConfig,
} from '../types';
import type { IPlugin, GenericPluginContext, HederaTool } from '../plugins';
import { HcsBuilder } from '../builders/hcs/hcs-builder';
import { HtsBuilder } from '../builders/hts/hts-builder';
import { AccountBuilder } from '../builders/account/account-builder';
import { ScsBuilder } from '../builders/scs/scs-builder';
import { FileBuilder } from '../builders/file/file-builder';
import { QueryBuilder } from '../builders/query/query-builder';
import { ExecuteResult } from '../builders/base-service-builder';
import { createHederaTools } from '../langchain';
import { ModelCapability } from '../types/model-capability';
import { HederaMirrorNode } from '../services/mirror-node';
import { Logger } from '../utils/logger';

export interface PluginConfig {
  plugins?: IPlugin[];
  appConfig?: Record<string, unknown> | undefined;
}
const NOT_INITIALIZED_ERROR =
  'HederaAgentKit not initialized. Call await kit.initialize() first.';

/**
 * HederaAgentKit provides a simplified interface for interacting with the Hedera network,
 * abstracting away the complexities of the underlying SDK for common use cases.
 * It supports various operations related to HCS, HTS, and HBAR transfers through a Signer and Builders.
 * The kit must be initialized using the async `initialize()` method before its tools can be accessed.
 */
export class HederaAgentKit {
  public readonly client: Client;
  public readonly network: HederaNetworkType;
  public readonly signer: AbstractSigner;
  public readonly mirrorNode: HederaMirrorNode;
  private loadedPlugins: IPlugin[];
  private aggregatedTools: HederaTool[];
  private pluginConfigInternal?: PluginConfig | undefined;
  private isInitialized: boolean = false;
  public readonly logger: Logger;
  public operationalMode: AgentOperationalMode;
  public userAccountId?: string | undefined;
  public scheduleUserTransactionsInBytesMode: boolean;
  public modelCapability: ModelCapability;
  public modelName?: string | undefined;

  constructor(
    signer: AbstractSigner,
    pluginConfigInput?: PluginConfig | undefined,
    initialOperationalMode: AgentOperationalMode = 'provideBytes',
    userAccountId?: string,
    scheduleUserTransactionsInBytesMode: boolean = true,
    modelCapability: ModelCapability = ModelCapability.MEDIUM,
    modelName?: string,
    mirrorNodeConfig?: MirrorNodeConfig,
    disableLogging: boolean = false
  ) {
    this.signer = signer;
    this.network = this.signer.getNetwork();

    const shouldDisableLogs =
      disableLogging || process.env.DISABLE_LOGS === 'true';

    this.logger = new Logger({
      level: shouldDisableLogs ? 'silent' : 'info',
      module: 'HederaAgentKit',
      silent: shouldDisableLogs,
    });

    if (this.network === 'mainnet') {
      this.client = Client.forMainnet();
    } else if (this.network === 'testnet') {
      this.client = Client.forTestnet();
    } else {
      throw new Error(`Unsupported network type: ${this.network}`);
    }
    this.client.setOperator(
      this.signer.getAccountId(),
      this.signer.getOperatorPrivateKey()
    );

    this.mirrorNode = new HederaMirrorNode(
      this.network,
      new Logger({
        level: shouldDisableLogs ? 'silent' : 'info',
        module: 'HederaAgentKit-MirrorNode',
        silent: shouldDisableLogs,
      }),
      mirrorNodeConfig
    );

    this.pluginConfigInternal = pluginConfigInput;
    this.loadedPlugins = [];
    this.aggregatedTools = [];
    this.operationalMode = initialOperationalMode;
    this.userAccountId = userAccountId || signer.getAccountId().toString();
    this.scheduleUserTransactionsInBytesMode =
      scheduleUserTransactionsInBytesMode;
    this.modelCapability = modelCapability;
    this.modelName = modelName;
  }

  /**
   * Initializes the HederaAgentKit, including loading any configured plugins and aggregating tools.
   * This method must be called before `getAggregatedLangChainTools()` can be used.
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('HederaAgentKit is already initialized.');
      return;
    }

    this.loadedPlugins = [];

    const contextForPlugins: GenericPluginContext = {
      logger: this.logger,
      config: {
        ...(this.pluginConfigInternal?.appConfig || {}),
        hederaKit: this,
        modelCapability: this.modelCapability,
      },
      client: {
        getNetwork: () => this.network,
      },
    };

    // Ensure unique plugins by id
    const uniquePlugins: IPlugin[] = [];
    const seenIds = new Set<string>();
    if (this.pluginConfigInternal?.plugins) {
      for (const pluginInstance of this.pluginConfigInternal.plugins) {
        if (!seenIds.has(pluginInstance.id)) {
          uniquePlugins.push(pluginInstance);
          seenIds.add(pluginInstance.id);
        }
      }
    }

    for (const pluginInstance of uniquePlugins) {
      try {
        this.logger.info(
          `Initializing plugin: ${pluginInstance.name}`
        );
        await pluginInstance.initialize(contextForPlugins);
        this.loadedPlugins.push(pluginInstance);
        this.logger.info(
          `Successfully initialized and added plugin: ${pluginInstance.name}`
        );
      } catch (error: unknown) {
        this.logger.error(
          `Failed to initialize plugin ${pluginInstance.name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Aggregate tools only from plugins
    const pluginTools: HederaTool[] = this.loadedPlugins.flatMap((plugin) => {
      return plugin.getTools();
    });
    this.aggregatedTools = [...pluginTools];

    this.isInitialized = true;
    this.logger.info(
      'HederaAgentKit initialized successfully with all tools aggregated.'
    );
  }

  public async getOperator(): Promise<{ id: AccountId; publicKey: PublicKey }> {
    return {
      id: this.signer.getAccountId(),
      publicKey: await this.signer.getPublicKey(),
    };
  }

  /**
   * Retrieves the aggregated list of LangChain tools from the kit, core tools, and plugins.
   * The HederaAgentKit instance must be initialized via `await kit.initialize()` before calling this method.
   * @returns {Tool[]} An array of LangChain Tool objects.
   * @throws {Error} If the kit has not been initialized.
   */
  public getAggregatedLangChainTools(): HederaTool[] {
    if (!this.isInitialized) {
      throw new Error(
        'HederaAgentKit not initialized. Call await kit.initialize() before accessing tools.'
      );
    }
    return this.aggregatedTools;
  }

  /**
   * Provides access to the Hedera Consensus Service (HCS) builder.
   * @returns {HcsBuilder} An instance of HcsBuilder.
   * @throws {Error} If HederaAgentKit has not been initialized via `await initialize()`.
   */
  public hcs(): HcsBuilder {
    if (!this.isInitialized) {
      throw new Error(NOT_INITIALIZED_ERROR);
    }
    return new HcsBuilder(this);
  }

  /**
   * Provides access to the Hedera Token Service (HTS) builder.
   * @returns {HtsBuilder} An instance of HtsBuilder.
   * @throws {Error} If HederaAgentKit has not been initialized via `await initialize()`.
   */
  public hts(): HtsBuilder {
    if (!this.isInitialized) {
      throw new Error(NOT_INITIALIZED_ERROR);
    }
    return new HtsBuilder(this);
  }

  /**
   * Provides access to the Hedera Account Service builder.
   * @returns {AccountBuilder} An instance of AccountBuilder.
   * @throws {Error} If HederaAgentKit has not been initialized via `await initialize()`.
   */
  public accounts(): AccountBuilder {
    if (!this.isInitialized) {
      throw new Error(NOT_INITIALIZED_ERROR);
    }
    return new AccountBuilder(this);
  }

  /**
   * Provides access to the Hedera Smart Contract Service (SCS) builder.
   * @returns {ScsBuilder} An instance of ScsBuilder.
   * @throws {Error} If HederaAgentKit has not been initialized via `await initialize()`.
   */
  public scs(): ScsBuilder {
    if (!this.isInitialized) {
      throw new Error(NOT_INITIALIZED_ERROR);
    }
    return new ScsBuilder(this);
  }

  /**
   * Provides access to the Hedera File Service (HFS) builder.
   * @returns {FileBuilder} An instance of FileBuilder.
   * @throws {Error} If HederaAgentKit has not been initialized via `await initialize()`.
   */
  public fs(): FileBuilder {
    if (!this.isInitialized) {
      throw new Error(NOT_INITIALIZED_ERROR);
    }
    return new FileBuilder(this);
  }

  /**
   * Provides access to the Hedera Query builder for read-only operations.
   * @returns {QueryBuilder} An instance of QueryBuilder.
   * @throws {Error} If HederaAgentKit has not been initialized via `await initialize()`.
   */
  public query(): QueryBuilder {
    if (!this.isInitialized) {
      throw new Error(NOT_INITIALIZED_ERROR);
    }
    return new QueryBuilder(this);
  }
  /**
   * Retrieves the transaction receipt for a given transaction ID string.
   * @param {string} transactionIdString - The transaction ID (e.g., "0.0.xxxx@16666666.77777777").
   * @returns {Promise<TransactionReceipt>} A promise that resolves to the TransactionReceipt.
   * @throws {Error} If the transaction ID is invalid or receipt cannot be fetched.
   */
  public async getTransactionReceipt(
    transactionIdInput: TransactionId | string
  ): Promise<TransactionReceipt> {
    const transactionId =
      typeof transactionIdInput === 'string'
        ? TransactionId.fromString(transactionIdInput)
        : transactionIdInput;
    try {
      return await transactionId.getReceipt(this.client);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to get transaction receipt for ${transactionId.toString()}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  /**
   * Signs a scheduled transaction.
   * The transaction is signed by the operator configured in the current signer.
   * @param {SignScheduledTransactionParams} params - Parameters for the ScheduleSign transaction.
   * @returns {Promise<ExecuteResult>} A promise that resolves to an object indicating success, receipt, and transactionId.
   * @throws {Error} If the execution fails.
   */
  public async signScheduledTransaction(
    params: SignScheduledTransactionParams
  ): Promise<ExecuteResult> {
    if (!this.isInitialized) {
      throw new Error(
        'HederaAgentKit not initialized. Call await kit.initialize() first.'
      );
    }
    this.logger.info(
      `Attempting to sign scheduled transaction: ${params.scheduleId.toString()}`
    );

    const scheduleId =
      typeof params.scheduleId === 'string'
        ? ScheduleId.fromString(params.scheduleId)
        : params.scheduleId;

    const transaction = new ScheduleSignTransaction().setScheduleId(scheduleId);

    if (params.memo) {
      transaction.setTransactionMemo(params.memo);
    }

    let transactionIdToReport: string | undefined;
    if (!transaction.transactionId) {
      transaction.freezeWith(this.client);
    }
    transactionIdToReport = transaction.transactionId?.toString();

    try {
      const receipt = await this.signer.signAndExecuteTransaction(transaction);

      return {
        success: true,
        receipt: receipt,
        transactionId: transactionIdToReport,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to sign scheduled transaction ${params.scheduleId.toString()}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        transactionId: transactionIdToReport,
      };
    }
  }
}

export default HederaAgentKit;
