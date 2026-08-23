/**
 * Fingerprint a captured file and get it timestamped — the same two steps the old
 * "Securing your record" screen used to walk through, extracted so they can run silently
 * in the background the instant something is captured, rather than as a screen the user
 * has to sit through. A capture session can hold several photos and videos now, and
 * blocking on each one in turn would mean waiting out N loading screens instead of one.
 *
 * Hashing is local and near-instant. Timestamp submission is a network round trip and can
 * fail; a failed timestamp is recoverable — the digest is still valid on its own — so it's
 * swallowed here rather than thrown, exactly as the screen it replaces used to do.
 */
import { sha256Blob, toHex } from './hash';
import { stampDigest } from './ots';
import type { TimestampProof } from './types';

export interface SecureResult {
  digest: Uint8Array;
  digestHex: string;
  proof?: TimestampProof;
}

export async function secureBlob(blob: Blob): Promise<SecureResult> {
  const digest = await sha256Blob(blob);
  const digestHex = toHex(digest);

  let proof: TimestampProof | undefined;
  try {
    const stamp = await stampDigest(digest);
    proof = {
      ots: stamp.ots,
      calendars: stamp.calendars,
      pendingUris: stamp.pendingUris,
      submittedAt: new Date().toISOString(),
    };
  } catch {
    proof = undefined;
  }

  return { digest, digestHex, proof };
}
