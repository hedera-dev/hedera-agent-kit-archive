import { z } from 'zod';
import { MintNFTParams } from '../../../types';
import {
  BaseHederaTransactionTool,
  BaseHederaTransactionToolParams,
} from '../common/base-hedera-transaction-tool';
import { BaseServiceBuilder } from '../../../builders';
import { HtsBuilder } from '../../../builders';
import { Buffer } from "buffer";

const MintNFTZodSchemaCore = z.object({
  tokenId: z
    .string()
    .describe('The ID of the NFT collection (e.g., "0.0.xxxx").'),
  metadata: z
    .array(z.string())
    .describe(
      'Array of metadata for each NFT. Strings are treated as UTF-8, or base64 for binary. Builder handles decoding & validation.'
    ),
  batchSize: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Optional. Max NFTs per transaction if chunking. Builder handles default/limits.'
    ),
});

export class HederaMintNftTool extends BaseHederaTransactionTool<
  typeof MintNFTZodSchemaCore
> {
  name = 'hedera-hts-mint-nft';
  description =
    'Mints new Non-Fungible Tokens (NFTs). Builder handles metadata decoding and batching.';
  specificInputSchema = MintNFTZodSchemaCore;
  namespace = 'hts';

  constructor(params: BaseHederaTransactionToolParams) {
    super(params);
  }

  protected getServiceBuilder(): BaseServiceBuilder {
    return this.hederaKit.hts();
  }

  protected async callBuilderMethod(
    builder: BaseServiceBuilder,
    specificArgs: z.infer<typeof MintNFTZodSchemaCore>
  ): Promise<void> {
    const parsedParams: MintNFTParams = {
      tokenId: specificArgs.tokenId,
      metadata: specificArgs.metadata.map((m) => {
        return Buffer.from(m, 'utf8');
      }),
      batchSize: specificArgs.batchSize,
    }
    await (builder as HtsBuilder).mintNonFungibleToken(
      parsedParams
    );
  }
}
