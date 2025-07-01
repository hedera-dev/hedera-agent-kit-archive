import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'; // Restored Vitest imports
import { HederaAgentKit } from '../../src/agent';
import { ServerSigner } from '../../src/signer/server-signer';
import {
  HederaCreateFungibleTokenTool,
  HederaDeleteTokenTool,
  HederaCreateNftTool,
  HederaMintFungibleTokenTool,
  HederaBurnFungibleTokenTool,
  HederaMintNftTool,
  HederaBurnNftTool,
  HederaPauseTokenTool,
  HederaUnpauseTokenTool,
  HederaUpdateTokenTool,
  HederaAssociateTokensTool,
  HederaDissociateTokensTool,
  HederaWipeTokenAccountTool,
  HederaTokenFeeScheduleUpdateTool,
  HederaRejectTokensTool,
  HederaFreezeTokenAccountTool,
  HederaUnfreezeTokenAccountTool,
  HederaGrantKycTokenTool,
  HederaRevokeKycTokenTool,
  HederaTransferTokensTool,
  HederaAirdropTokenTool,
} from '../../src/langchain/tools/hts';
// import { initializeTestKit, generateUniqueName, createTestAgentExecutor, delay } from './utils'; // Temporarily commented out
import {
  TokenId,
  AccountId,
  PrivateKey as SDKPrivateKey,
  PublicKey as SDKPublicKey,
  AccountCreateTransaction,
  Hbar as SDKHbar,
  Transaction,
  TokenAssociateTransaction,
  TokenDissociateTransaction,
  Status,
  TokenFreezeTransaction,
  TokenUnfreezeTransaction,
} from '@hashgraph/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { StructuredTool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Buffer } from 'buffer'; // Buffer was missing from original inlined utils, but needed for NFT metadata

// Ensure environment variables are loaded for the test file itself
dotenv.config({ path: path.resolve(__dirname, '../../../.env.test') });

const TOKEN_ID_REGEX = new RegExp('^0\\.0\\.\\d+$');

// --- INLINED UTILS ---
/**
 * Initializes HederaAgentKit with a ServerSigner for testing.
 */
async function initializeTestKit(): Promise<HederaAgentKit> {
  // Use the correct environment variable names as specified by the user
  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  const openAIApiKey = process.env.OPENAI_API_KEY;
  // HEDERA_KEY_TYPE is logged in setup-env.ts but not directly used in ServerSigner constructor here.
  // ServerSigner infers key type or expects a specific format.

  if (!accountId || !privateKey)
    throw new Error(
      'Hedera account ID or private key missing from environment variables.'
    );
  if (!openAIApiKey)
    throw new Error('OpenAI API key missing from environment variables.');

  const signer = await ServerSigner.create(accountId, privateKey, 'testnet');
  const kit = new HederaAgentKit(signer, { appConfig: { openAIApiKey } });
  await kit.initialize();
  return kit;
}

function generateUniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 7)}`;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simplify the prompt template for createOpenAIToolsAgent
// const AGENT_PROMPT_TEMPLATE_INLINED = `... complex template ...`; // Keep old one commented for reference if needed

async function createTestAgentExecutor(
  tool: StructuredTool,
  openAIApiKey: string
): Promise<AgentExecutor> {
  const tools = [tool]; // This is the array of actual tool instances
  const llm = new ChatOpenAI({
    apiKey: openAIApiKey,
    modelName: 'gpt-4o-mini',
    temperature: 0,
  });

  // Standard prompt structure for OpenAIToolsAgent
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      'You are a helpful assistant that can use tools to perform actions on the Hedera network. When a user asks you to do something that requires a tool, call the appropriate tool with the correct parameters. Respond directly to the user otherwise.',
    ],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}'],
  ]);

  const agent = await createOpenAIToolsAgent({
    llm,
    tools, // The agent needs the actual tool objects
    prompt,
  });

  return new AgentExecutor({
    agent,
    tools, // Executor also needs the tools
    verbose: process.env.VERBOSE_AGENT_LOGGING === 'true',
    returnIntermediateSteps: true, // Ensure intermediate steps are returned
  });
}

async function createNewTestAccount(
  kit: HederaAgentKit,
  initialBalanceHbar: number
): Promise<{
  accountId: AccountId;
  privateKey: SDKPrivateKey;
  publicKey: SDKPublicKey;
}> {
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
  const frozenTx = await transaction.freezeWith(kit.client);
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
  };
}

// --- END INLINED UTILS ---

// Helper to extract tool output from AgentExecutor result
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getToolOutputFromResult(agentResult: any): any {
  console.log('Full agentResult:', JSON.stringify(agentResult, null, 2)); // Log the whole thing

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let toolOutputData: any;

  if (
    agentResult.intermediateSteps &&
    agentResult.intermediateSteps.length > 0
  ) {
    const lastStep =
      agentResult.intermediateSteps[agentResult.intermediateSteps.length - 1];
    const observation = lastStep.observation;
    console.log(
      'Last intermediate step action:',
      JSON.stringify(lastStep.action, null, 2)
    ); // Log the action part
    console.log(
      'Attempting to use this observation from last intermediate step:',
      observation
    ); // Log the observation it's about to use

    if (typeof observation === 'string') {
      try {
        toolOutputData = JSON.parse(observation);
      } catch (error: unknown) {
        console.error(
          'Failed to parse observation string from intermediateStep. String was:',
          observation,
          'Error:',
          error
        );
        throw new Error(
          `Failed to parse observation string from intermediateStep. String was: "${observation}". Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } else if (typeof observation === 'object' && observation !== null) {
      toolOutputData = observation;
      console.log(
        'Observation from intermediateStep was already an object, using directly:',
        toolOutputData
      );
    } else {
      console.warn(
        'Observation in last intermediate step was not a string or a recognized object. Full step:',
        lastStep
      );
      // Fall through to try agentResult.output if intermediate observation is not usable
    }
  }

  if (!toolOutputData) {
    // If intermediate steps didn't yield data OR observation was not usable
    console.warn(
      'Could not find usable tool output in intermediateSteps or observation was not directly usable. Attempting to parse agentResult.output. Full agent result:',
      agentResult // agentResult.output is already part of this log
    );
    if (typeof agentResult.output === 'string') {
      console.log(
        'Attempting to parse agentResult.output as fallback:',
        agentResult.output
      );
      try {
        toolOutputData = JSON.parse(agentResult.output);
        console.warn(
          'Parsed agentResult.output as a fallback. This might be unstable if it was natural language.'
        );
      } catch (error: unknown) {
        throw new Error(
          `No usable intermediate step observation, and agentResult.output was not valid JSON. Output: "${agentResult.output}". Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } else {
      throw new Error(
        'No usable intermediate step observation, and agentResult.output is not a string.'
      );
    }
  }
  return toolOutputData;
}

describe('Hedera HTS Tools Integration Tests', () => {
  let kit: HederaAgentKit;
  let createdTokenIds: TokenId[] = [];
  let treasuryAccountId: AccountId;
  let openAIApiKey: string;
  let sharedSecondaryAccountId: AccountId; // For reusable secondary account
  let sharedSecondaryAccountPrivateKey: SDKPrivateKey; // Its private key
  let secondaryAccountSigner: ServerSigner; // << NEW: Signer for the shared secondary account

  beforeAll(async () => {
    kit = await initializeTestKit();
    treasuryAccountId = kit.signer.getAccountId();
    openAIApiKey = process.env.OPENAI_API_KEY as string;
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables.');
    }
    // Create one shared secondary account for all tests in this file that need it
    try {
      const accountDetails = await createNewTestAccount(kit, 50); // Create with 50 HBAR
      sharedSecondaryAccountId = accountDetails.accountId;
      sharedSecondaryAccountPrivateKey = accountDetails.privateKey;
      // Create a ServerSigner for this new account
      secondaryAccountSigner = await ServerSigner.create(
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
    if (kit && createdTokenIds.length > 0) {
      console.log(
        `Attempting to clean up ${createdTokenIds.length} created token(s)...`
      );
      const deleteTool = new HederaDeleteTokenTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(
        deleteTool,
        openAIApiKey
      );

      for (const tokenId of createdTokenIds) {
        try {
          const prompt = `Delete the token with ID ${tokenId.toString()}. metaOptions: { deleteAdminKeyShouldSign: true }`;
          console.log(`Cleaning up token: ${tokenId.toString()}`);
          const agentResult = await agentExecutor.invoke({ input: prompt });
          const result = getToolOutputFromResult(agentResult);

          if (!result.success) {
            // Explicitly log if not successful BEFORE expect
            console.error(
              `Cleanup FAILED (result.success is false) for ${tokenId.toString()}: Detailed error: ${JSON.stringify(
                result.error || result
              )}`
            );
          }

          expect(
            result.success,
            `Cleanup Failed for ${tokenId.toString()}: ${JSON.stringify(
              result.error || result
            )}` // stringify error
          ).toBe(true);
          expect(result.receipt).toBeDefined();
          if (result.receipt) {
            expect(result.receipt.status).toEqual('SUCCESS');
            console.log(`Successfully cleaned up token ${tokenId.toString()}`);
          } else {
            // This case should ideally not be hit if success is true and receipt is expected
            console.warn(
              `Receipt not found for deletion of token ${tokenId.toString()} despite success.`
            );
          }
        } catch (error: unknown) {
          console.error(
            `Failed to clean up token ${tokenId.toString()}:`,
            error
          );
        }
      }
    }
  });

  describe('HederaCreateFungibleTokenTool', () => {
    it('should create a new fungible token with basic parameters (adminKey as current_signer)', async () => {
      const tool = new HederaCreateFungibleTokenTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);
      const tokenName = generateUniqueName('TestFTCS');
      const tokenSymbol = generateUniqueName('TFCS');

      // Updated Prompt for Test 1
      const prompt = `Create a new fungible token. Name: "${tokenName}", Symbol: "${tokenSymbol}", Initial Supply: 100000 (smallest units), Decimals: 2, Treasury Account: ${treasuryAccountId.toString()}, Supply Type: FINITE, Max Supply: 1000000 (smallest units). For the adminKey parameter, use the exact string value "current_signer". metaOptions: { adminKeyShouldSign: true }`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(
        result.success,
        `Test 1 Failed: Agent/Tool Error: ${result.error}`
      ).toBe(true);
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      expect(result.receipt.tokenId?.toString()).toMatch(
        TOKEN_ID_REGEX
      );

      if (result.receipt.tokenId) {
        const newId = result.receipt.tokenId;
        createdTokenIds.push(newId);
        console.log(`Created token ${newId.toString()} in test 1.`);
      }
    });

    it('should create a new fungible token with an admin key provided as operator public key', async () => {
      const tool = new HederaCreateFungibleTokenTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);
      const tokenName = generateUniqueName('TestAdminFT');
      const tokenSymbol = generateUniqueName('TAFT');
      const operatorPubKeyDer = (await kit.signer.getPublicKey()).toStringDer();

      // Updated Prompt for Test 2 - remove adminKeyShouldSign from metaOptions for now
      const prompt = `Create a new fungible token. Name: "${tokenName}", Symbol: "${tokenSymbol}", Initial Supply: 50000, Decimals: 0, Treasury Account: ${treasuryAccountId.toString()}, Admin Key: "${operatorPubKeyDer}", Supply Type: FINITE, Max Supply: 500000.`; // Removed metaOptions for this test

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(
        result.success,
        `Test 2 Failed: Agent/Tool Error: ${result.error}`
      ).toBe(true);
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      expect(result.receipt.tokenId?.toString()).toMatch(
        TOKEN_ID_REGEX
      );
      if (result.receipt.tokenId) {
        const newId = result.receipt.tokenId;
        createdTokenIds.push(newId);
        console.log(
          `Created token ${newId.toString()} with admin key in test 2.`
        );
      }
    });
  });

  describe('HederaCreateNftTool', () => {
    it('should create a new NFT collection with basic parameters (adminKey as current_signer)', async () => {
      const tool = new HederaCreateNftTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);
      const tokenName = generateUniqueName('TestNFTCollection');
      const tokenSymbol = generateUniqueName('TNFTC');

      const prompt = `Create a new NFT collection. Name: "${tokenName}", Symbol: "${tokenSymbol}", Treasury Account: ${treasuryAccountId.toString()}, Supply Type: FINITE, Max Supply: 100. For the adminKey, use the exact string value "current_signer". metaOptions: { adminKeyShouldSign: true }`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(
        result.success,
        `NFT Creation Test Failed: Agent/Tool Error: ${result.error}`
      ).toBe(true);
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      expect(result.receipt.tokenId?.toString()).toMatch(
        TOKEN_ID_REGEX
      );

      if (result.receipt.tokenId) {
        const newId = result.receipt.tokenId;
        createdTokenIds.push(newId); // Add to cleanup queue
        console.log(`Created NFT Collection ${newId.toString()} in test.`);
      }
    });
  });

  describe('HederaMintFungibleTokenTool', () => {
    let mintableFtId: TokenId;

    beforeAll(async () => {
      // Create a specific FT with a supply key for minting tests
      const createTool = new HederaCreateFungibleTokenTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(
        createTool,
        openAIApiKey
      );
      const tokenName = generateUniqueName('MintableFT');
      const tokenSymbol = generateUniqueName('MFT');

      const createPrompt = `Create a new fungible token. Name: "${tokenName}", Symbol: "${tokenSymbol}", Initial Supply: 100, Decimals: 0, Treasury Account: ${treasuryAccountId.toString()}, Supply Type: FINITE, Max Supply: 10000. For the adminKey, use "current_signer". For the supplyKey, also use "current_signer". metaOptions: { adminKeyShouldSign: true }`;

      const agentResult = await agentExecutor.invoke({ input: createPrompt });
      const result = getToolOutputFromResult(agentResult);
      expect(
        result.success,
        `Setup for MintFungibleToken failed: ${result.error}`
      ).toBe(true);
      expect(
        result.receipt?.tokenId,
        'Mintable FT setup failed to return tokenId'
      ).toBeDefined();
      mintableFtId = result.receipt.tokenId!;
      createdTokenIds.push(mintableFtId); // Ensure it gets cleaned up
      console.log(
        `Created MintableFT ${mintableFtId.toString()} for minting tests.`
      );
    });

    it('should mint more fungible tokens', async () => {
      const tool = new HederaMintFungibleTokenTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);
      const amountToMint = 500;

      const prompt = `Mint ${amountToMint} units of token ${mintableFtId.toString()}. metaOptions: { supplyKeyShouldSign: true }`; // Assuming supplyKeyShouldSign might be needed

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(
        result.success,
        `MintFungibleToken Test Failed: ${result.error}`
      ).toBe(true);
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      // Mint transaction receipt has `totalSupply`
      expect(result.receipt.totalSupply).toBeDefined();
      // Initial was 100, minted 500, so new total should be 600 (if totalSupply reflects this post-mint)
      // Note: The actual total supply might need to be queried post-mint to confirm for sure.
      // For now, we check that the transaction succeeded.
      // We could also check `result.output?.newTotalSupply` if the tool were to return it.
      console.log(
        `Minted ${amountToMint} to ${mintableFtId.toString()}. New total supply from receipt: ${result.receipt.totalSupply?.toString()}`
      );
    });
  });

  describe('HederaBurnFungibleTokenTool', () => {
    let burnableFtId: TokenId;
    const initialSupplyForBurn = 2000;
    const amountToBurn = 500;

    beforeAll(async () => {
      const createTool = new HederaCreateFungibleTokenTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(
        createTool,
        openAIApiKey
      );
      const tokenName = generateUniqueName('BurnableFT');
      const tokenSymbol = generateUniqueName('BFT');

      // Ensure it has admin, supply, and wipe keys for full testing later if needed
      const createPrompt = `Create a new fungible token. Name: "${tokenName}", Symbol: "${tokenSymbol}", Initial Supply: ${initialSupplyForBurn}, Decimals: 0, Treasury Account: ${treasuryAccountId.toString()}, Supply Type: FINITE, Max Supply: 10000. For the adminKey, use "current_signer". For the supplyKey, use "current_signer". For the wipeKey, also use "current_signer". metaOptions: { adminKeyShouldSign: true }`;

      const agentResult = await agentExecutor.invoke({ input: createPrompt });
      const result = getToolOutputFromResult(agentResult);
      expect(
        result.success,
        `Setup for BurnFungibleToken failed: ${result.error}`
      ).toBe(true);
      expect(
        result.receipt?.tokenId,
        'Burnable FT setup failed to return tokenId'
      ).toBeDefined();
      burnableFtId = result.receipt.tokenId!;
      createdTokenIds.push(burnableFtId);
      console.log(
        `Created BurnableFT ${burnableFtId.toString()} with initial supply ${initialSupplyForBurn} for burning tests.`
      );
    });

    it('should burn fungible tokens from the treasury', async () => {
      const tool = new HederaBurnFungibleTokenTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);

      // The burn transaction is signed by the Treasury account by default if no wipe key is involved from another account.
      // If a wipeKey is set on the token (as we did), the burn operation from treasury also needs the supply key's signature.
      // Our current setup: treasury is operator, supplyKey is operator. So operator signature is sufficient.
      const prompt = `Burn ${amountToBurn} units of token ${burnableFtId.toString()}. metaOptions: { supplyKeyShouldSign: true }`; // supplyKeyShouldSign for good measure

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(
        result.success,
        `BurnFungibleToken Test Failed: ${result.error}`
      ).toBe(true);
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      expect(result.receipt.totalSupply).toBeDefined();
      const expectedNewSupply = initialSupplyForBurn - amountToBurn;
      expect(parseInt(result.receipt.totalSupply as string, 10)).toEqual(
        expectedNewSupply
      );
      console.log(
        `Burned ${amountToBurn} from ${burnableFtId.toString()}. New total supply from receipt: ${
          result.receipt.totalSupply
        }`
      );
    });
  });

  describe('HederaMintNftTool', () => {
    let nftCollectionId: TokenId;

    beforeAll(async () => {
      // Create a specific NFT collection with a supply key for minting tests
      const createTool = new HederaCreateNftTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(
        createTool,
        openAIApiKey
      );
      const tokenName = generateUniqueName('MintTestNFT');
      const tokenSymbol = generateUniqueName('MTNFT');

      const createPrompt = `Create a new NFT collection. Name: "${tokenName}", Symbol: "${tokenSymbol}", Treasury Account: ${treasuryAccountId.toString()}, Supply Type: FINITE, Max Supply: 100. For the adminKey, use "current_signer". For the supplyKey, also use "current_signer". metaOptions: { adminKeyShouldSign: true }`;

      const agentResult = await agentExecutor.invoke({ input: createPrompt });
      const result = getToolOutputFromResult(agentResult);
      expect(result.success, `Setup for MintNFT failed: ${result.error}`).toBe(
        true
      );
      expect(
        result.receipt?.tokenId,
        'NFT Collection setup for MintNFT failed to return tokenId'
      ).toBeDefined();
      nftCollectionId = result.receipt.tokenId!;
      createdTokenIds.push(nftCollectionId);
      console.log(
        `Created NFT Collection ${nftCollectionId.toString()} for minting tests.`
      );
    });

    it('should mint a new NFT into the collection', async () => {
      const tool = new HederaMintNftTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);
      const metadata = Buffer.from(
        `NFT metadata for ${generateUniqueName('Serial')}`
      ).toString('base64'); // Base64 encoded string

      const prompt = `Mint a new NFT into collection ${nftCollectionId.toString()} with metadata "${metadata}". metaOptions: { supplyKeyShouldSign: true }`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(result.success, `MintNFT Test Failed: ${result.error}`).toBe(true);
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      expect(result.receipt.serials).toBeDefined();
      expect(result.receipt.serials.length).toBeGreaterThan(0);
      // Serials in the parsed JSON from receipt will likely be numbers or strings.
      const newSerialValue = result.receipt.serials[0];
      const newSerial =
        typeof newSerialValue === 'string'
          ? parseInt(newSerialValue, 10)
          : (newSerialValue as number);
      expect(typeof newSerial).toBe('number'); // Add an assertion for the type
      console.log(
        `Minted NFT serial ${newSerial} into collection ${nftCollectionId.toString()}.`
      );
      // We could potentially add this serial to a list for later burning if needed for a burn test
    });
  });

  describe('HederaBurnNftTool', () => {
    let burnableNftCollectionId: TokenId;
    let mintedSerial: number;

    beforeAll(async () => {
      // 1. Create an NFT collection with admin, supply, and wipe keys
      const createTool = new HederaCreateNftTool({ hederaKit: kit });
      let agentExecutor = await createTestAgentExecutor(
        createTool,
        openAIApiKey
      );
      const collectionName = generateUniqueName('BurnTestNFT');
      const collectionSymbol = generateUniqueName('BTNFT');

      const createPrompt = `Create a new NFT collection. Name: "${collectionName}", Symbol: "${collectionSymbol}", Treasury Account: ${treasuryAccountId.toString()}, Supply Type: FINITE, Max Supply: 10. For the adminKey, supplyKey, and wipeKey, use the exact string value "current_signer". metaOptions: { adminKeyShouldSign: true }`;

      let agentResult = await agentExecutor.invoke({ input: createPrompt });
      let result = getToolOutputFromResult(agentResult);
      // It's possible the agent needs a supplyKey for NFT creation to succeed directly.
      // The agent might self-correct, or this initial creation might fail if supplyKey isn't prompted for.
      // The previous successful run showed the agent self-corrects by adding supplyKey if the first attempt fails.
      // We rely on that behavior here for the setup.
      if (
        !result.success &&
        result.error?.includes('TOKEN_HAS_NO_SUPPLY_KEY')
      ) {
        // This was the agent's first attempt; it should retry with supplyKey.
        // The actual successful result would be in the last intermediate step of that *overall* successful agentResult.
        // However, for simplicity in setup, we assume the agentExecutor.invoke will eventually lead to success if possible.
        console.warn(
          'Initial NFT collection creation attempt failed due to no supply key, relying on agent self-correction.'
        );
        // The `getToolOutputFromResult` already gets the last intermediate step if available.
        // If it still reflects the error, the setup fails.
      }
      expect(
        result.success,
        `Setup (Create NFT Collection for Burn Test) failed: ${result.error}`
      ).toBe(true);
      expect(
        result.receipt?.tokenId,
        'NFT Collection setup for Burn Test failed to return tokenId'
      ).toBeDefined();
      burnableNftCollectionId = result.receipt.tokenId!;
      createdTokenIds.push(burnableNftCollectionId);
      console.log(
        `Created NFT Collection ${burnableNftCollectionId.toString()} for burn tests.`
      );

      // 2. Mint an NFT into this collection
      const mintTool = new HederaMintNftTool({ hederaKit: kit });
      agentExecutor = await createTestAgentExecutor(mintTool, openAIApiKey);
      const metadata = Buffer.from(
        `NFT to burn ${generateUniqueName('Serial')}`
      ).toString('base64');
      const mintPrompt = `Mint a new NFT into collection ${burnableNftCollectionId.toString()} with metadata "${metadata}". metaOptions: { supplyKeyShouldSign: true }`;

      agentResult = await agentExecutor.invoke({ input: mintPrompt });
      result = getToolOutputFromResult(agentResult);
      expect(
        result.success,
        `Setup (Mint NFT for Burn Test) failed: ${result.error}`
      ).toBe(true);
      expect(result.receipt?.serials).toBeDefined();
      expect(result.receipt.serials.length).toBeGreaterThan(0);
      const newSerialValue = result.receipt.serials[0];
      mintedSerial =
        typeof newSerialValue === 'string'
          ? parseInt(newSerialValue, 10)
          : (newSerialValue as number);
      console.log(
        `Minted NFT serial ${mintedSerial} into ${burnableNftCollectionId.toString()} for burn test.`
      );
    });

    it('should burn a specific NFT serial from the collection', async () => {
      const tool = new HederaBurnNftTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);
      const prompt = `Burn NFT serial ${mintedSerial} of token ${burnableNftCollectionId.toString()}. metaOptions: { wipeKeyShouldSign: true }`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(result.success, `BurnNFT Test Failed: ${result.error}`).toBe(true);
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      expect(result.receipt.totalSupply).toBeDefined();
      expect(parseInt(result.receipt.totalSupply as string, 10)).toEqual(0);
      console.log(
        `Burned NFT serial ${mintedSerial} from ${burnableNftCollectionId.toString()}. New total supply from receipt: ${
          result.receipt.totalSupply
        }`
      );
    });
  });

  describe('HederaPauseUnpauseTokenTool', () => {
    let pausableTokenId: TokenId;

    beforeAll(async () => {
      const createTool = new HederaCreateFungibleTokenTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(
        createTool,
        openAIApiKey
      );
      const tokenName = generateUniqueName('PausableFT');
      const tokenSymbol = generateUniqueName('PFT');

      const createPrompt = `Create a new fungible token. Name: "${tokenName}", Symbol: "${tokenSymbol}", Initial Supply: 1000, Decimals: 0, Treasury Account: ${treasuryAccountId.toString()}. For the adminKey and pauseKey, use "current_signer". metaOptions: { adminKeyShouldSign: true }`;

      const agentResult = await agentExecutor.invoke({ input: createPrompt });
      const result = getToolOutputFromResult(agentResult);
      expect(
        result.success,
        `Setup for PauseUnpause failed: ${result.error}`
      ).toBe(true);
      expect(
        result.receipt?.tokenId,
        'Pausable FT setup failed to return tokenId'
      ).toBeDefined();
      pausableTokenId = result.receipt.tokenId!;
      createdTokenIds.push(pausableTokenId);
      console.log(
        `Created PausableFT ${pausableTokenId.toString()} for pause/unpause tests.`
      );
    });

    it('should pause a token and then unpause it', async () => {
      // Pause the token
      const pauseTool = new HederaPauseTokenTool({ hederaKit: kit });
      let agentExecutor = await createTestAgentExecutor(
        pauseTool,
        openAIApiKey
      );
      let prompt = `Pause token ${pausableTokenId.toString()}. metaOptions: { pauseKeyShouldSign: true }`; // pauseKeyShouldSign if we had such metaOption

      let agentResult = await agentExecutor.invoke({ input: prompt });
      let result = getToolOutputFromResult(agentResult);
      expect(result.success, `Pause Token Test Failed: ${result.error}`).toBe(
        true
      );
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      console.log(`Token ${pausableTokenId.toString()} paused successfully.`);

      // TODO: Optionally, verify token is paused using a query (e.g., GetTokenInfo)
      // For now, we rely on the transaction success.

      // Unpause the token
      const unpauseTool = new HederaUnpauseTokenTool({ hederaKit: kit });
      agentExecutor = await createTestAgentExecutor(unpauseTool, openAIApiKey);
      prompt = `Unpause token ${pausableTokenId.toString()}. metaOptions: { pauseKeyShouldSign: true }`;

      agentResult = await agentExecutor.invoke({ input: prompt });
      result = getToolOutputFromResult(agentResult);
      expect(result.success, `Unpause Token Test Failed: ${result.error}`).toBe(
        true
      );
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      console.log(`Token ${pausableTokenId.toString()} unpaused successfully.`);

      // TODO: Optionally, verify token is unpaused.
    });
  });

  // --- HederaUpdateTokenTool Tests ---
  describe('HederaUpdateTokenTool', () => {
    let updateableTokenId: TokenId;
    const originalTokenName = generateUniqueName('UpdatableToken');
    const originalTokenSymbol = generateUniqueName('UTK');

    beforeAll(async () => {
      const createTool = new HederaCreateFungibleTokenTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(
        createTool,
        openAIApiKey
      );

      const createPrompt = `Create a new fungible token. Name: "${originalTokenName}", Symbol: "${originalTokenSymbol}", Initial Supply: 100, Decimals: 0, Treasury Account: ${treasuryAccountId.toString()}. For the adminKey, use "current_signer". metaOptions: { adminKeyShouldSign: true }`;

      const agentResult = await agentExecutor.invoke({ input: createPrompt });
      const result = getToolOutputFromResult(agentResult);
      expect(
        result.success,
        `Setup for UpdateToken failed: ${result.error}`
      ).toBe(true);
      expect(
        result.receipt?.tokenId,
        'Updatable FT setup failed to return tokenId'
      ).toBeDefined();
      updateableTokenId = result.receipt.tokenId!;
      createdTokenIds.push(updateableTokenId);
      console.log(
        `Created UpdatableToken ${updateableTokenId.toString()} for update tests.`
      );
    });

    it("should update the token's name and symbol", async () => {
      const tool = new HederaUpdateTokenTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);
      const newTokenName = generateUniqueName('UpdatedTokenName');
      const newTokenSymbol = generateUniqueName('UTKS');

      const prompt = `Update token ${updateableTokenId.toString()}. Set its name to "${newTokenName}" and its symbol to "${newTokenSymbol}". metaOptions: { adminKeyShouldSign: true }`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(result.success, `UpdateToken Test Failed: ${result.error}`).toBe(
        true
      );
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      console.log(
        `Token ${updateableTokenId.toString()} updated successfully.`
      );
      // TODO: Optionally, query token info to verify new name and symbol.
    });
  });

  describe('HederaAssociateTokensTool', () => {
    let associatableTokenId: TokenId;

    beforeAll(async () => {
      // Token created by operator, secondary account will associate itself in the test.
      const createTokenTool = new HederaCreateFungibleTokenTool({
        hederaKit: kit,
      });
      const agentExecutor = await createTestAgentExecutor(
        createTokenTool,
        openAIApiKey
      );
      const tokenName = generateUniqueName('AssociatableFT');
      const tokenSymbol = generateUniqueName('AFT');
      const operatorPublicKeyDer = (
        await kit.signer.getPublicKey()
      ).toStringDer();
      const supplyAmount = 100;
      const createTokenPrompt = `Create a new fungible token. Name: "${tokenName}", Symbol: "${tokenSymbol}", Initial Supply: ${supplyAmount}, Decimals: 0, Treasury Account: ${treasuryAccountId.toString()}, Supply Type: FINITE, Max Supply: ${supplyAmount}, Admin Key: "${operatorPublicKeyDer}".`;

      const agentResultTokenCreate = await agentExecutor.invoke({
        input: createTokenPrompt,
      });
      const resultTokenCreate = getToolOutputFromResult(agentResultTokenCreate);
      expect(
        resultTokenCreate.success,
        `Setup for AssociateToken failed (token creation): ${
          resultTokenCreate.error
        } - Input: ${JSON.stringify(
          agentResultTokenCreate.intermediateSteps?.[0]?.action.toolInput
        )}`
      ).toBe(true);
      associatableTokenId = resultTokenCreate.receipt!.tokenId!;
      createdTokenIds.push(associatableTokenId);
      console.log(
        `Created AssociatableFT ${associatableTokenId.toString()} for association tests.`
      );
    });

    it('should prepare transaction bytes for association, then allow secondary account to sign and execute', async () => {
      const tool = new HederaAssociateTokensTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);

      const prompt = `Prepare a transaction for account ${sharedSecondaryAccountId.toString()} to associate with token ${associatableTokenId.toString()}. Return the transaction bytes. metaOptions: { getBytes: true }`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(
        result.success,
        `Tool failed to get transaction bytes for association: ${result.error}`
      ).toBe(true);
      expect(result.type).toEqual('bytes');
      expect(result.output).toBeDefined();
      const transactionBytesBase64 = result.output as string;
      console.log(
        'HederaAssociateTokensTool returned transaction bytes for association.'
      );

      // sharedSecondaryAccount loads, signs, and executes the association using its own signer
      const transactionBytes = Buffer.from(transactionBytesBase64, 'base64');
      // IMPORTANT: Freeze the transaction with the intended signer's client *before* signing with its key.
      const associateTx = (
        Transaction.fromBytes(transactionBytes) as TokenAssociateTransaction
      ).freezeWith(secondaryAccountSigner.getClient()); // Freeze with secondary signer's client

      const signedBySecondaryAccountTx = await associateTx.sign(
        sharedSecondaryAccountPrivateKey
      );

      console.log(
        `Executing association TX via secondaryAccountSigner for account ${sharedSecondaryAccountId} and token ${associatableTokenId}`
      );
      const execResult = await secondaryAccountSigner.signAndExecuteTransaction(
        signedBySecondaryAccountTx
      ); // Pass the already signed tx

      expect(execResult.status.toString()).toEqual(Status.Success.toString());
      console.log(
        `Token ${associatableTokenId.toString()} successfully associated with ${sharedSecondaryAccountId.toString()} via its own signer.`
      );
    });
  });

  describe('HederaDissociateTokensTool', () => {
    let dissociatableTokenIdForThisSuite: TokenId;

    beforeAll(async () => {
      // 1. Create a token
      const createTokenTool = new HederaCreateFungibleTokenTool({
        hederaKit: kit,
      });
      const agentExecutorToken = await createTestAgentExecutor(
        createTokenTool,
        openAIApiKey
      );
      const tokenName = generateUniqueName('DissociateTargetFT');
      const tokenSymbol = generateUniqueName('DTFT');
      const operatorPublicKeyDer = (
        await kit.signer.getPublicKey()
      ).toStringDer();
      const createTokenPrompt = `Create a new fungible token. Name: "${tokenName}", Symbol: "${tokenSymbol}", Initial Supply: 100, Decimals: 0, Treasury Account: ${treasuryAccountId.toString()}, Supply Type: FINITE, Max Supply: 100, Admin Key: "${operatorPublicKeyDer}".`;

      const agentResultTokenCreate = await agentExecutorToken.invoke({
        input: createTokenPrompt,
      });
      const resultTokenCreate = getToolOutputFromResult(agentResultTokenCreate);
      expect(
        resultTokenCreate.success,
        `Setup for DissociateToken failed (token creation): ${resultTokenCreate.error}`
      ).toBe(true);
      dissociatableTokenIdForThisSuite = resultTokenCreate.receipt!.tokenId!;
      createdTokenIds.push(dissociatableTokenIdForThisSuite);
      console.log(
        `Created DissociateTargetFT ${dissociatableTokenIdForThisSuite.toString()} for dissociate tests.`
      );

      // 2. Associate this token with the SHARED secondary account using its own signer
      console.log(
        `Associating token ${dissociatableTokenIdForThisSuite} with SHARED account ${sharedSecondaryAccountId} for dissociation test setup (using secondaryAccountSigner).`
      );
      const associateTx = new TokenAssociateTransaction()
        .setAccountId(sharedSecondaryAccountId)
        .setTokenIds([dissociatableTokenIdForThisSuite]);

      const associateReceipt =
        await secondaryAccountSigner.signAndExecuteTransaction(associateTx);

      expect(associateReceipt.status.toString()).toEqual(
        Status.Success.toString()
      );
      console.log(
        `Token ${dissociatableTokenIdForThisSuite.toString()} successfully associated with ${sharedSecondaryAccountId.toString()} in setup (via secondaryAccountSigner).`
      );
    });

    it('should prepare transaction bytes for dissociation, then allow secondary account to sign and execute', async () => {
      const tool = new HederaDissociateTokensTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);

      const prompt = `Prepare a transaction for account ${sharedSecondaryAccountId.toString()} to dissociate from token ${dissociatableTokenIdForThisSuite.toString()}. Return the transaction bytes. metaOptions: { getBytes: true }`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(
        result.success,
        `Tool failed to get transaction bytes for dissociation: ${result.error}`
      ).toBe(true);
      expect(result.type).toEqual('bytes');
      expect(result.output).toBeDefined();
      const transactionBytesBase64 = result.output as string;
      console.log(
        'HederaDissociateTokensTool returned transaction bytes for dissociation.'
      );

      // sharedSecondaryAccount loads, signs, and executes the dissociation using its own signer
      const transactionBytes = Buffer.from(transactionBytesBase64, 'base64');
      const dissociateTx = (
        TokenDissociateTransaction.fromBytes(
          transactionBytes
        ) as TokenDissociateTransaction
      ).freezeWith(secondaryAccountSigner.getClient()); // Freeze with secondary signer's client

      const signedBySecondaryAccountTx = await dissociateTx.sign(
        sharedSecondaryAccountPrivateKey
      );

      console.log(
        `Executing dissociation TX via secondaryAccountSigner for account ${sharedSecondaryAccountId} and token ${dissociatableTokenIdForThisSuite}`
      );
      const execResult = await secondaryAccountSigner.signAndExecuteTransaction(
        signedBySecondaryAccountTx
      );

      expect(execResult.status.toString()).toEqual(Status.Success.toString());
      console.log(
        `Token ${dissociatableTokenIdForThisSuite.toString()} successfully dissociated from account ${sharedSecondaryAccountId.toString()} via its own signer.`
      );
    });
  });

  describe('HederaWipeTokenAccountTool', () => {
    let wipeableFtId: TokenId;
    const initialSupplyForWipe = 3000;
    const amountToWipe = 700;

    beforeAll(async () => {
      const createTool = new HederaCreateFungibleTokenTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(
        createTool,
        openAIApiKey
      );
      const tokenName = generateUniqueName('WipeableFT');
      const tokenSymbol = generateUniqueName('WFT');
      const operatorPublicKeyDer = (
        await kit.signer.getPublicKey()
      ).toStringDer();

      // Token needs admin, supply, and wipe keys
      const createPrompt = `Create a new fungible token. Name: "${tokenName}", Symbol: "${tokenSymbol}", Initial Supply: ${initialSupplyForWipe}, Decimals: 0, Treasury Account: ${treasuryAccountId.toString()}, Supply Type: FINITE, Max Supply: ${
        initialSupplyForWipe + 10000
      }, Admin Key: "${operatorPublicKeyDer}", Supply Key: "${operatorPublicKeyDer}", Wipe Key: "${operatorPublicKeyDer}".`;

      const agentResult = await agentExecutor.invoke({ input: createPrompt });
      const result = getToolOutputFromResult(agentResult);
      expect(
        result.success,
        `Setup for WipeToken failed (token creation): ${
          result.error
        } - Input: ${JSON.stringify(
          agentResult.intermediateSteps?.[0]?.action.toolInput
        )}`
      ).toBe(true);
      expect(
        result.receipt?.tokenId,
        'Wipeable FT setup failed to return tokenId'
      ).toBeDefined();
      wipeableFtId = result.receipt.tokenId!;
      createdTokenIds.push(wipeableFtId);
      console.log(
        `Created WipeableFT ${wipeableFtId.toString()} with initial supply ${initialSupplyForWipe} for wipe tests.`
      );
    });

    it('should fail to wipe fungible tokens from the treasury account', async () => {
      const tool = new HederaWipeTokenAccountTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);

      const prompt = `Wipe ${amountToWipe} units of token ${wipeableFtId.toString()} from account ${treasuryAccountId.toString()}. metaOptions: { wipeKeyShouldSign: true }`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(
        result.success,
        `WipeToken did not fail as expected when wiping treasury: ${JSON.stringify(
          result
        )}`
      ).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('CANNOT_WIPE_TOKEN_TREASURY_ACCOUNT');
      console.log(
        `Wipe attempt from treasury for token ${wipeableFtId.toString()} correctly failed with: ${
          result.error
        }`
      );
    });
  });

  describe('HederaTokenFeeScheduleUpdateTool', () => {
    let tokenWithFeeScheduleKeyId: TokenId;

    beforeAll(async () => {
      const createTool = new HederaCreateFungibleTokenTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(
        createTool,
        openAIApiKey
      );
      const tokenName = generateUniqueName('FeeSchedFT');
      const tokenSymbol = generateUniqueName('FSFT');
      const operatorPublicKeyDer = (
        await kit.signer.getPublicKey()
      ).toStringDer();

      // Token needs adminKey and feeScheduleKey
      const createPrompt = `Create a new fungible token. Name: "${tokenName}", Symbol: "${tokenSymbol}", Initial Supply: 1000, Decimals: 2, Treasury Account: ${treasuryAccountId.toString()}, Supply Type: FINITE, Max Supply: 10000. For the adminKey, use "${operatorPublicKeyDer}". For the feeScheduleKey, also use "${operatorPublicKeyDer}".`;

      const agentResult = await agentExecutor.invoke({ input: createPrompt });
      const result = getToolOutputFromResult(agentResult);
      expect(
        result.success,
        `Setup for FeeScheduleUpdate failed (token creation): ${
          result.error
        } - Input: ${JSON.stringify(
          agentResult.intermediateSteps?.[0]?.action.toolInput
        )}`
      ).toBe(true);
      expect(
        result.receipt?.tokenId,
        'FeeSchedFT setup failed to return tokenId'
      ).toBeDefined();
      tokenWithFeeScheduleKeyId = result.receipt.tokenId!;
      createdTokenIds.push(tokenWithFeeScheduleKeyId);
      console.log(
        `Created FeeSchedFT ${tokenWithFeeScheduleKeyId.toString()} for fee schedule update tests.`
      );
    });

    it('should update the token fee schedule', async () => {
      const tool = new HederaTokenFeeScheduleUpdateTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);

      const customFeesJson = JSON.stringify([
        {
          type: 'FIXED',
          feeCollectorAccountId: treasuryAccountId.toString(),
          denominatingTokenId: tokenWithFeeScheduleKeyId.toString(),
          amount: '5',
        },
        {
          type: 'FRACTIONAL',
          feeCollectorAccountId: treasuryAccountId.toString(),
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

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(
        result.success,
        `TokenFeeScheduleUpdate Test Failed: ${result.error}`
      ).toBe(true);
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      console.log(
        `Token fee schedule for ${tokenWithFeeScheduleKeyId.toString()} updated successfully.`
      );
      // TODO: Query token info to verify new fee schedule (more complex).
    });
  });

  describe('HederaRejectTokensTool', () => {
    let rejectableTokenId: TokenId;

    beforeAll(async () => {
      const createTool = new HederaCreateFungibleTokenTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(
        createTool,
        openAIApiKey
      );
      const tokenName = generateUniqueName('RejectableFT');
      const tokenSymbol = generateUniqueName('RFT');
      const operatorPublicKeyDer = (
        await kit.signer.getPublicKey()
      ).toStringDer();

      const createPrompt = `Create a new fungible token. Name: "${tokenName}", Symbol: "${tokenSymbol}", Initial Supply: 100, Decimals: 0, Treasury Account: ${treasuryAccountId.toString()}, Supply Type: FINITE, Max Supply: 100, Admin Key: "${operatorPublicKeyDer}".`;

      const agentResult = await agentExecutor.invoke({ input: createPrompt });
      const result = getToolOutputFromResult(agentResult);
      expect(
        result.success,
        `Setup for RejectToken failed (token creation): ${
          result.error
        } - Input: ${JSON.stringify(
          agentResult.intermediateSteps?.[0]?.action.toolInput
        )}`
      ).toBe(true);
      expect(
        result.receipt?.tokenId,
        'Rejectable FT setup failed to return tokenId'
      ).toBeDefined();
      rejectableTokenId = result.receipt.tokenId!;
      createdTokenIds.push(rejectableTokenId);
      console.log(
        `Created RejectableFT ${rejectableTokenId.toString()} for reject tests.`
      );
    });

    it('should configure the operator to reject associations for the specified token', async () => {
      const tool = new HederaRejectTokensTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);

      // The TokenRejectTransaction is signed by the owner of the rejection (the operator in this case).
      const prompt = `Configure my account (${treasuryAccountId.toString()}) to reject token ${rejectableTokenId.toString()}.`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      // Expect this to fail with ACCOUNT_IS_TREASURY because the operator is the treasury of rejectableTokenId
      expect(
        result.success,
        `RejectToken did not fail as expected: ${JSON.stringify(result)}`
      ).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('ACCOUNT_IS_TREASURY');
      console.log(
        `Operator account ${treasuryAccountId.toString()} correctly failed to reject token ${rejectableTokenId.toString()} (as it's treasury): ${
          result.error
        }`
      );
    });
  });

  describe('HederaFreezeUnfreezeTokenAccountTool', () => {
    let tokenIdToFreeze: TokenId;
    // Using the sharedSecondaryAccountId and sharedSecondaryAccountPrivateKey

    beforeAll(async () => {
      // 1. Create a token with a freeze key (operator)
      const createTokenTool = new HederaCreateFungibleTokenTool({
        hederaKit: kit,
      });
      const agentExecutorToken = await createTestAgentExecutor(
        createTokenTool,
        openAIApiKey
      );
      const tokenName = generateUniqueName('FreezableFT');
      const tokenSymbol = generateUniqueName('FFT');
      const operatorPublicKeyDer = (
        await kit.signer.getPublicKey()
      ).toStringDer();
      const createTokenPrompt = `Create a new fungible token. Name: "${tokenName}", Symbol: "${tokenSymbol}", Initial Supply: 1000, Decimals: 0, Treasury Account: ${treasuryAccountId.toString()}, Supply Type: FINITE, Max Supply: 1000, Admin Key: "${operatorPublicKeyDer}", Freeze Key: "${operatorPublicKeyDer}".`;

      const agentResultTokenCreate = await agentExecutorToken.invoke({
        input: createTokenPrompt,
      });
      const resultTokenCreate = getToolOutputFromResult(agentResultTokenCreate);
      expect(
        resultTokenCreate.success,
        `Setup for Freeze/Unfreeze failed (token creation): ${resultTokenCreate.error}`
      ).toBe(true);
      tokenIdToFreeze = resultTokenCreate.receipt!.tokenId!;
      createdTokenIds.push(tokenIdToFreeze);
      console.log(
        `Created FreezableFT ${tokenIdToFreeze.toString()} for freeze/unfreeze tests.`
      );

      // 2. Associate this token with the SHARED secondary account using its own signer
      console.log(
        `Associating token ${tokenIdToFreeze} with SHARED account ${sharedSecondaryAccountId} for freeze/unfreeze test setup (via secondaryAccountSigner).`
      );
      const associateTxFrozen = new TokenAssociateTransaction()
        .setAccountId(sharedSecondaryAccountId)
        .setTokenIds([tokenIdToFreeze]);

      const associateReceipt =
        await secondaryAccountSigner.signAndExecuteTransaction(
          associateTxFrozen
        );
      expect(associateReceipt.status.toString()).toEqual(
        Status.Success.toString()
      );
      console.log(
        `Token ${tokenIdToFreeze.toString()} successfully associated with ${sharedSecondaryAccountId.toString()} in setup for freeze/unfreeze (via secondaryAccountSigner).`
      );
    });

    it('should freeze and then unfreeze a token for the shared secondary account using transaction bytes', async () => {
      // --- Freeze ---
      const freezeTool = new HederaFreezeTokenAccountTool({ hederaKit: kit });
      let agentExecutor = await createTestAgentExecutor(
        freezeTool,
        openAIApiKey
      );
      let prompt = `Prepare a transaction to freeze token ${tokenIdToFreeze.toString()} for account ${sharedSecondaryAccountId.toString()}. Return the transaction bytes. metaOptions: { getBytes: true }`;

      let agentResult = await agentExecutor.invoke({ input: prompt });
      let result = getToolOutputFromResult(agentResult);
      expect(
        result.success,
        `FreezeTool failed to get transaction bytes: ${result.error}`
      ).toBe(true);
      expect(result.type).toEqual('bytes');
      const freezeTxBytes = Buffer.from(result.output as string, 'base64');
      const freezeTx = Transaction.fromBytes(
        freezeTxBytes
      ) as TokenFreezeTransaction;

      const signedFreezeTx = await freezeTx.sign(
        kit.signer.getOperatorPrivateKey()
      ); // Operator (freeze key holder) signs
      console.log(
        `Executing signed freeze TX for account ${sharedSecondaryAccountId} and token ${tokenIdToFreeze}`
      );
      let submit = await signedFreezeTx.execute(kit.client);
      let receipt = await submit.getReceipt(kit.client);
      expect(receipt.status).toEqual(Status.Success);
      console.log(
        `Token ${tokenIdToFreeze.toString()} successfully frozen for account ${sharedSecondaryAccountId.toString()}.`
      );

      // --- Unfreeze ---
      const unfreezeTool = new HederaUnfreezeTokenAccountTool({
        hederaKit: kit,
      });
      agentExecutor = await createTestAgentExecutor(unfreezeTool, openAIApiKey);
      prompt = `Prepare a transaction to unfreeze token ${tokenIdToFreeze.toString()} for account ${sharedSecondaryAccountId.toString()}. Return the transaction bytes. metaOptions: { getBytes: true }`;

      agentResult = await agentExecutor.invoke({ input: prompt });
      result = getToolOutputFromResult(agentResult);
      expect(
        result.success,
        `UnfreezeTool failed to get transaction bytes: ${result.error}`
      ).toBe(true);
      expect(result.type).toEqual('bytes');
      const unfreezeTxBytes = Buffer.from(result.output as string, 'base64');
      const unfreezeTx = Transaction.fromBytes(
        unfreezeTxBytes
      ) as TokenUnfreezeTransaction;

      const signedUnfreezeTx = await unfreezeTx.sign(
        kit.signer.getOperatorPrivateKey()
      ); // Operator (freeze key holder) signs
      console.log(
        `Executing signed unfreeze TX for account ${sharedSecondaryAccountId} and token ${tokenIdToFreeze}`
      );
      submit = await signedUnfreezeTx.execute(kit.client);
      receipt = await submit.getReceipt(kit.client);
      expect(receipt.status).toEqual(Status.Success);
      console.log(
        `Token ${tokenIdToFreeze.toString()} successfully unfrozen for account ${sharedSecondaryAccountId.toString()}.`
      );
    });
  });

  describe('HederaGrantKycTokenTool and HederaRevokeKycTokenTool', () => {
    let kycEnabledTokenId: TokenId;

    beforeAll(async () => {
      // 1. Create a token with KYC key (operator as KYC key)
      const createTool = new HederaCreateFungibleTokenTool({ hederaKit: kit });
      const agentExecutorCreate = await createTestAgentExecutor(
        createTool,
        openAIApiKey
      );
      const tokenName = generateUniqueName('KycFT');
      const tokenSymbol = generateUniqueName('KYT');
      const operatorPublicKeyDer = (
        await kit.signer.getPublicKey()
      ).toStringDer();

      const createPrompt = `Create a new fungible token. Name: "${tokenName}", Symbol: "${tokenSymbol}", Initial Supply: 1000, Decimals: 0, Treasury Account: ${treasuryAccountId.toString()}. For the kycKey, use "${operatorPublicKeyDer}". For the adminKey, use "${operatorPublicKeyDer}".`;

      const agentResultCreate = await agentExecutorCreate.invoke({
        input: createPrompt,
      });
      const resultCreate = getToolOutputFromResult(agentResultCreate);
      expect(
        resultCreate.success,
        `Setup for KYC Tests (Token Creation) failed: ${resultCreate.error}`
      ).toBe(true);
      expect(
        resultCreate.receipt?.tokenId,
        'KYC-enabled token creation failed to return tokenId'
      ).toBeDefined();
      kycEnabledTokenId = resultCreate.receipt!.tokenId!;
      createdTokenIds.push(kycEnabledTokenId);
      console.log(
        `Created KYC-enabled token ${kycEnabledTokenId.toString()} for KYC tests.`
      );

      // 2. Associate this token with the sharedSecondaryAccountId using its own signer
      console.log(
        `Associating KYC-enabled token ${kycEnabledTokenId.toString()} with shared account ${sharedSecondaryAccountId.toString()} for KYC tests (via secondaryAccountSigner).`
      );
      const associateTx = new TokenAssociateTransaction()
        .setAccountId(sharedSecondaryAccountId)
        .setTokenIds([kycEnabledTokenId]);

      const associateReceipt =
        await secondaryAccountSigner.signAndExecuteTransaction(associateTx);
      expect(associateReceipt.status.toString()).toEqual(
        Status.Success.toString()
      ); // Compare stringified status
      console.log(
        `Token ${kycEnabledTokenId.toString()} successfully associated with ${sharedSecondaryAccountId.toString()} for KYC tests (via secondaryAccountSigner).`
      );
    });

    it('should grant KYC to the shared secondary account for the token', async () => {
      const tool = new HederaGrantKycTokenTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);
      const prompt = `Grant KYC to account ${sharedSecondaryAccountId.toString()} for token ${kycEnabledTokenId.toString()}. metaOptions: { kycKeyShouldSign: true }`; // Assuming kycKeyShouldSign metaOption might be needed, though operator (KYC key holder) signs by default.

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(result.success, `GrantKYC Test Failed: ${result.error}`).toBe(
        true
      );
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      console.log(
        `KYC granted to ${sharedSecondaryAccountId.toString()} for token ${kycEnabledTokenId.toString()} successfully.`
      );
    });

    it('should revoke KYC from the shared secondary account for the token', async () => {
      // This test depends on the grant KYC test passing first.
      const tool = new HederaRevokeKycTokenTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);
      const prompt = `Revoke KYC from account ${sharedSecondaryAccountId.toString()} for token ${kycEnabledTokenId.toString()}. metaOptions: { kycKeyShouldSign: true }`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(result.success, `RevokeKYC Test Failed: ${result.error}`).toBe(
        true
      );
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      console.log(
        `KYC revoked from ${sharedSecondaryAccountId.toString()} for token ${kycEnabledTokenId.toString()} successfully.`
      );
    });
  });

  describe('HederaTransferTokensTool', () => {
    let transferSourceFtId: TokenId;
    let transferSourceNftCollectionId: TokenId;
    let nftSerialToTransfer: number;

    beforeAll(async () => {
      // Setup for Fungible Token Transfer
      const createFtTool = new HederaCreateFungibleTokenTool({
        hederaKit: kit,
      });
      const agentExecutorFtCreate = await createTestAgentExecutor(
        createFtTool,
        openAIApiKey
      );
      const ftName = generateUniqueName('TransferFT');
      const ftSymbol = generateUniqueName('TFTT');
      const createFtPrompt = `Create a new fungible token. Name: "${ftName}", Symbol: "${ftSymbol}", Initial Supply: 5000, Decimals: 0, Treasury Account: ${treasuryAccountId.toString()}. For the adminKey, use "current_signer". metaOptions: { adminKeyShouldSign: true }`;

      const agentResultFtCreate = await agentExecutorFtCreate.invoke({
        input: createFtPrompt,
      });
      const resultFtCreate = getToolOutputFromResult(agentResultFtCreate);
      expect(
        resultFtCreate.success,
        `Setup for TransferTokens (FT Creation) failed: ${resultFtCreate.error}`
      ).toBe(true);
      expect(
        resultFtCreate.receipt?.tokenId,
        'Transfer FT creation failed to return tokenId'
      ).toBeDefined();
      transferSourceFtId = resultFtCreate.receipt!.tokenId!;
      createdTokenIds.push(transferSourceFtId);
      console.log(
        `Created TransferFT ${transferSourceFtId.toString()} for transfer tests.`
      );

      // Associate FT with sharedSecondaryAccountId using its own signer
      console.log(
        `Associating TransferFT ${transferSourceFtId.toString()} with ${sharedSecondaryAccountId.toString()} (via secondaryAccountSigner).`
      );
      const associateFtTx = new TokenAssociateTransaction()
        .setAccountId(sharedSecondaryAccountId)
        .setTokenIds([transferSourceFtId]);
      const associateFtReceipt =
        await secondaryAccountSigner.signAndExecuteTransaction(associateFtTx);
      expect(associateFtReceipt.status.toString()).toEqual(
        Status.Success.toString()
      );
      console.log(
        `Associated TransferFT ${transferSourceFtId.toString()} with ${sharedSecondaryAccountId.toString()} successfully (via secondaryAccountSigner).`
      );

      // Setup for NFT Transfer
      const createNftTool = new HederaCreateNftTool({ hederaKit: kit });
      const agentExecutorNftCreate = await createTestAgentExecutor(
        createNftTool,
        openAIApiKey
      );
      const nftName = generateUniqueName('TransferNFTColl');
      const nftSymbol = generateUniqueName('TNFTTC');
      const createNftPrompt = `Create a new NFT collection. Name: "${nftName}", Symbol: "${nftSymbol}", Treasury Account: ${treasuryAccountId.toString()}, Supply Type: FINITE, Max Supply: 100. For the adminKey and supplyKey, use "current_signer". metaOptions: { adminKeyShouldSign: true }`; // Added Supply Type and Max Supply

      const agentResultNftCreate = await agentExecutorNftCreate.invoke({
        input: createNftPrompt,
      });
      const resultNftCreate = getToolOutputFromResult(agentResultNftCreate);
      expect(
        resultNftCreate.success,
        `Setup for TransferTokens (NFT Collection Creation) failed: ${resultNftCreate.error}`
      ).toBe(true);
      expect(
        resultNftCreate.receipt?.tokenId,
        'Transfer NFT Collection creation failed to return tokenId'
      ).toBeDefined();
      transferSourceNftCollectionId = resultNftCreate.receipt!.tokenId!;
      createdTokenIds.push(transferSourceNftCollectionId);
      console.log(
        `Created TransferNFT Collection ${transferSourceNftCollectionId.toString()} for transfer tests.`
      );

      // Mint an NFT into the collection
      const mintNftTool = new HederaMintNftTool({ hederaKit: kit });
      const agentExecutorNftMint = await createTestAgentExecutor(
        mintNftTool,
        openAIApiKey
      );
      const metadata = Buffer.from(
        `NFT for transfer test ${generateUniqueName('Serial')}`
      ).toString('base64');
      const mintNftPrompt = `Mint a new NFT into collection ${transferSourceNftCollectionId.toString()} with metadata "${metadata}". metaOptions: { supplyKeyShouldSign: true }`;
      const agentResultNftMint = await agentExecutorNftMint.invoke({
        input: mintNftPrompt,
      });
      const resultNftMint = getToolOutputFromResult(agentResultNftMint);
      expect(
        resultNftMint.success,
        `Setup for TransferTokens (NFT Mint) failed: ${resultNftMint.error}`
      ).toBe(true);
      expect(
        resultNftMint.receipt?.serials &&
          resultNftMint.receipt.serials.length > 0,
        'NFT Mint for transfer test failed to return serials'
      ).toBe(true);
      const serialValue = resultNftMint.receipt.serials[0];
      nftSerialToTransfer =
        typeof serialValue === 'string'
          ? parseInt(serialValue, 10)
          : (serialValue as number);
      console.log(
        `Minted NFT serial ${nftSerialToTransfer} from ${transferSourceNftCollectionId.toString()} for transfer tests.`
      );

      // Associate NFT Collection with sharedSecondaryAccountId using its own signer
      console.log(
        `Associating TransferNFT Collection ${transferSourceNftCollectionId.toString()} with ${sharedSecondaryAccountId.toString()} (via secondaryAccountSigner).`
      );
      const associateNftTx = new TokenAssociateTransaction()
        .setAccountId(sharedSecondaryAccountId)
        .setTokenIds([transferSourceNftCollectionId]);
      const associateNftReceipt =
        await secondaryAccountSigner.signAndExecuteTransaction(associateNftTx);
      expect(associateNftReceipt.status.toString()).toEqual(
        Status.Success.toString()
      );
      console.log(
        `Associated TransferNFT Collection ${transferSourceNftCollectionId.toString()} with ${sharedSecondaryAccountId.toString()} successfully (via secondaryAccountSigner).`
      );
    });

    it('should transfer fungible tokens', async () => {
      const tool = new HederaTransferTokensTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);
      const amountToTransfer = 150;

      const tokenTransfers = [
        {
          type: 'fungible',
          tokenId: transferSourceFtId.toString(),
          accountId: treasuryAccountId.toString(),
          amount: -amountToTransfer, // Debiting treasury
        },
        {
          type: 'fungible',
          tokenId: transferSourceFtId.toString(),
          accountId: sharedSecondaryAccountId.toString(),
          amount: amountToTransfer, // Crediting shared account
        },
      ];

      const prompt = `Transfer tokens. Token Transfers: ${JSON.stringify(
        tokenTransfers
      )}. Memo: "FT Transfer Test"`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(
        result.success,
        `Fungible Token Transfer Failed: ${result.error}`
      ).toBe(true);
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      console.log(
        `Successfully transferred ${amountToTransfer} of FT ${transferSourceFtId.toString()} from ${treasuryAccountId.toString()} to ${sharedSecondaryAccountId.toString()}.`
      );
    });

    it('should transfer an NFT', async () => {
      const tool = new HederaTransferTokensTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);

      const nftTransfer = {
        type: 'nft',
        tokenId: transferSourceNftCollectionId.toString(), // Corrected: Pass tokenId
        serial: nftSerialToTransfer, // Corrected: Pass serial separately
        senderAccountId: treasuryAccountId.toString(),
        receiverAccountId: sharedSecondaryAccountId.toString(),
        isApproved: false, // Treasury (owner) is sending
      };

      const prompt = `Transfer tokens. Token Transfers: ${JSON.stringify([
        nftTransfer,
      ])}. Memo: "NFT Transfer Test"`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(result.success, `NFT Transfer Failed: ${result.error}`).toBe(true);
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      console.log(
        `Successfully transferred NFT ${transferSourceNftCollectionId.toString()}.${nftSerialToTransfer} from ${treasuryAccountId.toString()} to ${sharedSecondaryAccountId.toString()}.`
      );
    });
  });

  describe('HederaAirdropTokenTool', () => {
    let airdropSourceFtId: TokenId;
    let recipient1ForAirdrop: AccountId;
    let recipient1Key: SDKPrivateKey;
    let recipient1Signer: ServerSigner; // << NEW
    let recipient2ForAirdrop: AccountId;
    let recipient2Key: SDKPrivateKey;
    let recipient2Signer: ServerSigner; // << NEW

    beforeAll(async () => {
      // 1. Create a new fungible token for airdrop
      const createFtTool = new HederaCreateFungibleTokenTool({
        hederaKit: kit,
      });
      const agentExecutorFtCreate = await createTestAgentExecutor(
        createFtTool,
        openAIApiKey
      );
      const ftName = generateUniqueName('AirdropFT');
      const ftSymbol = generateUniqueName('ADFT');
      const createFtPrompt = `Create a new fungible token. Name: "${ftName}", Symbol: "${ftSymbol}", Initial Supply: 10000, Decimals: 0, Treasury Account: ${treasuryAccountId.toString()}. For the adminKey, use "current_signer". metaOptions: { adminKeyShouldSign: true }`;

      const agentResultFtCreate = await agentExecutorFtCreate.invoke({
        input: createFtPrompt,
      });
      const resultFtCreate = getToolOutputFromResult(agentResultFtCreate);
      expect(
        resultFtCreate.success,
        `Setup for Airdrop (Token Creation) failed: ${resultFtCreate.error}`
      ).toBe(true);
      airdropSourceFtId = resultFtCreate.receipt!.tokenId!;
      createdTokenIds.push(airdropSourceFtId);
      console.log(
        `Created AirdropFT ${airdropSourceFtId.toString()} for airdrop tests.`
      );

      // 2. Create recipient accounts and their signers
      const acc1Details = await createNewTestAccount(kit, 10); // 10 HBAR initial balance
      recipient1ForAirdrop = acc1Details.accountId;
      recipient1Key = acc1Details.privateKey;
      recipient1Signer = await ServerSigner.create(
        recipient1ForAirdrop,
        recipient1Key,
        kit.network
      );
      console.log(
        `Created recipient account 1: ${recipient1ForAirdrop.toString()} and its signer for airdrop test.`
      );

      const acc2Details = await createNewTestAccount(kit, 10);
      recipient2ForAirdrop = acc2Details.accountId;
      recipient2Key = acc2Details.privateKey;
      recipient2Signer = await ServerSigner.create(
        recipient2ForAirdrop,
        recipient2Key,
        kit.network
      );
      console.log(
        `Created recipient account 2: ${recipient2ForAirdrop.toString()} and its signer for airdrop test.`
      );

      // 3. Associate token with recipient accounts using their own signers
      const recipientsToAssociate = [
        { accountId: recipient1ForAirdrop, signer: recipient1Signer },
        { accountId: recipient2ForAirdrop, signer: recipient2Signer },
      ];

      for (const recipient of recipientsToAssociate) {
        console.log(
          `Associating AirdropFT ${airdropSourceFtId.toString()} with ${recipient.accountId.toString()} using its own signer.`
        );
        const associateTx = new TokenAssociateTransaction()
          .setAccountId(recipient.accountId)
          .setTokenIds([airdropSourceFtId]);

        const associateReceipt =
          await recipient.signer.signAndExecuteTransaction(associateTx);
        expect(associateReceipt.status).toEqual(Status.Success);
        console.log(
          `Associated AirdropFT ${airdropSourceFtId.toString()} with ${recipient.accountId.toString()} successfully (via its own signer).`
        );
      }
    });

    it('should airdrop fungible tokens to multiple recipients', async () => {
      const tool = new HederaAirdropTokenTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);
      const amount1 = 123;
      const amount2 = 456;

      const recipients = [
        { accountId: recipient1ForAirdrop.toString(), amount: amount1 },
        { accountId: recipient2ForAirdrop.toString(), amount: amount2 },
      ];

      const prompt = `Airdrop token ${airdropSourceFtId.toString()}. Recipients: ${JSON.stringify(
        recipients
      )}. Memo: "FT Airdrop Test"`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(
        result.success,
        `Airdrop Failed: ${result.error} - Intermediate Steps: ${JSON.stringify(
          agentResult.intermediateSteps
        )}`
      ).toBe(true);
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      console.log(
        `Successfully airdropped ${airdropSourceFtId.toString()} to recipients.`
      );

      // TODO: Future enhancement - query balances of recipients to verify amounts.
    });
  });

  describe('HederaDeleteTokenTool (Dedicated Test)', () => {
    let deletableTokenId: TokenId;

    beforeEach(async () => {
      // Using beforeEach to create a fresh token for each delete attempt
      const createTool = new HederaCreateFungibleTokenTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(
        createTool,
        openAIApiKey
      );
      const tokenName = generateUniqueName('DeletableFT');
      const tokenSymbol = generateUniqueName('DFT');

      // Token needs an admin key to be deleted
      const createPrompt = `Create a new fungible token. Name: "${tokenName}", Symbol: "${tokenSymbol}", Initial Supply: 100, Decimals: 0, Treasury Account: ${treasuryAccountId.toString()}. For the adminKey, use "current_signer". metaOptions: { adminKeyShouldSign: true }`;

      const agentResult = await agentExecutor.invoke({ input: createPrompt });
      const result = getToolOutputFromResult(agentResult);
      expect(
        result.success,
        `Setup for DeleteToken test failed (token creation): ${result.error}`
      ).toBe(true);
      expect(
        result.receipt?.tokenId,
        'Deletable FT setup failed to return tokenId'
      ).toBeDefined();
      deletableTokenId = result.receipt.tokenId!;
      // No need to add to createdTokenIds for global afterAll, as this test will delete it.
      // If the test fails, afterAll will catch any leftovers if it were added, but this design is cleaner.
      console.log(
        `Created DeletableFT ${deletableTokenId.toString()} for dedicated delete test.`
      );
    });

    it('should delete a token successfully', async () => {
      const tool = new HederaDeleteTokenTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);

      const prompt = `Delete the token with ID ${deletableTokenId.toString()}. metaOptions: { adminKeyShouldSign: true }`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(result.success, `DeleteToken Test Failed: ${result.error}`).toBe(
        true
      );
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      console.log(
        `Token ${deletableTokenId.toString()} deleted successfully in dedicated test.`
      );

      // To prevent afterAll from trying to delete it again (and failing if it's already gone)
      // we could remove it from createdTokenIds if it was added, but we chose not to add it.
    });
  });
});
