/**
 * Builds the PDF evidence record — the thing the user actually hands to a platform,
 * a community organisation, an employer, or the police.
 *
 * Tone here is deliberately different from the app UI. The app is plain and gentle
 * because the person using it is having a bad day; this document is precise, because its
 * reader is assessing a claim. It states exactly what the proof does and does not
 * establish, so nobody downstream over-reads it.
 */
import type { jsPDF } from 'jspdf';
import type { EvidenceRecord } from './types';
import { formatDigestForHumans } from './hash';
import { CATEGORIES, SEVERITIES, labelFor } from './taxonomy';
import { extractFrames, formatDuration } from './media';

const PAGE = { width: 595.28, height: 841.89 }; // A4 in points
const MARGIN = 56;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;

const INK: [number, number, number] = [24, 28, 38];
const MUTED: [number, number, number] = [92, 100, 116];
const RULE: [number, number, number] = [214, 219, 227];

/**
 * The built-in jsPDF fonts can only encode Latin-1, but plenty of ordinary English text
 * contains typographic characters just outside it — em dashes, curly quotes, ellipses —
 * all of which OCR happily produces. Folding those down to ASCII first means only text in
 * a genuinely different script (Arabic, Urdu, CJK) takes the "cannot render" path.
 */
const TYPOGRAPHIC: Record<string, string> = {
  '\u2018': "'", '\u2019': "'", '\u201a': "'", '\u201b': "'",
  '\u201c': '"', '\u201d': '"', '\u201e': '"', '\u201f': '"',
  '\u2013': '-', '\u2014': '--', '\u2015': '--', '\u2212': '-',
  '\u2026': '...', '\u2022': '*', '\u2039': '<', '\u203a': '>',
  '\u02bc': "'", '\u00a0': ' ', '\u200b': '', '\ufeff': '',
};

/** Replace characters jsPDF cannot encode with close ASCII equivalents. */
export const sanitiseForPdf = (text: string): string =>
  text.replace(/[\u2018-\u201f\u2013-\u2015\u2212\u2026\u2022\u2039\u203a\u02bc\u00a0\u200b\ufeff]/g,
    (c) => TYPOGRAPHIC[c] ?? c);

/** True when the text still needs a font this PDF cannot supply. */
export const needsCompanionTextFile = (text: string): boolean =>
  /[^\u0020-\u00ff\n\r\t]/.test(sanitiseForPdf(text));

const isLatinSafe = (text: string): boolean => !needsCompanionTextFile(text);

class Doc {
  readonly pdf: jsPDF;
  private y = MARGIN;

  constructor(pdf: jsPDF) {
    this.pdf = pdf;
  }

  private ensure(space: number): void {
    if (this.y + space > PAGE.height - MARGIN) {
      this.pdf.addPage();
      this.y = MARGIN;
    }
  }

  gap(h: number): void {
    this.y += h;
  }

  get cursor(): number {
    return this.y;
  }

  heading(text: string, size = 15): void {
    this.ensure(size + 14);
    this.pdf.setFont('helvetica', 'bold').setFontSize(size).setTextColor(...INK);
    this.pdf.text(sanitiseForPdf(text), MARGIN, this.y);
    this.y += size + 8;
  }

  body(text: string, opts: { muted?: boolean; size?: number } = {}): void {
    const size = opts.size ?? 10;
    this.pdf.setFont('helvetica', 'normal').setFontSize(size);
    this.pdf.setTextColor(...(opts.muted ? MUTED : INK));
    for (const line of this.pdf.splitTextToSize(sanitiseForPdf(text), CONTENT_WIDTH) as string[]) {
      this.ensure(size + 4);
      this.pdf.text(line, MARGIN, this.y);
      this.y += size + 4;
    }
  }

  /** Label/value row. Long values wrap under the label rather than overflowing. */
  field(label: string, value: string): void {
    const labelWidth = 132;
    this.ensure(16);
    this.pdf.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...MUTED);
    this.pdf.text(sanitiseForPdf(label.toUpperCase()), MARGIN, this.y);

