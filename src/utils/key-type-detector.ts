import { PrivateKey } from '@hashgraph/sdk';
import { HederaMirrorNode } from '../services';

export type KeyType = 'ed25519' | 'ecdsa';

export interface KeyDetectionResult {
  detectedType: KeyType;
  privateKey: PrivateKey;
}

/**
 * Detects the key type for a given account by querying the Hedera mirror node,
 * then parses the provided private key string according to the detected type.
 * @param mirrorNode - The HederaMirrorNode instance to use for account info lookup.
 * @param accountId - The account ID to fetch key type for.
 * @param privateKeyString - The private key string to parse.
 * @returns The detected key type and the parsed PrivateKey.
 * @throws Error if the key type is not supported or the private key cannot be parsed.
 */
export async function detectKeyTypeFromMirrorNode(
  mirrorNode: HederaMirrorNode,
  accountId: string,
  privateKeyString: string
): Promise<KeyDetectionResult> {
  try {
    const accountInfo = await mirrorNode.requestAccount(accountId);

    let detectedType: KeyType;
    let privateKey: PrivateKey;

    if (accountInfo.key._type === 'ECDSA_SECP256K1') {
      detectedType = 'ecdsa';
      privateKey = PrivateKey.fromStringECDSA(privateKeyString);
    } else if (accountInfo.key._type === 'ED25519') {
      detectedType = 'ed25519';
      privateKey = PrivateKey.fromStringED25519(privateKeyString);
    } else {
      throw new Error(
        `[detectKeyTypeFromMirrorNode] Unsupported key type: ${accountInfo.key._type}`
      );
    }

    return { detectedType, privateKey };
  } catch (error) {
    throw new Error(
      `[detectKeyTypeFromMirrorNode] Failed to detect or parse key for account ${accountId}: ${(error as Error).message}`,
    );
  }
}
