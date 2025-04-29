import { describe, expect, it, beforeAll } from "vitest";
import { NetworkType } from "../types";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import * as dotenv from "dotenv";
import { LangchainAgent } from "../utils/langchainAgent";
import { NetworkClientWrapper } from "../utils/testnetClient";
import {TokenType} from "@hashgraph/sdk";
import { AccountData } from "../utils/testnetUtils";
import { extractTxBytes, formatTxHash, signAndExecuteTx, wait } from "../utils/utils";
import { ExecutorAccountDetails } from "../../types";

const IS_CUSTODIAL = false;

describe("create_nft_token", () => {
    let hederaApiClient: HederaMirrorNodeClient;
    let networkClientWrapper;
    let txExecutorAccount: AccountData;
    const INFINITE_SUPPLY = 0;

    beforeAll(async () => {
        dotenv.config();
        hederaApiClient = new HederaMirrorNodeClient("testnet" as NetworkType);

        networkClientWrapper = new NetworkClientWrapper(
          process.env.HEDERA_ACCOUNT_ID!,
          process.env.HEDERA_PRIVATE_KEY!,
          process.env.HEDERA_KEY_TYPE!,
          "testnet"
        );

        // Create a test account
        const startingHbars = 60;
        const autoAssociation = -1; // unlimited auto association
        txExecutorAccount = await networkClientWrapper.createAccount(
          startingHbars,
          autoAssociation
        );

    });

    it("Create NFT token with all possible parameters", async () => {
        const prompt = {
            user: "user",
            text: "Create non-fungible token with name TestToken, symbol TT, and max supply of 100. Set memo to 'This is an example memo' and token metadata to 'And that's an example metadata'. Add admin key. Set metadata key.",
        };

        const langchainAgent = await LangchainAgent.create();

        console.log(`Prompt: ${prompt.text}`);
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

        // STEP 4: verify that the token was created correctly
        const tokenId = await hederaApiClient.getTransactionDetails(
          formatTxHash(executedTx.txHash),
        ).then((tx) => tx.entity_id);

        const tokenDetails = await hederaApiClient.getTokenDetails(tokenId);

        expect(tokenDetails.symbol).toEqual("TT");
        expect(tokenDetails.name).toEqual("TestToken");
        expect(tokenDetails.type).toEqual(TokenType.NonFungibleUnique.toString());
        expect(Number(tokenDetails.max_supply)).toEqual(100);
        expect(tokenDetails.memo).toEqual("This is an example memo");
        expect(atob(tokenDetails.metadata!)).toEqual(
          "And that's an example metadata"
        );
        expect(tokenDetails?.supply_key?.key).toBeTruthy(); // all NFTs have a supply key set by default
        expect(tokenDetails?.admin_key?.key).toBeTruthy();
        expect(tokenDetails?.metadata_key?.key).toBeTruthy();
    });

    it("Create without optional keys", async () => {
        const prompt = {
            user: "user",
            text: "Create non-fungible token with name TestToken, symbol TT, and max supply of 100. Set memo to 'This is an example memo' and token metadata to 'And that's an example metadata'. Do not set the metadata and admin keys",
        };

        const langchainAgent = await LangchainAgent.create();

        console.log(`Prompt: ${prompt.text}`);
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

        // STEP 4: verify that the token was created correctly
        const tokenId = await hederaApiClient.getTransactionDetails(
          formatTxHash(executedTx.txHash),
        ).then((tx) => tx.entity_id);

        const tokenDetails = await hederaApiClient.getTokenDetails(tokenId);

        expect(tokenDetails.symbol).toEqual("TT");
        expect(tokenDetails.name).toEqual("TestToken");
        expect(tokenDetails.type).toEqual(TokenType.NonFungibleUnique.toString());
        expect(Number(tokenDetails.max_supply)).toEqual(100);
        expect(tokenDetails.memo).toEqual("This is an example memo");
        expect(atob(tokenDetails.metadata!)).toEqual(
          "And that's an example metadata"
        );
        expect(tokenDetails?.supply_key?.key).toBeTruthy(); // all NFTs have a supply key set by default
        expect(tokenDetails?.admin_key?.key).toBeFalsy();
        expect(tokenDetails?.metadata_key?.key).toBeFalsy();
    });

    it("Create token with minimal parameters", async () => {
        const prompt = {
            user: "user",
            text: "Create non-fungible token with name TestToken, symbol TT.",
        };

        const langchainAgent = await LangchainAgent.create();

        console.log(`Prompt: ${prompt.text}`);
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

        // STEP 4: verify that the token was created correctly
        const tokenId = await hederaApiClient.getTransactionDetails(
          formatTxHash(executedTx.txHash),
        ).then((tx) => tx.entity_id);

        const tokenDetails = await hederaApiClient.getTokenDetails(tokenId);

        expect(tokenDetails.symbol).toEqual("TT");
        expect(tokenDetails.name).toEqual("TestToken");
        expect(tokenDetails.type).toEqual(TokenType.NonFungibleUnique.toString());
        expect(Number(tokenDetails.max_supply)).toEqual(INFINITE_SUPPLY);
        expect(tokenDetails.memo).toEqual("");
        expect(tokenDetails.metadata).toEqual("");
        expect(tokenDetails?.supply_key?.key).toBeTruthy(); // all NFTs have a supply key set by default
        expect(tokenDetails?.admin_key?.key).toBeFalsy();
        expect(tokenDetails?.metadata_key?.key).toBeFalsy();
    });

    it("Create token with minimal parameters plus memo and max supply", async () => {
        const prompt = {
            user: "user",
            text: "Create non-fungible token with name TestToken, symbol TT. Set memo to 'This is memo'. Set max supply to 10.",
        };

        const langchainAgent = await LangchainAgent.create();

        console.log(`Prompt: ${prompt.text}`);
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

        // STEP 4: verify that the token was created correctly
        const tokenId = await hederaApiClient.getTransactionDetails(
          formatTxHash(executedTx.txHash),
        ).then((tx) => tx.entity_id);

        const tokenDetails = await hederaApiClient.getTokenDetails(tokenId);

        expect(tokenDetails.symbol).toEqual("TT");
        expect(tokenDetails.name).toEqual("TestToken");
        expect(tokenDetails.type).toEqual(TokenType.NonFungibleUnique.toString());
        expect(Number(tokenDetails.max_supply)).toEqual(10);
        expect(tokenDetails.memo).toEqual("This is memo");
        expect(tokenDetails.metadata).toEqual("");
        expect(tokenDetails?.supply_key?.key).toBeTruthy(); // all NFTs have a supply key set by default
        expect(tokenDetails?.admin_key?.key).toBeFalsy();
        expect(tokenDetails?.metadata_key?.key).toBeFalsy();
    });

    it("Create token with minimal parameters plus metadata key", async () => {
        const prompt = {
            user: "user",
            text: "Create non-fungible token with name TestToken, symbol TT. Set metadata key.",
        };

        const langchainAgent = await LangchainAgent.create();

        console.log(`Prompt: ${prompt.text}`);
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

        // STEP 4: verify that the token was created correctly
        const tokenId = await hederaApiClient.getTransactionDetails(
          formatTxHash(executedTx.txHash),
        ).then((tx) => tx.entity_id);

        const tokenDetails = await hederaApiClient.getTokenDetails(tokenId);

        expect(tokenDetails.symbol).toEqual("TT");
        expect(tokenDetails.name).toEqual("TestToken");
        expect(tokenDetails.type).toEqual(TokenType.NonFungibleUnique.toString());
        expect(Number(tokenDetails.max_supply)).toEqual(INFINITE_SUPPLY);
        expect(tokenDetails.memo).toEqual("");
        expect(tokenDetails.metadata).toEqual("");
        expect(tokenDetails?.supply_key?.key).toBeTruthy(); // all NFTs have a supply key set by default
        expect(tokenDetails?.admin_key?.key).toBeFalsy();
        expect(tokenDetails?.metadata_key?.key).toBeTruthy();
    });

    it("Create token with minimal parameters plus admin key and metadata key and memo and metadata", async () => {
        const prompt = {
            user: "user",
            text: "Create non-fungible token with name TestToken, symbol TT. Set metadata key and admin key. Add memo 'thats memo' and metadata 'thats metadata'.",
        };

        const langchainAgent = await LangchainAgent.create();

        console.log(`Prompt: ${prompt.text}`);
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

        // STEP 4: verify that the token was created correctly
        const tokenId = await hederaApiClient.getTransactionDetails(
          formatTxHash(executedTx.txHash),
        ).then((tx) => tx.entity_id);

        const tokenDetails = await hederaApiClient.getTokenDetails(tokenId);

        expect(tokenDetails.symbol).toEqual("TT");
        expect(tokenDetails.name).toEqual("TestToken");
        expect(tokenDetails.type).toEqual(TokenType.NonFungibleUnique.toString());
        expect(Number(tokenDetails.max_supply)).toEqual(INFINITE_SUPPLY);
        expect(tokenDetails.memo).toEqual("thats memo");
        expect(atob(tokenDetails.metadata!)).toEqual("thats metadata");
        expect(tokenDetails?.supply_key?.key).toBeTruthy(); // all NFTs have a supply key set by default
        expect(tokenDetails?.admin_key?.key).toBeTruthy();
        expect(tokenDetails?.metadata_key?.key).toBeTruthy();
    });
});