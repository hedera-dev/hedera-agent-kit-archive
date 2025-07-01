import { Key, PublicKey } from '@hashgraph/sdk';
import { detectKeyTypeFromMirrorNode } from './key-type-detector';
import { HederaMirrorNode } from '../services';

/**
 * Parses a string representation of a key into an SDK Key object.
 * Supports hex-encoded private keys (derives public key) or hex/DER-encoded public keys.
 * @param keyString The key string.
 * @returns An SDK Key object or null if parsing fails.
 */
export async function parseKey(mirrorNode: HederaMirrorNode, accountId: string, keyString: string): Promise<Key | null> {
  if (!keyString) {
    return null;
  }
  try {
    const keyDetection = await detectKeyTypeFromMirrorNode(mirrorNode, accountId, keyString);
    return keyDetection.privateKey.publicKey;
  } catch {
    try {
      return PublicKey.fromString(keyString);
    } catch {
      return null;
    }
  }
}
