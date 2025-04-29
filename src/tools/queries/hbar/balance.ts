import { AccountBalanceQuery, AccountId, Client } from "@hashgraph/sdk";

export const get_hbar_balance = async (
    client: Client,
    accountId: string | AccountId
): Promise<number> => {
    if(!accountId){
        throw new Error("accountId must be provided");
    }

    const query = new AccountBalanceQuery().setAccountId(accountId);

    const balance = await query.execute(client);
    return balance.hbars.toBigNumber().toNumber();
};