import { describe, expect, it, beforeAll } from "vitest";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { AccountData } from "../utils/testnetUtils";
import {LangchainAgent} from "../utils/langchainAgent";
import {NetworkType} from "../types";
import { extractTxBytes, signAndExecuteTx, wait } from "../utils/utils";
import { ExecutorAccountDetails } from "../../types";

const IS_CUSTODIAL = false;

describe("reject_token (non-custodial)", async () => {
    let airdropCreatorAccount: AccountData;
    let txExecutorAccount: AccountData;
    let token1: string;
    let token2: string;
    let networkClientWrapper: NetworkClientWrapper;
    let airdropCreatorAccountNetworkClientWrapper: NetworkClientWrapper;
    let testCases: {
        promptText: string;
        tokenId: string;
    }[];
    let hederaApiClient: HederaMirrorNodeClient;

    beforeAll(async () => {
        dotenv.config();
        try {
            hederaApiClient = new HederaMirrorNodeClient("testnet" as NetworkType);

            networkClientWrapper = new NetworkClientWrapper(
              process.env.HEDERA_ACCOUNT_ID!,
              process.env.HEDERA_PRIVATE_KEY!,
              process.env.HEDERA_KEY_TYPE!,
              "testnet"
            );

            // Create test accounts
            airdropCreatorAccount = await networkClientWrapper.createAccount(
              20, // starting HBARs
              0 // no auto association
            );

            txExecutorAccount = await networkClientWrapper.createAccount(
              5, // starting HBARs
              -1 // unlimited auto association. To reject tokens, the airdrop must be first claimed.
            );

            airdropCreatorAccountNetworkClientWrapper = new NetworkClientWrapper(
                airdropCreatorAccount.accountId,
                airdropCreatorAccount.privateKey,
                "ECDSA",
                "testnet"
            );

            // Create test tokens
            await Promise.all([
                airdropCreatorAccountNetworkClientWrapper.createFT({
                    name: "AirdropToken",
                    symbol: "ADT",
                    initialSupply: 10000000,
                    decimals: 0,
                }),
                airdropCreatorAccountNetworkClientWrapper.createFT({
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
                airdropCreatorAccountNetworkClientWrapper.airdropToken(token1, [
                    {
                        accountId: txExecutorAccount.accountId,
                        amount: 1,
                    },
                ]),
                airdropCreatorAccountNetworkClientWrapper.airdropToken(token2, [
                    {
                        accountId: txExecutorAccount.accountId,
                        amount: 1,
                    },
                ]),
            ]);

            testCases = [
                {
                    tokenId: token1,
                    promptText: `Reject token ${token1}`,
                },
                {
                    tokenId: token2,
                    promptText: `Reject token ${token2}`,
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

            const langchainAgent = await LangchainAgent.create();

            console.log(`Prompt: ${promptText}`);
            console.log(JSON.stringify(txExecutorAccount, null, 2));

            const executorAccountDetails: ExecutorAccountDetails = {
                executorAccountId: txExecutorAccount.accountId,
                executorPublicKey: txExecutorAccount.publicKey,
            }

            // STEP 1: send non-custodial prompt
            const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL, executorAccountDetails);

            // STEP 2: extract tx bytes
            const txBytesString = extractTxBytes(response.messages)

            // STEP 3: verify correctness by signing and executing the tx
            const executedTx = await signAndExecuteTx(
              txBytesString,
              txExecutorAccount.privateKey,
              txExecutorAccount.accountId
            )

            await wait(5000); // wait for the mirror node to update

            const tokenInfo = await hederaApiClient.getAccountToken(
                networkClientWrapper.getAccountId(),
                tokenId
            );

            expect(tokenInfo?.balance ?? 0).toBe(0);

            console.log('\n\n');
        }
    });
});
