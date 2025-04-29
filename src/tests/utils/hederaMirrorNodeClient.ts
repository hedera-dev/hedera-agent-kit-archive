import {
    AccountsResponse,
    AllTokensBalancesApiResponse,
    DetailedTokenBalance,
    HTSBalanceResponse,
    HtsTokenDetails,
    NetworkType,
    TransactionsResponse,
    txReport,
    PendingAirdropsResponse,
    PendingAirdrop,
    Topic,
    TopicMessagesResponse,
    MirrorNodeTopicMessage,
    Account,
    AccountTokensResponse,
    AccountToken,
    Transaction,
} from "../types";
import BigNumber from "bignumber.js";
import { fromBaseToDisplayUnit, fromTinybarToHbar } from "./utils";
import { convertStringToTimestamp } from "../../utils/date-format-utils";

export class HederaMirrorNodeClient {
    private baseUrl: string;

    constructor(networkType: NetworkType) {
        const networkBase =
            networkType === "mainnet" ? `${networkType}-public` : networkType;
        this.baseUrl = `https://${networkBase}.mirrornode.hedera.com/api/v1`;
    }

    async getHbarBalance(accountId: string): Promise<number> {
        const url = `${this.baseUrl}/accounts?account.id=${accountId}&balance=true&limit=1&order=desc`;

        console.log(`URL: ${url}`);

        const response = await fetch(url, { method: "GET" });
        const parsedResponse: AccountsResponse = await response.json();
        const rawBalance = parsedResponse.accounts[0].balance.balance;

        console.log(
            `Raw balance for ${accountId}: ${rawBalance} (from Mirror Node)`
        );

        return fromTinybarToHbar(rawBalance);
    }

    async getTokenBalance(accountId: string, tokenId: string): Promise<number> {
        const url = `${this.baseUrl}/tokens/${tokenId}/balances?account.id=${accountId}&limit=1&order=asc`;

        console.log(`URL: ${url}`);

        const response = await fetch(url, { method: "GET" });
        const parsedResponse: HTSBalanceResponse = await response.json();

        const rawBalance = parsedResponse?.balances[0]?.balance;
        const decimals = parsedResponse?.balances[0]?.decimals;

        const balanceInDisplayUnit = parsedResponse?.balances[0]
            ? fromBaseToDisplayUnit(rawBalance as number, decimals as number)
            : 0;

        console.log(
            `Parsed balance for ${accountId}: ${balanceInDisplayUnit} of ${tokenId} (from Mirror Node)`
        );

        return balanceInDisplayUnit;
    }

    async getTransactionReport(
        transactionId: string,
        senderId: string,
        receiversId: string[]
    ): Promise<txReport> {
        const transaction = await this.getTransactionDetails(transactionId);

        const totalFees = transaction.transfers
            .filter(
                (t) =>
                    t.account !== senderId &&
                    !receiversId.find((r) => r === t.account)
            )
            .reduce((sum, t) => sum + t.amount, 0);

        const status = transaction.result;

        const txReport = {
            status,
            totalPaidFees: fromTinybarToHbar(totalFees),
        };

        console.log(
            `Parsed transaction report: ${JSON.stringify(txReport, null, 2)}`
        );

        return txReport;
    }

    async getTokenDetails(tokenId: string): Promise<HtsTokenDetails> {
        const url = `${this.baseUrl}/tokens/${tokenId}`;

        console.log(`URL: ${url}`);

        const response = await fetch(url, { method: "GET" });
        return response.json();
    }

