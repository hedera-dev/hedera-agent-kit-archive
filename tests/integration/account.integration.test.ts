import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { HederaAgentKit } from '../../src/agent';
import { ServerSigner } from '../../src/signer/server-signer';
import {
  HederaTransferHbarTool,
  HederaUpdateAccountTool,
  HederaCreateAccountTool,
  HederaDeleteAccountTool,
  HederaApproveHbarAllowanceTool,
  HederaApproveFungibleTokenAllowanceTool,
  HederaApproveTokenNftAllowanceTool,
  HederaRevokeHbarAllowanceTool,
  HederaRevokeFungibleTokenAllowanceTool,
  HederaDeleteNftSpenderAllowanceTool,
  HederaDeleteNftSerialAllowancesTool,
} from '../../src/langchain/tools/account';
import {
  HederaCreateFungibleTokenTool,
  HederaCreateNftTool,
  HederaMintNftTool,
} from '../../src/langchain/tools/hts';
import {
  AccountId,
  PrivateKey as SDKPrivateKey,
  PublicKey as SDKPublicKey,
  AccountCreateTransaction,
  Hbar as SDKHbar,
  Client,
  Transaction,
  AccountDeleteTransaction,
  Status,
  TokenId,
  TokenAssociateTransaction,
  AccountUpdateTransaction,
} from '@hashgraph/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { StructuredTool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env.test') });

// --- Test Utilities (Consider moving to a shared utils.ts eventually) ---
async function initializeTestKit(): Promise<HederaAgentKit> {
  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  const openAIApiKey = process.env.OPENAI_API_KEY;
  if (!accountId || !privateKey || !openAIApiKey) {
    throw new Error(
      'Missing HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY, or OPENAI_API_KEY in environment variables.'
    );
  }
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

async function createTestAgentExecutor(
  tool: StructuredTool,
  openAIApiKey: string
): Promise<AgentExecutor> {
  const tools = [tool];
  const llm = new ChatOpenAI({
    apiKey: openAIApiKey,
    modelName: 'gpt-4o-mini',
    temperature: 0,
  });
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      'You are a helpful assistant that can use tools to perform actions on the Hedera network.',
    ],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}'],
  ]);
  const agent = await createOpenAIToolsAgent({ llm, tools, prompt });
  return new AgentExecutor({
    agent,
    tools,
    verbose: process.env.VERBOSE_AGENT_LOGGING === 'true',
    returnIntermediateSteps: true,
  });
}

interface ToolResult {
  success?: boolean;
  error?: unknown;
  type?: string;
  output?: unknown;
  receipt?: {
    tokenId?: { toString(): string };
    serials?: number[];
    status?: { toString(): string };
    accountId?: { toString(): string };
  };
}

function getToolOutputFromResult(agentResult: unknown): ToolResult {
  if (
    agentResult &&
    typeof agentResult === 'object' &&
    'intermediateSteps' in agentResult &&
    Array.isArray((agentResult as { intermediateSteps: unknown[] }).intermediateSteps) &&
    (agentResult as { intermediateSteps: unknown[] }).intermediateSteps.length > 0
  ) {
    const intermediateSteps = (agentResult as { intermediateSteps: unknown[] }).intermediateSteps;
    const lastStep = intermediateSteps[intermediateSteps.length - 1];
    if (lastStep && typeof lastStep === 'object' && 'observation' in lastStep) {
      const observation = (lastStep as { observation: unknown }).observation;
      if (typeof observation === 'string') {
        try {
          return JSON.parse(observation) as ToolResult;
        } catch {
          /* ignore */
        }
      }
      return observation as ToolResult; // Return raw if not JSON string
    }
  }
  // Fallback for direct output if no intermediate steps (e.g. simple tools or errors)
  if (
    agentResult &&
    typeof agentResult === 'object' &&
    'output' in agentResult &&
    typeof (agentResult as { output: unknown }).output === 'string'
  ) {
    try {
      return JSON.parse((agentResult as { output: string }).output) as ToolResult;
    } catch {
      /* ignore */
    }
  }
  return (agentResult && typeof agentResult === 'object' && 'output' in agentResult 
    ? (agentResult as { output: unknown }).output 
    : agentResult) as ToolResult;
}

