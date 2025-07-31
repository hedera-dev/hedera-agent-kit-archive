// optional to use methods in here

import {
  airdropFungibleTokenParameters,
  createFungibleTokenParameters,
  createFungibleTokenParametersNormalised,
  createNonFungibleTokenParameters,
  createNonFungibleTokenParametersNormalised,
} from '@/shared/parameter-schemas/hts.zod';
import { transferHbarParameters } from '@/shared/parameter-schemas/has.zod';
import {
  createTopicParameters,
  createTopicParametersNormalised,
} from '@/shared/parameter-schemas/hcs.zod';
import {
  transferERC20Parameters
} from '@/shared/parameter-schemas/erc20.zod';
import { Client, Hbar, PublicKey, TokenSupplyType, TokenType } from '@hashgraph/sdk';
import { Context } from '@/shared/configuration';
import z from 'zod';
import {
  accountBalanceQueryParameters,
  accountTokenBalancesQueryParameters,
} from '@/shared/parameter-schemas/account-query.zod';
import { IHederaMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-service.interface';
import { toBaseUnit } from '@/shared/hedera-utils/decimals-utils';
import Long from 'long';
import { TokenTransferMinimalParams, TransferHbarInput } from '@/shared/hedera-utils/types';
import { AccountResolver } from '@/shared/utils/account-resolver';

export default class HederaParameterNormaliser {
  static async normaliseCreateFungibleTokenParams(
    params: z.infer<ReturnType<typeof createFungibleTokenParameters>>,
    context: Context,
    client: Client,
    mirrorNode: IHederaMirrornodeService,
  ) {
    const defaultAccountId = AccountResolver.getDefaultAccount(context, client);

    const normalized: z.infer<ReturnType<typeof createFungibleTokenParametersNormalised>> = {
      ...params,
      supplyType: TokenSupplyType.Finite, // defaults to finite supply
      autoRenewAccountId: defaultAccountId,
    };

    const treasuryAccountId = params.treasuryAccountId ?? defaultAccountId;

    if (!treasuryAccountId) {
      throw new Error('Must include treasury account ID');
    }

    const supplyTypeString = params.supplyType ?? 'infinite';
    const supplyType =
      supplyTypeString === 'finite' ? TokenSupplyType.Finite : TokenSupplyType.Infinite;
    const decimals = params.decimals ?? 0;
    const initialSupply = toBaseUnit(params.initialSupply ?? 0, decimals);

    let maxSupply: number | undefined = undefined;
    if (supplyTypeString === 'finite') {
      if (!params.maxSupply) {
        throw new Error('Must include max supply for finite supply type');
      }
      maxSupply = toBaseUnit(params.maxSupply, decimals);

      if (initialSupply > maxSupply) {
        throw new Error(
          `Initial supply (${initialSupply}) cannot exceed max supply (${maxSupply})`,
        );
      }
    }

    const publicKey =
      (await mirrorNode.getAccount(defaultAccountId).then(r => r.accountPublicKey)) ??
      client.operatorPublicKey?.toStringDer();

    if (params.isSupplyKey === true) {
      normalized.supplyKey = PublicKey.fromString(publicKey);
    }

    const autoRenewAccountId = defaultAccountId;

    return {
      ...normalized,
      treasuryAccountId,
      supplyType,
      maxSupply,
      decimals,
      initialSupply,
      autoRenewAccountId,
    };
  }

  static async normaliseCreateNonFungibleTokenParams(
    params: z.infer<ReturnType<typeof createNonFungibleTokenParameters>>,
    context: Context,
    client: Client,
    mirrorNode: IHederaMirrornodeService,
  ) {
    const defaultAccountId = AccountResolver.getDefaultAccount(context, client);

    const treasuryAccountId = params.treasuryAccountId || defaultAccountId;
    if (!treasuryAccountId) throw new Error('Must include treasury account ID');

    const publicKey =
      (await mirrorNode.getAccount(defaultAccountId).then(r => r.accountPublicKey)) ??
      client.operatorPublicKey?.toStringDer();

    const maxSupply = params.maxSupply ?? 100;
    const normalized: z.infer<ReturnType<typeof createNonFungibleTokenParametersNormalised>> = {
      ...params,
      treasuryAccountId,
      maxSupply,
      supplyKey: PublicKey.fromString(publicKey), // the supply key is mandatory in the case of NFT
      supplyType: TokenSupplyType.Finite, // NFTs supply must be finite
      autoRenewAccountId: defaultAccountId,
      tokenType: TokenType.NonFungibleUnique,
    };

    return normalized;
  }

  static normaliseTransferHbar(
    params: z.infer<ReturnType<typeof transferHbarParameters>>,
    context: Context,
    client: Client,
  ) {
    const sourceAccountId = AccountResolver.resolveAccount(params.sourceAccountId, context, client);

    const hbarTransfers: TransferHbarInput[] = [];

    let totalTinybars = Long.ZERO;

    for (const transfer of params.transfers) {
      const amount = new Hbar(transfer.amount);

      if (amount.isNegative() || amount.toTinybars().equals(Long.ZERO)) {
        throw new Error(`Invalid transfer amount: ${transfer.amount}`);
      }

      totalTinybars = totalTinybars.add(amount.toTinybars());

      hbarTransfers.push({
        accountId: transfer.accountId,
        amount,
      });
    }

    hbarTransfers.push({
      accountId: sourceAccountId,
      amount: Hbar.fromTinybars(totalTinybars.negate()),
    });

    return {
      hbarTransfers,
      transactionMemo: params.transactionMemo,
    };
  }

  static async normaliseAirdropFungibleTokenParams(
    params: z.infer<ReturnType<typeof airdropFungibleTokenParameters>>,
    context: Context,
    client: Client,
    mirrorNode: IHederaMirrornodeService,
  ) {
    const sourceAccountId = AccountResolver.resolveAccount(params.sourceAccountId, context, client);

    const tokenDetails = await mirrorNode.getTokenDetails(params.tokenId);
    const tokenDecimals = parseInt(tokenDetails.decimals, 10);

    const tokenTransfers: TokenTransferMinimalParams[] = [];
    let totalAmount = Long.ZERO;

    for (const recipient of params.recipients) {
      const amountRaw = Number(recipient.amount);

      if (amountRaw <= 0) {
        throw new Error(`Invalid recipient amount: ${recipient.amount}`);
      }

      const amount = Long.fromString(toBaseUnit(amountRaw, tokenDecimals).toString());

      totalAmount = totalAmount.add(amount);

      tokenTransfers.push({
        tokenId: params.tokenId,
        accountId: recipient.accountId,
        amount,
      });
    }

    // Sender negative total
    tokenTransfers.push({
      tokenId: params.tokenId,
      accountId: sourceAccountId,
      amount: totalAmount.negate(),
    });

    return {
      tokenTransfers,
    };
  }

  static async normaliseCreateTopicParams(
    params: z.infer<ReturnType<typeof createTopicParameters>>,
    context: Context,
    client: Client,
    mirrorNode: IHederaMirrornodeService,
  ) {
    const defaultAccountId = AccountResolver.getDefaultAccount(context, client);
    const normalised: z.infer<ReturnType<typeof createTopicParametersNormalised>> = {
      ...params,
      autoRenewAccountId: defaultAccountId,
    };

    if (params.isSubmitKey) {
      const publicKey =
        (await mirrorNode.getAccount(defaultAccountId).then(r => r.accountPublicKey)) ??
        client.operatorPublicKey?.toStringDer();
      if (!publicKey) {
        throw new Error('Could not determine default account ID for submit key');
      }
      normalised.submitKey = PublicKey.fromString(publicKey);
    }

    return normalised;
  }

  static normaliseHbarBalanceParams(
    params: z.infer<ReturnType<typeof accountBalanceQueryParameters>>,
    context: Context,
    client: Client,
  ) {
    const accountId = AccountResolver.resolveAccount(params.accountId, context, client);
    return {
      ...params,
      accountId,
    };
  }

  static normaliseAccountTokenBalancesParams(
    params: z.infer<ReturnType<typeof accountTokenBalancesQueryParameters>>,
    context: Context,
    client: Client,
  ) {
    const accountId = AccountResolver.resolveAccount(params.accountId, context, client);
    return {
      ...params,
      accountId,
    };
  }

  static normaliseTransferERC20Params(
    params: z.infer<ReturnType<typeof transferERC20Parameters>>,
    _context: Context,
  ) {
    return {
      ...params,
      gas: 10_000_000,
    };
  }
}
