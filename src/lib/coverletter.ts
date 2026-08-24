/**
 * A plain-text cover letter for the evidence package.
 *
 * Plain text on purpose. Most of the routes this package travels — an online reporting
 * form, an email to a community organisation, an intake portal — accept pasted text and
 * nothing else. A beautifully formatted PDF is useless when the box in front of you only
 * takes characters.
 *
 * It is written to be read by someone who has never heard of this app: it says what each
 * file is, what the proof does and does not establish, and how to check it without
 * trusting us.
 */
import type { EvidenceRecord } from './types';
import { formatDigestForHumans } from './hash';
import { CATEGORIES, SEVERITIES, labelFor } from './taxonomy';
import { findCountry, findRegion, type Agency } from './jurisdictions';
import { formatDuration } from './media';
import { formatLocation } from './geo';

interface Options {
  stem: string;
  evidenceFilename: string;
}

const wrap = (text: string, width = 74): string => {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph.length <= width) {
      out.push(paragraph);
      continue;
    }
    let line = '';
    for (const word of paragraph.split(' ')) {
      if ((line + ' ' + word).trim().length > width) {
        out.push(line.trim());
        line = word;
      } else {
        line += ' ' + word;
      }
    }
    if (line.trim()) out.push(line.trim());
  }
  return out.join('\n');
};

const heading = (text: string): string => `${text}\n${'-'.repeat(text.length)}`;

export function buildCoverLetter(record: EvidenceRecord, { stem, evidenceFilename }: Options): string {
  const handover = record.handover;
  const country = handover?.countryId ? findCountry(handover.countryId) : undefined;
  const region = country && handover?.regionId ? findRegion(country, handover.regionId) : undefined;

  const chosen: Agency[] = [];
  if (country && handover) {
    const pool = [...country.national, ...country.community, ...(region?.agencies ?? [])];
    for (const id of handover.selectedAgencyIds) {
      const found = pool.find((a) => a.id === id);
      if (found) chosen.push(found);
    }
  }

  const captured = new Date(record.capturedAt);
  const parts: string[] = [];

  parts.push('REPORT OF A HATE-MOTIVATED INCIDENT');
  parts.push('');
  parts.push(`Record reference: ${record.id}`);
  parts.push(`Prepared: ${new Date().toLocaleString()} (${record.timeZone})`);
  if (handover?.declarantName) parts.push(`Reported by: ${handover.declarantName}`);
  if (handover?.declarantContact) parts.push(`Contact: ${handover.declarantContact}`);
  parts.push('');

  if (chosen.length > 0) {
    parts.push(`Intended for: ${chosen.map((a) => a.name).join('; ')}`);
    parts.push('');
  }

  // ---- 1. What happened ---------------------------------------------------
  parts.push(heading('1. WHAT IS BEING REPORTED'));
  parts.push('');
  const recordNoun =
    record.kind === 'video' ? 'video recording' : record.kind === 'audio' ? 'audio recording' : 'still image';
  parts.push(
    wrap(
      `A ${recordNoun} documenting an incident, ` +
        `captured on ${captured.toLocaleDateString()} at ${captured.toLocaleTimeString()} (${record.timeZone}).`,
    ),
  );
  parts.push('');
  if (record.details.platform) parts.push(`Where it happened: ${record.details.platform}`);
  if (record.details.sourceUrl) parts.push(`Link to the content: ${record.details.sourceUrl}`);
  if (record.details.category) {
    parts.push(`Category (as described by the reporter): ${labelFor(CATEGORIES, record.details.category)}`);
  }
  if (record.details.severity) {
    parts.push(`Severity (as described by the reporter): ${labelFor(SEVERITIES, record.details.severity)}`);
  }
  if (record.details.location) {
    parts.push(`Location (reporter-supplied): ${formatLocation(record.details.location)}`);
  }
  if (record.kind === 'video' || record.kind === 'audio') {
    parts.push(
      `Recording length: ${record.durationSeconds ? formatDuration(record.durationSeconds) : 'not available'}`,
    );
  }
  parts.push('');

  if (record.details.note.trim()) {
    parts.push(heading("2. THE REPORTER'S ACCOUNT"));
    parts.push('');
    parts.push(wrap(record.details.note.trim()));
    parts.push('');
  }

  if (record.details.transcript.trim()) {
    parts.push(heading(record.kind === 'image' ? '3. TEXT VISIBLE IN THE IMAGE' : '3. WHAT WAS SAID'));
    parts.push('');
    parts.push(wrap(record.details.transcript.trim()));
    parts.push('');
  }

  // ---- Files --------------------------------------------------------------
  parts.push(heading('4. FILES IN THIS PACKAGE'));
  parts.push('');
  parts.push(`  ${stem}.pdf`);
  parts.push('      The full report, including the content and how to verify it.');
  parts.push(`  ${evidenceFilename}`);
  parts.push('      The original file, exactly as captured. Do not edit or re-save it.');
  if (record.proof) {
    parts.push(`  ${evidenceFilename}.ots`);
    parts.push('      An OpenTimestamps proof of when the file existed.');
  }
  if (record.handover?.includeCertificate) {
    parts.push(`  ${stem}-certificate.pdf`);
    parts.push('      A signed certificate of authenticity.');
  }
  parts.push('');

  // ---- Integrity ----------------------------------------------------------
  parts.push(heading('5. INTEGRITY'));
  parts.push('');
  parts.push('SHA-256 of the original file:');
  parts.push('');
  parts.push(`  ${formatDigestForHumans(record.digestHex)}`);
  parts.push('');
  if (record.proof) {
    const ok = record.proof.calendars.filter((c) => c.ok);
    parts.push(
      wrap(
        `This fingerprint was submitted to ${ok.length} independent public OpenTimestamps ` +
          `calendar servers on ${new Date(record.proof.submittedAt).toLocaleString()}, which commit ` +
          'it to a public blockchain ledger. This establishes that the file existed no later than that ' +
          'point, and that it has not been altered since.',
      ),
    );
    parts.push('');
    parts.push('To verify it yourself, without relying on the reporter or the software used:');
    parts.push('');
    parts.push('  pip install opentimestamps-client');
    parts.push(`  ots verify ${evidenceFilename}.ots`);
    parts.push('');
    parts.push(wrap('Or upload both files at https://opentimestamps.org to check in a browser.'));
  } else {
    parts.push(
      wrap(
        'No timestamp proof is attached. The fingerprint above still detects any later change to ' +
          'the file, but does not by itself establish when the file existed.',
      ),
    );
  }
  parts.push('');

  // ---- Limits -------------------------------------------------------------
  parts.push(heading('6. WHAT THIS DOES AND DOES NOT ESTABLISH'));
  parts.push('');
  parts.push('Establishes:');
  parts.push(wrap('  - This exact file existed no later than the timestamp stated above.'));
  parts.push(wrap('  - The file has not been altered since. Any change breaks the proof.'));
  parts.push('');
  parts.push('Does not establish:');
  parts.push(
    wrap(
      '  - That the content shown is genuine, or that any account named published it. A timestamp ' +
        'proves when a file existed, not that its contents are true.',
    ),
  );
  parts.push(wrap('  - Who created the content, or their intent.'));
  parts.push(wrap('  - Any legal conclusion.'));
  parts.push('');
  if (record.source === 'upload') {
    parts.push(
      wrap(
        'Note: this file was imported from the device rather than captured through the ' +
          'application, so it existed before the software processed it.',
      ),
    );
    parts.push('');
  }

  parts.push(
    wrap(
      'This package was produced with Evidence Vault, an open source tool that runs entirely on ' +
        'the reporter’s own device. The content was never uploaded to any server. Source code: ' +
        'https://github.com/nakib786/evidence-vault',
    ),
  );
  parts.push('');

  return parts.join('\n');
}

