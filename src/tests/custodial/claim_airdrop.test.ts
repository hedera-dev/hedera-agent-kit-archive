import { describe, beforeAll, expect, it, afterAll } from "vitest";
import { AccountData } from "../utils/testnetUtils";
import { LangchainAgent } from "../utils/langchainAgent";
import { NetworkClientWrapper } from "../utils/testnetClient";
import * as dotenv from "dotenv";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import { NetworkType } from "../types";
import { wait } from "../utils/utils";

const IS_CUSTODIAL = true;

describe("claim_pending_airdrops", () => {
    let airdropCreatorAccount: AccountData;
    let token1: string;
    let token2: string;
    let langchainAgent: LangchainAgent;
    let claimerInitialMaxAutoAssociation: number;
    let testCases: {
        receiverAccountId: string;
        senderAccountId: string;
        tokenId: string;
        promptText: string;
        expectedClaimedAmount: number;
    }[];
    let networkClientWrapper: NetworkClientWrapper;
    let hederaMirrorNodeClient: HederaMirrorNodeClient;

    beforeAll(async () => {
        dotenv.config()
        try {
            langchainAgent = await LangchainAgent.create();

            hederaMirrorNodeClient = new HederaMirrorNodeClient("testnet" as NetworkType);

            networkClientWrapper = new NetworkClientWrapper(
              process.env.HEDERA_ACCOUNT_ID!,
              process.env.HEDERA_PRIVATE_KEY!,
              process.env.HEDERA_KEY_TYPE!,
              "testnet"
            );


            // Create test account
            const startingHbars = 20;
            const autoAssociation = 0; // no auto association
            airdropCreatorAccount = await networkClientWrapper.createAccount(
                startingHbars,
                autoAssociation
            );


            claimerInitialMaxAutoAssociation = (
                await hederaMirrorNodeClient.getAccountInfo(
                    networkClientWrapper.getAccountId()
                )
            ).max_automatic_token_associations;

            const maxAutoAssociationForTest =
                await hederaMirrorNodeClient.getAutomaticAssociationsCount(
                    networkClientWrapper.getAccountId()
                );

            await networkClientWrapper.setMaxAutoAssociation(
                maxAutoAssociationForTest
            );

            const airdropCreatorAccountNetworkClientWrapper =
                new NetworkClientWrapper(
                    airdropCreatorAccount.accountId,
                    airdropCreatorAccount.privateKey,
                    "ECDSA",
                    "testnet"
                );

            // create tokens
            await Promise.all([
                airdropCreatorAccountNetworkClientWrapper.createFT({
                    name: "ClaimAirdrop1",
                    symbol: "CA1",
                    initialSupply: 1000,
                    decimals: 0,
                }),
                airdropCreatorAccountNetworkClientWrapper.createFT({
                    name: "ClaimAirdrop2",
                    symbol: "CA2",
                    initialSupply: 1000,
                    decimals: 0,
                }),
            ]).then(([_token1, _token2]) => {
                token1 = _token1;
                token2 = _token2;
            });

            // airdrop tokens
            await Promise.all([
                airdropCreatorAccountNetworkClientWrapper.airdropToken(token1, [
                    {
                        accountId: process.env.HEDERA_ACCOUNT_ID!,
                        amount: 10,
                    },
                ]),
                airdropCreatorAccountNetworkClientWrapper.airdropToken(token2, [
                    {
                        accountId: process.env.HEDERA_ACCOUNT_ID!,
                        amount: 40,
                    },
                ]),
            ]);

            await wait(5000);


            testCases = [
                {
                    receiverAccountId: networkClientWrapper.getAccountId(),
                    senderAccountId: airdropCreatorAccount.accountId,
                    tokenId: token1,
                    promptText: `Claim airdrop for token ${token1} from sender ${airdropCreatorAccount.accountId}`,
                    expectedClaimedAmount: 10,
                },
                {
                    receiverAccountId: networkClientWrapper.getAccountId(),
                    senderAccountId: airdropCreatorAccount.accountId,
                    tokenId: token2,
                    promptText: `Claim airdrop for token ${token2} from sender ${airdropCreatorAccount.accountId}`,
                    expectedClaimedAmount: 40,
                },
            ];

        } catch (error) {
            console.error("Error in setup:", error);
            throw error;
        }
    });

    afterAll(async () => {
        await networkClientWrapper.setMaxAutoAssociation(
            claimerInitialMaxAutoAssociation
        );
    });

    describe("pending airdrops checks", () => {
        it("should test dynamic token airdrops", async () => {
            for (const {
                receiverAccountId,
                tokenId,
                promptText,
                expectedClaimedAmount,
            } of testCases || []) {
                const prompt = {
                    user: "user",
                    text: promptText,
                };
                langchainAgent = await LangchainAgent.create();
                const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);

                const tokenBalance = await hederaMirrorNodeClient.getTokenBalance(
                  receiverAccountId,
                  tokenId,
                );

                expect(tokenBalance ?? 0).toBe(expectedClaimedAmount);
            }
        });
    })
})
