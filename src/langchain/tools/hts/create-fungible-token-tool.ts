import { z } from 'zod';
import { FTCreateParams } from '../../../types';
import { TokenSupplyType as SDKTokenSupplyType } from '@hashgraph/sdk';
import {
  BaseHederaTransactionTool,
  BaseHederaTransactionToolParams,
} from '../common/base-hedera-transaction-tool';
import { BaseServiceBuilder } from '../../../builders';
import { HtsBuilder } from '../../../builders';
import { SERIALIZED_KEY_DESCRIPTION, FEE_COLLECTOR_DESCRIPTION } from './hts-tool-utils';

const FixedFeeInputSchema = z.object({
  type: z.enum(['FIXED', 'FIXED_FEE']),
  feeCollectorAccountId: z.string().optional().describe(FEE_COLLECTOR_DESCRIPTION),
  denominatingTokenId: z
    .string()
    .optional()
    .describe('Denominating token ID for the fee (if not HBAR).'),
  amount: z
    .union([z.number(), z.string()])
    .describe('Fee amount (smallest unit for tokens, or tinybars for HBAR).'),
});

const FractionalFeeInputSchema = z.object({
  type: z.enum(['FRACTIONAL', 'FRACTIONAL_FEE']),
  feeCollectorAccountId: z.string().optional().describe(FEE_COLLECTOR_DESCRIPTION),
  numerator: z.number().int().describe('Numerator of the fractional fee.'),
  denominator: z
    .number()
    .int()
    .positive()
    .describe('Denominator of the fractional fee.'),
  minAmount: z
    .union([z.number(), z.string()])
    .optional()
    .describe('Minimum fractional fee amount.'),
  maxAmount: z
    .union([z.number(), z.string()])
    .optional()
    .describe('Maximum fractional fee amount (0 for no max).'),
  assessmentMethodInclusive: z
    .boolean()
    .optional()
    .describe('Fee is assessed on net amount (false) or gross (true).'),
});

const RoyaltyFeeInputSchema = z.object({
  type: z.enum(['ROYALTY', 'ROYALTY_FEE']),
  feeCollectorAccountId: z.string().optional().describe(FEE_COLLECTOR_DESCRIPTION),
  numerator: z.number().int().describe('Numerator of the royalty fee.'),
  denominator: z
    .number()
    .int()
    .positive()
    .describe('Denominator of the royalty fee.'),
  fallbackFee: FixedFeeInputSchema.omit({ type: true })
    .optional()
    .describe('Fallback fixed fee if royalty is not applicable.'),
});

const CustomFeeInputUnionSchema = z.discriminatedUnion('type', [
  FixedFeeInputSchema,
  FractionalFeeInputSchema,
  RoyaltyFeeInputSchema,
]);

export type CustomFeeInputData = z.infer<typeof CustomFeeInputUnionSchema>;

const FTCreateZodSchemaCore = z.object({
  tokenName: z.string().describe('The publicly visible name of the token.'),
  tokenSymbol: z
    .string()
    .optional()
    .describe('The publicly visible symbol of the token.'),
  treasuryAccountId: z
    .string()
    .optional()
    .describe('Treasury account ID (e.g., "0.0.xxxx").'),
  initialSupply: z
    .union([z.number(), z.string()])
    .describe('Initial supply in the smallest denomination.'),
  decimals: z
    .number()
    .int()
    .optional()
    .default(0)
    .describe(
      'Number of decimal places for the token. Defaults to 0 if not specified.'
    ),
  adminKey: z
    .string()
    .optional()
    .describe(
      `Optional. Admin key (${SERIALIZED_KEY_DESCRIPTION}. Required for token to be mutable.`
    ),
  kycKey: z
    .string()
    .optional()
    .describe(
      `Optional. KYC key (${SERIALIZED_KEY_DESCRIPTION}`
    ),
  freezeKey: z
    .string()
    .optional()
    .describe(
      `Optional. Freeze key (${SERIALIZED_KEY_DESCRIPTION}`
    ),
  wipeKey: z
    .string()
    .optional()
    .describe(
      `Optional. Wipe key (${SERIALIZED_KEY_DESCRIPTION}`
    ),
  supplyKey: z
    .string()
    .optional()
    .describe(
      `Optional. Supply key (${SERIALIZED_KEY_DESCRIPTION}`
    ),
  feeScheduleKey: z
    .string()
    .optional()
    .describe(
      `Optional. Fee schedule key (${SERIALIZED_KEY_DESCRIPTION}`
    ),
  pauseKey: z
    .string()
    .optional()
    .describe(
      `Optional. Pause key (${SERIALIZED_KEY_DESCRIPTION}`
    ),
  autoRenewAccountId: z
    .string()
    .optional()
    .describe('Optional. Auto-renew account ID (e.g., "0.0.xxxx").'),
  autoRenewPeriod: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Optional. Auto-renewal period in seconds.'),
  memo: z.string().optional().describe('Optional. Memo for the token.'),
  freezeDefault: z
    .boolean()
    .optional()
    .describe('Optional. Default freeze status for accounts.'),
  customFees: z
    .array(CustomFeeInputUnionSchema)
    .optional()
    .describe('Optional. Array of custom fee objects for the token.'),
  supplyType: z
    .enum([
      SDKTokenSupplyType.Finite.toString(),
      SDKTokenSupplyType.Infinite.toString(),
    ])
    .optional()
    .default(SDKTokenSupplyType.Finite.toString())
    .describe(
      'Supply type: FINITE or INFINITE. Defaults to FINITE if not specified.'
    ),
  maxSupply: z
    .union([z.number(), z.string()])
    .optional()
    .default(1000000000000000)
    .describe(
      'Max supply if supplyType is FINITE. Builder validates against initialSupply.'
    ),
});

export class HederaCreateFungibleTokenTool extends BaseHederaTransactionTool<
  typeof FTCreateZodSchemaCore
> {
  name = 'hedera-hts-create-fungible-token';
  description =
    'Creates a new Hedera Fungible Token (FT). Builder handles key parsing, fee construction, and supply validation.';
  specificInputSchema = FTCreateZodSchemaCore;
  namespace = 'hts';

  constructor(params: BaseHederaTransactionToolParams) {
    super(params);
  }

  protected getServiceBuilder(): BaseServiceBuilder {
    return this.hederaKit.hts();
  }

  protected async callBuilderMethod(
    builder: BaseServiceBuilder,
    specificArgs: z.infer<typeof FTCreateZodSchemaCore>
  ): Promise<void> {
    await (builder as HtsBuilder).createFungibleToken(
      specificArgs as unknown as FTCreateParams
    );
  }

  protected override getNoteForKey(
    key: string,
    schemaDefaultValue: unknown,
    actualValue: unknown
  ): string | undefined {
    if (key === 'decimals') {
      return `The number of decimal places for your token was automatically set to '${actualValue}'.`;
    }
    if (key === 'supplyType') {
      return `Your token's supply type was set to '${actualValue}' by default.`;
    }
    if (key === 'maxSupply') {
      try {
        const num = BigInt(String(actualValue));
        return `A maximum supply of '${num.toLocaleString()}' for the token was set by default.`;
      } catch {
        return `The maximum supply for the token was set to '${actualValue}' by default.`;
      }
    }
    if (key === 'freezeDefault') {
      return `By default, accounts holding this token will ${
        actualValue ? 'be frozen' : 'not be frozen'
      }.`;
    }
    return undefined;
  }
}
