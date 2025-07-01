import {
  FileCreateTransaction,
  FileAppendTransaction,
  FileUpdateTransaction,
  FileDeleteTransaction,
  PublicKey,
} from '@hashgraph/sdk';
import { Buffer } from 'buffer';
import {
  CreateFileParams,
  AppendFileParams,
  UpdateFileParams,
  DeleteFileParams,
} from '../../types';
import { BaseServiceBuilder } from '../base-service-builder';
import { HederaAgentKit } from '../../agent/agent';
import { detectKeyTypeFromMirrorNode } from '../../utils/key-type-detector';

const MAX_FILE_APPEND_BYTES = 6000;

/**
 * FileBuilder facilitates Hedera File Service transactions.
 */
export class FileBuilder extends BaseServiceBuilder {
  constructor(hederaKit: HederaAgentKit) {
    super(hederaKit);
  }

  /**
   * @param {CreateFileParams} params
   * @returns {this}
   */
  public async createFile(params: CreateFileParams): Promise<this> {
    this.clearNotes();
    const transaction = new FileCreateTransaction();

    if (params.contents) {
      if (typeof params.contents === 'string') {
        transaction.setContents(Buffer.from(params.contents, 'utf8'));
      } else {
        transaction.setContents(params.contents);
      }
    }

    if (params.keys) {
      const publicKeys: PublicKey[] = (
        await Promise.all(
          params.keys.map(async (keyInput) => {
            if (typeof keyInput === 'string') {
              const keyDetection = await detectKeyTypeFromMirrorNode(
                this.kit.mirrorNode, this.kit.userAccountId!, keyInput
              );
              return keyDetection.privateKey.publicKey;
            } else if (keyInput instanceof PublicKey) {
              return keyInput;
            } else {
              this.logger.warn(
                'FileBuilder: createFile expects keys to be string or PublicKey. Other types are ignored.'
              );
              return undefined;
            }
          })
        )
      ).filter((key): key is PublicKey => key instanceof PublicKey);

      if (publicKeys.length > 0) {
        transaction.setKeys(publicKeys);
      }
    }

    if (params.memo) {
      transaction.setFileMemo(params.memo);
    }

    this.setCurrentTransaction(transaction);
    return this;
  }

  /**
   * @param {AppendFileParams} params
   * @returns {this}
   * @throws {Error}
   */
  public appendFile(params: AppendFileParams): this {
    this.clearNotes();
    if (!params.fileId) {
      throw new Error('File ID is required to append to a file.');
    }
    const transaction = new FileAppendTransaction().setFileId(params.fileId);

    if (params.contents) {
      const contentsBytes =
        typeof params.contents === 'string'
          ? Buffer.from(params.contents, 'utf8')
          : params.contents;

      if (contentsBytes.length > MAX_FILE_APPEND_BYTES) {
        console.warn(
          `FileBuilder: Content size (${contentsBytes.length} bytes) for appendFile exceeds single transaction limit (${MAX_FILE_APPEND_BYTES} bytes). Only the first chunk will be prepared. Implement multi-transaction append for larger files.`
        );
        this.addNote(
          `Content for file append was truncated to ${MAX_FILE_APPEND_BYTES} bytes due to single transaction limit.`
        );
        transaction.setContents(
          contentsBytes.subarray(0, MAX_FILE_APPEND_BYTES)
        );
      } else {
        transaction.setContents(contentsBytes);
      }
    }
    this.setCurrentTransaction(transaction);
    return this;
  }

  /**
   * @param {UpdateFileParams} params
   * @returns {this}
   * @throws {Error}
   */
  public async updateFile(params: UpdateFileParams): Promise<this> {
    this.clearNotes();
    if (!params.fileId) {
      throw new Error('File ID is required to update a file.');
    }
    const transaction = new FileUpdateTransaction().setFileId(params.fileId);

    if (params.contents) {
      if (typeof params.contents === 'string') {
        transaction.setContents(Buffer.from(params.contents, 'utf8'));
      } else {
        transaction.setContents(params.contents);
      }
    }

    if (params.keys) {
      const publicKeys: PublicKey[] = (
        await Promise.all(
          params.keys.map(async (keyInput) => {
            if (typeof keyInput === 'string') {
              const keyDetection = await detectKeyTypeFromMirrorNode(
                this.kit.mirrorNode,
                this.kit.userAccountId!,
                keyInput
              );
              return keyDetection.privateKey.publicKey;
            } else if (keyInput instanceof PublicKey) {
              return keyInput;
            }
            this.logger.warn(
              'FileBuilder: updateFile expects keys to be string or PublicKey. Other types are ignored.'
            );
            return undefined;
          })
        )
      ).filter((key): key is PublicKey => key instanceof PublicKey);

      if (publicKeys.length > 0) {
        transaction.setKeys(publicKeys);
      }
    }

    if (params.memo) {
      transaction.setFileMemo(params.memo);
    }

    this.setCurrentTransaction(transaction);
    return this;
  }

  /**
   * @param {DeleteFileParams} params
   * @returns {this}
   * @throws {Error}
   */
  public deleteFile(params: DeleteFileParams): this {
    this.clearNotes();
    if (!params.fileId) {
      throw new Error('File ID is required to delete a file.');
    }
    const transaction = new FileDeleteTransaction().setFileId(params.fileId);
    this.setCurrentTransaction(transaction);
    return this;
  }
}
