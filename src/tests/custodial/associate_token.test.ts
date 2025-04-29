import { describe, expect, it, beforeAll, afterAll } from "vitest";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { AccountData } from "../utils/testnetUtils";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import { LangchainAgent } from "../utils/langchainAgent";
import { NetworkType } from "../types";
import { wait } from "../utils/utils";

const IS_CUSTODIAL = true;

dotenv.config();
describe("associate_token", () => {
    let tokenCreatorAccount: AccountData;
    let token1: string;
    let token2: string;
    let networkClientWrapper: NetworkClientWrapper;
    let claimerInitialMaxAutoAssociation: number;
    let langchainAgent: LangchainAgent;
    let testCases: {
        tokenToAssociateId: string;
        promptText: string;
    }[];
    let hederaMirrorNodeClient: HederaMirrorNodeClient;

    beforeAll(async () => {
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
            tokenCreatorAccount = await networkClientWrapper.createAccount(
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

            const tokenCreatorAccountNetworkClientWrapper =
                new NetworkClientWrapper(
                    tokenCreatorAccount.accountId,
                    tokenCreatorAccount.privateKey,
                    "ECDSA",
                    "testnet"
                );

            // create tokens
            await Promise.all([
                tokenCreatorAccountNetworkClientWrapper.createFT({
                    name: "TokenToAssociate1",
                    symbol: "TTA1",
                    initialSupply: 1000,
                    decimals: 2,
                }),
                tokenCreatorAccountNetworkClientWrapper.createFT({
                    name: "TokenToAssociate2",
                    symbol: "TTA2",
                    initialSupply: 1000,
                    decimals: 2,
                }),
            ]).then(([_token1, _token2]) => {
                token1 = _token1;
                token2 = _token2;
            });


            testCases = [
                {
                    tokenToAssociateId: token1,
                    promptText: `Associate token ${token1} to my account ${networkClientWrapper.getAccountId()}`,
                },
                {
                    tokenToAssociateId: token2,
                    promptText: `Associate token ${token2} to my account ${networkClientWrapper.getAccountId()}`,
                },
            ];
        } catch (error) {
            console.error("Error in setup:", error);
            throw error;
        }
    });

    afterAll(async () => {
        if (claimerInitialMaxAutoAssociation === -1) {
            await networkClientWrapper.setMaxAutoAssociation(
                claimerInitialMaxAutoAssociation
            );
        }
    });

    describe("associate token checks", () => {
        it("should associate token", async () => {
            for (const { promptText, tokenToAssociateId } of testCases || []) {
                const prompt = {
                    user: "user",
                    text: promptText,
                };

                const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);

                await wait(5000);

                console.log({
                    client: networkClientWrapper.getAccountId(),
                    tokenToAssociateId
                })

                const token = await hederaMirrorNodeClient.getAccountToken(
                    networkClientWrapper.getAccountId(),
                    tokenToAssociateId
                );

                expect(token).toBeDefined();
            }
        });
    });
});
