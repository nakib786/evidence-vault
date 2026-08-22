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
  parts.push(
    wrap(
      `A ${record.kind === 'video' ? 'video recording' : 'still image'} documenting an incident, ` +
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
  if (record.kind === 'video') {
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
    parts.push(heading(record.kind === 'video' ? '3. WHAT WAS SAID' : '3. TEXT VISIBLE IN THE IMAGE'));
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
