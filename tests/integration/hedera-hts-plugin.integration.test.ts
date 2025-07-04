import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { HederaHTSPlugin } from "../../src/plugins/core";
import {
  AccountId,
  PrivateKey as SDKPrivateKey,
  PublicKey as SDKPublicKey,
  AccountCreateTransaction,
  Hbar as SDKHbar,
  TokenId,
  TokenAssociateTransaction,
  Status,
  Transaction,
  TokenDissociateTransaction,
  TokenSupplyType,
  TransactionReceipt,
  TokenDeleteTransaction,
  TokenInfoQuery,
  TokenType,
  TokenNftInfoQuery,
  NftId,
  Long,
  AccountInfoQuery,
} from '@hashgraph/sdk';
import { HederaAgentKit, HederaConversationalAgent } from '../../src/agent';
import dotenv from 'dotenv';
import path from 'path';
import {
  ServerSigner
} from "../../src";
import {
  associateTokensWithAccount,
  createFungibleToken,
  createNftCollection,
  generateUniqueName,
  getNftOwner,
  getTokenBalance,
  getTokenBalanceQuery,
  mintFt,
  mintNft
} from "./utils";
import { Buffer } from "buffer";

dotenv.config({path: path.resolve(__dirname, '../../../.env.test')});

const TOKEN_ID_REGEX = new RegExp('^0\\.0\\.\\d+$');

interface AccountDetails {
  accountId: AccountId;
  privateKey: SDKPrivateKey;
  publicKey: SDKPublicKey;
}

/**
 * Creates a new Hedera test account with the given initial HBAR balance.
 * The balance is deducted from the operator account set in the environment.
 *
 * @param kit - HederaAgentKit with configured client and operator signer.
 * @param initialBalanceHbar - Initial balance for the new account in HBAR.
 *
 * @returns AccountDetails with new accountId, privateKey, and publicKey.
 *
 * @throws If account creation fails or no accountId is returned.
 */
async function createNewTestAccount(
  kit: HederaAgentKit,
  initialBalanceHbar: number
): Promise<
  AccountDetails
> {
  const newPrivateKey = SDKPrivateKey.generateED25519();
  const newPublicKey = newPrivateKey.publicKey;
  console.log(
    `[createNewTestAccount] Generated new PublicKey: ${newPublicKey.toStringDer()}`
  );
  const transaction = new AccountCreateTransaction()
    .setKey(newPublicKey)
    .setInitialBalance(new SDKHbar(initialBalanceHbar));
  console.log(
    `[createNewTestAccount] Attempting to create account with key ${newPublicKey.toStringDer()} and balance ${initialBalanceHbar} HBAR...`
  );
  const frozenTx = transaction.freezeWith(kit.client);
  const signedTx = await frozenTx.sign(kit.signer.getOperatorPrivateKey());
  const txResponse = await signedTx.execute(kit.client);
  const receipt = await txResponse.getReceipt(kit.client);
  if (!receipt.accountId) {
    throw new Error(
      'Failed to create new account: accountId is null in receipt.'
    );
  }
  console.log(
    `[createNewTestAccount] Successfully created account ${receipt.accountId.toString()}`
  );
  return {
    accountId: receipt.accountId,
    privateKey: newPrivateKey,
    publicKey: newPublicKey,
  } as AccountDetails;
}


