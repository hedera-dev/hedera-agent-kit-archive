import { describe, beforeAll, expect, it } from "vitest";
import { AccountData } from "../utils/testnetUtils";
import { LangchainAgent } from "../utils/langchainAgent";
import { NetworkClientWrapper } from "../utils/testnetClient";
import * as dotenv from "dotenv";
import { Airdrop } from "../../types";
import { wait } from "../utils/utils";

const IS_CUSTODIAL = true;

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

describe("get_pending_airdrops", () => {
    let acc1: AccountData;
    let acc2: AccountData;
    let acc3: AccountData;
    let token1: string;
    let langchainAgent: LangchainAgent;
    let testCases: [string, string, string, number][];
    let networkClientWrapper: NetworkClientWrapper;

    beforeAll(async () => {
        dotenv.config()
        try {
            langchainAgent = await LangchainAgent.create();
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
            ]).then(([_acc1, _acc2, _acc3]) => {
                acc1 = _acc1;
                acc2 = _acc2;
                acc3 = _acc3;
            });

            // create token
            token1 = await networkClientWrapper.createFT({
                name: "AirDrop1",
                symbol: "AD1",
                initialSupply: 1000,
                decimals: 2,
            });

            // airdrop token
            await networkClientWrapper.airdropToken(token1, [
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
            ]);

            await wait(5000);


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
            ];

        } catch (error) {
            console.error("Error in setup:", error);
            throw error;
        }
    });

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

                const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);

                const airdrops = findAirdrops(response.messages);
                const relevantAirdrop = airdrops.find((airdrop) => airdrop.receiver_id === accountId && airdrop.token_id === tokenId);


                if (!relevantAirdrop) {
                    throw new Error(`No matching airdrop found for account ${accountId} and token ${tokenId}`);
                }

                const expectedResult: Airdrop = {
                    amount: expectedAmount,
                    receiver_id: accountId,
                    sender_id: networkClientWrapper.getAccountId(),
                    token_id: tokenId,
                }

                expect(relevantAirdrop.amount).toEqual(expectedResult.amount);
                expect(relevantAirdrop.receiver_id).toEqual(expectedResult.receiver_id);
                expect(relevantAirdrop.sender_id).toEqual(expectedResult.sender_id);
                expect(relevantAirdrop.token_id).toEqual(expectedResult.token_id);

                await wait(5000);
            }
        });
    })
})