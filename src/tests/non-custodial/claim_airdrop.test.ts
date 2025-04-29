import { describe, beforeAll, expect, it } from "vitest";
import { AccountData } from "../utils/testnetUtils";
import { LangchainAgent } from "../utils/langchainAgent";
import { NetworkClientWrapper } from "../utils/testnetClient";
import * as dotenv from "dotenv";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import { extractTxBytes, signAndExecuteTx, wait } from "../utils/utils";
import { ExecutorAccountDetails } from "../../types";

const IS_CUSTODIAL = false;

describe("claim_pending_airdrops (non-custodial)", () => {
    let airdropCreatorAccount: AccountData;
    let token1: string;
    let token2: string;
    let testCases: {
        receiverAccountId: string;
        senderAccountId: string;
        tokenId: string;
        promptText: string;
        expectedClaimedAmount: number;
    }[];
    let networkClientWrapper: NetworkClientWrapper;
    let txExecutorAccount: AccountData;
    let hederaApiClient: HederaMirrorNodeClient;

    beforeAll(async () => {
        dotenv.config()
        try {
            hederaApiClient = new HederaMirrorNodeClient("testnet");

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
              0 // no auto association
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
                        accountId: txExecutorAccount.accountId,
                        amount: 10,
                    },
                ]),
                airdropCreatorAccountNetworkClientWrapper.airdropToken(token2, [
                    {
                        accountId: txExecutorAccount.accountId,
                        amount: 40,
                    },
                ]),
            ]);

            testCases = [
                {
                    receiverAccountId: txExecutorAccount.accountId,
                    senderAccountId: airdropCreatorAccount.accountId,
                    tokenId: token1,
                    promptText: `Claim airdrop for token ${token1} from sender ${airdropCreatorAccount.accountId}`,
                    expectedClaimedAmount: 10,
                },
                {
                    receiverAccountId: txExecutorAccount.accountId,
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

                const tokenBalance = await hederaApiClient.getTokenBalance(
                  receiverAccountId,
                  tokenId,
                );

                expect(tokenBalance ?? 0).toBe(expectedClaimedAmount);

                console.log('\n\n');
            }
        });
    })
})
