/**
 * A minimal, dependency-free OpenTimestamps client that runs in the browser.
 *
 * Why hand-rolled instead of the `opentimestamps` npm package: that package was last
 * published in 2021, is LGPL-3.0, and depends on `fs`, `request`, `request-promise` and
 * `bitcore-lib`. None of those work in a browser bundle without heavy Node polyfills.
 * The wire format we actually need is small, so we implement it directly against the
 * spec. Output is validated against the reference implementation in `scripts/ots_validate.py`.
 *
 * Format reference: https://github.com/opentimestamps/python-opentimestamps
 * (opentimestamps/core/timestamp.py, op.py, notary.py)
 */

/** `\x00OpenTimestamps\x00\x00Proof\x00\xbf\x89\xe2\xe8\x84\xe8\x92\x94` — 31 bytes. */
const HEADER_MAGIC = new Uint8Array([
  0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61, 0x6d, 0x70, 0x73,
  0x00, 0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf, 0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94,
]);

const MAJOR_VERSION = 0x01;

/** Operation tags. Binary ops carry an argument; unary ops do not. */
const OP_SHA1 = 0x02;
const OP_RIPEMD160 = 0x03;
const OP_SHA256 = 0x08;
const OP_KECCAK256 = 0x67;
const OP_APPEND = 0xf0;
const OP_PREPEND = 0xf1;
const OP_REVERSE = 0xf2;
const OP_HEXLIFY = 0xf3;

const BINARY_OPS = new Set([OP_APPEND, OP_PREPEND]);
const UNARY_OPS = new Set([OP_SHA1, OP_RIPEMD160, OP_SHA256, OP_KECCAK256, OP_REVERSE, OP_HEXLIFY]);

const ATTESTATION_MARKER = 0x00;
const FORK_MARKER = 0xff;

const PENDING_TAG = '83dfe30d2ef90c8e';
const BITCOIN_TAG = '0588960d73d71901';
const LITECOIN_TAG = '06869a0d73d71b45';

/**
 * Public calendar servers. All confirmed to return `Access-Control-Allow-Origin: *`.
 *
 * These are queried in parallel and we keep every response that succeeds, so a proof
 * does not depend on any single calendar operator staying online.
 */
export const CALENDARS = [
  'https://a.pool.opentimestamps.org',
  'https://b.pool.opentimestamps.org',
  'https://a.pool.eternitywall.com',
  'https://finney.calendar.eternitywall.com',
] as const;

// ---------------------------------------------------------------------------
// Byte reader / writer
// ---------------------------------------------------------------------------

class Writer {
  private buf: number[] = [];

  u8(value: number): void {
    this.buf.push(value & 0xff);
  }

  raw(bytes: Uint8Array): void {
    for (const b of bytes) this.buf.push(b);
  }

  /** OTS varuint: 7 bits per byte, high bit set while more bytes follow. */
  varuint(value: number): void {
    if (value === 0) {
      this.buf.push(0);
      return;
    }
    while (value !== 0) {
      let b = value & 0b0111_1111;
      if (value > 0b0111_1111) b |= 0b1000_0000;
      this.buf.push(b);
      value >>>= 7;
    }
  }

  varbytes(bytes: Uint8Array): void {
    this.varuint(bytes.length);
    this.raw(bytes);
  }

  finish(): Uint8Array {
    return new Uint8Array(this.buf);
  }
}

class Reader {
  private pos = 0;
  private readonly buf: Uint8Array;

  constructor(buf: Uint8Array) {
    this.buf = buf;
  }

  get exhausted(): boolean {
    return this.pos >= this.buf.length;
  }

  u8(): number {
    if (this.pos >= this.buf.length) throw new Error('OTS parse: unexpected end of input');
    return this.buf[this.pos++];
  }

