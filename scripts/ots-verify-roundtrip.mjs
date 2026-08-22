/**
 * Proves our hand-rolled OTS client produces files the reference implementation accepts.
 * Run: node scripts/ots-verify-roundtrip.mjs   (then scripts/ots_validate.py on the output)
 */
import { writeFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { stampDigest, parseDetachedOts, CALENDARS } from '../src/lib/ots.ts';

const payload = Buffer.concat([Buffer.from('evidence-vault multi-calendar test '), randomBytes(16)]);
writeFileSync('./.tmp/multi.bin', payload);
const digest = new Uint8Array(createHash('sha256').update(payload).digest());
console.log('digest      :', Buffer.from(digest).toString('hex'));

const result = await stampDigest(digest, CALENDARS);
writeFileSync('./.tmp/multi.bin.ots', result.ots);

console.log('ots bytes   :', result.ots.length);
for (const c of result.calendars) {
  console.log(`  ${c.ok ? 'OK  ' : 'FAIL'} ${c.calendar}${c.error ? '  (' + c.error + ')' : ''}`);
}
console.log('pending URIs:', result.pendingUris.length);
result.pendingUris.forEach((u) => console.log('   -', u));

// Round-trip through our own parser.
const reparsed = parseDetachedOts(result.ots);
const same = Buffer.from(reparsed.digest).equals(Buffer.from(digest));
console.log('self round-trip digest match:', same ? 'PASS' : 'FAIL');
if (!same) process.exit(1);