    this.pdf.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...INK);
    const lines = this.pdf.splitTextToSize(sanitiseForPdf(value) || '--', CONTENT_WIDTH - labelWidth) as string[];
    lines.forEach((line, i) => {
      if (i > 0) this.ensure(14);
      this.pdf.text(line, MARGIN + labelWidth, this.y);
      if (i < lines.length - 1) this.y += 14;
    });
    this.y += 18;
  }

  mono(text: string): void {
    this.pdf.setFont('courier', 'normal').setFontSize(10).setTextColor(...INK);
    for (const line of this.pdf.splitTextToSize(sanitiseForPdf(text), CONTENT_WIDTH) as string[]) {
      this.ensure(15);
      this.pdf.text(line, MARGIN, this.y);
      this.y += 14;
    }
    this.y += 4;
  }

  rule(): void {
    this.ensure(18);
    this.pdf.setDrawColor(...RULE).setLineWidth(0.75);
    this.pdf.line(MARGIN, this.y, PAGE.width - MARGIN, this.y);
    this.y += 18;
  }

  image(dataUrl: string, format: string, w: number, h: number): void {
    const scale = Math.min(CONTENT_WIDTH / w, 1);
    const drawW = w * scale;
    const drawH = h * scale;

    if (drawH > PAGE.height - MARGIN * 2) {
      // Very tall screenshots get their own page and are fitted to it.
      this.pdf.addPage();
      this.y = MARGIN;
      const fit = Math.min(CONTENT_WIDTH / w, (PAGE.height - MARGIN * 2) / h);
      this.pdf.addImage(dataUrl, format, MARGIN, this.y, w * fit, h * fit);
      this.y += h * fit + 14;
      return;
    }

    this.ensure(drawH + 14);
    this.pdf.addImage(dataUrl, format, MARGIN, this.y, drawW, drawH);
    this.y += drawH + 14;
  }

  /**
   * Lay video frames out as a contact sheet.
   *
   * A PDF cannot play a recording, so the report carries evenly spaced stills with their
   * timecodes — the same convention a forensic report uses. It lets a reviewer see the
   * substance without opening the video, which still travels alongside the report.
   */
  contactSheet(frames: { dataUrl: string; at: number; width: number; height: number }[]): void {
    if (frames.length === 0) return;
    const cols = 2;
    const gutter = 12;
    const cellW = (CONTENT_WIDTH - gutter * (cols - 1)) / cols;

    for (let i = 0; i < frames.length; i += cols) {
      const row = frames.slice(i, i + cols);
      const rowH = Math.max(
        ...row.map((f) => (cellW / f.width) * f.height),
      );
      this.ensure(rowH + 20);

      row.forEach((frame, c) => {
        const x = MARGIN + c * (cellW + gutter);
        const h = (cellW / frame.width) * frame.height;
        this.pdf.addImage(frame.dataUrl, 'JPEG', x, this.y, cellW, h);
        this.pdf.setFont('courier', 'normal').setFontSize(8).setTextColor(...MUTED);
        this.pdf.text(formatDuration(frame.at), x, this.y + h + 10);
      });

      this.y += rowH + 20;
    }
  }

  footers(recordId: string): void {
    const total = this.pdf.getNumberOfPages();
    for (let p = 1; p <= total; p += 1) {
      this.pdf.setPage(p);
      this.pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED);
      this.pdf.text(`Evidence record ${recordId}`, MARGIN, PAGE.height - 28);
      this.pdf.text(`Page ${p} of ${total}`, PAGE.width - MARGIN, PAGE.height - 28, {
        align: 'right',
      });
    }
  }
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/**
 * Prepare the captured image for embedding.
 *
 * PNG and JPEG are handed to jsPDF as their original bytes, which it can embed directly.
 * An earlier version pushed everything through a canvas and re-encoded it as PNG; that
 * turned a 64 KB screenshot into a 1.8 MB report, which is a real problem for someone
 * emailing it from a phone. Formats jsPDF cannot embed natively still go through the
 * canvas, but come out as JPEG rather than PNG for the same reason.
 */
