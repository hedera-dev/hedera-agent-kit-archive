import { describe, expect, it } from "vitest";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import * as dotenv from "dotenv";
import { wait } from "../utils/utils";
import { LangchainAgent } from "../utils/langchainAgent";

const IS_CUSTODIAL = true;

interface TokenDetails {
  tokenId: string;
  decimals: number;
  solidityAddress: string;
  txHash: string;
  initialSupply: number;
}

function extractTokenDetails(messages: any[]): TokenDetails {
  console.log(messages)

  const result = messages.reduce<TokenDetails | null>((acc, message) => {
    try {
      const toolResponse = JSON.parse(message.content);
      if (toolResponse.status === "success" && toolResponse.tokenId) {
        return { tokenId: toolResponse.tokenId, initialSupply: toolResponse.initialSupply } as TokenDetails;
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

dotenv.config();
describe("create_fungible_token", () => {
  it("Create token with all possible parameters", async () => {
    const hederaApiClient = new HederaMirrorNodeClient("testnet");

    const promptText =
      "Create token GameGold with symbol GG, 2 decimal places, and starting supply of 7500. Set memo to 'This is an example memo' and token metadata to 'And that's an example metadata'. Add supply key, admin key. Set metadata key.";
    const prompt = {
      user: "user",
      text: promptText,
    };
    const langchainAgent = await LangchainAgent.create();

    const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);
    const tokenDetailsFromToolResponse = extractTokenDetails(response.messages);

    if (!tokenDetailsFromToolResponse) {
      throw new Error("No token details found");
    }

    await wait(5000);

    const tokenDetails = await hederaApiClient.getTokenDetails(
      tokenDetailsFromToolResponse.tokenId
    );

    expect(tokenDetails.symbol).toEqual("GG");
    expect(tokenDetails.name).toEqual("GameGold");
    expect(tokenDetails.decimals).toEqual("2");
    expect(Number(tokenDetails.initial_supply) / Math.pow(10, Number(tokenDetails.decimals))).toEqual(7500);
    expect(tokenDetails.memo).toEqual("This is an example memo");
    expect(atob(tokenDetails.metadata!)).toEqual(
      "And that's an example metadata"
    );
    expect(tokenDetails?.supply_key?.key).not.toBeFalsy();
    expect(tokenDetails?.admin_key?.key).not.toBeFalsy();
    expect(tokenDetails?.metadata_key?.key).not.toBeFalsy();
  });

  it("Create token with minimal parameters", async () => {
    const hederaApiClient = new HederaMirrorNodeClient("testnet");

    const promptText =
      "Create token Minimal Token with symbol MT, 3 decimal places, and starting supply of 333.";
    const prompt = {
      user: "user",
      text: promptText,
    };
    const langchainAgent = await LangchainAgent.create();

    const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);
    const tokenDetailsFromToolResponse = extractTokenDetails(response.messages);

    if (!tokenDetailsFromToolResponse) {
      throw new Error("No token details found");
    }

    await wait(5000);

    const tokenDetails = await hederaApiClient.getTokenDetails(
      tokenDetailsFromToolResponse.tokenId
    );

    expect(tokenDetails.symbol).toEqual("MT");
    expect(tokenDetails.name).toEqual("Minimal Token");
    expect(tokenDetails.decimals).toEqual("3");
    expect(Number(tokenDetails.initial_supply) / Math.pow(10, Number(tokenDetails.decimals))).toEqual(333);
    expect(tokenDetails.memo).toBe("");
    expect(tokenDetails.metadata).toBe("");
    expect(tokenDetails?.supply_key?.key).toBeUndefined();
    expect(tokenDetails?.admin_key?.key).toBeUndefined();
    expect(tokenDetails?.metadata_key?.key).toBeUndefined();
  });

  it("Create token with minimal parameters plus memo", async () => {
    const hederaApiClient = new HederaMirrorNodeClient("testnet");

    const promptText =
      "Create token 'Minimal Plus Memo Token' with symbol MPMT, 4 decimal places, and starting supply of 444. Set memo to 'Automatic tests memo'";
    const prompt = {
      user: "user",
      text: promptText,
    };
    const langchainAgent = await LangchainAgent.create();

    const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);
    const tokenDetailsFromToolResponse = extractTokenDetails(response.messages);

    if (!tokenDetailsFromToolResponse) {
      throw new Error("No token details found");
    }

    await wait(5000);

    const tokenDetails = await hederaApiClient.getTokenDetails(tokenDetailsFromToolResponse.tokenId);

    expect(tokenDetails.symbol).toEqual("MPMT");
    expect(tokenDetails.name).toEqual("Minimal Plus Memo Token");
    expect(tokenDetails.decimals).toEqual("4");
    expect(Number(tokenDetails.initial_supply) / Math.pow(10, Number(tokenDetails.decimals))).toEqual(444);
    expect(tokenDetails.memo).toEqual("Automatic tests memo");
    expect(tokenDetails.metadata).toBe("");
    expect(tokenDetails?.supply_key?.key).toBeUndefined();
    expect(tokenDetails?.admin_key?.key).toBeUndefined();
    expect(tokenDetails?.metadata_key?.key).toBeUndefined();
  });

  it("Create token with minimal parameters plus metadata key", async () => {
    const hederaApiClient = new HederaMirrorNodeClient("testnet");

    const promptText =
      "Create token 'Minimal Plus Metadata Key Token' with symbol MPMKT, 5 decimal places, and starting supply of 555. Set metadata key to agents key.";
    const prompt = {
      user: "user",
      text: promptText,
    };
    const langchainAgent = await LangchainAgent.create();

    const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);
    const tokenDetailsFromToolResponse = extractTokenDetails(response.messages);

    if (!tokenDetailsFromToolResponse) {
      throw new Error("No token details found");
    }

    await wait(5000);

    const tokenDetails = await hederaApiClient.getTokenDetails(tokenDetailsFromToolResponse.tokenId);

    expect(tokenDetails.symbol).toEqual("MPMKT");
    expect(tokenDetails.name).toEqual("Minimal Plus Metadata Key Token");
    expect(tokenDetails.decimals).toEqual("5");
    expect(Number(tokenDetails.initial_supply) / Math.pow(10, Number(tokenDetails.decimals))).toEqual(555);
    expect(tokenDetails.memo).toBe("");
    expect(tokenDetails.metadata).toBe("");
    expect(tokenDetails?.supply_key?.key).toBeUndefined();
    expect(tokenDetails?.admin_key?.key).toBeUndefined();
    expect(tokenDetails?.metadata_key?.key).not.toBeUndefined();
  });

  it("Create token with minimal parameters plus admin key and supply key", async () => {
    const hederaApiClient = new HederaMirrorNodeClient("testnet");

    const promptText =
      "Create token 'Minimal Plus Admin Supply Keys Token' with symbol MPASKT, 1 decimal places, and starting supply of 111. Set admin key and supply keys.";
    const prompt = {
      user: "user",
      text: promptText,
    };
    const langchainAgent = await LangchainAgent.create();

    const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);
    const tokenDetailsFromToolResponse = extractTokenDetails(response.messages);

    if (!tokenDetailsFromToolResponse) {
      throw new Error("No token details found");
    }

    await wait(5000);

    const tokenDetails = await hederaApiClient.getTokenDetails(tokenDetailsFromToolResponse.tokenId);

    expect(tokenDetails.symbol).toEqual("MPASKT");
    expect(tokenDetails.name).toEqual("Minimal Plus Admin Supply Keys Token");
    expect(tokenDetails.decimals).toEqual("1");
    expect(Number(tokenDetails.initial_supply) / Math.pow(10, Number(tokenDetails.decimals))).toEqual(111);
    expect(tokenDetails.memo).toBe("");
    expect(tokenDetails?.supply_key?.key).not.toBeUndefined();
    expect(tokenDetails?.admin_key?.key).not.toBeUndefined();
    expect(tokenDetails?.metadata_key?.key).toBeUndefined();
  });

  it("Create token with minimal parameters plus admin key and supply key and memo and metadata", async () => {
    const hederaApiClient = new HederaMirrorNodeClient("testnet");

    const promptText =
      "Create token 'Complex Token' with symbol CPLXT, 1 decimal places, and starting supply of 1111. Set admin key and supply keys. Set memo to 'This a complex token'. Set metadata to 'this could be a link to image'. Don't set metadata key";
    const prompt = {
      user: "user",
      text: promptText,
    };
    const langchainAgent = await LangchainAgent.create();

    const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);
    const tokenDetailsFromToolResponse = extractTokenDetails(response.messages);

    if (!tokenDetailsFromToolResponse) {
      throw new Error("No token details found");
    }

    await wait(5000);

    const tokenDetails = await hederaApiClient.getTokenDetails(tokenDetailsFromToolResponse.tokenId);

    expect(tokenDetails.symbol).toEqual("CPLXT");
    expect(tokenDetails.name).toEqual("Complex Token");
    expect(tokenDetails.decimals).toEqual("1");
    expect(Number(tokenDetails.initial_supply) / Math.pow(10, Number(tokenDetails.decimals))).toEqual(1111);
    expect(tokenDetails.memo).toBe("This a complex token");
    expect(atob(tokenDetails.metadata!)).toBe("this could be a link to image");
    expect(tokenDetails?.supply_key?.key).not.toBeUndefined();
    expect(tokenDetails?.admin_key?.key).not.toBeUndefined();
    expect(tokenDetails?.metadata_key?.key).toBeUndefined();
  });

  it("Create token with supply in display units using comma", async () => {
    const hederaApiClient = new HederaMirrorNodeClient("testnet");

    const promptText =
      "Create token GameGold with symbol GG, 2 decimal places, and starting supply of 75,55";
    const prompt = {
      user: "user",
      text: promptText,
    };
    const langchainAgent = await LangchainAgent.create();

    const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);
    const tokenDetailsFromToolResponse = extractTokenDetails(response.messages);

    if (!tokenDetailsFromToolResponse) {
      throw new Error("No token details found");
    }

    await wait(5000);

    const tokenDetails = await hederaApiClient.getTokenDetails(
      tokenDetailsFromToolResponse.tokenId
    );

    expect(Number(tokenDetails.initial_supply) / Math.pow(10, Number(tokenDetails.decimals))).toEqual(75.55);
  });

  it("Create token with supply in display units using dot", async () => {
    const hederaApiClient = new HederaMirrorNodeClient("testnet");

    const promptText =
      "Create token GameGold with symbol GG, 2 decimal places, and starting supply of 75.55";
    const prompt = {
      user: "user",
      text: promptText,
    };
    const langchainAgent = await LangchainAgent.create();

    const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);
    const tokenDetailsFromToolResponse = extractTokenDetails(response.messages);

    if (!tokenDetailsFromToolResponse) {
      throw new Error("No token details found");
    }

    await wait(5000);

    const tokenDetails = await hederaApiClient.getTokenDetails(
      tokenDetailsFromToolResponse.tokenId
    );

    expect(Number(tokenDetails.initial_supply) / Math.pow(10, Number(tokenDetails.decimals))).toEqual(75.55);
  });

  it("Create token with supply in display units using dot and zero", async () => {
    const hederaApiClient = new HederaMirrorNodeClient("testnet");

    const promptText =
      "Create token GameGold with symbol GG, 2 decimal places, and starting supply of 75.0";
    const prompt = {
      user: "user",
      text: promptText,
    };
    const langchainAgent = await LangchainAgent.create();

    const response = await langchainAgent.sendPrompt(prompt, IS_CUSTODIAL);
    const tokenDetailsFromToolResponse = extractTokenDetails(response.messages);

    if (!tokenDetailsFromToolResponse) {
      throw new Error("No token details found");
    }

    await wait(5000);

    const tokenDetails = await hederaApiClient.getTokenDetails(
      tokenDetailsFromToolResponse.tokenId
    );

    expect(Number(tokenDetails.initial_supply) / Math.pow(10, Number(tokenDetails.decimals))).toEqual(75.0);
  });
});
