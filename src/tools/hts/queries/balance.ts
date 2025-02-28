import { Client, AccountBalanceQuery, AccountId } from "@hashgraph/sdk"
import {
  AllTokensBalancesApiResponse,
  DetailedTokenBalance,
  HederaNetworkType,
  HtsTokenBalanceApiReponse, HtsTokenDetails,
} from "../../../types";
import { get_hts_token_details } from "./details";
import { toDisplayUnit } from "../../../utils/hts-format-utils";

export const get_account_info = async (
  accountId: string | AccountId | null
): Promise<string | AccountId> => {
if(!accountId){
  throw new Error("accountId must be provided");
}

return accountId;
};

export const get_hbar_balance = async (
    client: Client,
    accountId: string | AccountId | null
): Promise<number> => {
  if(!accountId){
    throw new Error("accountId must be provided");
  }

  const query = new AccountBalanceQuery().setAccountId(accountId);

  const balance = await query.execute(client);
  return balance.hbars.toBigNumber().toNumber();
};

export const get_hts_balance = async (
    tokenId: string,
    networkType: HederaNetworkType,
    accountId: string
): Promise<number> => {
  const url = `https://${networkType}.mirrornode.hedera.com/api/v1/tokens/${tokenId}/balances?account.id=eq:${accountId}&limit=1&order=asc`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: HtsTokenBalanceApiReponse = await response.json();
    const balance = data.balances[0]?.balance;
    if (balance === undefined) return 0;

    return balance; // returns balance in base unit
  } catch (error) {
    console.error("Failed to fetch HTS balance:", error);
    throw error;
  }
};

export const get_all_tokens_balances = async (
    networkType: HederaNetworkType,
    accountId: string
): Promise<Array<DetailedTokenBalance>> => {
  let url: string | null = `https://${networkType}.mirrornode.hedera.com/api/v1/balances?account.id=${accountId}`;
  const array = new Array<DetailedTokenBalance>();

  try {
    while (url) { // Results are paginated
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: AllTokensBalancesApiResponse = await response.json();

      for (const token of data.balances[0]?.tokens || []) {
        const tokenDetails: HtsTokenDetails = await get_hts_token_details(token.token_id, networkType);

        const detailedTokenBalance: DetailedTokenBalance = {
          balance: token.balance,
          tokenDecimals: tokenDetails.decimals,
          tokenId: token.token_id,
          tokenName: tokenDetails.name,
          tokenSymbol: tokenDetails.symbol,
          balanceInDisplayUnit: (await toDisplayUnit(token.token_id, token.balance, networkType))
        };
        array.push(detailedTokenBalance);
      }

      // Update URL for pagination
      url = data.links.next;
    }

    return array;
  } catch (error) {
    console.error("Failed to fetch token balances. Error:", error);
    throw error;
  }
};