async function loadImage(
  blob: Blob,
): Promise<{ dataUrl: string; format: string; w: number; h: number } | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const w = bitmap.width;
    const h = bitmap.height;

    if (blob.type === 'image/png' || blob.type === 'image/jpeg') {
      bitmap.close();
      return {
        dataUrl: await blobToDataUrl(blob),
        format: blob.type === 'image/png' ? 'PNG' : 'JPEG',
        w,
        h,
      };
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return null;
    }
    // White ground: JPEG has no alpha, and transparent pixels would otherwise go black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), format: 'JPEG', w, h };
  } catch {
    return null;
  }
}

const humanBytes = (n: number): string =>
  n < 1024 ? `${n} bytes` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(2)} MB`;

const humanTime = (iso: string, zone: string): string => {
  const d = new Date(iso);
  return `${d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' })}  (${zone})\nISO 8601: ${iso}`;
};

export async function buildReportPdf(record: EvidenceRecord): Promise<Blob> {
  // Deferred for the same reason as tesseract: only the export screen needs it.
  const { jsPDF } = await import('jspdf');
  const doc = new Doc(new jsPDF({ unit: 'pt', format: 'a4', compress: true }));
  const { details, proof } = record;

  // ---- Header -------------------------------------------------------------
  doc.pdf.setFont('helvetica', 'bold').setFontSize(22).setTextColor(...INK);
  doc.pdf.text('Evidence Record', MARGIN, doc.cursor);
  doc.gap(26);
  doc.body(
    'A tamper-evident record of documented content, produced on the reporter’s own device. ' +
      'The cryptographic digest below was calculated at the moment of capture and submitted to ' +
      'independent OpenTimestamps calendar servers, which register it on a public blockchain ledger.',
    { muted: true },
  );
  doc.gap(6);
  doc.rule();

  // ---- What was recorded --------------------------------------------------
  doc.heading('1. What was recorded');
  doc.field('Record ID', record.id);
  doc.field('Captured', humanTime(record.capturedAt, record.timeZone));
  doc.field('Medium', record.kind === 'video' ? 'Video recording' : 'Still image');
  if (record.kind === 'video') {
    doc.field(
      'Duration',
      record.durationSeconds ? formatDuration(record.durationSeconds) : 'Not available',
    );
    doc.field(
      'Audio',
      record.source === 'upload'
        ? 'As present in the original file'
        : record.hasAudio
          ? 'Recorded alongside the picture'
          : 'Not recorded — no microphone was available',
    );
  }
  doc.field(
    'Capture method',
    record.source === 'live'
      ? record.kind === 'video'
        ? 'Live capture — recorded through this application’s camera and hashed the moment recording stopped.'
        : 'Live capture — photographed through this application’s camera and hashed before being written to a file.'
      : 'Existing file — selected from the device’s storage and hashed on import.',
  );
  doc.field('Platform or setting', details.platform);
  doc.field('Source link', details.sourceUrl);
  doc.field('File type', record.mimeType);
  doc.field('File size', humanBytes(record.byteLength));

  // ---- Classification -----------------------------------------------------
  doc.heading('2. Reporter’s classification');
  doc.body(
    'These labels were chosen by the person filing this record, not generated by an automated ' +
      'classifier. No content from this report was sent to any classification service.',
    { muted: true, size: 9 },
  );
  doc.gap(8);
  doc.field('Category', labelFor(CATEGORIES, details.category));
  doc.field('Severity', labelFor(SEVERITIES, details.severity));

  // ---- Reporter's account -------------------------------------------------
  if (details.note.trim()) {
    doc.heading('3. Reporter’s account');
    doc.body(details.note.trim());
    doc.gap(8);
  }

  // ---- Transcript ---------------------------------------------------------
  if (details.transcript.trim()) {
    doc.heading('4. Transcript of visible text');
    doc.body(
      'Drafted by on-device optical character recognition, then reviewed and corrected by the ' +
        'reporter. It is a reading aid, not a substitute for the image itself.',
      { muted: true, size: 9 },
    );
    doc.gap(8);
    if (isLatinSafe(details.transcript)) {
      doc.body(details.transcript.trim());
    } else {
      doc.body(
        'The transcript contains characters this PDF’s font cannot render (for example Arabic ' +
          'or Urdu script). It is included verbatim, in UTF-8, in the accompanying transcript.txt ' +
          'file. The original text is visible in the image below.',
        { muted: true },
      );
    }
    doc.gap(8);
  }

  // ---- The evidence itself ------------------------------------------------
  doc.heading('5. The recorded content');
  if (record.kind === 'video') {
    doc.body(
      'The recording itself is supplied as a separate file. The frames below are sampled from ' +
        'it at even intervals and labelled with their timecode; they are a summary, not a ' +
        'substitute for viewing the original.',
      { muted: true, size: 9 },
    );
    doc.gap(8);
    try {
      doc.contactSheet(await extractFrames(record.blob, 6));
    } catch {
      doc.body('Frames could not be extracted from this recording in the browser.', { muted: true });
    }
  } else {
    const img = await loadImage(record.blob);
    if (img) {
      doc.image(img.dataUrl, img.format, img.w, img.h);
    } else {
      doc.body('The captured file could not be rendered as an image in this document.', { muted: true });
    }
  }

  // ---- Integrity ----------------------------------------------------------
  doc.pdf.addPage();
  doc.gap(0);
  doc.heading('6. Integrity and timestamp proof');
  doc.body('SHA-256 digest of the captured file:', { muted: true, size: 9 });
  doc.gap(4);
  doc.mono(formatDigestForHumans(record.digestHex));
  doc.gap(6);

  if (proof) {
    doc.field('Proof submitted', humanTime(proof.submittedAt, record.timeZone));
    doc.field(
      'Calendar servers',
      proof.calendars.filter((c) => c.ok).map((c) => c.calendar).join('\n') || 'None responded',
    );
    doc.field('Attestations pending at', proof.pendingUris.join('\n') || '—');
    doc.body(
      'A pending attestation means the calendar has accepted the digest and will include it in an ' +
        'upcoming block on that ledger. Confirmation typically completes within a few hours. Once ' +
        'confirmed, ' +
        'the proof file can be upgraded and verified with no further involvement from this application ' +
        'or its authors.',
      { muted: true, size: 9 },
    );
  } else {
    doc.body(
      'No timestamp proof was attached to this record. The digest above still detects any later ' +
        'change to the file, but on its own it does not establish when the file existed.',
      { muted: true },
    );
  }
  doc.gap(10);

  // ---- Verification -------------------------------------------------------
  doc.heading('7. How to verify this record', 13);
  doc.body(
    'Verification does not depend on this application, its authors, or any server they control. ' +
      'Anyone holding the original file and the .ots proof can check it with the standard ' +
      'OpenTimestamps tooling:',
    { muted: true, size: 9 },
  );
  doc.gap(8);
  doc.body('1.  Recompute the digest of the original file and confirm it matches the value above.');
  doc.mono('sha256sum <original-file>');
  doc.body('2.  Verify the proof with the OpenTimestamps client (pip install opentimestamps-client):');
  doc.mono('ots verify <original-file>.ots');
  doc.body('3.  Or upload both files at https://opentimestamps.org to check them in a browser.');
  doc.gap(10);

  // ---- Limits -------------------------------------------------------------
  doc.heading('8. What this record does and does not establish', 13);
  doc.body('It establishes:', { muted: true, size: 9 });
  doc.body(
    '•  That this exact file existed no later than the timestamp confirmed on the public ' +
      'blockchain.\n' +
      '•  That the file has not been altered since — any change, however small, produces a ' +
      'different digest and breaks the proof.',
  );
  doc.gap(6);
  doc.body('It does not establish:', { muted: true, size: 9 });
  doc.body(
    '•  That the content shown is genuine, or that the account shown actually published it. A ' +
      'timestamp proves when a file existed, not that its contents are true.\n' +
      '•  Who created the content, or their intent.\n' +
      '•  Anything about events before the moment of capture.\n' +
      '•  Any legal conclusion. This document is a record, not a legal determination, and its ' +
      'authors are not lawyers.',
  );
  doc.gap(6);
  doc.body(
    'Where the capture method above is recorded as "Existing file", note that the file was already ' +
      'present on the device before this application saw it, and could in principle have been edited ' +
      'beforehand. Records made by live capture do not have that gap.',
    { muted: true, size: 9 },
  );

  doc.footers(record.id);
  return doc.pdf.output('blob');
}