  take(n: number): Uint8Array {
    if (this.pos + n > this.buf.length) throw new Error('OTS parse: unexpected end of input');
    const out = this.buf.slice(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }

  varuint(): number {
    let value = 0;
    let shift = 0;
    for (;;) {
      const b = this.u8();
      value |= (b & 0b0111_1111) << shift;
      if ((b & 0b1000_0000) === 0) return value >>> 0;
      shift += 7;
      if (shift > 35) throw new Error('OTS parse: varuint too long');
    }
  }

  varbytes(): Uint8Array {
    return this.take(this.varuint());
  }
}

// ---------------------------------------------------------------------------
// Timestamp tree
// ---------------------------------------------------------------------------

export interface Attestation {
  /** 8-byte tag, hex encoded. */
  tag: string;
  /** Raw attestation payload, kept verbatim so we can round-trip unknown types. */
  payload: Uint8Array;
  /** Calendar URI, for pending attestations. */
  uri?: string;
  /** Block height, for Bitcoin/Litecoin attestations. */
  height?: number;
}

export interface Timestamp {
  attestations: Attestation[];
  ops: OpBranch[];
}

interface OpBranch {
  tag: number;
  /** Present only for binary ops (append / prepend). */
  arg?: Uint8Array;
  next: Timestamp;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function parseAttestation(r: Reader): Attestation {
  const tag = toHex(r.take(8));
  const payload = r.varbytes();
  const att: Attestation = { tag, payload };

  const inner = new Reader(payload);
  try {
    if (tag === PENDING_TAG) {
      att.uri = new TextDecoder().decode(inner.varbytes());
    } else if (tag === BITCOIN_TAG || tag === LITECOIN_TAG) {
      att.height = inner.varuint();
    }
  } catch {
    // Unknown or malformed payload: keep the raw bytes so re-serialization is lossless.
  }
  return att;
}

function serializeAttestation(w: Writer, att: Attestation): void {
  for (let i = 0; i < 16; i += 2) w.u8(parseInt(att.tag.slice(i, i + 2), 16));
  w.varbytes(att.payload);
}

/** Mirrors `Timestamp.deserialize` in the reference implementation. */
function parseTimestamp(r: Reader, depth = 0): Timestamp {
  if (depth > 256) throw new Error('OTS parse: recursion limit reached');
  const ts: Timestamp = { attestations: [], ops: [] };

  const consume = (tag: number): void => {
    if (tag === ATTESTATION_MARKER) {
      ts.attestations.push(parseAttestation(r));
      return;
    }
    if (BINARY_OPS.has(tag)) {
      const arg = r.varbytes();
      ts.ops.push({ tag, arg, next: parseTimestamp(r, depth + 1) });
      return;
    }
    if (UNARY_OPS.has(tag)) {
      ts.ops.push({ tag, next: parseTimestamp(r, depth + 1) });
      return;
    }
    throw new Error(`OTS parse: unknown tag 0x${tag.toString(16)}`);
  };

  let tag = r.u8();
  while (tag === FORK_MARKER) {
    consume(r.u8());
    tag = r.u8();
  }
  consume(tag);

  return ts;
}

/** Mirrors `Timestamp.serialize` in the reference implementation. */
function serializeTimestamp(w: Writer, ts: Timestamp): void {
  if (ts.attestations.length === 0 && ts.ops.length === 0) {
    throw new Error('OTS serialize: empty timestamp');
  }

  const atts = [...ts.attestations].sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));
  const ops = [...ts.ops].sort(
    (a, b) => a.tag - b.tag || toHex(a.arg ?? new Uint8Array()).localeCompare(toHex(b.arg ?? new Uint8Array())),
  );

  // Every attestation but the last is emitted as its own fork.
  for (const att of atts.slice(0, -1)) {
    w.u8(FORK_MARKER);
    w.u8(ATTESTATION_MARKER);
    serializeAttestation(w, att);
  }

  if (ops.length === 0) {
    w.u8(ATTESTATION_MARKER);
    serializeAttestation(w, atts[atts.length - 1]);
    return;
  }

  if (atts.length > 0) {
    w.u8(FORK_MARKER);
    w.u8(ATTESTATION_MARKER);
    serializeAttestation(w, atts[atts.length - 1]);
  }

  // Every op but the last is emitted as its own fork; the last continues inline.
  ops.forEach((branch, i) => {
    if (i < ops.length - 1) w.u8(FORK_MARKER);
    w.u8(branch.tag);
    if (branch.arg) w.varbytes(branch.arg);
    serializeTimestamp(w, branch.next);
  });
}

/**
 * Merge two timestamp trees rooted at the same message.
 *
 * Ops with an identical tag and argument describe the same path, so their subtrees are
 * merged recursively; anything else becomes a separate branch. This is what lets one
 * proof carry attestations from several independent calendars.
 */
