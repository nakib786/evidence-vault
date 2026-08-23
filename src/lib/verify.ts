/**
 * Independent verification: given an arbitrary file and its detached `.ots` proof, confirm
 * the file's own SHA-256 digest is the one embedded in the proof, and read off whatever
 * attestation state the proof currently carries. This asks nothing of the vault or of this
 * app's own capture flow — it works for a file and proof pair from anywhere, which is the
 * point: the proof was always meant to outlive this app.
 */
import { sha256Blob, toHex } from './hash';
import { parseDetachedOts, confirmedBlockHeights, collectPendingUris } from './ots';

export interface VerifyResult {
  /** Digest embedded in the proof. */
  proofDigestHex: string;
  /** Digest recomputed from the uploaded file. */
  fileDigestHex: string;
  matches: boolean;
  confirmedHeights: number[];
  pendingUris: string[];
}

export async function verifyFileAgainstProof(file: Blob, otsBytes: Uint8Array): Promise<VerifyResult> {
  const { digest, timestamp } = parseDetachedOts(otsBytes);
  const proofDigestHex = toHex(digest);
  const fileDigestHex = toHex(await sha256Blob(file));

  return {
    proofDigestHex,
    fileDigestHex,
    matches: proofDigestHex === fileDigestHex,
    confirmedHeights: confirmedBlockHeights(otsBytes),
    pendingUris: collectPendingUris(timestamp),
  };
}
