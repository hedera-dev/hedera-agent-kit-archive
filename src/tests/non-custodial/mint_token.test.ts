import { describe, expect, it, beforeAll } from "vitest";
import { NetworkType } from "../types";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import { LangchainAgent } from "../utils/langchainAgent";
import { extractTxBytes, signAndExecuteTx, wait } from "../utils/utils";
import { AccountData } from "../utils/testnetUtils";
import { ExecutorAccountDetails } from "../../types";

dotenv.config();

const IS_CUSTODIAL = false;

describe("hedera_mint_fungible_token (non-custodial)", () => {
  let hederaApiClient: HederaMirrorNodeClient;
  let networkClientWrapper: NetworkClientWrapper;
  let executorCustodialClientWrapper: NetworkClientWrapper;
  let txExecutorAccount: AccountData;

    beforeAll(async () => {
      hederaApiClient = new HederaMirrorNodeClient("testnet" as NetworkType);

      networkClientWrapper = new NetworkClientWrapper(
        process.env.HEDERA_ACCOUNT_ID!,
        process.env.HEDERA_PRIVATE_KEY!,
        process.env.HEDERA_KEY_TYPE!,
        "testnet"
      );

      txExecutorAccount = await networkClientWrapper.createAccount(
        15, // starting HBARs
        0 // no auto association
      );

      executorCustodialClientWrapper = new NetworkClientWrapper(
        txExecutorAccount.accountId,
        txExecutorAccount.privateKey,
        'ECDSA', // .createAccount() creates account with ECDSA key
        "testnet"
      );
    });

  it("should mint fungible token", async () => {
    const STARTING_SUPPLY = 0;
    const TOKENS_TO_MINT = 100;

    // STEP 0: create token that will be minted
    const tokenId = await executorCustodialClientWrapper.createFT({
      name: "TokenToMint",
      symbol: "TTM",
      maxSupply: 1000,
      initialSupply: STARTING_SUPPLY,
      isSupplyKey: true,
    });

    const prompt = {
      user: "user",
      text: `Mint ${TOKENS_TO_MINT} of tokens ${tokenId}`,
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

    console.log(JSON.stringify(response, null, 2));

    // STEP 2: extract tx bytes
    const txBytesString = extractTxBytes(response.messages)

    // STEP 3: verify correctness by signing and executing the tx
    const executedTx = await signAndExecuteTx(
      txBytesString,
      txExecutorAccount.privateKey,
      txExecutorAccount.accountId
    )

    await wait(5000); // wait for the mirror node to update

    // STEP 4: verify that minting the token was successful
    const tokenInfo = await hederaApiClient.getTokenDetails(tokenId);

    expect(Number(tokenInfo.total_supply)).toBe(
      STARTING_SUPPLY + TOKENS_TO_MINT
    );
  });

  it("should fail minting fungible tokens due to not setting supply key of token", async () => {
    const STARTING_SUPPLY = 0;
    const TOKENS_TO_MINT = 100;

    const tokenId = await executorCustodialClientWrapper.createFT({
      name: "TokenToMint",
      symbol: "TTM",
      maxSupply: 1000,
      initialSupply: STARTING_SUPPLY,
    });

    const prompt = {
      user: "user",
      text: `Mint ${TOKENS_TO_MINT} of tokens ${tokenId}`,
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

    console.log(JSON.stringify(response, null, 2));

    // STEP 2: extract tx bytes
    const txBytesString = extractTxBytes(response.messages)

    // STEP 3: verify correctness by signing and executing the tx
    await expect(
      signAndExecuteTx(
        txBytesString,
        txExecutorAccount.privateKey,
        txExecutorAccount.accountId
      )
    ).rejects.toThrow("TOKEN_HAS_NO_SUPPLY_KEY");

    await wait(5000); // wait for the mirror node to update

    // STEP 4: verify that minting the token was successful
    const tokenInfo = await hederaApiClient.getTokenDetails(tokenId);

    expect(Number(tokenInfo.total_supply)).toBe(STARTING_SUPPLY);

  });

  it("should mint fungible token using display units in prompt", async () => {
    const STARTING_SUPPLY = 0;
    const TOKENS_TO_MINT_IN_DISPLAY_UNITS = 100;
    const DECIMALS = 2;

    const tokenId = await executorCustodialClientWrapper.createFT({
      name: "TokenToMint",
      symbol: "TTM",
      maxSupply: 100_000_000, // given in base units. This is 1_000_000 tokens in display units
      decimals: DECIMALS,
      initialSupply: STARTING_SUPPLY, // given in base units
      isSupplyKey: true,
    });

    const prompt = {
      user: "user",
      text: `Mint ${TOKENS_TO_MINT_IN_DISPLAY_UNITS} of tokens ${tokenId}`,
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

    console.log(JSON.stringify(response, null, 2));

    // STEP 2: extract tx bytes
    const txBytesString = extractTxBytes(response.messages)

    // STEP 3: verify correctness by signing and executing the tx
    const executedTx = await signAndExecuteTx(
      txBytesString,
      txExecutorAccount.privateKey,
      txExecutorAccount.accountId
    )
    await wait(5000); // wait for the mirror node to update

    // STEP 4: verify that minting the token was successful
    const tokenInfo = await hederaApiClient.getTokenDetails(tokenId);

    expect(Number(tokenInfo.total_supply) / Math.pow(10, DECIMALS)).toBe(
      STARTING_SUPPLY / Math.pow(10, DECIMALS) + TOKENS_TO_MINT_IN_DISPLAY_UNITS
    );
  });
});