interface PackageOptions {
  packageId: string;
  reportFilename: string;
  /** Filename for each item, in the same order as `records`. */
  evidenceFilenames: string[];
}

/**
 * The multi-item counterpart to `buildCoverLetter`. Each item keeps its own account,
 * classification and transcript — those are genuinely per-item, the same reason the PDF
 * report gives each one its own section rather than merging them — while the files list
 * and the handover routing (chosen once, for the whole package) are stated together.
 */
export function buildPackageCoverLetter(
  records: EvidenceRecord[],
  { packageId, reportFilename, evidenceFilenames }: PackageOptions,
): string {
  const handover = records[0]?.handover;
  const country = handover?.countryId ? findCountry(handover.countryId) : undefined;
  const region = country && handover?.regionId ? findRegion(country, handover.regionId) : undefined;

  const chosen: Agency[] = [];
  if (country && handover) {
    const pool = [...country.national, ...country.community, ...(region?.agencies ?? [])];
    for (const id of handover.selectedAgencyIds) {
      const found = pool.find((a) => a.id === id);
      if (found) chosen.push(found);
    }
  }

  const parts: string[] = [];

  parts.push('REPORT OF A HATE-MOTIVATED INCIDENT');
  parts.push('');
  parts.push(`Package reference: ${packageId}`);
  parts.push(`Items in this package: ${records.length}`);
  parts.push(`Prepared: ${new Date().toLocaleString()}`);
  if (handover?.declarantName) parts.push(`Reported by: ${handover.declarantName}`);
  if (handover?.declarantContact) parts.push(`Contact: ${handover.declarantContact}`);
  parts.push('');

  if (chosen.length > 0) {
    parts.push(`Intended for: ${chosen.map((a) => a.name).join('; ')}`);
    parts.push('');
  }

  // ---- What's being reported, per item ------------------------------------
  parts.push(heading('1. WHAT IS BEING REPORTED'));
  parts.push('');
  records.forEach((record, i) => {
    const captured = new Date(record.capturedAt);
    const recordNoun =
      record.kind === 'video' ? 'video recording' : record.kind === 'audio' ? 'audio recording' : 'still image';
    parts.push(
      `Item ${i + 1} of ${records.length} — ${recordNoun}, ` +
        `captured ${captured.toLocaleDateString()} at ${captured.toLocaleTimeString()} (${record.timeZone}).`,
    );
    if (record.details.platform) parts.push(`  Where it happened: ${record.details.platform}`);
    if (record.details.sourceUrl) parts.push(`  Link to the content: ${record.details.sourceUrl}`);
    if (record.details.category) {
      parts.push(`  Category (as described by the reporter): ${labelFor(CATEGORIES, record.details.category)}`);
    }
    if (record.details.severity) {
      parts.push(`  Severity (as described by the reporter): ${labelFor(SEVERITIES, record.details.severity)}`);
    }
    if (record.details.location) {
      parts.push(`  Location (reporter-supplied): ${formatLocation(record.details.location)}`);
    }
    if (record.kind === 'video' || record.kind === 'audio') {
      parts.push(
        `  Recording length: ${record.durationSeconds ? formatDuration(record.durationSeconds) : 'not available'}`,
      );
    }
    if (record.details.note.trim()) {
      parts.push(`  Reporter's account: ${wrap(record.details.note.trim(), 68).split('\n').join('\n    ')}`);
    }
    if (record.details.transcript.trim()) {
      parts.push(
        `  ${record.kind === 'image' ? 'Text visible in the image' : 'What was said'}: ` +
          wrap(record.details.transcript.trim(), 68).split('\n').join('\n    '),
      );
    }
    parts.push('');
  });

  // ---- Files ----------------------------------------------------------------
  parts.push(heading('2. FILES IN THIS PACKAGE'));
  parts.push('');
  parts.push(`  ${reportFilename}`);
  parts.push('      The full report, covering every item and how to verify each one.');
  records.forEach((record, i) => {
    const evidenceFilename = evidenceFilenames[i];
    parts.push(`  ${evidenceFilename}`);
    parts.push(`      Item ${i + 1}, exactly as captured. Do not edit or re-save it.`);
    if (record.proof) {
      parts.push(`  ${evidenceFilename}.ots`);
      parts.push(`      An OpenTimestamps proof of when item ${i + 1} existed.`);
    }
    if (record.handover?.includeCertificate) {
      parts.push(`  evidence-${record.id}-certificate.pdf`);
      parts.push(`      A signed certificate of authenticity for item ${i + 1}.`);
    }
  });
  parts.push('');

  // ---- Integrity ------------------------------------------------------------
  parts.push(heading('3. INTEGRITY'));
  parts.push('');
  records.forEach((record, i) => {
    parts.push(`Item ${i + 1} — SHA-256 of the original file:`);
    parts.push(`  ${formatDigestForHumans(record.digestHex)}`);
    if (record.proof) {
      const ok = record.proof.calendars.filter((c) => c.ok);
      parts.push(
        wrap(
          `  Submitted to ${ok.length} independent OpenTimestamps calendar servers on ` +
            `${new Date(record.proof.submittedAt).toLocaleString()}.`,
          68,
        )
          .split('\n')
          .join('\n  '),
      );
    } else {
      parts.push('  No timestamp proof is attached to this item.');
    }
    parts.push('');
  });
  parts.push('To verify any item yourself, without relying on the reporter or the software used:');
  parts.push('');
  parts.push('  pip install opentimestamps-client');
  parts.push('  ots verify <item-file>.ots');
  parts.push('');
  parts.push(wrap('Or upload a file and its proof at https://opentimestamps.org to check in a browser.'));
  parts.push('');

  // ---- Limits -----------------------------------------------------------------
  parts.push(heading('4. WHAT THIS DOES AND DOES NOT ESTABLISH'));
  parts.push('');
  parts.push('Establishes:');
  parts.push(wrap('  - Each exact file existed no later than its timestamp stated above.'));
  parts.push(wrap('  - No file has been altered since. Any change breaks that file’s proof.'));
  parts.push('');
  parts.push('Does not establish:');
  parts.push(
    wrap(
      '  - That the content shown is genuine, or that any account named published it. A timestamp ' +
        'proves when a file existed, not that its contents are true.',
    ),
  );
  parts.push(wrap('  - Who created the content, or their intent.'));
  parts.push(wrap('  - Any legal conclusion.'));
  parts.push('');

  parts.push(
    wrap(
      'This package was produced with Evidence Vault, an open source tool that runs entirely on ' +
        'the reporter’s own device. The content was never uploaded to any server. Source code: ' +
        'https://github.com/nakib786/evidence-vault',
    ),
  );
  parts.push('');

  return parts.join('\n');
}
