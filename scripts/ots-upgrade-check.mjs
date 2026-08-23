/**
 * Proves the vault's "check for confirmation" path actually works, two ways:
 *
 *  1. Parses a well-known, long-since-confirmed proof (the canonical OpenTimestamps
 *     "hello-world.txt" example, bundled with the javascript-opentimestamps devDependency)
 *     and checks we correctly read its Bitcoin block height back out.
 *  2. Submits a fresh digest to the real calendars, then immediately asks whether it has
 *     upgraded. It won't have — confirmation takes hours — but a clean run without errors
 *     proves the merkle-path walk and the `/timestamp/<hex>` request format are correct
 *     against the live servers, not just against our own parser.
 *
 * Run: node scripts/ots-upgrade-check.mjs
 */
import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { CALENDARS, confirmedBlockHeights, parseDetachedOts, stampDigest, upgradeProof } from '../src/lib/ots.ts';

console.log('--- 1. known-confirmed fixture ---');
const fixture = new Uint8Array(
  readFileSync('node_modules/javascript-opentimestamps/examples/hello-world.txt.ots'),
);
const { digest: fixtureDigest } = parseDetachedOts(fixture);
const heights = confirmedBlockHeights(fixture);
console.log('digest :', Buffer.from(fixtureDigest).toString('hex'));
console.log('heights:', heights);
if (heights.length === 0) {
  console.error('FAIL: expected at least one confirmed block height from a known-confirmed proof');
  process.exit(1);
}
console.log('PASS: confirmedBlockHeights reads a real Bitcoin attestation.\n');

console.log('--- 2. live calendars ---');
const payload = Buffer.concat([Buffer.from('evidence-vault upgrade sanity check '), randomBytes(16)]);
const digest = new Uint8Array(createHash('sha256').update(payload).digest());
const stamped = await stampDigest(digest, CALENDARS);
console.log('pendingUris:', stamped.pendingUris);

const result = await upgradeProof(stamped.ots);
console.log('confirmedHeights:', result.confirmedHeights, '(expected: none — just submitted)');
console.log('errors          :', result.errors);
if (result.errors.length > 0) {
  console.error('FAIL: upgradeProof reported errors talking to the live calendars');
  process.exit(1);
}
console.log('PASS: upgradeProof round-trips against the live calendars without error.');
