/**
 * SHA-256 over evidence bytes, via the Web Crypto API.
 *
 * This is the anchor for everything else: the digest is what gets timestamped, what goes
 * in the PDF, and what anyone re-checking the file later recomputes for themselves. It is
 * deliberately computed from the exact bytes of the captured file, so any later edit —
 * even one that looks identical — produces a different digest and breaks the proof.
 */

/** Lowercase hex, the form used in the report and by the OpenTimestamps tooling. */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Group a digest into 8 four-character blocks.
 *
 * A 64-character run of hex is effectively impossible to compare by eye, and someone
 * checking a printed report against a screen is exactly who this is for.
 */
export function formatDigestForHumans(hex: string): string {
  return (hex.match(/.{1,8}/g) ?? []).join(' ');
}

export async function sha256(bytes: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const buf = bytes instanceof Uint8Array ? (bytes.slice().buffer as ArrayBuffer) : bytes;
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return new Uint8Array(digest);
}

export async function sha256Blob(blob: Blob): Promise<Uint8Array> {
  return sha256(await blob.arrayBuffer());
}
