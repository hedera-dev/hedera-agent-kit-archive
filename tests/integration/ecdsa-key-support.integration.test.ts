import { describe, it, expect, beforeAll } from 'vitest';
import { PrivateKey } from '@hashgraph/sdk';
import { ServerSigner } from '../../src/signer/server-signer';
import { HederaAgentKit } from '../../src/agent/agent';
import { parseKey } from '../../src/utils/key-utils';
import { detectKeyTypeFromMirrorNode } from '../../src/utils/key-type-detector';
import './setup-env';
import { HederaMirrorNode } from '../../src/services';

describe('ECDSA Key Support Integration Tests', () => {
  let testAccountIdECDSA: string;
  let testAccountIdECDSAHexEncoded: string;
  let testAccountIdECDSADerEncoded: string;

  let testAccountIdED25519: string;
  let testAccountIdED25519HexEncoded: string;
  let testAccountIdED25519DerEncoded: string;

  let testNetwork: 'testnet' | 'mainnet' = 'testnet';
  let mirrorNode = new HederaMirrorNode(testNetwork);

  beforeAll(async () => {
    testAccountIdECDSA = '0.0.3626626';
    testAccountIdECDSAHexEncoded = '0x3f9851dfafd9e168015da972acfb2adc4413bd085600bf26faddcf50f2fbea23';
    testAccountIdECDSADerEncoded = '3030020100300706052b8104000a042204203f9851dfafd9e168015da972acfb2adc4413bd085600bf26faddcf50f2fbea23';

    testAccountIdED25519 = '0.0.3573758';
    testAccountIdED25519HexEncoded = '0x240e25755ee21aa8ad034a125cc5b33343c1a73eed0a573a2f3c1d8879849eb7';
    testAccountIdED25519DerEncoded = '302e020100300506032b657004220420240e25755ee21aa8ad034a125cc5b33343c1a73eed0a573a2f3c1d8879849eb7';
  });

  describe('Key Type Detection', () => {
    it('should correctly detect ECDSA key with 0x prefix', async () => {
      const result = await detectKeyTypeFromMirrorNode(mirrorNode, testAccountIdECDSA, testAccountIdECDSAHexEncoded);

      expect(result.detectedType).toBe('ecdsa');
      expect(result.privateKey).toBeDefined();
    });

    it('should correctly detect ECDSA key with DER prefix', async () => {
      const result = await detectKeyTypeFromMirrorNode(mirrorNode, testAccountIdECDSA, testAccountIdECDSADerEncoded);

      expect(result.detectedType).toBe('ecdsa');
      expect(result.privateKey).toBeDefined();
    });

    it('should correctly detect ED25519 key', async () => {
      const result = await detectKeyTypeFromMirrorNode(mirrorNode, testAccountIdED25519, testAccountIdED25519DerEncoded);

      expect(result.detectedType).toBe('ed25519');
      expect(result.privateKey).toBeDefined();
    });

    it('should handle key detection in parseKey utility', async () => {
      const parsedKey = await parseKey(mirrorNode, testAccountIdECDSA, testAccountIdECDSAHexEncoded);

      expect(parsedKey).toBeDefined();
      expect(parsedKey).not.toBeNull();
    });
  });

  describe('ServerSigner with ECDSA Keys', () => {
    it('should create ServerSigner with ECDSA key string', async () => {
      const ecdsaPrivateKey = PrivateKey.generateECDSA();
      const ecdsaKeyString = ecdsaPrivateKey.toString();

      const signer = await ServerSigner.create(
        testAccountIdECDSA,
        ecdsaKeyString,
        testNetwork
      );

      expect(signer).toBeDefined();
      expect(signer.getAccountId().toString()).toBe(testAccountIdECDSA);
      expect(signer.getKeyType()).toBeDefined();
    });

    it('should create ServerSigner with ED25519 key string', async () => {
      const ed25519PrivateKey = PrivateKey.generateED25519();
      const ed25519KeyString = ed25519PrivateKey.toString();

      const signer = await ServerSigner.create(
        testAccountIdED25519,
        ed25519KeyString,
        testNetwork
      );

      expect(signer).toBeDefined();
      expect(signer.getAccountId().toString()).toBe(testAccountIdED25519);
      expect(signer.getKeyType()).toBe('ed25519');
    });

    it('should handle PrivateKey object directly', async () => {
      const privateKey = PrivateKey.fromString(testAccountIdECDSADerEncoded);

      const signer = await ServerSigner.create(testAccountIdECDSA, privateKey, testNetwork);

      expect(signer).toBeDefined();
      expect(signer.getAccountId().toString()).toBe(testAccountIdECDSA);
    });
  });

  describe('HederaAgentKit with ECDSA Keys', () => {
    it('should create HederaAgentKit with ECDSA signer', async () => {
      const signer = await ServerSigner.create(
        testAccountIdECDSA,
        testAccountIdECDSADerEncoded,
        testNetwork
      );

      const testKit = new HederaAgentKit(signer);

      expect(testKit).toBeDefined();
      expect(testKit.signer).toBe(signer);
    });
  });

  describe('Account Operations with ECDSA Keys', () => {
    it('should handle ECDSA key in account creation', async () => {
      const signer = await ServerSigner.create(
        testAccountIdECDSA,
        testAccountIdECDSADerEncoded,
        testNetwork
      );

      const testKit = new HederaAgentKit(signer);
      await testKit.initialize();
      const accountBuilder = testKit.accounts();

      const newAccountKey = PrivateKey.generateECDSA();
      const keyString = newAccountKey.toString();

      const builder = await accountBuilder.createAccount({ key: keyString });
      const transaction = builder.getCurrentTransaction();

      expect(transaction).toBeDefined();
    });

    it('should handle ECDSA key in account update', async () => {
      const signer = await ServerSigner.create(
        testAccountIdECDSA,
        testAccountIdECDSADerEncoded,
        testNetwork
      );

      const testKit = new HederaAgentKit(signer);
      await testKit.initialize();
      const accountBuilder = testKit.accounts();

      const newKey = PrivateKey.generateECDSA();
      const keyString = newKey.toString();

      const builder = await accountBuilder
        .updateAccount({
          accountIdToUpdate: testAccountIdECDSA,
          key: keyString,
          amount: 0,
        })
      const transaction = builder.getCurrentTransaction();

      expect(transaction).toBeDefined();
    });
  });

  describe('File Operations with ECDSA Keys', () => {
    it('should handle ECDSA keys in file creation', async () => {
      const signer = await ServerSigner.create(
        testAccountIdECDSA,
        testAccountIdECDSADerEncoded,
        testNetwork
      );
      const testKit = new HederaAgentKit(signer);
      await testKit.initialize();
      const fileBuilder = testKit.fs();

      const key1 = PrivateKey.generateECDSA().toString();
      const key2 = PrivateKey.generateED25519().toString();

      const builder = await fileBuilder
        .createFile({
          contents: 'Test file with mixed key types',
          keys: [key1, key2],
        })
      const transaction = builder.getCurrentTransaction()

      expect(transaction).toBeDefined();
    });
  });

  describe('Contract Operations with ECDSA Admin Keys', () => {
    it('should handle ECDSA admin key in contract creation', async () => {
      const signer = await ServerSigner.create(
        testAccountIdECDSA,
        testAccountIdECDSAHexEncoded,
        testNetwork
      );

      const testKit = new HederaAgentKit(signer);
      await testKit.initialize();
      const contractBuilder = testKit.scs();

      const adminKey = PrivateKey.generateECDSA().toString();

      const builder = await contractBuilder
        .createContract({
          bytecode: '0x123456',
          adminKey: adminKey,
          gas: 100000,
          contractId: '0.0.1234567890',
          functionName: 'functionName',
        })
      const transaction = builder.getCurrentTransaction()

      expect(transaction).toBeDefined();
    });
  });

  describe('Mirror Node Key Type Verification', () => {
    it('should detect ECDSA key type using ServerSigner', async () => {
      const signer = await ServerSigner.create(
        testAccountIdECDSA,
        testAccountIdECDSADerEncoded,
        testNetwork
      );
      const keyType = signer.getKeyType();
      expect(keyType).toBe('ecdsa');
    });

    it('should detect ED25519 key type using ServerSigner', async () => {
      const signer = await ServerSigner.create(
        testAccountIdED25519,
        testAccountIdED25519DerEncoded,
        testNetwork
      );
      const keyType = signer.getKeyType();
      expect(keyType).toBe('ed25519');
    });
  });
});
