/**
 * Local storage for the vault.
 *
 * A hand-rolled IndexedDB wrapper rather than a dependency — the same call this codebase
 * already made for OpenTimestamps (see `ots.ts`). What's needed here is three operations
 * across two small object stores, which doesn't earn a package.
 *
 * This is also the one place in the app that keeps anything beyond the current tab. Every
 * other screen (see `App.tsx`) holds state in memory only, on purpose. Saving to the vault
 * is the explicit exception — the export screen triggers it automatically per record, with
 * a one-tap "don't keep this copy" to opt out (see `ExportScreen.tsx`), rather than
 * requiring an opt-in click. Everything written here beyond the PIN's salt and canary is
 * AES-GCM ciphertext; see `vaultCrypto.ts` for what encrypts it.
 */
import { decryptBytes, encryptBytes } from './vaultCrypto';
import { toHex } from './hash';
import type { CalendarResult } from './ots';
import type { EvidenceRecord, VaultRecord } from './types';

const DB_NAME = 'evidence-vault';
const DB_VERSION = 1;
const CONFIG_STORE = 'config';
const ENTRIES_STORE = 'entries';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CONFIG_STORE)) db.createObjectStore(CONFIG_STORE);
      if (!db.objectStoreNames.contains(ENTRIES_STORE)) db.createObjectStore(ENTRIES_STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function runRequest<T>(store: IDBObjectStore, make: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = make(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(name: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => Promise<T>): Promise<T> {
  const db = await openDb();
  try {
    return await run(db.transaction(name, mode).objectStore(name));
  } finally {
    db.close();
  }
}

// ---- PIN configuration -----------------------------------------------------

export interface PinConfig {
  salt: Uint8Array;
  canaryIv: Uint8Array;
  canaryCiphertext: Uint8Array;
}

export const loadPinConfig = (): Promise<PinConfig | null> =>
  withStore(CONFIG_STORE, 'readonly', async (s) => (await runRequest(s, (st) => st.get('pin'))) ?? null);

export const savePinConfig = async (config: PinConfig): Promise<void> => {
  await withStore(CONFIG_STORE, 'readwrite', (s) => runRequest(s, (st) => st.put(config, 'pin')));
};

// ---- Duress PIN configuration ------------------------------------------------
//
// A second, independent PIN, stored the same way as the real one (own salt, own canary —
// see vaultCrypto.ts) but under a different key, so it can be checked without touching the
// real config. Unlocking with it never derives the real key and never reads a single real
// entry's ciphertext — see useVault.ts. `clearVault` below wipes both, since a full reset
// should leave nothing configured either way.

export const loadDuressPinConfig = (): Promise<PinConfig | null> =>
  withStore(CONFIG_STORE, 'readonly', async (s) => (await runRequest(s, (st) => st.get('duress-pin'))) ?? null);

export const saveDuressPinConfig = async (config: PinConfig): Promise<void> => {
  await withStore(CONFIG_STORE, 'readwrite', (s) => runRequest(s, (st) => st.put(config, 'duress-pin')));
};

export const clearDuressPinConfig = async (): Promise<void> => {
  await withStore(CONFIG_STORE, 'readwrite', (s) => runRequest(s, (st) => st.delete('duress-pin')));
};

// ---- Entries ----------------------------------------------------------------

interface StoredEntry {
  id: string;
  savedAt: string;
  isDemo: boolean;
  demoConfirmedHeight?: number;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

export const deleteEntry = (id: string): Promise<void> =>
  withStore(ENTRIES_STORE, 'readwrite', (s) => runRequest(s, (st) => st.delete(id)));

export const clearVault = async (): Promise<void> => {
  await withStore(ENTRIES_STORE, 'readwrite', (s) => runRequest(s, (st) => st.clear()));
  await withStore(CONFIG_STORE, 'readwrite', (s) => runRequest(s, (st) => st.clear()));
};

// ---- Packing an EvidenceRecord to/from plaintext bytes -----------------------
//
// IndexedDB can store a Blob natively, but then the blob itself would sit in storage
// unencrypted — the whole point of this layer. So the file's bytes travel inside the same
// ciphertext as everything else: a small JSON header (length-prefixed) followed by the
// raw media bytes, encrypted as one buffer.

interface PackedMeta {
  id: string;
  mimeType: string;
  byteLength: number;
  source: EvidenceRecord['source'];
  kind: EvidenceRecord['kind'];
  durationSeconds?: number;
  hasAudio?: boolean;
  capturedAt: string;
  timeZone: string;
  digestHex: string;
  details: EvidenceRecord['details'];
  handover?: EvidenceRecord['handover'];
  captureMeta?: EvidenceRecord['captureMeta'];
  proof?: {
    otsHex: string;
    calendars: CalendarResult[];
    pendingUris: string[];
    submittedAt: string;
  };
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function packRecord(record: EvidenceRecord): Promise<Uint8Array> {
  const mediaBytes = new Uint8Array(await record.blob.arrayBuffer());
  const meta: PackedMeta = {
    id: record.id,
    mimeType: record.mimeType,
    byteLength: record.byteLength,
    source: record.source,
    kind: record.kind,
    durationSeconds: record.durationSeconds,
    hasAudio: record.hasAudio,
    capturedAt: record.capturedAt,
    timeZone: record.timeZone,
    digestHex: record.digestHex,
    details: record.details,
    handover: record.handover,
    captureMeta: record.captureMeta,
    proof: record.proof
      ? {
          otsHex: toHex(record.proof.ots),
          calendars: record.proof.calendars,
          pendingUris: record.proof.pendingUris,
          submittedAt: record.proof.submittedAt,
        }
      : undefined,
  };

  const metaBytes = new TextEncoder().encode(JSON.stringify(meta));
  const header = new Uint8Array(4);
  new DataView(header.buffer).setUint32(0, metaBytes.length, true);

  const out = new Uint8Array(4 + metaBytes.length + mediaBytes.length);
  out.set(header, 0);
  out.set(metaBytes, 4);
  out.set(mediaBytes, 4 + metaBytes.length);
  return out;
}

function unpackRecord(bytes: Uint8Array): EvidenceRecord {
  const metaLength = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true);
  const meta = JSON.parse(new TextDecoder().decode(bytes.slice(4, 4 + metaLength))) as PackedMeta;
  const mediaBytes = bytes.slice(4 + metaLength);

  return {
    id: meta.id,
    blob: new Blob([mediaBytes], { type: meta.mimeType }),
    mimeType: meta.mimeType,
    byteLength: meta.byteLength,
    source: meta.source,
    kind: meta.kind,
    durationSeconds: meta.durationSeconds,
    hasAudio: meta.hasAudio,
    capturedAt: meta.capturedAt,
    timeZone: meta.timeZone,
    digest: fromHex(meta.digestHex),
    digestHex: meta.digestHex,
    details: meta.details,
    handover: meta.handover,
    captureMeta: meta.captureMeta,
    proof: meta.proof
      ? {
          ots: fromHex(meta.proof.otsHex),
          calendars: meta.proof.calendars,
          pendingUris: meta.proof.pendingUris,
          submittedAt: meta.proof.submittedAt,
        }
      : undefined,
  };
}

export async function saveVaultEntry(
  key: CryptoKey,
  record: EvidenceRecord,
  opts: { isDemo?: boolean; demoConfirmedHeight?: number } = {},
): Promise<void> {
  const plain = await packRecord(record);
  const { iv, ciphertext } = await encryptBytes(key, plain);
  const entry: StoredEntry = {
    id: record.id,
    savedAt: new Date().toISOString(),
    isDemo: opts.isDemo ?? false,
    demoConfirmedHeight: opts.demoConfirmedHeight,
    iv,
    ciphertext,
  };
  await withStore(ENTRIES_STORE, 'readwrite', (s) => runRequest(s, (st) => st.put(entry)));
}

/**
 * Decrypt every entry with the given key. An entry that fails to decrypt (wrong key,
 * corrupted row) is skipped rather than failing the whole vault — one bad row shouldn't
 * hide the rest.
 */
export async function loadVaultEntries(key: CryptoKey): Promise<VaultRecord[]> {
  const stored = await withStore(ENTRIES_STORE, 'readonly', (s) => runRequest<StoredEntry[]>(s, (st) => st.getAll()));

  const out: VaultRecord[] = [];
  for (const entry of stored) {
    try {
      const plain = await decryptBytes(key, entry.iv, entry.ciphertext);
      out.push({
        record: unpackRecord(plain),
        savedAt: entry.savedAt,
        isDemo: entry.isDemo,
        demoConfirmedHeight: entry.demoConfirmedHeight,
      });
    } catch {
      // Skipped — see the doc comment above.
    }
  }
  out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return out;
}

/** Re-encrypt and overwrite a single entry, e.g. after `upgradeProof` finds a new attestation. */
export const updateVaultEntry = saveVaultEntry;