    async getAllTokensBalances(
        accountId: string
    ): Promise<Array<DetailedTokenBalance>> {
        let url: string | null =
            `${this.baseUrl}/balances?account.id=${accountId}`;
        const array = new Array<DetailedTokenBalance>();

        console.log(`URL: ${url}`);

        try {
            while (url) {
                // Results are paginated
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data: AllTokensBalancesApiResponse =
                    await response.json();

                for (const token of data.balances[0]?.tokens || []) {
                    const tokenDetails: HtsTokenDetails =
                        await this.getTokenDetails(token.token_id);

                    const detailedTokenBalance: DetailedTokenBalance = {
                        balance: token.balance,
                        tokenDecimals: tokenDetails.decimals,
                        tokenId: token.token_id,
                        tokenName: tokenDetails.name,
                        tokenSymbol: tokenDetails.symbol,
                        balanceInDisplayUnit: BigNumber(
                            fromBaseToDisplayUnit(
                                token.balance,
                                +tokenDetails.decimals
                            )
                        ),
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
    }

    async getPendingAirdrops(accountId: string): Promise<PendingAirdrop[]> {
        let url: string | null =
            `${this.baseUrl}/accounts/${accountId}/pending-airdrops`;
        const allAirdrops: PendingAirdrop[] = [];

        console.log(`URL: ${url}`);

        try {
            while (url) {
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data: PendingAirdropsResponse = await response.json();
                allAirdrops.push(...data.airdrops);

                url = data.links.next;
            }

            return allAirdrops;
        } catch (error) {
            console.error("Failed to fetch pending airdrops. Error:", error);
            throw error;
        }
    }

    async getTopic(topicId: string): Promise<Topic> {
        const url = `${this.baseUrl}/topics/${topicId}`;
        console.log(`URL: ${url}`);

        try {
            const response = await fetch(url, { method: "GET" });
            const data = await response.json();
            console.log("Topic data:", data);
            return data;
        } catch (error) {
            console.error(`Failed to fetch topic ${topicId}. Error:`, error);
            throw error;
        }
    }

    async getAccountInfo(accountId: string): Promise<Account> {
        console.log(`Getting account info for ${accountId}`);
        const url = `${this.baseUrl}/accounts?account.id=${accountId}&limit=1&order=desc`;

        console.log(`URL: ${url}`);

        const response = await fetch(url, { method: "GET" });
        const parsedResponse: AccountsResponse = await response.json();
        return parsedResponse.accounts[0];
    }

    async getAccountToken(
        accountId: string,
        tokenId: string
    ): Promise<AccountToken | undefined> {
        const url = `${this.baseUrl}/accounts/${accountId}/tokens?token.id=${tokenId}&limit=1&order=desc`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: AccountTokensResponse = await response.json();

        return data.tokens[0];
    }

    async getAccountTokens(accountId: string): Promise<AccountToken[]> {
        const allTokens: AccountToken[] = [];
        let nextLink: string | null =
            `${this.baseUrl}/accounts/${accountId}/tokens?&limit=100&order=desc`;

        console.log(`URL: ${nextLink}`);

        while (nextLink) {
            const response = await fetch(nextLink);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data: AccountTokensResponse = await response.json();
            allTokens.push(...data.tokens);

            nextLink = data.links?.next
                ? `${this.baseUrl.replace("/api/v1", "")}${data.links?.next}`
                : null;
        }

        return allTokens;
    }

    async getAutomaticAssociationsCount(accountId: string): Promise<number> {
        const allTokens = await this.getAccountTokens(accountId);

        return allTokens.reduce((acc, currentToken) => {
            if (currentToken.automatic_association) {
                acc += 1;
            }
            return acc;
        }, 0);
    }

    async getTopicMessages(topicId: string, range?: { lowerTimestamp: string | undefined, upperTimestamp: string | undefined }): Promise<MirrorNodeTopicMessage[]> {

        const lowerThreshold = range?.lowerTimestamp ? `&timestamp=gte:${convertStringToTimestamp(range.lowerTimestamp)}` : '';
        const upperThreshold = range?.upperTimestamp ? `&timestamp=lte:${convertStringToTimestamp(range.upperTimestamp)}` : '';

        let url: string | null = `${this.baseUrl}/topics/${topicId}/messages?encoding=UTF-8&limit=100&order=desc${lowerThreshold}${upperThreshold}`;
        const allMessages: MirrorNodeTopicMessage[] = [];

        console.log(`URL: ${url}`);

        try {
            while (url) {
                const response = await fetch(url, { method: "GET" });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data: TopicMessagesResponse = await response.json();
                allMessages.push(...data.messages);

                // Update URL for pagination
                url = data.links.next
                    ? `${this.baseUrl.replace("/api/v1", "")}${data.links.next}`
                    : null;
            }

            return allMessages;
        } catch (error) {
            console.error(
                `Failed to get topic messages for ${topicId}. Error:`,
                error
            );
            throw error;
        }
    }

    async getTransactionDetails(txHash: string): Promise<Transaction> {
        const url = `${this.baseUrl}/transactions/${txHash}`;
        console.log(`URL: ${url}`);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(
              `Hedera Mirror Node API error: ${response.statusText}`
            );
        }
        const result: TransactionsResponse = await response.json();
        return result.transactions[0];
    }
}