function mergeTimestamps(a: Timestamp, b: Timestamp): Timestamp {
  const seen = new Set(a.attestations.map((x) => x.tag + toHex(x.payload)));
  const attestations = [...a.attestations];
  for (const att of b.attestations) {
    if (!seen.has(att.tag + toHex(att.payload))) attestations.push(att);
  }

  const ops = [...a.ops];
  for (const branch of b.ops) {
    const key = (o: OpBranch) => o.tag + ':' + toHex(o.arg ?? new Uint8Array());
    const match = ops.find((o) => key(o) === key(branch));
    if (match) {
      match.next = mergeTimestamps(match.next, branch.next);
    } else {
      ops.push(branch);
    }
  }

  return { attestations, ops };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CalendarResult {
  calendar: string;
  ok: boolean;
  error?: string;
}

export interface StampResult {
  /** Serialized detached `.ots` proof, ready to save alongside the evidence file. */
  ots: Uint8Array;
  /** Per-calendar outcome, for showing the user which ones responded. */
  calendars: CalendarResult[];
  /** Calendar URIs that issued a pending attestation. */
  pendingUris: string[];
}

/**
 * Submit a digest to the calendars and assemble a detached proof.
 *
 * The request is deliberately kept a "CORS-simple" request: we pass the digest as a bare
 * body with no `Content-Type` header. Setting `application/octet-stream` would trigger a
 * preflight, and the calendars answer `OPTIONS` with 404 — which fails the whole call.
 */
export async function stampDigest(
  digest: Uint8Array,
  calendars: readonly string[] = CALENDARS,
  signal?: AbortSignal,
): Promise<StampResult> {
  if (digest.length !== 32) throw new Error('stampDigest expects a 32-byte SHA-256 digest');

  const settled = await Promise.all(
    calendars.map(async (calendar): Promise<{ calendar: string; ts?: Timestamp; error?: string }> => {
      try {
        const res = await fetch(`${calendar}/digest`, {
          method: 'POST',
          body: digest as BodyInit,
          signal,
        });
        if (!res.ok) return { calendar, error: `HTTP ${res.status}` };
        const bytes = new Uint8Array(await res.arrayBuffer());
        return { calendar, ts: parseTimestamp(new Reader(bytes)) };
      } catch (err) {
        return { calendar, error: err instanceof Error ? err.message : String(err) };
      }
    }),
  );

  const good = settled.filter((s): s is { calendar: string; ts: Timestamp } => Boolean(s.ts));
  if (good.length === 0) {
    throw new Error('No calendar server could be reached. Check your connection and try again.');
  }

  const merged = good.map((g) => g.ts).reduce((acc, ts) => mergeTimestamps(acc, ts));

  const w = new Writer();
  w.raw(HEADER_MAGIC);
  w.u8(MAJOR_VERSION);
  w.u8(OP_SHA256);
  w.raw(digest);
  serializeTimestamp(w, merged);

  return {
    ots: w.finish(),
    calendars: settled.map(({ calendar, ts, error }) => ({ calendar, ok: Boolean(ts), error })),
    pendingUris: collectPendingUris(merged),
  };
}

function collectPendingUris(ts: Timestamp): string[] {
  const out: string[] = [];
  const walk = (node: Timestamp): void => {
    for (const att of node.attestations) if (att.uri) out.push(att.uri);
    for (const branch of node.ops) walk(branch.next);
  };
  walk(ts);
  return [...new Set(out)];
}

/** Parse a detached `.ots` file. Used by the verification view and by our tests. */
export function parseDetachedOts(bytes: Uint8Array): { digest: Uint8Array; timestamp: Timestamp } {
  const r = new Reader(bytes);
  const magic = r.take(HEADER_MAGIC.length);
  if (toHex(magic) !== toHex(HEADER_MAGIC)) throw new Error('Not an OpenTimestamps proof file');

  const version = r.varuint();
  if (version !== MAJOR_VERSION) throw new Error(`Unsupported .ots version ${version}`);

  const hashOp = r.u8();
  if (hashOp !== OP_SHA256) throw new Error('Only SHA-256 proofs are supported');

  const digest = r.take(32);
  return { digest, timestamp: parseTimestamp(r) };
}
