import { describe, expect, it, beforeAll } from "vitest";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { AccountData } from "../utils/testnetUtils";
import {LangchainAgent} from "../utils/langchainAgent";
import {NetworkType} from "../types";
import { wait } from "../utils/utils";

const IS_CUSTODIAL = true;

describe("reject_token", async () => {
    let acc1: AccountData;
    let token1: string;
    let token2: string;
    let langchainAgent: LangchainAgent;
    let networkClientWrapper: NetworkClientWrapper;
    const AIRDROPS_COUNT = 2;
    let airdropCreatorNetworkClientWrapper: NetworkClientWrapper;
    let testCases: {
        promptText: string;
        tokenId: string;
    }[];
    let hederaMirrorNodeClient: HederaMirrorNodeClient;

    beforeAll(async () => {
        dotenv.config();
        try {
            langchainAgent = await LangchainAgent.create();

            hederaMirrorNodeClient = new HederaMirrorNodeClient("testnet" as NetworkType);

            networkClientWrapper = new NetworkClientWrapper(
              process.env.HEDERA_ACCOUNT_ID!,
              process.env.HEDERA_PRIVATE_KEY!,
              process.env.HEDERA_KEY_TYPE!,
              "testnet"
            );

            const autoAssociationsCount =
                await hederaMirrorNodeClient.getAutomaticAssociationsCount(
                    networkClientWrapper.getAccountId()
                );

            const maxAutoAssociation = (
                await hederaMirrorNodeClient.getAccountInfo(
                    networkClientWrapper.getAccountId()
                )
            ).max_automatic_token_associations;

            if (
                maxAutoAssociation !== -1 &&
                maxAutoAssociation - autoAssociationsCount < AIRDROPS_COUNT
            ) {
                // need to be sure that airdrops will be claimed automatically
                await networkClientWrapper.setMaxAutoAssociation(
                    autoAssociationsCount + AIRDROPS_COUNT
                );
            }

            // Create test account
            const startingHbars = 20;
            const autoAssociation = -1; // unlimited
            acc1 = await networkClientWrapper.createAccount(startingHbars, autoAssociation);

            airdropCreatorNetworkClientWrapper = new NetworkClientWrapper(
                acc1.accountId,
                acc1.privateKey,
                "ECDSA",
                "testnet"
            );

            // Create test tokens
            await Promise.all([
                airdropCreatorNetworkClientWrapper.createFT({
                    name: "AirdropToken",
                    symbol: "ADT",
                    initialSupply: 10000000,
                    decimals: 2,
                }),
                airdropCreatorNetworkClientWrapper.createFT({
                    name: "AirdropToken2",
                    symbol: "ADT2",
                    initialSupply: 10000,
                    decimals: 0,
                }),
            ]).then(([_token1, _token2]) => {
                token1 = _token1;
                token2 = _token2;
            });

            // Define test cases using created accounts and tokens
            await Promise.all([
                airdropCreatorNetworkClientWrapper.airdropToken(token1, [
                    {
                        accountId: networkClientWrapper.getAccountId(),
                        amount: 1,
                    },
                ]),
                airdropCreatorNetworkClientWrapper.airdropToken(token2, [
                    {
                        accountId: networkClientWrapper.getAccountId(),
                        amount: 1,
                    },
                ]),
            ]);

            testCases = [
                {
                    tokenId: token1,
                    promptText: `Reject token ${token1} from account ${airdropCreatorNetworkClientWrapper.getAccountId()}`,
                },
                {
                    tokenId: token2,
                    promptText: `Reject token ${token2} from account ${airdropCreatorNetworkClientWrapper.getAccountId()}`,
                },
            ];

        } catch (error) {
            console.error("Error in setup:", error);
            throw error;
        }
    });

    it("it should reject token from account", async () => {
        for (const { promptText, tokenId } of testCases) {
            const prompt = {
                user: "user",
                text: promptText,
            };

            const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);

            await wait(5000);

            const tokenInfo = await hederaMirrorNodeClient.getAccountToken(
                networkClientWrapper.getAccountId(),
                tokenId
            );

            expect(tokenInfo?.balance ?? 0).toBe(0);
        }
    });
});
