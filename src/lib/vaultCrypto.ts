/**
 * PIN-derived encryption for the local vault.
 *
 * The vault's job is to make a saved record unreadable to anyone who doesn't have the
 * PIN — not to keep the PIN itself secret. For this hackathon build the PIN is a fixed,
 * published default (see `DEFAULT_DEMO_PIN`), printed on the lock screen so judges can get
 * in without being told a secret out of band. That makes this a real, working
 * demonstration of PIN-derived encryption at rest, not a claim that the vault is
 * confidential against someone who has read this file. A shipped version would have the
 * person choose their own PIN privately on first use — see docs/SECURITY.md.
 *
 * The mechanism itself is not theatre: PBKDF2-SHA256 derives an AES-256-GCM key from the
 * PIN and a random per-device salt, and every vault entry is encrypted with it before it
 * touches IndexedDB. Reading the raw browser storage gets you ciphertext, not an image.
 */

export const DEFAULT_DEMO_PIN = '1234';

/**
 * Same reasoning as `DEFAULT_DEMO_PIN`: for this hackathon build, the duress PIN is also a
 * fixed published value rather than something the person has to set up privately, so judges
 * can find and try the decoy-vault feature (see `VaultScreen.tsx`, `docs/SECURITY.md`)
 * without an extra step. A real deployment would never publish this — see the "Duress PIN"
 * section of docs/SECURITY.md for exactly what publishing it here does and doesn't cost.
 */
export const DEFAULT_DURESS_PIN = '9999';

const PBKDF2_ITERATIONS = 150_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const CANARY_TEXT = 'evidence-vault-pin-ok';

/**
 * TypeScript's DOM lib types `BufferSource` as tied to a plain `ArrayBuffer`, but
 * `Uint8Array`'s own type parameter is the looser `ArrayBufferLike` (which also admits
 * `SharedArrayBuffer`). Every array here is freshly allocated with `new Uint8Array(...)`,
 * never a view over a shared buffer, so this narrowing is safe — it just tells the
 * compiler what's already true at runtime.
 */
const buf = (u: Uint8Array): BufferSource => u as BufferSource;

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: buf(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function newSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

/**
 * First run: pick a salt, derive a key from the PIN, and encrypt a known "canary" string
 * with it. There is nothing else to check a PIN against before the vault holds any
 * entries, so the canary is what later unlock attempts are verified against.
 */
export async function setupPin(
  pin: string,
): Promise<{ key: CryptoKey; salt: Uint8Array; canaryIv: Uint8Array; canaryCiphertext: Uint8Array }> {
  const salt = newSalt();
  const key = await deriveKey(pin, salt);
  const canaryIv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const canaryCiphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(canaryIv) }, key, buf(new TextEncoder().encode(CANARY_TEXT))),
  );
  return { key, salt, canaryIv, canaryCiphertext };
}

/**
 * Later runs: derive a key from the attempted PIN and try to decrypt the stored canary.
 * A wrong PIN derives a different key, which fails GCM's authentication check rather than
 * producing garbage text — so failure here is unambiguous.
 */
export async function unlockWithPin(
  pin: string,
  salt: Uint8Array,
  canaryIv: Uint8Array,
  canaryCiphertext: Uint8Array,
): Promise<CryptoKey | null> {
  const key = await deriveKey(pin, salt);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf(canaryIv) }, key, buf(canaryCiphertext));
    return new TextDecoder().decode(plain) === CANARY_TEXT ? key : null;
  } catch {
    return null;
  }
}

export async function encryptBytes(
  key: CryptoKey,
  plain: Uint8Array,
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(iv) }, key, buf(plain)));
  return { iv, ciphertext };
}

export async function decryptBytes(key: CryptoKey, iv: Uint8Array, ciphertext: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf(iv) }, key, buf(ciphertext)));
}