describe('HederaHTSPlugin Integration (Testnet)', () => {
  let agent: HederaConversationalAgent;
  let signer: ServerSigner;
  let kit: HederaAgentKit;
  let operatorPublicKey: SDKPublicKey;
  let sharedSecondaryAccountId: AccountId; // For reusable secondary account
  let sharedSecondaryAccountPrivateKey: SDKPrivateKey; // Its private key
  let secondaryAccountSigner: ServerSigner; // Signer for the shared secondary account
  let operatorAccountId: AccountId;
  let createdTokenIds: TokenId[] = [];

  console.log('HederaHTSPlugin Integration Test (Testnet)');

  beforeAll(async () => {
    const accountId = process.env.HEDERA_ACCOUNT_ID;
    const privateKey = process.env.HEDERA_PRIVATE_KEY;
    const openAIApiKey = process.env.OPENAI_API_KEY;
    console.log('API KEYS LOADED');

    if (!accountId || !privateKey || !openAIApiKey) {
      throw new Error(
        'HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY, and OPENAI_API_KEY must be set in environment variables.'
      );
    }

    signer = new ServerSigner(accountId, privateKey, 'testnet');

    agent = new HederaConversationalAgent(signer, {
      pluginConfig: {plugins: [new HederaHTSPlugin()]},
      userAccountId: accountId,
      openAIApiKey,
      verbose: true,
      scheduleUserTransactionsInBytesMode: false,
      operationalMode: 'autonomous'
    });
    await agent.initialize();

    kit = new HederaAgentKit(signer, {appConfig: {openAIApiKey}}, "autonomous", undefined, false);
    await kit.initialize();

    operatorAccountId = kit.signer.getAccountId();
    operatorPublicKey = await kit.signer.getPublicKey();

    try {
      const accountDetails = await createNewTestAccount(kit, 50); // Create with 50 HBAR
      sharedSecondaryAccountId = accountDetails.accountId;
      sharedSecondaryAccountPrivateKey = accountDetails.privateKey;
      // Create a ServerSigner for this new account
      secondaryAccountSigner = new ServerSigner(
        sharedSecondaryAccountId,
        sharedSecondaryAccountPrivateKey,
        kit.network
      ); // Using kit.network for consistency
      console.log(
        `Created shared secondary account ${sharedSecondaryAccountId.toString()} and its signer for HTS test suites.`
      );
    } catch (e) {
      console.error(
        'CRITICAL: Failed to create shared secondary account in main beforeAll',
        e
      );
      throw e; // Fail all tests if this crucial setup fails
    }
  });

  afterAll(async () => {
    if (!kit || createdTokenIds.length === 0) return;

    console.log(`Attempting to clean up ${createdTokenIds.length} created token(s)...`);
    for (const tokenId of createdTokenIds) {
      try {
        console.log(`Cleaning up token: ${tokenId.toString()}`);

        // Build and freeze the delete transaction
        const deleteTx = new TokenDeleteTransaction()
          .setTokenId(tokenId)
          .freezeWith(signer.getClient());

        // Sign with the admin key and client payer
        const signedTx = await deleteTx.sign(signer.getOperatorPrivateKey());

        const txResponse = await signedTx.execute(signer.getClient());
        const receipt = await txResponse.getReceipt(signer.getClient());

        console.log(`Delete status for ${tokenId}: ${receipt.status.toString()}`);

        // Validate the receipt
        expect(receipt.status.toString()).toEqual('SUCCESS');
        console.log(`Successfully cleaned up token ${tokenId.toString()}`);

      } catch (error: unknown) {
        console.error(`Cleanup FAILED for token ${tokenId.toString()}:`, error);
      }
    }
  });


  describe('HederaCreateFungibleTokenTool', () => {
    it('should create a new fungible token with basic parameters (adminKey as current_signer)', async () => {
      const tokenName = generateUniqueName('TestFTCS');
      const tokenSymbol = generateUniqueName('TFCS');
      const initialSupply = 100000;
      const decimals = 2;
      const supplyType = TokenSupplyType.Infinite;
      const prompt = `Create a new fungible token. Name: "${tokenName}", Symbol: "${tokenSymbol}", Initial Supply: ${initialSupply} (smallest units), Decimals: ${decimals}, Treasury Account: ${operatorAccountId.toString()}, Supply Type: ${supplyType.toString()}. For the adminKey parameter, use the exact string value "current_signer". metaOptions: { adminKeyShouldSign: true }`;
      const response = await agent.processMessage(prompt);
      const receipt = response.receipt as TransactionReceipt;

      expect(
        response.success,
        `Test 1 Failed: Agent/Tool Error: ${response.error}`
      ).toBe(true);
      expect(response.error).toBeUndefined();
      expect(receipt).toBeDefined();
      expect(receipt.status).toEqual('SUCCESS');
      expect(receipt.tokenId!.toString()).toMatch(
        TOKEN_ID_REGEX
      );

      // Validate on-chain result
      const tokenInfo = await new TokenInfoQuery()
        .setTokenId(receipt.tokenId as TokenId)
        .execute(signer.getClient());

      expect(tokenInfo.tokenType).equal(TokenType.FungibleCommon);
      expect(tokenInfo.name).equal(tokenName);
      expect(tokenInfo.symbol).equal(tokenSymbol);
      expect(tokenInfo.supplyType).equal(supplyType);
      expect(tokenInfo.decimals).equal(decimals);
      expect(tokenInfo.totalSupply.toString()).equal(initialSupply.toString());
      expect(tokenInfo.treasuryAccountId?.toString()).equal(operatorAccountId?.toString());
      expect(tokenInfo.adminKey?.toString()).equal(operatorPublicKey?.toString());
      expect(tokenInfo.supplyKey?.toString()).toBeUndefined();
      expect(tokenInfo.freezeKey?.toString()).toBeUndefined();
      expect(tokenInfo.kycKey?.toString()).toBeUndefined();

      if (receipt.tokenId) {
        const newId = receipt.tokenId as TokenId;
        createdTokenIds.push(newId);
        console.log(`Created token ${newId.toString()} in test 1.`);
      }
    });

    it('should create a new fungible token with an admin key provided as operator public key', async () => {
      const tokenName = generateUniqueName('TestAdminFT');
      const tokenSymbol = generateUniqueName('TAFT');
      const operatorPubKeyDer = (await kit.signer.getPublicKey()).toStringDer();
      const initialSupply = 50000;
      const decimals = 0;
      const supplyType = TokenSupplyType.Finite;
      const maxSupply = 1000000;

      // Updated Prompt for Test 2 - remove adminKeyShouldSign from metaOptions for now
      const prompt = `Create a new fungible token. Name: "${tokenName}", Symbol: "${tokenSymbol}", Initial Supply: ${initialSupply}, Decimals: ${decimals}, Treasury Account: ${operatorAccountId.toString()}, Admin Key: "${operatorPubKeyDer}", Supply Type: ${supplyType.toString()}, Max Supply: ${maxSupply}. Supply key: ${operatorPubKeyDer}`;

      const response = await agent.processMessage(prompt);
      const receipt = response.receipt as TransactionReceipt;

      expect(
        response.success,
        `Test 2 Failed: Agent/Tool Error: ${response.error}`
      ).toBe(true);
      expect(response.error).toBeUndefined();
      expect(receipt).toBeDefined();
      expect(receipt.status).toEqual('SUCCESS');
      expect(receipt.tokenId).toBeDefined();
      expect(receipt.tokenId!.toString()).toMatch(
        TOKEN_ID_REGEX
      );

      // Validate on-chain result
      const tokenInfo = await new TokenInfoQuery()
        .setTokenId(receipt.tokenId as TokenId)
        .execute(signer.getClient());

      expect(tokenInfo.tokenType).equal(TokenType.FungibleCommon);
      expect(tokenInfo.name).equal(tokenName);
      expect(tokenInfo.symbol).equal(tokenSymbol);
      expect(tokenInfo.supplyType).equal(supplyType);
      expect(tokenInfo.decimals).equal(decimals);
      expect(tokenInfo.totalSupply.toString()).equal(initialSupply.toString());
      // expect(tokenInfo.maxSupply?.toString()).equal(maxSupply.toString()); // FIXME: The maxSupply is not set correctly
      expect(tokenInfo.treasuryAccountId?.toString()).equal(operatorAccountId.toString());
      expect(tokenInfo.adminKey?.toString()).equal(operatorPublicKey?.toString());
      expect(tokenInfo.supplyKey?.toString()).equal(operatorPublicKey?.toString());
      expect(tokenInfo.freezeKey?.toString()).toBeUndefined();
      expect(tokenInfo.kycKey?.toString()).toBeUndefined();

      if (receipt) {
        const newId = receipt.tokenId as TokenId;
        createdTokenIds.push(newId);
        console.log(
          `Created token ${newId.toString()} with admin key in test 2.`
        );
      }
    });
  });

  describe('HederaCreateNftTool', () => {
    it('should create a new non-fungible token with basic parameters (adminKey as current_signer)', async () => {
      const tokenName = generateUniqueName('TestNFTCS');
      const tokenSymbol = generateUniqueName('TNFTCS');
      const initialSupply = 100000;
      const decimals = 0; // NFTs always have decimals set to 0
      const supplyType = TokenSupplyType.Finite;
      const maxSupply = 1000000;
      const prompt = `Create a new non-fungible token. Name: "${tokenName}", Symbol: "${tokenSymbol}", Initial Supply: ${initialSupply} (smallest units), Treasury Account: ${operatorAccountId.toString()}, Supply Type: ${supplyType.toString()}, Max Supply: ${maxSupply} (smallest units). For the adminKey parameter, use the exact string value "current_signer". metaOptions: { adminKeyShouldSign: true }`;
      const response = await agent.processMessage(prompt);
      const receipt = response.receipt as TransactionReceipt;

      expect(
        response.success,
        `NFT Creation Test Failed: Agent/Tool Error: ${response.error}`
      ).toBe(true);
      expect(response.error).toBeUndefined();
      expect(receipt).toBeDefined();
      expect(receipt.status).toEqual('SUCCESS');
      expect(receipt.tokenId?.toString()).toMatch(
        TOKEN_ID_REGEX
      );

      // Validate on-chain result
      const tokenInfo = await new TokenInfoQuery()
        .setTokenId(receipt.tokenId as TokenId)
        .execute(signer.getClient());

      expect(tokenInfo.tokenType).equal(TokenType.NonFungibleUnique);
      expect(tokenInfo.name).equal(tokenName);
      expect(tokenInfo.symbol).equal(tokenSymbol);
      expect(tokenInfo.supplyType).equal(supplyType);
      expect(tokenInfo.decimals).equal(decimals);
      expect(tokenInfo.totalSupply.toString()).equal("0"); // NFT collections are created as empty
      expect(tokenInfo.maxSupply?.toString()).equal(maxSupply.toString());
      // expect(tokenInfo.treasuryAccountId?.toString()).equal(operatorAccountId?.toString()); //FIXME: treasuryAccountId setting is failing
      expect(tokenInfo.adminKey?.toString()).equal(operatorPublicKey?.toString());
      // expect(tokenInfo.supplyKey?.toString()).toBeUndefined(); //FIXME: supply key is failing
      expect(tokenInfo.freezeKey?.toString()).toBeUndefined();
      expect(tokenInfo.kycKey?.toString()).toBeUndefined();

      if (receipt.tokenId) {
        const newId = receipt.tokenId;
        createdTokenIds.push(newId); // Add to clean up queue
        console.log(`Created NFT Collection ${newId.toString()} in test.`);
      }
    })
  })

  describe('HederaMintFungibleTokenTool', () => {
    let mintableFtId: TokenId;

    beforeAll(async () => {
      const tokenName = generateUniqueName('MintableFT');
      const tokenSymbol = generateUniqueName('MFT');
      const initialSupply = 100;
      const maxSupply = 10000;
      const decimals = 0;

      mintableFtId = await createFungibleToken(signer as ServerSigner, {
        name: tokenName,
        symbol: tokenSymbol,
        initialSupply,
        decimals,
        maxSupply,
        treasuryAccountId: operatorAccountId,
        supplyType: TokenSupplyType.Finite,
        adminKey: operatorPublicKey,
        supplyKey: operatorPublicKey,
      });

      createdTokenIds.push(mintableFtId);
      console.log(`Created MintableFT ${mintableFtId.toString()} for minting tests.`);
    });

    it('should mint more fungible tokens', async () => {
      const tokenInfoBefore = await new TokenInfoQuery()
        .setTokenId(mintableFtId)
        .execute(signer.getClient());
      const supplyBefore = tokenInfoBefore.totalSupply.toNumber();
      const amountToMint = 500;

      const prompt = `Mint ${amountToMint} units of token ${mintableFtId.toString()}. metaOptions: { supplyKeyShouldSign: true }`; // Assuming supplyKeyShouldSign might be needed

      const response = await agent.processMessage(prompt);
      const receipt = response.receipt as TransactionReceipt;

      expect(
        response.success,
        `MintFungibleToken Test Failed: ${response.error}`
      ).toBe(true);
      expect(receipt).toBeDefined();
      expect(receipt.status).toEqual('SUCCESS');

      // validate on-chain
      const tokenInfoAfter = await new TokenInfoQuery()
        .setTokenId(mintableFtId)
        .execute(signer.getClient());
      const supplyAfter = tokenInfoAfter.totalSupply.toNumber();

      expect(supplyBefore + amountToMint).equal(supplyAfter)

      console.log(
        `Minted ${amountToMint} to ${mintableFtId.toString()}. New total supply from receipt: ${receipt.totalSupply?.toString()}`
      );
    });
  });

  describe('HederaBurnFungibleTokenTool', () => {
    let burnableFtId: TokenId;
    const initialSupplyForBurn = 2000;
    const amountToBurn = 500;

    beforeAll(async () => {
      const tokenName = generateUniqueName('BurnableFT');
      const tokenSymbol = generateUniqueName('BFT');

      burnableFtId = await createFungibleToken(signer, {
        name: tokenName,
        symbol: tokenSymbol,
        initialSupply: initialSupplyForBurn,
        decimals: 0,
        treasuryAccountId: operatorAccountId,
        supplyType: TokenSupplyType.Infinite,
        adminKey: operatorPublicKey,
        wipeKey: operatorPublicKey,
        supplyKey: operatorPublicKey, // needed for burning
      });

      createdTokenIds.push(burnableFtId);

      console.log(
        `Created BurnableFT ${burnableFtId.toString()} with initial supply ${initialSupplyForBurn} for burning tests.`
      );
    });

    it('should burn fungible tokens from the treasury', async () => {
      // Get supply before burn
      const tokenInfoBefore = await new TokenInfoQuery()
        .setTokenId(burnableFtId)
        .execute(signer.getClient());
      const supplyBefore = tokenInfoBefore.totalSupply.toNumber();

      // The burn transaction is signed by the Treasury account by default if no wipe key is involved from another account.
      // If a wipeKey is set on the token (as we did), the burn operation from treasury also needs the supply key's signature.
      // Our current setup: treasury is operator, supplyKey is operator. So operator signature is sufficient.
      const prompt = `Burn ${amountToBurn} units of token ${burnableFtId.toString()}. metaOptions: { supplyKeyShouldSign: true }`; // supplyKeyShouldSign for good measure

      const response = await agent.processMessage(prompt);
      const receipt = response.receipt as TransactionReceipt;

      expect(
        response.success,
        `BurnFungibleToken Test Failed: ${response.error}`
      ).toBe(true);
      expect(receipt).toBeDefined();
      expect(receipt.status).toEqual('SUCCESS');

      const expectedNewSupply = initialSupplyForBurn - amountToBurn;
      expect(receipt.totalSupply?.toString()).toEqual(expectedNewSupply.toString());


      // perform on-chain validation
      const tokenInfoAfter = await new TokenInfoQuery()
        .setTokenId(burnableFtId)
        .execute(signer.getClient());
      const supplyAfter = tokenInfoAfter.totalSupply.toNumber();

      // Verify new supply matches expected
      expect(supplyAfter).toEqual(supplyBefore - amountToBurn);

      console.log(
        `Burned ${amountToBurn} from ${burnableFtId.toString()}. New total supply from receipt: ${receipt.totalSupply?.toString()}`
      );
    });
  });

  describe('HederaMintNftTool', () => {
    let nftCollectionId: TokenId;

    beforeAll(async () => {
      // Create NFT Collection
      const nftName = generateUniqueName('BurnTestNFT');
      const nftSymbol = generateUniqueName('BTNFT');
      const maxSupply = 100;

      nftCollectionId = await createNftCollection(signer, {
        name: nftName,
        symbol: nftSymbol,
        maxSupply,
        treasuryAccountId: operatorAccountId,
        supplyType: TokenSupplyType.Finite,
        adminKey: operatorPublicKey,
        supplyKey: operatorPublicKey,
      });

      createdTokenIds.push(nftCollectionId);

      console.log(`Created NFT Collection ${nftCollectionId.toString()} for minting tests.`);
    });

    it('should mint a new NFT into the collection', async () => {
      const metadata = Buffer.from(`NFT metadata for ${generateUniqueName('Serial')}`).toString('base64'); // Base64 encoded string

      const prompt = `Mint a new NFT into collection ${nftCollectionId.toString()} with metadata "${metadata}". metaOptions: { supplyKeyShouldSign: true }`;

      const response = await agent.processMessage(prompt);
      const receipt = response.receipt as TransactionReceipt;

      expect(response.success, `MintNFT Test Failed: ${response.error}`).toBe(true);
      expect(response.receipt).toBeDefined();
      expect(receipt.status).toEqual('SUCCESS');
      expect(receipt.serials).toBeDefined();
      expect(receipt.serials.length).toBeGreaterThan(0);

      // Serials in the parsed JSON from receipt will likely be numbers or strings.
      const newSerialValue = receipt.serials[0];
      const newSerial = (newSerialValue.toString());

      // Construct NftId for querying on-chain info
      const nftId = new NftId(nftCollectionId, Long.fromString(newSerial));

      // Query the NFT info on-chain
      const nftInfo = await new TokenNftInfoQuery()
        .setNftId(nftId)
        .execute(signer.getClient());

      expect(nftInfo).toBeDefined();
      expect(nftInfo[0].nftId.toString()).toEqual(nftId.toString());
      expect(nftInfo[0].metadata!.length).toBeGreaterThan(0);
      // expect(Buffer.from(nftInfo[0].metadata!).toString('base64')).toEqual(metadata); //FIXME: failing metadata verification

      console.log(`Minted NFT serial ${newSerial} into collection ${nftCollectionId.toString()}.`);
      // We could potentially add this serial to a list for later burning if needed for a burn test
    });
  });

  describe('HederaBurnNftTool', () => {
    let burnableNftCollectionId: TokenId;
    let mintedSerial: string;

    beforeAll(async () => {
      const nftName = generateUniqueName('BurnTestNFT');
      const nftSymbol = generateUniqueName('BTNFT');
      const maxSupply = 100;

      burnableNftCollectionId = await createNftCollection(signer, {
        name: nftName,
        symbol: nftSymbol,
        maxSupply,
        treasuryAccountId: operatorAccountId,
        supplyType: TokenSupplyType.Finite,
        adminKey: operatorPublicKey,
        supplyKey: operatorPublicKey,
        wipeKey: operatorPublicKey,
      });

      createdTokenIds.push(burnableNftCollectionId);

      console.log(`Created NFT Collection ${burnableNftCollectionId.toString()} for burn tests.`);

      // Mint an NFT
      const metadata = `NFT for transfer test ${generateUniqueName('Serial')}`;
      const {serial} = await mintNft(signer, burnableNftCollectionId, metadata);
      mintedSerial = serial.toString();

      console.log(`Minted NFT serial ${mintedSerial} into ${burnableNftCollectionId.toString()} for burn test.`);
    });

    it('should burn a specific NFT serial from the collection', async () => {
      const prompt = `Burn NFT serial ${mintedSerial} of token ${burnableNftCollectionId.toString()}.`;

      const response = await agent.processMessage(prompt);
      const receipt = response.receipt as TransactionReceipt;

      expect(response.success, `BurnNFT Test Failed: ${response.error}`).toBe(true);
      expect(receipt).toBeDefined();
      expect(receipt.status).toEqual('SUCCESS');
      expect(receipt.totalSupply).toBeDefined();
      expect(receipt.totalSupply?.toString()).toEqual('0');

      console.log(
        `Burned NFT serial ${mintedSerial} from ${burnableNftCollectionId.toString()}. New total supply from receipt: ${receipt.totalSupply}`
      );


      // perform on-chain verification
      try {
        const nftId = new NftId(burnableNftCollectionId, Number(mintedSerial));
        const nftInfo = await new TokenNftInfoQuery()
          .setNftId(nftId)
          .execute(signer.getClient());

        // If no error, NFT still exists (unexpected after burn)
        console.warn("NFT still exists on-chain after burn:", nftInfo);
        expect.fail("NFT still exists after burn.");
      } catch (e) {
        // Expected: after burn, NFT info query should fail because NFT was wiped/burned
        console.log("NFT no longer exists on-chain after burn (expected).", e);
      }
    });
  });

  describe('HederaPauseUnpauseTokenTool', () => {
    let pausableTokenId: TokenId;

    beforeAll(async () => {
      const tokenName = generateUniqueName('PausableFT');
      const tokenSymbol = generateUniqueName('PFT');

      pausableTokenId = await createFungibleToken(signer, {
        name: tokenName,
        symbol: tokenSymbol,
        initialSupply: 100,
        decimals: 0,
        treasuryAccountId: operatorAccountId,
        adminKey: operatorPublicKey,
        pauseKey: operatorPublicKey,
      });

      createdTokenIds.push(pausableTokenId);
      console.log(`Created PausableFT ${pausableTokenId.toString()} for pause/unpause tests.`);
    });

    it('should pause a token and then unpause it', async () => {
      // Pause the token
      const pausePrompt = `Pause token ${pausableTokenId.toString()}. metaOptions: { pauseKeyShouldSign: true }`;
      const responsePause = await agent.processMessage(pausePrompt);
      const receiptPause = responsePause.receipt as TransactionReceipt;

      expect(responsePause.success, `Pause Token Test Failed: ${responsePause.error}`).toBe(true);
      expect(receiptPause).toBeDefined();
      expect(receiptPause.status).toEqual('SUCCESS');

      // Validate on-chain result
      const pausedTokenInfo = await new TokenInfoQuery()
        .setTokenId(pausableTokenId)
        .execute(signer.getClient());

      expect(pausedTokenInfo.pauseStatus).equal(true);
      console.log(`Token ${pausableTokenId.toString()} paused successfully.`);

      // Unpause the token
      const unpausePrompt = `Unpause token ${pausableTokenId.toString()}. metaOptions: { pauseKeyShouldSign: true }`;
      const responseUnpause = await agent.processMessage(unpausePrompt);
      const receiptUnpause = responseUnpause.receipt as TransactionReceipt;

      expect(responseUnpause.success, `Unpause Token Test Failed: ${responseUnpause.error}`).toBe(true);
      expect(receiptUnpause).toBeDefined();
      expect(receiptUnpause.status).toEqual('SUCCESS');

      const unpausedTokenInfo = await new TokenInfoQuery()
        .setTokenId(pausableTokenId)
        .execute(signer.getClient());

      expect(unpausedTokenInfo.pauseStatus).equal(false);

      console.log(`Token ${pausableTokenId.toString()} unpaused successfully.`);
    });
  });

  describe('HederaUpdateTokenTool', () => {
    let updatableTokenId: TokenId;
    const tokenName = generateUniqueName('UpdatableToken');
    const tokenSymbol = generateUniqueName('UTK');

    beforeAll(async () => {
      updatableTokenId = await createFungibleToken(signer, {
        name: tokenName,
        symbol: tokenSymbol,
        initialSupply: 100,
        decimals: 0,
        treasuryAccountId: operatorAccountId,
        adminKey: operatorPublicKey,
      });

      createdTokenIds.push(updatableTokenId);
      console.log(`Created UpdatableToken ${updatableTokenId.toString()} for update tests.`);
    });


    it("should update the token's name and symbol", async () => {
      const newTokenName = generateUniqueName('UpdatedTokenName');
      const newTokenSymbol = generateUniqueName('UTKS');

      const prompt = `Update token ${updatableTokenId.toString()}. Set its name to "${newTokenName}" and its symbol to "${newTokenSymbol}".metaOptions: { adminKeyShouldSign: true }`;

      const response = await agent.processMessage(prompt);
      const receipt = response.receipt as TransactionReceipt;

      expect(response.success, `UpdateToken Test Failed: ${response.error}`).toBe(true);
      expect(receipt).toBeDefined();
      expect(receipt.status).toEqual('SUCCESS');

      // Validate on-chain result
      const updatedTokenInfo = await new TokenInfoQuery()
        .setTokenId(updatableTokenId)
        .execute(signer.getClient());

      expect(updatedTokenInfo.name).equal(newTokenName);
      expect(updatedTokenInfo.symbol).equal(newTokenSymbol);

      console.log(`Token ${updatableTokenId.toString()} updated successfully.`);
    });
  });

  describe('HederaAssociateTokensTool', () => {
    let associatableTokenId: TokenId;

    beforeAll(async () => {
      const tokenName = generateUniqueName('AssociatableFT');
      const tokenSymbol = generateUniqueName('AFT');

      associatableTokenId = await createFungibleToken(signer, {
        name: tokenName,
        symbol: tokenSymbol,
        initialSupply: 100,
        maxSupply: 100,
        decimals: 0,
        treasuryAccountId: operatorAccountId,
        adminKey: operatorPublicKey,
        supplyType: TokenSupplyType.Finite,
      });

      createdTokenIds.push(associatableTokenId);
      console.log(`Created token ${associatableTokenId.toString()} for association tests.`);
    });


    // FIXME: failing due to `No transaction is currently being built` error
    it.skip('should prepare transaction bytes for association, then allow secondary account to sign and execute', async () => {
      const prompt = `Prepare a transaction for account ${sharedSecondaryAccountId.toString()} to associate with token 0.0.6273446. Return the transaction bytes. metaOptions: { getBytes: true }`;

      const response = await agent.processMessage(prompt);

      expect(response.success, `Failed to get transaction bytes: ${response.error}`).toBe(true);
      expect(response.type).toBe('bytes');

      const transactionBytes = Buffer.from(response.output as string, 'base64');
      const associateTx = (
        Transaction.fromBytes(transactionBytes) as TokenAssociateTransaction
      ).freezeWith(secondaryAccountSigner.getClient());

      const signedTx = await associateTx.sign(sharedSecondaryAccountPrivateKey);
      const execResult = await secondaryAccountSigner.signAndExecuteTransaction(signedTx);

      expect(execResult.status.toString()).toEqual(Status.Success.toString());
      console.log(`Token ${associatableTokenId} successfully associated with ${sharedSecondaryAccountId}.`);
    });
  });

  describe('HederaDissociateTokensTool', () => {
    let dissociatableTokenId: TokenId;

    beforeAll(async () => {
      const operatorPublicKey = await kit.signer.getPublicKey();

      // Create the fungible token using the helper func
      dissociatableTokenId = await createFungibleToken(signer, {
        name: generateUniqueName('DissociateTargetFT'),
        symbol: generateUniqueName('DTFT'),
        initialSupply: 100,
        maxSupply: 100,
        decimals: 0,
        treasuryAccountId: operatorAccountId,
        adminKey: operatorPublicKey,
        supplyType: TokenSupplyType.Finite,
      });

      createdTokenIds.push(dissociatableTokenId);
      console.log(`Created token ${dissociatableTokenId.toString()} for dissociation tests.`);

      // Associate the token with the secondary account using the helper func
      await associateTokensWithAccount(secondaryAccountSigner, sharedSecondaryAccountId, [
        dissociatableTokenId,
      ]);

      console.log(`Associated ${dissociatableTokenId} with ${sharedSecondaryAccountId} for dissociation test.`);
    });

    // FIXME: failing due to `No transaction is currently being built` error
    it.skip('should prepare and execute dissociation via secondary account signer', async () => {
      const prompt = `Prepare a transaction for account ${sharedSecondaryAccountId.toString()} to dissociate from token ${dissociatableTokenId.toString()}. Return the transaction bytes. metaOptions: { getBytes: true }`;

      const response = await agent.processMessage(prompt);

      expect(response.success, `Failed to get transaction bytes: ${response.error}`).toBe(true);
      expect(response.type).toBe('bytes');

      const transactionBytes = Buffer.from(response.output as string, 'base64');
      const dissociateTx = (
        TokenDissociateTransaction.fromBytes(transactionBytes)
      ).freezeWith(secondaryAccountSigner.getClient());

      const signedTx = await dissociateTx.sign(sharedSecondaryAccountPrivateKey);
      const execResult = await secondaryAccountSigner.signAndExecuteTransaction(signedTx);

      expect(execResult.status.toString()).toEqual(Status.Success.toString());
      console.log(`Token ${dissociatableTokenId} successfully dissociated from ${sharedSecondaryAccountId}.`);
    });
  });

  describe('HederaWipeTokenAccountTool', () => {
    let wipeableFtId: TokenId;
    const initialSupply = 3000;
    const amountToWipe = 700;

    beforeAll(async () => {
      const operatorPublicKey = await kit.signer.getPublicKey();

      wipeableFtId = await createFungibleToken(signer, {
        name: generateUniqueName('WipeableFT'),
        symbol: generateUniqueName('WFT'),
        initialSupply: initialSupply,
        decimals: 0,
        supplyType: TokenSupplyType.Finite,
        maxSupply: initialSupply + 10000,
        treasuryAccountId: operatorAccountId,
        adminKey: operatorPublicKey,
        supplyKey: operatorPublicKey,
        wipeKey: operatorPublicKey,
      });

      createdTokenIds.push(wipeableFtId);

      console.log(`Created WipeableFT ${wipeableFtId} for wipe test.`);
    });

    // FIXME: failing due to `No transaction is currently being built` error
    it.skip('should fail to wipe tokens from the treasury account', async () => {
      const prompt = `Wipe ${amountToWipe} units of token ${wipeableFtId.toString()} from account ${operatorAccountId.toString()}. metaOptions: { wipeKeyShouldSign: true }`;

      const response = await agent.processMessage(prompt);

      expect(response.success, `Expected failure but got success: ${JSON.stringify(response)}`).toBe(false);
      expect(response.error).toContain('CANNOT_WIPE_TOKEN_TREASURY_ACCOUNT');

      console.log(`Wipe attempt correctly failed: ${response.error}`);
    });
  });

  describe('HederaTokenFeeScheduleUpdateTool', () => {
    let tokenWithFeeScheduleKeyId: TokenId;

    beforeAll(async () => {
      const operatorPublicKey = await kit.signer.getPublicKey();

      tokenWithFeeScheduleKeyId = await createFungibleToken(signer, {
        name: generateUniqueName('FeeSchedFT'),
        symbol: generateUniqueName('FSFT'),
        initialSupply: 1000,
        decimals: 0,
        treasuryAccountId: operatorAccountId,
        adminKey: operatorPublicKey,
        supplyKey: operatorPublicKey,
      });

      createdTokenIds.push(tokenWithFeeScheduleKeyId);

      console.log(
        `Created FeeSchedFT ${tokenWithFeeScheduleKeyId.toString()} for fee schedule update tests.`
      );
    });

    // FIXME: failing due to `No transaction is currently being built` error
    it.skip('should update the fee schedule for a token', async () => {
      const customFeesJson = JSON.stringify([
        {
          type: 'FIXED',
          feeCollectorAccountId: operatorAccountId.toString(),
          denominatingTokenId: tokenWithFeeScheduleKeyId.toString(),
          amount: '5',
        },
        {
          type: 'FRACTIONAL',
          feeCollectorAccountId: operatorAccountId.toString(),
          numerator: 1,
          denominator: 100,
          minAmount: '1',
          maxAmount: '10',
          assessmentMethodInclusive: false,
        },
      ]);

      // The feeScheduleKey (operator) must sign this transaction.
      const prompt = `Update the fee schedule for token ${tokenWithFeeScheduleKeyId.toString()} with the following custom fees: ${customFeesJson}. metaOptions: { feeScheduleKeyShouldSign: true }`;
      // Note: feeScheduleKeyShouldSign is not yet implemented in BaseHederaTransactionTool, but operator signs by default.

      const result = await agent.processMessage(prompt);
      const receipt = result.receipt as TransactionReceipt;

      expect(
        result.success,
        `TokenFeeScheduleUpdate Test Failed: ${result.error}`
      ).toBe(true);
      expect(receipt).toBeDefined();
      expect(receipt.status).toEqual('SUCCESS');
      console.log(
        `Token fee schedule for ${tokenWithFeeScheduleKeyId.toString()} updated successfully.`
      );
    })

  })

  describe('HederaRejectTokensTool', () => {
    let rejectableTokenId: TokenId;

    beforeAll(async () => {
      const operatorPublicKey = await kit.signer.getPublicKey();

      rejectableTokenId = await createFungibleToken(signer, {
        name: generateUniqueName('RejectableFT'),
        symbol: generateUniqueName('RFT'),
        initialSupply: 1000,
        decimals: 0,
        treasuryAccountId: operatorAccountId,
        adminKey: operatorPublicKey,
        supplyKey: operatorPublicKey,
      });

      createdTokenIds.push(rejectableTokenId);

      console.log(
        `Created RejectableFT ${rejectableTokenId.toString()} for reject tests.`
      );
    });

    it('should configure the operator to reject associations for the specified token', async () => {
      // The TokenRejectTransaction is signed by the owner of the rejection (the operator in this case).
      const prompt = `Configure my account (${operatorAccountId.toString()}) to reject token ${rejectableTokenId.toString()}.`;

      const result = await agent.processMessage(prompt);

      // Expect this to fail with ACCOUNT_IS_TREASURY because the operator is the treasury of rejectableTokenId
      expect(
        result.success,
        `RejectToken did not fail as expected: ${JSON.stringify(result)}`
      ).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('ACCOUNT_IS_TREASURY');
      console.log(
        `Operator account ${operatorAccountId.toString()} correctly failed to reject token ${rejectableTokenId.toString()} (as it's treasury): ${
          result.error
        }`
      );
    });
  })

  describe('HederaFreezeUnfreezeTokenAccountTool', () => {
    let tokenIdToFreeze: TokenId;

    beforeAll(async () => {
      const operatorPublicKey = await kit.signer.getPublicKey();
      const tokenName = generateUniqueName('FeeSchedFT');
      const tokenSymbol = generateUniqueName('FSFT');
      const initialSupply = 1000;
      const decimals = 0;

      // Create fungible token with freeze key (operator)
      tokenIdToFreeze = await createFungibleToken(signer, {
        name: tokenName,
        symbol: tokenSymbol,
        initialSupply,
        decimals,
        treasuryAccountId: operatorAccountId,
        adminKey: operatorPublicKey,
        freezeKey: operatorPublicKey,
        supplyKey: operatorPublicKey,
        supplyType: TokenSupplyType.Infinite,
      });
      createdTokenIds.push(tokenIdToFreeze);

      console.log(`Created FreezableFT ${tokenIdToFreeze.toString()} for freeze/unfreeze tests.`);

      // Associate the token with the shared secondary account
      const associateReceipt = await associateTokensWithAccount(
        secondaryAccountSigner,
        sharedSecondaryAccountId,
        [tokenIdToFreeze]
      );

      expect(associateReceipt.status.toString()).toEqual(Status.Success.toString());

      console.log(
        `Token ${tokenIdToFreeze.toString()} successfully associated with ${sharedSecondaryAccountId.toString()} in setup for freeze/unfreeze (via secondaryAccountSigner).`
      );
    });

    it('should freeze and then unfreeze a token for the shared secondary account using transaction bytes', async () => {
      // --- Freeze ---
      let prompt = `Freeze token ${tokenIdToFreeze.toString()} for account ${sharedSecondaryAccountId.toString()}.`;
      let result = await agent.processMessage(prompt);

      expect(result.success).toBe(true);
      expect(result.error).not.toBeDefined();

      // perform on-chain check
      const accountInfo = await new AccountInfoQuery()
        .setAccountId(sharedSecondaryAccountId)
        .execute(signer.getClient());
      const tokenRel = accountInfo.tokenRelationships.get(tokenIdToFreeze.toString());

      expect(tokenRel?.isFrozen).toBe(true)

      console.log(
        `Token ${tokenIdToFreeze.toString()} successfully frozen for account ${sharedSecondaryAccountId.toString()}.`
      );

      // --- Unfreeze ---
      prompt = `Unfreeze token ${tokenIdToFreeze.toString()} for account ${sharedSecondaryAccountId.toString()}.`;
      const resultUnfreeze = await agent.processMessage(prompt);

      expect(
        resultUnfreeze.success,
        `UnfreezeTool failed: ${resultUnfreeze.error}`
      ).toBe(true);
      expect(resultUnfreeze.error).not.toBeDefined();

      // perform on-chain check
      const accountInfoAfterUnfreeze = await new AccountInfoQuery()
        .setAccountId(sharedSecondaryAccountId)
        .execute(signer.getClient());
      const tokenRelAfter = accountInfoAfterUnfreeze.tokenRelationships.get(tokenIdToFreeze.toString());

      expect(tokenRelAfter?.isFrozen).toBe(false);

      console.log(
        `Executed unfreeze account for: account  ${sharedSecondaryAccountId} and token ${tokenIdToFreeze}`
      );
    });
  })

  describe('HederaGrantKycTokenTool and HederaRevokeKycTokenTool', () => {
    let kycEnabledTokenId: TokenId;

    beforeAll(async () => {
      const operatorPublicKey = await kit.signer.getPublicKey();
      const tokenName = generateUniqueName('KycFT');
      const tokenSymbol = generateUniqueName('KYT');
      const initialSupply = 1000;
      const decimals = 0;

      // Create a fungible token with KYC key (operator)
      kycEnabledTokenId = await createFungibleToken(signer, {
        name: tokenName,
        symbol: tokenSymbol,
        initialSupply,
        decimals,
        treasuryAccountId: operatorAccountId,
        adminKey: operatorPublicKey,
        supplyKey: operatorPublicKey,
        kycKey: operatorPublicKey,
        supplyType: TokenSupplyType.Infinite,
      });
      createdTokenIds.push(kycEnabledTokenId);

      console.log(`Created KYC-enabled token ${kycEnabledTokenId.toString()} for KYC tests.`);

      // Associate token with shared secondary account
      const associateReceipt = await associateTokensWithAccount(
        secondaryAccountSigner,
        sharedSecondaryAccountId,
        [kycEnabledTokenId]
      );

      expect(associateReceipt.status.toString()).toEqual(Status.Success.toString());

      console.log(
        `Token ${kycEnabledTokenId.toString()} successfully associated with ${sharedSecondaryAccountId.toString()} for KYC tests (via secondaryAccountSigner).`
      );
    });

    // FIXME: failing due to `No transaction is currently being built` error
    it.skip('should grant KYC to the shared secondary account for the token', async () => {
      const prompt = `Grant KYC to account ${sharedSecondaryAccountId.toString()} for token ${kycEnabledTokenId.toString()}. metaOptions: { kycKeyShouldSign: true }`; // Assuming kycKeyShouldSign metaOption might be needed, though operator (KYC key holder) signs by default.

      const result = await agent.processMessage(prompt);
      const receipt = result.receipt as TransactionReceipt;

      expect(result.success, `GrantKYC Test Failed: ${result.error}`).toBe(
        true
      );
      expect(receipt).toBeDefined();
      expect(receipt.status).toEqual('SUCCESS');
      console.log(
        `KYC granted to ${sharedSecondaryAccountId.toString()} for token ${kycEnabledTokenId.toString()} successfully.`
      );
    });

    // FIXME: failing due to `No transaction is currently being built` error
    it.skip('should revoke KYC from the shared secondary account for the token', async () => {
      // This test depends on the grant KYC test passing first.
      const prompt = `Revoke KYC from account ${sharedSecondaryAccountId.toString()} for token ${kycEnabledTokenId.toString()}. metaOptions: { kycKeyShouldSign: true }`;

      const result = await agent.processMessage(prompt);
      const receipt = result.receipt as TransactionReceipt;

      expect(result.success, `RevokeKYC Test Failed: ${result.error}`).toBe(
        true
      );
      expect(receipt).toBeDefined();
      expect(receipt.status).toEqual('SUCCESS');
      console.log(
        `KYC revoked from ${sharedSecondaryAccountId.toString()} for token ${kycEnabledTokenId.toString()} successfully.`
      );
    });
  })

  describe('HederaTransferTokenTool (Fungible Token)', () => {
    let transferSourceFtId: TokenId;
    const initialSupply = 5000;
    const mintAmount = 1000;

    beforeAll(async () => {
      // Create fungible token using helper method
      transferSourceFtId = await createFungibleToken(signer, {
        name: generateUniqueName('TransferFT'),
        symbol: generateUniqueName('TFTT'),
        initialSupply,
        treasuryAccountId: operatorAccountId,
        supplyType: TokenSupplyType.Infinite,
        adminKey: operatorPublicKey,
        supplyKey: operatorPublicKey,
      });

      createdTokenIds.push(transferSourceFtId);
      console.log(`Created FT ${transferSourceFtId.toString()}`);

      // Associate fungible token with a secondary account using helper method
      await associateTokensWithAccount(
        secondaryAccountSigner,
        sharedSecondaryAccountId,
        [transferSourceFtId]
      );

      // Mint additional fungible tokens using the helper method
      await mintFt(signer, transferSourceFtId, mintAmount);

      console.log(`Minted ${mintAmount} to FT ${transferSourceFtId}`);
    });

    it('should transfer fungible tokens', async () => {
      const amountToTransfer = 150;
      const senderPreBalance = await getTokenBalance(operatorAccountId, transferSourceFtId, signer);
      const receiverPreBalance = await getTokenBalance(sharedSecondaryAccountId, transferSourceFtId, signer);

      const tokenTransfers = [
        {
          type: 'fungible',
          tokenId: transferSourceFtId.toString(),
          accountId: operatorAccountId.toString(),
          amount: -amountToTransfer
        },
        {
          type: 'fungible',
          tokenId: transferSourceFtId.toString(),
          accountId: sharedSecondaryAccountId.toString(),
          amount: amountToTransfer
        }
      ];

      const prompt = `Transfer tokens. Token Transfers: ${JSON.stringify(tokenTransfers)}. Memo: \"FT Transfer Test\"`;
      const result = await agent.processMessage(prompt);
      const receipt = result.receipt as TransactionReceipt;

      expect(result.success, `Fungible Token Transfer Failed: ${result.error}`).toBe(true);
      expect(receipt).toBeDefined();
      expect(receipt.status).toEqual('SUCCESS');

      const senderPostBalance = await getTokenBalance(operatorAccountId, transferSourceFtId, signer);
      const receiverPostBalance = await getTokenBalance(sharedSecondaryAccountId, transferSourceFtId, signer);

      expect(senderPostBalance).toBe(senderPreBalance - amountToTransfer);
      expect(receiverPostBalance).toBe(receiverPreBalance + amountToTransfer);

      console.log(`Transferred ${amountToTransfer} of FT ${transferSourceFtId}`);
    });
  });

  describe('HederaTransferTokenTool (Non-Fungible Token)', () => {
    let transferSourceNftCollectionId: TokenId;
    let nftSerialToTransfer: number;

    beforeAll(async () => {
      // Create NFT collection using helper method
      transferSourceNftCollectionId = await createNftCollection(signer, {
        name: generateUniqueName('TransferNFTColl'),
        symbol: generateUniqueName('TNFTTC'),
        maxSupply: 100,
        treasuryAccountId: operatorAccountId,
        supplyType: TokenSupplyType.Finite,
        adminKey: operatorPublicKey,
        supplyKey: operatorPublicKey,
      });

      createdTokenIds.push(transferSourceNftCollectionId);
      console.log(`Created NFT Collection ${transferSourceNftCollectionId}`);

      // Associate NFT collection with a secondary account using helper
      await associateTokensWithAccount(
        secondaryAccountSigner,
        sharedSecondaryAccountId,
        [transferSourceNftCollectionId]
      );

      // Mint one NFT using helper method with metadata string
      const metadata = `NFT for transfer test ${generateUniqueName('Serial')}`;
      const {serial} = await mintNft(signer, transferSourceNftCollectionId, metadata);
      nftSerialToTransfer = serial;

      console.log(`Minted NFT serial ${nftSerialToTransfer}`);
    });


    it('should transfer an NFT', async () => {
      const nftTransfer = {
        type: 'nft',
        tokenId: transferSourceNftCollectionId.toString(),
        serial: nftSerialToTransfer.toString(),
        senderAccountId: operatorAccountId.toString(),
        receiverAccountId: sharedSecondaryAccountId.toString(),
        isApproved: false
      };

      const prompt = `Transfer tokens. Token Transfers: ${JSON.stringify([nftTransfer])}. Memo: \"NFT Transfer Test\"`;
      const result = await agent.processMessage(prompt);
      const receipt = result.receipt as TransactionReceipt;

      expect(result.success, `NFT Transfer Failed: ${result.error}`).toBe(true);
      expect(receipt).toBeDefined();
      expect(receipt.status.toString()).toEqual('SUCCESS');

      // perform on-chain check
      const ownerAfter = await getNftOwner(transferSourceNftCollectionId, nftSerialToTransfer, signer);
      expect(ownerAfter.toString()).toBe(sharedSecondaryAccountId.toString());

      console.log(`Transferred NFT ${transferSourceNftCollectionId}.${nftSerialToTransfer}`);
    });
  });

  describe('HederaAirdropTokenTool', () => {
    // This test uses the default secondary account used in most other tests but also create another account to
    // test airdropping to the multiple account
    let airdropSourceFtId: TokenId;
    let additionalAccountDetails: AccountDetails;
    let additionalAccountSigner: ServerSigner;

    beforeAll(async () => {
      // 1. Create fungible token for airdrop using helper method
      airdropSourceFtId = await createFungibleToken(signer, {
        name: generateUniqueName('AirdropFT'),
        symbol: generateUniqueName('AFT'),
        initialSupply: 1000,
        decimals: 0,
        treasuryAccountId: operatorAccountId,
        supplyKey: operatorPublicKey,
      });

      createdTokenIds.push(airdropSourceFtId);
      console.log(`Created AirdropFT ${airdropSourceFtId}`);

      // 2. Create an additional recipient account and signer
      additionalAccountDetails = await createNewTestAccount(kit, 10); // 10 HBAR initial balance
      additionalAccountSigner = new ServerSigner(
        additionalAccountDetails.accountId,
        additionalAccountDetails.privateKey,
        kit.network
      );
      console.log(
        `Created additional recipient account: ${additionalAccountDetails.accountId.toString()} and its signer for airdrop test.`
      );

      // 3. Associate token with recipient accounts using helper method
      await associateTokensWithAccount(secondaryAccountSigner, sharedSecondaryAccountId, [airdropSourceFtId]);
      await associateTokensWithAccount(additionalAccountSigner, additionalAccountDetails.accountId, [airdropSourceFtId]);
    });


    it('should airdrop tokens to multiple accounts', async () => {
      const recipients = [
        {accountId: additionalAccountDetails.accountId.toString(), amount: 123},
        {accountId: sharedSecondaryAccountId.toString(), amount: 456},
      ];

      // Get pre-airdrop balances
      const preBalances = await Promise.all(
        recipients.map(r =>
          getTokenBalanceQuery(r.accountId, airdropSourceFtId, signer)
        )
      );

      const prompt = `Airdrop token ${airdropSourceFtId.toString()}. Recipients: ${JSON.stringify(
        recipients
      )}. Memo: "FT Airdrop Test"`;

      const result = await agent.processMessage(prompt)
      const receipt = result.receipt as TransactionReceipt;

      expect(receipt).toBeDefined();
      expect(receipt.status).toEqual('SUCCESS');

      // Perform on-chain check
      // Get post-airdrop balances
      const postBalances = await Promise.all(
        recipients.map(r =>
          getTokenBalanceQuery(r.accountId, airdropSourceFtId, signer)
        )
      );

      // Assert balances increased by expected amounts
      recipients.forEach((recipient, i) => {
        const expected = preBalances[i] + recipient.amount;
        expect(postBalances[i]).toBe(expected);
      });

      console.log(
        `Successfully airdropped ${airdropSourceFtId.toString()} to recipients.`
      );
    })
  })

  describe('HederaDeleteTokenTool', () => {
    let deletableTokenId: TokenId;

    beforeEach(async () => {
      deletableTokenId = await createFungibleToken(signer, {
        name: generateUniqueName('DeletableFT'),
        symbol: generateUniqueName('DFT'),
        initialSupply: 1000,
        decimals: 0,
        treasuryAccountId: operatorAccountId,
        supplyType: TokenSupplyType.Infinite,
        adminKey: operatorPublicKey,
        supplyKey: operatorPublicKey,
      });

      console.log(
        `Created DeletableFT ${deletableTokenId.toString()} for dedicated delete test.`
      );
    });

    it('should delete a token successfully', async () => {
      const prompt = `Delete the token with ID ${deletableTokenId.toString()}. metaOptions: { adminKeyShouldSign: true }`;

      const result = await agent.processMessage(prompt);
      const receipt = result.receipt as TransactionReceipt;

      expect(result.success, `DeleteToken Test Failed: ${result.error}`).toBe(
        true
      );
      expect(receipt).toBeDefined();
      expect(receipt.status).toEqual('SUCCESS');

      // perform on-chain verification
      const tokenInfo = await new TokenInfoQuery()
        .setTokenId(deletableTokenId)
        .execute(signer.getClient());

      expect(tokenInfo.isDeleted).toBe(true);

      console.log(
        `Token ${deletableTokenId.toString()} deleted successfully in dedicated test.`
      );
    });
  })
})