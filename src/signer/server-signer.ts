import {
  AccountId,
  Client,
  PrivateKey,
  Transaction,
  TransactionResponse,
  TransactionReceipt,
} from '@hashgraph/sdk';
import { AbstractSigner } from './abstract-signer';
import { HederaNetworkType } from '../types';
import { Logger } from '../utils/logger';
import { HederaMirrorNode } from '../services/mirror-node';
import { detectKeyTypeFromMirrorNode, KeyType } from '../utils/key-type-detector';

/**
 * A signer implementation for server-side environments that uses a private key for signing.
 * It directly interacts with the Hedera network using an operator-configured client.
 */
export class ServerSigner extends AbstractSigner {
  private client: Client;
  private accountIdInternal: AccountId;
  private privateKey: PrivateKey;
  private networkInternal: HederaNetworkType;
  private keyType: KeyType;
  private logger: Logger;

  /**
   * Constructs a ServerSigner instance.
   * @param {AccountId} accountId - The Hedera account ID.
   * @param {PrivateKey} privateKey - The parsed PrivateKey object.
   * @param {KeyType} keyType - The type of the private key ('ed25519' or 'ecdsa').
   * @param {HederaNetworkType} network - The Hedera network to connect to ('mainnet' or 'testnet').
   * @param {Client} client - The Hedera Client instance configured for this signer.
   * @param {Logger} logger - The logger instance for this signer.
   * @param {HederaMirrorNode} mirrorNode - The mirror node instance for key type verification.
   */
  private constructor(
    accountId: AccountId,
    privateKey: PrivateKey,
    keyType: KeyType,
    network: HederaNetworkType,
    client: Client,
    logger: Logger,
    mirrorNode: HederaMirrorNode
  ) {
    super();
    this.accountIdInternal = accountId;
    this.privateKey = privateKey;
    this.keyType = keyType;
    this.networkInternal = network;
    this.client = client;
    this.mirrorNode = mirrorNode;
    this.client.setOperator(this.accountIdInternal, this.privateKey);
    this.logger = logger;
  }

  /**
   * Asynchronously creates and initializes a ServerSigner instance.
   * Detects the key type using the mirror node and parses the provided private key accordingly.
   * @param {string | AccountId} accountId - The Hedera account ID.
   * @param {string | PrivateKey} privateKey - The private key (string or object).
   * @param {HederaNetworkType} network - The Hedera network to connect to ('mainnet' or 'testnet').
   * @returns {Promise<ServerSigner>} The fully initialized ServerSigner instance.
   */
  public static async create(
    accountId: string | AccountId,
    privateKey: string | PrivateKey,
    network: HederaNetworkType
  ): Promise<ServerSigner> {
    const accId = AccountId.fromString(accountId.toString());
    const logger = new Logger({
      module: 'ServerSigner',
      level: process.env.DEBUG === 'true' ? 'debug' : 'warn',
    });

    let client: Client;
    if (network === 'mainnet') {
      client = Client.forMainnet();
    } else if (network === 'testnet') {
      client = Client.forTestnet();
    } else {
      throw new Error(
        `Unsupported Hedera network type specified: ${network}. Only 'mainnet' or 'testnet' are supported.`
      );
    }

    const mirrorNode = new HederaMirrorNode(
      network,
      new Logger({
        level: 'info',
        module: 'ServerSigner-MirrorNode',
      })
    );

    let keyType: KeyType;
    let privKey: PrivateKey;

    if (typeof privateKey === 'string') {
      const detection = await detectKeyTypeFromMirrorNode(
        mirrorNode,
        accId.toString(),
        privateKey
      );
      privKey = detection.privateKey;
      keyType = detection.detectedType;
      logger.debug(`Detected key type for ${accId}: ${keyType}`);
    } else {
      const detection = await detectKeyTypeFromMirrorNode(
        mirrorNode,
        accId.toString(),
        privateKey.toStringDer()
      );
      privKey = detection.privateKey;
      keyType = detection.detectedType;
      logger.debug(`Detected key type for ${accId}: ${keyType}`);
    }

    return new ServerSigner(
      accId,
      privKey,
      keyType,
      network,
      client,
      logger,
      mirrorNode
    );
  }

  /**
   * Retrieves the Hedera account ID associated with this signer.
   * @returns {AccountId} The Hedera AccountId object.
   */
  public getAccountId(): AccountId {
    return this.accountIdInternal;
  }

  /**
   * Signs and executes a Hedera transaction using the configured client and private key,
   * and returns the transaction receipt.
   * @param {Transaction} transaction - The transaction to sign and execute.
   * @returns {Promise<TransactionReceipt>} A promise that resolves to the transaction receipt.
   */
  public async signAndExecuteTransaction(
    transaction: Transaction
  ): Promise<TransactionReceipt> {
    if (!transaction.isFrozen()) {
      await transaction.freezeWith(this.client);
    }
    if (transaction.getSignatures().size === 0) {
      await transaction.sign(this.privateKey);
    }
    const response: TransactionResponse = await transaction.execute(this.client);
    return response.getReceipt(this.client);
  }

  /**
   * Retrieves the Hedera network type this signer is configured for.
   * @returns {HederaNetworkType} The configured Hedera network type ('mainnet' or 'testnet').
   */
  public getNetwork(): HederaNetworkType {
    return this.networkInternal;
  }

  /**
   * Retrieves the operator's private key associated with this signer.
   * @returns {PrivateKey} The Hedera PrivateKey object.
   */
  public getOperatorPrivateKey(): PrivateKey {
    return this.privateKey;
  }

  /**
   * Retrieves the client instance configured for this ServerSigner.
   * @returns {Client} The Hedera Client object.
   */
  public getClient(): Client {
    return this.client;
  }

  /**
   * Retrieves the key type of the operator's private key.
   * @returns {Promise<'ed25519' | 'ecdsa'>} The key type.
   */
  public getKeyType(): KeyType {
    return this.keyType;
  }
}
