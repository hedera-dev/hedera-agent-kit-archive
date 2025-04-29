import { describe, expect, it, beforeAll } from "vitest";
import { NetworkType} from "../types";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "../utils/testnetClient";
import { HederaMirrorNodeClient } from "../utils/hederaMirrorNodeClient";
import { LangchainAgent } from "../utils/langchainAgent";
import { extractTxBytes, signAndExecuteTx, wait } from "../utils/utils";
import { AccountData } from "../utils/testnetUtils";
import { ExecutorAccountDetails } from "../../types";

dotenv.config();

const IS_CUSTODIAL = false;

describe("hedera_mint_nft (non-custodial)", () => {
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
          5, // starting HBARs
          0 // no auto association
        );

        executorCustodialClientWrapper = new NetworkClientWrapper(
          txExecutorAccount.accountId,
          txExecutorAccount.privateKey,
          'ECDSA', // .createAccount() creates account with ECDSA key
          "testnet"
        );
    });

    it("should mint non-fungible token", async () => {
        const STARTING_SUPPLY = 0;

        // STEP 0: create token that will be minted
        const tokenId = await executorCustodialClientWrapper.createNFT({
            name: "TokenToMint",
            symbol: "TTM",
            maxSupply: 1000,
        });

        const prompt = {
            user: "user",
            text: `Mint an NFT with metadata "My NFT" to token ${tokenId}`,
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

        const tokenInfo =
            await hederaApiClient.getTokenDetails(tokenId);


        expect(Number(tokenInfo.total_supply)).toBe(STARTING_SUPPLY + 1);
    });
});
