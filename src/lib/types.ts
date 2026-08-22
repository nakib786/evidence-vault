/** Shared shapes for a single piece of documented evidence. */

import type { CalendarResult } from './ots';

export type CaptureSource = 'live' | 'upload';

/** Stills and recordings travel the same pipeline but differ in how they're presented. */
export type MediaKind = 'image' | 'video';

export type Step = 'capture' | 'process' | 'review' | 'handover' | 'export';

/**
 * Where the person intends to take this, and who is attesting to it.
 *
 * The declarant's name and contact are the only personal data this app ever handles. They
 * are optional, never prefilled, never stored, and exist solely because a certificate of
 * authenticity is worthless without someone standing behind it. If the user declines,
 * they still get every other file.
 */
export interface HandoverChoice {
  countryId: string;
  regionId: string;
  /** Agency ids the user says they intend to contact. Shapes the cover letter only. */
  selectedAgencyIds: string[];
  declarantName: string;
  declarantContact: string;
  /** Whether to generate the signed certificate at all. */
  includeCertificate: boolean;
}

export const emptyHandover = (): HandoverChoice => ({
  countryId: '',
  regionId: '',
  selectedAgencyIds: [],
  declarantName: '',
  declarantContact: '',
  includeCertificate: false,
});

/** What the user supplies. Everything here is optional except the evidence itself. */
export interface ReportDetails {
  /** Where it happened, e.g. a platform name. Free text — we don't constrain the world. */
  platform: string;
  /** Public link to the content, if there is one. */
  sourceUrl: string;
  /** The user's own account of what happened and why it matters. */
  note: string;
  /** Category id from `CATEGORIES`. Empty string means "not categorised". */
  category: string;
  /** Severity id from `SEVERITIES`. Empty string means "not rated". */
  severity: string;
  /** Text pulled off the image by OCR, after the user has reviewed and corrected it. */
  transcript: string;
}

export interface TimestampProof {
  ots: Uint8Array;
  calendars: CalendarResult[];
  pendingUris: string[];
  /** When we asked the calendars, per this device's clock. */
  submittedAt: string;
}

export interface EvidenceRecord {
  id: string;
  blob: Blob;
  mimeType: string;
  byteLength: number;
  source: CaptureSource;
  kind: MediaKind;
  /** Seconds. Videos only. */
  durationSeconds?: number;
  /** Whether a live recording captured audio as well as picture. */
  hasAudio?: boolean;
  /** ISO 8601, from the device clock at the moment of capture. */
  capturedAt: string;
  /** IANA zone name, so the report can state the clock it was read from. */
  timeZone: string;
  digest: Uint8Array;
  digestHex: string;
  details: ReportDetails;
  proof?: TimestampProof;
  handover?: HandoverChoice;
}

export const emptyDetails = (): ReportDetails => ({
  platform: '',
  sourceUrl: '',
  note: '',
  category: '',
  severity: '',
  transcript: '',
});
