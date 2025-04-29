import { describe, expect, it, beforeEach, beforeAll } from "vitest";
import { NetworkType } from "../types";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import * as dotenv from "dotenv";
import { LangchainAgent } from "../utils/langchainAgent";
import { NetworkClientWrapper } from "../utils/testnetClient";
import {TokenType} from "@hashgraph/sdk";
import { wait } from "../utils/utils";

const IS_CUSTODIAL = true;

function extractTokenId(messages: any[]): string {
    const result = messages.reduce<string | null>((acc, message) => {
        try {
            const toolResponse = JSON.parse(message.content);
            if (toolResponse.status === "success" && toolResponse.tokenId) {
                return toolResponse.tokenId;
            }
            return acc;
        } catch (error) {
            return acc;
        }
    }, null);

    if (!result) {
        throw new Error("No token id found");
    }

    return result;
  }

describe("create_nft_token", () => {
    let langchainAgent: LangchainAgent;
    let hederaApiClient: HederaMirrorNodeClient;
    let wrapper;
    const INFINITE_SUPPLY = 0;

    beforeAll(async () => {
        wrapper = new NetworkClientWrapper(
            process.env.HEDERA_ACCOUNT_ID!,
            process.env.HEDERA_PRIVATE_KEY!,
            process.env.HEDERA_KEY_TYPE!,
            "testnet"
        );
        hederaApiClient = new HederaMirrorNodeClient("testnet" as NetworkType);

    });

    beforeEach(async () => {
        dotenv.config();
        await wait(3000);
    });

    it("Create NFT token with all possible parameters", async () => {

        const prompt = {
            user: "user",
            text: "Create non-fungible token with name TestToken, symbol TT, and max supply of 100. Set memo to 'This is an example memo' and token metadata to 'And that's an example metadata'. Add admin key. Set metadata key.",
        };

        langchainAgent = await LangchainAgent.create();
        const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);

        const tokenId = extractTokenId(response.messages);

        await wait(5000);

        const tokenDetails = await hederaApiClient.getTokenDetails(tokenId);

        expect(tokenDetails.symbol).toEqual("TT");
        expect(tokenDetails.name).toEqual("TestToken");
        expect(tokenDetails.type).toEqual(TokenType.NonFungibleUnique.toString());
        expect(Number(tokenDetails.max_supply)).toEqual(100);
        expect(tokenDetails.memo).toEqual("This is an example memo");
        expect(atob(tokenDetails.metadata!)).toEqual(
            "And that's an example metadata"
        );
        expect(tokenDetails?.supply_key?.key).toBeTruthy(); // all NFTs have supply key set by default
        expect(tokenDetails?.admin_key?.key).toBeTruthy();
        expect(tokenDetails?.metadata_key?.key).toBeTruthy();
    });

    it("Create without optional keys", async () => {
        const prompt = {
            user: "user",
            text: "Create non-fungible token with name TestToken, symbol TT, and max supply of 100. Set memo to 'This is an example memo' and token metadata to 'And that's an example metadata'. Do not set the metadata and admin keys",
        };

        langchainAgent = await LangchainAgent.create();
        const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);

        const tokenId = extractTokenId(response.messages);

        await wait(5000);

        const tokenDetails = await hederaApiClient.getTokenDetails(tokenId);

        expect(tokenDetails.symbol).toEqual("TT");
        expect(tokenDetails.name).toEqual("TestToken");
        expect(tokenDetails.type).toEqual(TokenType.NonFungibleUnique.toString());
        expect(Number(tokenDetails.max_supply)).toEqual(100);
        expect(tokenDetails.memo).toEqual("This is an example memo");
        expect(atob(tokenDetails.metadata!)).toEqual(
            "And that's an example metadata"
        );
        expect(tokenDetails?.supply_key?.key).toBeTruthy(); // all NFTs have supply key set by default
        expect(tokenDetails?.admin_key?.key).toBeFalsy();
        expect(tokenDetails?.metadata_key?.key).toBeFalsy();
    });

    it("Create token with minimal parameters", async () => {
        const prompt = {
            user: "user",
            text: "Create non-fungible token with name TestToken, symbol TT.",
        };

        langchainAgent = await LangchainAgent.create();
        const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);

        const tokenId = extractTokenId(response.messages);

        await wait(5000);

        const tokenDetails = await hederaApiClient.getTokenDetails(tokenId);

        expect(tokenDetails.symbol).toEqual("TT");
        expect(tokenDetails.name).toEqual("TestToken");
        expect(tokenDetails.type).toEqual(TokenType.NonFungibleUnique.toString());
        expect(Number(tokenDetails.max_supply)).toEqual(INFINITE_SUPPLY);
        expect(tokenDetails.memo).toEqual("");
        expect(tokenDetails.metadata).toEqual("");
        expect(tokenDetails?.supply_key?.key).toBeTruthy(); // all NFTs have supply key set by default
        expect(tokenDetails?.admin_key?.key).toBeFalsy();
        expect(tokenDetails?.metadata_key?.key).toBeFalsy();
    });

    it("Create token with minimal parameters plus memo and max supply", async () => {
        const prompt = {
            user: "user",
            text: "Create non-fungible token with name TestToken, symbol TT. Set memo to 'This is memo'. Set max supply to 10.",
        };

        langchainAgent = await LangchainAgent.create();
        const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);

        const tokenId = extractTokenId(response.messages);

        await wait(5000);

        const tokenDetails = await hederaApiClient.getTokenDetails(tokenId);

        expect(tokenDetails.symbol).toEqual("TT");
        expect(tokenDetails.name).toEqual("TestToken");
        expect(tokenDetails.type).toEqual(TokenType.NonFungibleUnique.toString());
        expect(Number(tokenDetails.max_supply)).toEqual(10);
        expect(tokenDetails.memo).toEqual("This is memo");
        expect(tokenDetails.metadata).toEqual("");
        expect(tokenDetails?.supply_key?.key).toBeTruthy(); // all NFTs have supply key set by default
        expect(tokenDetails?.admin_key?.key).toBeFalsy();
        expect(tokenDetails?.metadata_key?.key).toBeFalsy();
    });

    it("Create token with minimal parameters plus metadata key", async () => {
        const prompt = {
            user: "user",
            text: "Create non-fungible token with name TestToken, symbol TT. Set metadata key.",
        };

        langchainAgent = await LangchainAgent.create();
        const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);

        const tokenId = extractTokenId(response.messages);

        await wait(5000);

        const tokenDetails = await hederaApiClient.getTokenDetails(tokenId);

        expect(tokenDetails.symbol).toEqual("TT");
        expect(tokenDetails.name).toEqual("TestToken");
        expect(tokenDetails.type).toEqual(TokenType.NonFungibleUnique.toString());
        expect(Number(tokenDetails.max_supply)).toEqual(INFINITE_SUPPLY);
        expect(tokenDetails.memo).toEqual("");
        expect(tokenDetails.metadata).toEqual("");
        expect(tokenDetails?.supply_key?.key).toBeTruthy(); // all NFTs have supply key set by default
        expect(tokenDetails?.admin_key?.key).toBeFalsy();
        expect(tokenDetails?.metadata_key?.key).toBeTruthy();
    });

    it("Create token with minimal parameters plus admin key and metadata key and memo and metadata", async () => {
        const prompt = {
            user: "user",
            text: "Create non-fungible token with name TestToken, symbol TT. Set metadata key and admin key. Add memo 'thats memo' and metadata 'thats metadata'.",
        };

        langchainAgent = await LangchainAgent.create();
        const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);

        const tokenId = extractTokenId(response.messages);

        await wait(5000);

        const tokenDetails = await hederaApiClient.getTokenDetails(tokenId);

        expect(tokenDetails.symbol).toEqual("TT");
        expect(tokenDetails.name).toEqual("TestToken");
        expect(tokenDetails.type).toEqual(TokenType.NonFungibleUnique.toString());
        expect(Number(tokenDetails.max_supply)).toEqual(INFINITE_SUPPLY);
        expect(tokenDetails.memo).toEqual("thats memo");
        expect(atob(tokenDetails.metadata!)).toEqual("thats metadata");
        expect(tokenDetails?.supply_key?.key).toBeTruthy(); // all NFTs have supply key set by default
        expect(tokenDetails?.admin_key?.key).toBeTruthy();
        expect(tokenDetails?.metadata_key?.key).toBeTruthy();
    });
});