async function createNewHederaAccount(
  client: Client,
  payerSigner: ServerSigner,
  initialBalanceHbar: number
): Promise<{
  accountId: AccountId;
  privateKey: SDKPrivateKey;
  publicKey: SDKPublicKey;
}> {
  const newPrivateKey = SDKPrivateKey.generateED25519();
  const newPublicKey = newPrivateKey.publicKey;
  const transaction = new AccountCreateTransaction()
    .setKey(newPublicKey)
    .setInitialBalance(new SDKHbar(initialBalanceHbar))
    .setNodeAccountIds([new AccountId(3)]);

  await transaction.freezeWith(client);
  const signedTx = await transaction.sign(payerSigner.getOperatorPrivateKey());
  const txResponse = await signedTx.execute(client);
  const receipt = await txResponse.getReceipt(client);
  if (!receipt.accountId) {
    throw new Error('Failed to create new Hedera account: accountId is null.');
  }
  console.log(
    `Test utility created new account: ${receipt.accountId.toString()} with public key ${newPublicKey.toStringDer()}`
  ); // Log public key
  return {
    accountId: receipt.accountId,
    privateKey: newPrivateKey,
    publicKey: newPublicKey,
  }; // Return publicKey
}
// --- End Test Utilities ---

describe('Hedera Account Service Tools Integration Tests', () => {
  let kit: HederaAgentKit;
  let openAIApiKey: string;
  let operatorAccountId: AccountId;
  let recipientAccount: AccountId;
  let recipientAccountPrivateKey: SDKPrivateKey; // Store private key
  let secondaryAccountSigner: ServerSigner; // For recipientAccount to sign its own associations
  let ftForAllowanceId: TokenId; // << For the new test suite
  let nftForNftAllowanceId: TokenId; // << NEW
  let nftSerialToAllow: number; // << NEW

  beforeAll(async () => {
    kit = await initializeTestKit();
    openAIApiKey = process.env.OPENAI_API_KEY as string;
    operatorAccountId = kit.signer.getAccountId();

    const recipientDetails = await createNewHederaAccount(
      kit.client,
      kit.signer as ServerSigner,
      10
    );
    recipientAccount = recipientDetails.accountId;
    recipientAccountPrivateKey = recipientDetails.privateKey;
    secondaryAccountSigner = await ServerSigner.create(
      recipientAccount,
      recipientAccountPrivateKey,
      kit.network
    );

    // Create a fungible token for allowance tests
    const createFtTool = new HederaCreateFungibleTokenTool({ hederaKit: kit }); // Import this tool if not already
    const agentExecutorFtCreate = await createTestAgentExecutor(
      createFtTool,
      openAIApiKey
    );
    const ftName = generateUniqueName('AllowFT');
    const ftSymbol = generateUniqueName('AFTL');
    const createFtPrompt = `Create a new fungible token. Name: "${ftName}", Symbol: "${ftSymbol}", Initial Supply: 10000, Decimals: 2, Treasury Account: ${operatorAccountId.toString()}. For the adminKey, use "current_signer".`;

    const agentResultFtCreate = await agentExecutorFtCreate.invoke({
      input: createFtPrompt,
    });
    const resultFtCreate = getToolOutputFromResult(agentResultFtCreate);
    if (!resultFtCreate.success || !resultFtCreate.receipt?.tokenId) {
      throw new Error(
        `Failed to create fungible token for allowance tests: ${JSON.stringify(
          resultFtCreate.error || resultFtCreate
        )}`
      );
    }
    ftForAllowanceId = TokenId.fromString(
      resultFtCreate.receipt.tokenId.toString()
    );
    console.log(
      `Created FT ${ftForAllowanceId.toString()} for allowance tests.`
    );

    // Associate this FT with recipientAccount using secondaryAccountSigner
    console.log(
      `Associating FT ${ftForAllowanceId.toString()} with recipient ${recipientAccount.toString()} using its own signer.`
    );
    const associateTx = new TokenAssociateTransaction()
      .setAccountId(recipientAccount)
      .setTokenIds([ftForAllowanceId]);
    const associateReceipt =
      await secondaryAccountSigner.signAndExecuteTransaction(associateTx);
    if (associateReceipt.status.toString() !== Status.Success.toString()) {
      throw new Error(
        `Failed to associate FT ${ftForAllowanceId.toString()} with recipient ${recipientAccount.toString()}: ${associateReceipt.status.toString()}`
      );
    }
    console.log(
      `Associated FT ${ftForAllowanceId.toString()} with recipient ${recipientAccount.toString()} successfully.`
    );

    // --- Setup for NFT Allowance Tests ---
    // 1. Create NFT Collection
    const createNftTool = new HederaCreateNftTool({ hederaKit: kit });
    const agentExecutorNftCreate = await createTestAgentExecutor(
      createNftTool,
      openAIApiKey
    );
    const nftName = generateUniqueName('AllowNFTColl');
    const nftSymbol = generateUniqueName('ANFTC');
    const createNftPrompt = `Create a new NFT collection. Name: "${nftName}", Symbol: "${nftSymbol}", Treasury Account: ${operatorAccountId.toString()}, Supply Type: FINITE, Max Supply: 100. For the adminKey and supplyKey, use "current_signer".`;

    const agentResultNftCreate = await agentExecutorNftCreate.invoke({
      input: createNftPrompt,
    });
    const resultNftCreate = getToolOutputFromResult(agentResultNftCreate);
    if (!resultNftCreate.success || !resultNftCreate.receipt?.tokenId) {
      throw new Error(
        `Failed to create NFT collection for NFT allowance tests: ${JSON.stringify(
          resultNftCreate.error || resultNftCreate
        )}`
      );
    }
    nftForNftAllowanceId = TokenId.fromString(
      resultNftCreate.receipt.tokenId.toString()
    );
    console.log(
      `Created NFT Collection ${nftForNftAllowanceId.toString()} for NFT allowance tests.`
    );
    // Add to global cleanup if this token should be deleted by HTS cleanup, though it's an account test setup.
    // For now, let's assume it gets cleaned up if HTS tests run their full cleanup.

    // 2. Mint an NFT into this collection (owned by operator)
    const mintNftTool = new HederaMintNftTool({ hederaKit: kit });
    const agentExecutorNftMint = await createTestAgentExecutor(
      mintNftTool,
      openAIApiKey
    );
    const metadata = Buffer.from(
      `NFT for allowance test ${generateUniqueName('Serial')}`
    ).toString('base64');
    const mintNftPrompt = `Mint a new NFT into collection ${nftForNftAllowanceId.toString()} with metadata "${metadata}".`;
    const agentResultNftMint = await agentExecutorNftMint.invoke({
      input: mintNftPrompt,
    });
    const resultNftMint = getToolOutputFromResult(agentResultNftMint);
    if (
      !resultNftMint.success ||
      !resultNftMint.receipt?.serials ||
      resultNftMint.receipt.serials.length === 0
    ) {
      throw new Error(
        `Failed to mint NFT for allowance tests: ${JSON.stringify(
          resultNftMint.error || resultNftMint
        )}`
      );
    }
    const serialValue = resultNftMint.receipt.serials[0];
    nftSerialToAllow =
      typeof serialValue === 'string'
        ? parseInt(serialValue, 10)
        : (serialValue as number);
    console.log(
      `Minted NFT serial ${nftSerialToAllow} from ${nftForNftAllowanceId.toString()} for NFT allowance tests.`
    );

    // 3. Associate this NFT Collection with recipientAccount (spender) using its own signer
    console.log(
      `Associating NFT Collection ${nftForNftAllowanceId.toString()} with recipient ${recipientAccount.toString()} (spender) using its own signer.`
    );
    const associateNftTx = new TokenAssociateTransaction()
      .setAccountId(recipientAccount)
      .setTokenIds([nftForNftAllowanceId]);
    const associateNftReceipt =
      await secondaryAccountSigner.signAndExecuteTransaction(associateNftTx);
    if (associateNftReceipt.status.toString() !== Status.Success.toString()) {
      throw new Error(
        `Failed to associate NFT Collection ${nftForNftAllowanceId.toString()} with recipient ${recipientAccount.toString()}: ${associateNftReceipt.status.toString()}`
      );
    }
    console.log(
      `Associated NFT Collection ${nftForNftAllowanceId.toString()} with recipient ${recipientAccount.toString()} successfully.`
    );
  });

  describe('HederaTransferHbarTool', () => {
    it('should transfer HBAR from operator to a recipient account', async () => {
      const tool = new HederaTransferHbarTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);
      const amountToTransferHbar = 1;
      const transferAmountTinybars = new SDKHbar(amountToTransferHbar)
        .toTinybars()
        .toNumber();

      const hbarTransfers = [
        {
          accountId: operatorAccountId.toString(),
          amount: -transferAmountTinybars,
        }, // Debiting operator
        {
          accountId: recipientAccount.toString(),
          amount: transferAmountTinybars,
        }, // Crediting recipient
      ];

      const prompt = `Transfer HBAR. Transfers: ${JSON.stringify(
        hbarTransfers
      )}. Memo: "HBAR Transfer Test"`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(result.success, `HBAR Transfer Failed: ${result.error}`).toBe(
        true
      );
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      console.log(
        `Successfully transferred ${amountToTransferHbar} HBAR from ${operatorAccountId.toString()} to ${recipientAccount.toString()}.`
      );
    });
  });

  describe('HederaUpdateAccountTool', () => {
    it('should update the memo of an account', async () => {
      const tool = new HederaUpdateAccountTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);
      const newMemo = generateUniqueName('UpdatedAccountMemo');

      const prompt = `Prepare a transaction to update account ${recipientAccount.toString()}. Set its memo to "${newMemo}". Return the transaction bytes. metaOptions: { getBytes: true }`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(
        result.success,
        `Tool failed to get transaction bytes for account update: ${result.error}`
      ).toBe(true);
      expect(result.type).toEqual('bytes');
      expect(result.output).toBeDefined();
      const transactionBytesBase64 = result.output as string;
      console.log('HederaUpdateAccountTool returned transaction bytes.');

      const transactionBytes = Buffer.from(transactionBytesBase64, 'base64');
      // The AccountUpdateTransaction must be frozen by the client of the account paying the transaction fee
      const updateTx = (
        Transaction.fromBytes(transactionBytes) as AccountUpdateTransaction
      ).freezeWith(kit.client); // Freeze with operator's client (payer)

      // Sign with the key of the account being updated, then by the payer (operator)
      const signedByRecipientKey = await updateTx.sign(
        recipientAccountPrivateKey
      );
      const signedByOperator = await signedByRecipientKey.sign(
        kit.signer.getOperatorPrivateKey()
      );

      console.log(
        `Executing account memo update for ${recipientAccount.toString()}`
      );
      const submit = await signedByOperator.execute(kit.client);
      const receipt = await submit.getReceipt(kit.client);

      expect(receipt.status).toEqual(Status.Success);
      console.log(
        `Successfully updated memo for account ${recipientAccount.toString()} to "${newMemo}".`
      );
      // TODO: Query account info to verify memo if getAccountInfoTool becomes available/used.
    }, 30000); // Added timeout just in case
  });

  describe('HederaCreateAccountTool', () => {
    it('should create a new account with a public key and initial balance', async () => {
      const tool = new HederaCreateAccountTool({ hederaKit: kit }); // Import this tool
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);

      const newAccountPrivateKey = SDKPrivateKey.generateED25519();
      const newAccountPublicKey = newAccountPrivateKey.publicKey;
      const initialBalanceHbar = 1;

      // Note: The tool's Zod schema likely expects the key as a string (DER-encoded public key, or private key string for derivation).
      // The builder (AccountBuilder.createAccount) then handles parsing this string.
      const prompt = `Create a new Hedera account. Key: "${newAccountPublicKey.toStringDer()}", Initial Balance: ${initialBalanceHbar} HBAR. Memo: "Test Account Creation via Tool"`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(result.success, `Account Creation Failed: ${result.error}`).toBe(
        true
      );
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      expect(result.receipt.accountId).toBeDefined();
      const createdAccountId = result.receipt.accountId.toString();
      expect(createdAccountId).toMatch(/^0\.0\.\d+$/);
      console.log(
        `Successfully created new account: ${createdAccountId} via HederaCreateAccountTool.`
      );

      // For now, we are not deleting this account automatically in this test
      // to keep the test focused. Deletion can be tested with HederaDeleteAccountTool.
      // If this account needs cleanup, its private key is `newAccountPrivateKey`.
    }, 30000); // Increased timeout for account creation
  });

  describe('HederaDeleteAccountTool', () => {
    let accountToDeleteId: AccountId;
    let accountToDeletePrivateKey: SDKPrivateKey;

    beforeEach(async () => {
      // Create a fresh account for each delete attempt
      const details = await createNewHederaAccount(
        kit.client,
        kit.signer as ServerSigner,
        5
      ); // Create with 5 HBAR
      accountToDeleteId = details.accountId;
      accountToDeletePrivateKey = details.privateKey;
      console.log(
        `Created account ${accountToDeleteId.toString()} to be deleted in test.`
      );
    });

    it('should prepare and allow execution of an account deletion', async () => {
      const tool = new HederaDeleteAccountTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);

      const prompt = `Prepare a transaction to delete account ${accountToDeleteId.toString()} and transfer its balance to ${operatorAccountId.toString()}. Return the transaction bytes. metaOptions: { getBytes: true }`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(
        result.success,
        `Tool failed to get transaction bytes for account deletion: ${result.error}`
      ).toBe(true);
      expect(result.type).toEqual('bytes');
      expect(result.output).toBeDefined();
      const transactionBytesBase64 = result.output as string;
      console.log(
        'HederaDeleteAccountTool returned transaction bytes for account deletion.'
      );

      const transactionBytes = Buffer.from(transactionBytesBase64, 'base64');
      let deleteTx = Transaction.fromBytes(
        transactionBytes
      ) as AccountDeleteTransaction;

      // Freeze the transaction with the operator's client (payer)
      deleteTx = await deleteTx.freezeWith(kit.client);

      // Transaction must be signed by the key of the account being deleted, AND by the operator (payer)
      const signedByDeletedAccount = await deleteTx.sign(
        accountToDeletePrivateKey
      );
      const signedByOperator = await signedByDeletedAccount.sign(
        kit.signer.getOperatorPrivateKey()
      );

      console.log(
        `Executing account deletion for ${accountToDeleteId.toString()}`
      );
      const submit = await signedByOperator.execute(kit.client);
      const receipt = await submit.getReceipt(kit.client);

      expect(receipt.status).toEqual(Status.Success);
      console.log(
        `Successfully deleted account ${accountToDeleteId.toString()}.`
      );
    }, 30000);
  });

  describe('ApproveHbarAllowanceTool', () => {
    it('should approve an HBAR allowance for a spender account', async () => {
      const tool = new HederaApproveHbarAllowanceTool({ hederaKit: kit }); // Import this tool
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);
      const allowanceAmountHbar = new SDKHbar(5); // 5 HBAR

      // The operator (kit.signer) is the owner granting the allowance.
      const prompt = `Approve an HBAR allowance. Owner: ${operatorAccountId.toString()}, Spender: ${recipientAccount.toString()}, Amount: ${allowanceAmountHbar.toString()}. Memo: "HBAR Allowance Test"`;
      // Note: The tool's Zod schema for amount might expect tinybars as number/string.
      // The builder (AccountBuilder.approveHbarAllowance) expects an Hbar object.
      // The tool/builder should handle this conversion.
      // Let's use Hbar.toString() which gives "5 hℏ" and see if the LLM/tool/builder handles it.
      // Or, more robustly, specify tinybars in the prompt if the Zod schema expects that.
      // For now, trying with Hbar.toString(). If it fails, will adjust to tinybars in prompt.

      // Alternative prompt assuming tool expects tinybars for amount:
      // const prompt = `Approve an HBAR allowance. Owner: ${operatorAccountId.toString()}, Spender: ${recipientAccount.toString()}, Amount: ${allowanceAmountHbar.toTinybars().toString()} tinybars. Memo: "HBAR Allowance Test"`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(
        result.success,
        `HBAR Allowance Approval Failed: ${
          result.error
        } - Intermediate Steps: ${JSON.stringify(
          agentResult.intermediateSteps
        )}`
      ).toBe(true);
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      console.log(
        `Successfully approved HBAR allowance from ${operatorAccountId.toString()} for ${recipientAccount.toString()}.`
      );
      // TODO: Query allowance or attempt transfer by spender.
    });
  });

  describe('ApproveFungibleTokenAllowanceTool', () => {
    it('should approve a fungible token allowance for a spender account', async () => {
      const tool = new HederaApproveFungibleTokenAllowanceTool({
        hederaKit: kit,
      });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);
      const allowanceAmount = 500; // 5.00 tokens if decimals is 2

      // Operator (owner of ftForAllowanceId) grants allowance to recipientAccount
      const prompt = `Approve a fungible token allowance. Owner: ${operatorAccountId.toString()}, Spender: ${recipientAccount.toString()}, Token ID: ${ftForAllowanceId.toString()}, Amount: ${allowanceAmount}. Memo: "FT Allowance Test"`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(
        result.success,
        `Fungible Token Allowance Approval Failed: ${
          result.error
        } - Intermediate Steps: ${JSON.stringify(
          agentResult.intermediateSteps
        )}`
      ).toBe(true);
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      console.log(
        `Successfully approved FT allowance for token ${ftForAllowanceId.toString()} from ${operatorAccountId.toString()} to ${recipientAccount.toString()}.`
      );
    });
  });

  describe('ApproveTokenNftAllowanceTool', () => {
    it('should approve a specific NFT serial for a spender account', async () => {
      const tool = new HederaApproveTokenNftAllowanceTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);

      const prompt = `Approve NFT allowance. Owner: ${operatorAccountId.toString()}, Spender: ${recipientAccount.toString()}, Token ID: ${nftForNftAllowanceId.toString()}, Serials: [${nftSerialToAllow}]. Memo: "NFT Serial Allowance Test"`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(
        result.success,
        `NFT Serial Allowance Approval Failed: ${
          result.error
        } - Intermediate Steps: ${JSON.stringify(
          agentResult.intermediateSteps
        )}`
      ).toBe(true);
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      console.log(
        `Successfully approved NFT serial ${nftSerialToAllow} of ${nftForNftAllowanceId.toString()} from ${operatorAccountId.toString()} for ${recipientAccount.toString()}.`
      );
    });

    it('should approve all serials of an NFT collection for a spender account', async () => {
      const tool = new HederaApproveTokenNftAllowanceTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);

      // Operator (owner of nftForNftAllowanceId) grants allowance for ALL serials to recipientAccount
      const prompt = `Approve NFT allowance for ALL serials. Owner: ${operatorAccountId.toString()}, Spender: ${recipientAccount.toString()}, Token ID: ${nftForNftAllowanceId.toString()}. Memo: "NFT All Serials Allowance Test"`;
      // Note: The tool's Zod schema should have an 'allSerials: boolean' field which the LLM needs to pick up from "ALL serials".

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(
        result.success,
        `NFT All Serials Allowance Approval Failed: ${
          result.error
        } - Intermediate Steps: ${JSON.stringify(
          agentResult.intermediateSteps
        )}`
      ).toBe(true);
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      console.log(
        `Successfully approved all serials of NFT collection ${nftForNftAllowanceId.toString()} from ${operatorAccountId.toString()} for ${recipientAccount.toString()}.`
      );
    });
  });

  describe('RevokeHbarAllowanceTool', () => {
    beforeEach(async () => {
      // Ensure there is an allowance to revoke by approving one first.
      // This makes the test self-contained for the revocation part.
      const approveTool = new HederaApproveHbarAllowanceTool({
        hederaKit: kit,
      });
      const agentExecutorApprove = await createTestAgentExecutor(
        approveTool,
        openAIApiKey
      );
      const allowanceAmountHbar = new SDKHbar(3); // Approve 3 HBAR
      const approvePrompt = `Approve an HBAR allowance. Owner: ${operatorAccountId.toString()}, Spender: ${recipientAccount.toString()}, Amount: ${allowanceAmountHbar.toString()}. Memo: "Pre-Revoke HBAR Allowance"`;

      const approveAgentResult = await agentExecutorApprove.invoke({
        input: approvePrompt,
      });
      const approveResult = getToolOutputFromResult(approveAgentResult);
      expect(
        approveResult.success,
        `Pre-Revoke HBAR Allowance Approval Failed: ${approveResult.error}`
      ).toBe(true);
      console.log(
        `Pre-Revoke: Successfully approved HBAR allowance from ${operatorAccountId.toString()} for ${recipientAccount.toString()}.`
      );
    });

    it('should revoke an HBAR allowance for a spender account', async () => {
      const tool = new HederaRevokeHbarAllowanceTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);

      // The operator (kit.signer) is the owner revoking the allowance.
      const prompt = `Revoke HBAR allowance. Owner: ${operatorAccountId.toString()}, Spender: ${recipientAccount.toString()}. Memo: "Revoke HBAR Allowance Test"`;
      // The tool should handle setting the amount to 0 internally.

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(
        result.success,
        `HBAR Allowance Revocation Failed: ${
          result.error
        } - Intermediate Steps: ${JSON.stringify(
          agentResult.intermediateSteps
        )}`
      ).toBe(true);
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      console.log(
        `Successfully revoked HBAR allowance from ${operatorAccountId.toString()} for ${recipientAccount.toString()}.`
      );
    });
  });

  describe('RevokeFungibleTokenAllowanceTool', () => {
    beforeEach(async () => {
      // Ensure there is an FT allowance to revoke
      const approveFtTool = new HederaApproveFungibleTokenAllowanceTool({
        hederaKit: kit,
      });
      const agentExecutorApprove = await createTestAgentExecutor(
        approveFtTool,
        openAIApiKey
      );
      const allowanceAmount = 700; // Some amount
      const approveFtPrompt = `Approve a fungible token allowance. Owner: ${operatorAccountId.toString()}, Spender: ${recipientAccount.toString()}, Token ID: ${ftForAllowanceId.toString()}, Amount: ${allowanceAmount}. Memo: "Pre-Revoke FT Allowance"`;

      const approveFtAgentResult = await agentExecutorApprove.invoke({
        input: approveFtPrompt,
      });
      const approveFtResult = getToolOutputFromResult(approveFtAgentResult);
      expect(
        approveFtResult.success,
        `Pre-Revoke FT Allowance Approval Failed: ${approveFtResult.error}`
      ).toBe(true);
      console.log(
        `Pre-Revoke: Successfully approved FT allowance for token ${ftForAllowanceId.toString()} from ${operatorAccountId.toString()} to ${recipientAccount.toString()}.`
      );
    });

    it('should revoke a fungible token allowance for a spender account', async () => {
      const tool = new HederaRevokeFungibleTokenAllowanceTool({
        hederaKit: kit,
      });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);

      const prompt = `Revoke fungible token allowance. Owner: ${operatorAccountId.toString()}, Spender: ${recipientAccount.toString()}, Token ID: ${ftForAllowanceId.toString()}. Memo: "Revoke FT Allowance Test"`;
      // The tool should handle setting the amount to 0 internally for revocation.

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(
        result.success,
        `FT Allowance Revocation Failed: ${
          result.error
        } - Intermediate Steps: ${JSON.stringify(
          agentResult.intermediateSteps
        )}`
      ).toBe(true);
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      console.log(
        `Successfully revoked FT allowance for token ${ftForAllowanceId.toString()} from ${operatorAccountId.toString()} for ${recipientAccount.toString()}.`
      );
    });
  });

  describe('HederaDeleteNftSpenderAllowanceTool', () => {
    beforeEach(async () => {
      // Ensure there is a specific NFT serial allowance to delete.
      // Approve recipientAccount for nftSerialToAllow of nftForNftAllowanceId (owned by operator)
      const approveTool = new HederaApproveTokenNftAllowanceTool({
        hederaKit: kit,
      });
      const agentExecutorApprove = await createTestAgentExecutor(
        approveTool,
        openAIApiKey
      );
      const approvePrompt = `Approve NFT allowance. Owner: ${operatorAccountId.toString()}, Spender: ${recipientAccount.toString()}, Token ID: ${nftForNftAllowanceId.toString()}, Serials: [${nftSerialToAllow}]. Memo: "Pre-Delete NFT Spender Allowance"`;

      const approveAgentResult = await agentExecutorApprove.invoke({
        input: approvePrompt,
      });
      const approveResult = getToolOutputFromResult(approveAgentResult);
      expect(
        approveResult.success,
        `Pre-Delete NFT Spender Allowance: Approval Failed: ${approveResult.error}`
      ).toBe(true);
      console.log(
        `Pre-Delete NFT Spender Allowance: Successfully approved NFT serial ${nftSerialToAllow} of ${nftForNftAllowanceId.toString()} for ${recipientAccount.toString()}.`
      );
    });

    it('should delete a specific NFT serial allowance for a spender account', async () => {
      const tool = new HederaDeleteNftSpenderAllowanceTool({ hederaKit: kit });
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);

      // Operator (owner) deletes the allowance for recipientAccount for the specific serial.
      const prompt = `Delete NFT allowance. Owner: ${operatorAccountId.toString()}, Spender: ${recipientAccount.toString()}, Token ID: ${nftForNftAllowanceId.toString()}, Serials: [${nftSerialToAllow}]. Memo: "Delete NFT Spender Allowance Test"`;
      // The transaction must be signed by the owner (operator in this case).

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(
        result.success,
        `Delete NFT Spender Allowance Failed: ${
          result.error
        } - Intermediate Steps: ${JSON.stringify(
          agentResult.intermediateSteps
        )}`
      ).toBe(true);
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      console.log(
        `Successfully deleted NFT serial ${nftSerialToAllow} allowance for token ${nftForNftAllowanceId.toString()} from owner ${operatorAccountId.toString()} for spender ${recipientAccount.toString()}.`
      );
      // TODO: Query allowance to verify deletion (complex, requires specific mirror node support for deleted allowances or attempting a spender transfer).
    });
  });

  describe('HederaDeleteNftSerialAllowancesTool', () => {
    beforeEach(async () => {
      // Ensure there is an NFT allowance to delete.
      const approveTool = new HederaApproveTokenNftAllowanceTool({
        hederaKit: kit,
      });
      const agentExecutorApprove = await createTestAgentExecutor(
        approveTool,
        openAIApiKey
      );
      // Approve for a specific serial, the tool will delete for this serial for all spenders
      const approvePrompt = `Approve NFT allowance. Owner: ${operatorAccountId.toString()}, Spender: ${recipientAccount.toString()}, Token ID: ${nftForNftAllowanceId.toString()}, Serials: [${nftSerialToAllow}]. Memo: "Pre-Delete NFT Serial Allowances"`;

      const approveAgentResult = await agentExecutorApprove.invoke({
        input: approvePrompt,
      });
      const approveResult = getToolOutputFromResult(approveAgentResult);
      expect(
        approveResult.success,
        `Pre-Delete NFT Serial Allowances: Approval Failed: ${approveResult.error}`
      ).toBe(true);
      console.log(
        `Pre-Delete NFT Serial Allowances: Successfully approved NFT serial ${nftSerialToAllow} of ${nftForNftAllowanceId.toString()} for ${recipientAccount.toString()}.`
      );
    });

    it('should delete all spender allowances for a specific NFT serial granted by an owner', async () => {
      const tool = new HederaDeleteNftSerialAllowancesTool({ hederaKit: kit }); // Use renamed tool
      const agentExecutor = await createTestAgentExecutor(tool, openAIApiKey);

      const nftIdString = `${nftForNftAllowanceId.toString()}.${nftSerialToAllow}`;
      const prompt = `Delete all NFT allowances for NFT serial ${nftIdString} where I am the owner. Owner: ${operatorAccountId.toString()}. Memo: "Delete NFT Serial Allowances Test"`;

      const agentResult = await agentExecutor.invoke({ input: prompt });
      const result = getToolOutputFromResult(agentResult);

      expect(
        result.success,
        `Delete NFT Serial Allowances Failed: ${
          result.error
        } - Intermediate Steps: ${JSON.stringify(
          agentResult.intermediateSteps
        )}`
      ).toBe(true);
      expect(result.receipt).toBeDefined();
      expect(result.receipt.status).toEqual('SUCCESS');
      console.log(
        `Successfully deleted all spender allowances for NFT serial ${nftIdString} granted by owner ${operatorAccountId.toString()}.`
      );
    });
  });

  // More account tool tests will go here
});
