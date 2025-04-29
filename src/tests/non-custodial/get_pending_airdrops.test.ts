import { describe, beforeAll, expect, it } from "vitest";
import { AccountData } from "../utils/testnetUtils";
import { LangchainAgent } from "../utils/langchainAgent";
import { NetworkClientWrapper } from "../utils/testnetClient";
import * as dotenv from "dotenv";
import { Airdrop, ExecutorAccountDetails } from "../../types";

const IS_CUSTODIAL = false;

function findAirdrops(messages: any[]): Airdrop[] { 
    const result = messages.reduce<Airdrop[] | null>((acc, message) => {
        try {
            const toolResponse = JSON.parse(message.content);
            if (toolResponse.status === "success" && toolResponse.airdrop) {
                return toolResponse.airdrop as Airdrop[];
            }
            return acc;
        } catch (error) {
            return acc;
        }
    }, null);

    if (!result) {
        throw new Error("No airdrops found");
    }

    return result;
}

describe("get_pending_airdrops (non-custodial)", () => {
    let acc1: AccountData;
    let acc2: AccountData;
    let acc3: AccountData;
    let txExecutorAccount: AccountData;
    let airdropCreatorAccount: AccountData;
    let token1: string;
    let testCases: [string, string, string, number][];
    let networkClientWrapper: NetworkClientWrapper;

    beforeAll(async () => {
        dotenv.config()
        try {
            networkClientWrapper = new NetworkClientWrapper(
                process.env.HEDERA_ACCOUNT_ID!,
                process.env.HEDERA_PRIVATE_KEY!,
                process.env.HEDERA_KEY_TYPE!,
                "testnet"
            );

            // create test accounts
            const startingHbars = 0;
            const autoAssociation = 0; // no auto association
            await Promise.all([
                networkClientWrapper.createAccount(startingHbars, autoAssociation),
                networkClientWrapper.createAccount(startingHbars, autoAssociation),
                networkClientWrapper.createAccount(startingHbars, autoAssociation),
                networkClientWrapper.createAccount(startingHbars, autoAssociation),
                networkClientWrapper.createAccount(20, autoAssociation), // airdrop creator account, with 20 hbars to cover gas costs
            ]).then(([_acc1, _acc2, _acc3, _acc4, _acc5]) => {
                acc1 = _acc1;
                acc2 = _acc2;
                acc3 = _acc3;
                txExecutorAccount = _acc4;
                airdropCreatorAccount = _acc5;
            });

            const airdropCreatorAccountNetworkClientWrapper =
              new NetworkClientWrapper(
                airdropCreatorAccount.accountId,
                airdropCreatorAccount.privateKey,
                "ECDSA",
                "testnet"
              );

            // create token
            token1 = await airdropCreatorAccountNetworkClientWrapper.createFT({
                name: "AirDrop1",
                symbol: "AD1",
                initialSupply: 1000,
                decimals: 2,
            });

            // airdrop token
            await airdropCreatorAccountNetworkClientWrapper.airdropToken(token1, [
                {
                    accountId: acc1.accountId,
                    amount: 10,
                },
                {
                    accountId: acc2.accountId,
                    amount: 10,
                },
                {
                    accountId: acc3.accountId,
                    amount: 7,
                },
                {
                    accountId: txExecutorAccount.accountId,
                    amount: 17,
                },
            ]);

            testCases = [
                [
                    acc1.accountId,
                    token1,
                    `Show me pending airdrops for account ${acc1.accountId}`,
                    10,
                ],
                [
                    acc2.accountId,
                    token1,
                    `Get pending airdrops for account ${acc2.accountId}`,
                    10,
                ],
                [
                    acc3.accountId,
                    token1,
                    `Display pending airdrops for account ${acc3.accountId}`,
                    7,
                ],
                [
                    txExecutorAccount.accountId,
                    token1,
                    `Show my pending airdrops`,
                    17,
                ],
            ];

        } catch (error) {
            console.error("Error in setup:", error);
            throw error;
        }
    });


    /*
    This action is not a typical non-custodial action. It does not require creation of any transaction, therefore, no txBytes are returned.
    This action fetches data from the hedera mirror node and returns pending airdrops for the given account.
    If no account is provided, the Executor account is used by default in non-custodial flow, whereas in custodial flow, the operator account is used.
    */
    describe("pending airdrops checks", () => {
        it("should test dynamic token airdrops", async () => {
            for (const [
                accountId,
                tokenId,
                promptText,
                expectedAmount,
            ] of testCases) {
                const prompt = {
                    user: "user",
                    text: promptText,
                };

                const langchainAgent = await LangchainAgent.create();

                console.log(`Prompt: ${promptText}`);
                console.log(JSON.stringify(txExecutorAccount, null, 2));

                const executorAccountDetails: ExecutorAccountDetails = {
                    executorAccountId: txExecutorAccount.accountId,
                    executorPublicKey: txExecutorAccount.publicKey,
                }

                // STEP 1: send non-custodial prompt
                const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL, executorAccountDetails);

                // STEP 2: extract airdrops from response
                const airdrops = findAirdrops(response.messages);
                const relevantAirdrop = airdrops.find((airdrop) => airdrop.receiver_id === accountId && airdrop.token_id === tokenId);

                if (!relevantAirdrop) {
                    throw new Error(`No matching airdrop found for account ${accountId} and token ${tokenId}`);
                }

                // STEP 3: verify the correctness
                const expectedResult: Airdrop = {
                    amount: expectedAmount,
                    receiver_id: accountId,
                    sender_id: airdropCreatorAccount.accountId,
                    token_id: tokenId,
                }

                expect(relevantAirdrop.amount).toEqual(expectedResult.amount);
                expect(relevantAirdrop.receiver_id).toEqual(expectedResult.receiver_id);
                expect(relevantAirdrop.sender_id).toEqual(expectedResult.sender_id);
                expect(relevantAirdrop.token_id).toEqual(expectedResult.token_id);

                console.log('\n\n');
            }
        });
    })
})