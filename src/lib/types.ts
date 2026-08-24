/** Shared shapes for a single piece of documented evidence. */

import type { CalendarResult } from './ots';

export type CaptureSource = 'live' | 'upload';

/** Stills, video and audio-only recordings travel the same pipeline but differ in how they're presented. */
export type MediaKind = 'image' | 'video' | 'audio';

export type Step = 'capture' | 'review' | 'handover' | 'export';

/**
 * Where the person intends to take this, and who is attesting to it.
 *
 * The declarant's name and contact — like the optional contact fields on `ReportDetails` —
 * are the only personal data this app ever handles. They are optional, never prefilled,
 * never stored, and exist solely because a certificate of authenticity is worthless without
 * someone standing behind it. If the user declines, they still get every other file.
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

/**
 * GPS coordinates read from the device at the reporter's request, to pin down where a
 * record was captured. Never read automatically — see `useGeolocation` — and, like the
 * contact fields below, personal enough that the UI calls it out as its own opt-in step
 * rather than letting it blend in with the plain-text fields.
 */
export interface GeoLocation {
  latitude: number;
  longitude: number;
  /** Metres, as reported by the browser. Absent when the platform doesn't supply one. */
  accuracyMeters: number | null;
  /** ISO 8601, when the coordinates were read — distinct from `capturedAt` on the record. */
  readAt: string;
  /**
   * 'gps' — the device's own location hardware, via `useGeolocation`. 'ip' — a much coarser
   * (city-level) fallback derived from the visitor's IP address by Cloudflare's edge, offered
   * only when GPS wasn't granted or isn't available. 'manual' — typed in directly by the user,
   * e.g. in `NearbyResourcesSection` when GPS isn't available or they'd rather search around
   * somewhere other than their current position. The report states plainly which one it is
   * rather than presenting a guess, or a place the user picked, as if it were a device reading.
   */
  source: 'gps' | 'ip' | 'manual';
}

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
  /**
   * How a reviewer can reach whoever filed this record — entirely optional, and blank by
   * default. Unlike the rest of this interface, these three carry personal data, so the UI
   * calls that out rather than letting them blend in with the other fields.
   */
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  /** GPS coordinates, read from the device only if the reporter asks for them. */
  location: GeoLocation | null;
}

export interface TimestampProof {
  ots: Uint8Array;
  calendars: CalendarResult[];
  pendingUris: string[];
  /** When we asked the calendars, per this device's clock. */
  submittedAt: string;
}

/**
 * Technical facts about how a live capture was taken — camera and microphone in use, and
 * any adjustment the reporter made before the shutter fired. Live capture only; an
 * imported file carries none of this, because none of it is knowable about a file that
 * already existed before this app saw it.
 *
 * This exists for the same reason `source` and `capturedAt` do: the report is stronger
 * for stating plainly how a record was produced, rather than leaving a reviewer to assume.
 */
export interface CaptureMeta {
  /** 'user' (front/selfie) or 'environment' (rear) camera, when the browser reports it. */
  facingMode?: 'user' | 'environment';
  /** The camera's own label, exactly as the browser reports it (e.g. "Back Camera"). */
  cameraLabel?: string;
  /** The microphone's own label, when the recording included audio. */
  microphoneLabel?: string;
  /** Whether the flashlight/torch was switched on at the moment of capture. */
  torchOn?: boolean;
  /** Zoom factor in use, e.g. 2 for 2x, when the camera reports a zoom capability. */
  zoom?: number;
  /** Manual exposure compensation in EV stops, when the camera exposes that control. */
  exposureCompensation?: number;
  /** Manual brightness level, when the camera exposes that instead of exposure compensation. */
  brightness?: number;
  /** Self-timer delay used before the shutter fired, in seconds. */
  timerSeconds?: number;
  /** This frame's position within a burst sequence, 1-based. */
  burstIndex?: number;
  /** Total number of frames captured in the same burst sequence. */
  burstCount?: number;
}

export interface EvidenceRecord {
  id: string;
  /**
   * Ties this record to the other items captured in the same session — a burst, or several
   * photos/videos taken back-to-back before moving on to review. Shared by every item saved
   * from the same package (see `App.tsx`'s `packageId`), so the vault can show them as one
   * report instead of one entry per item. Absent on a demo entry, since each of those stands
   * alone rather than belonging to a batch.
   */
  packageId?: string;
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
  /** Live capture only — see `CaptureMeta`. */
  captureMeta?: CaptureMeta;
}

export const emptyDetails = (): ReportDetails => ({
  platform: '',
  sourceUrl: '',
  note: '',
  category: '',
  severity: '',
  transcript: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  location: null,
});

export type CaptureItemStatus = 'securing' | 'ready' | 'error';

/**
 * A capture as it exists while its package is still being assembled — from the instant
 * the shutter fires until the user finalises the package. Fingerprinting and timestamp
 * submission (see `secureBlob` in `lib/secure.ts`) happen in the background rather than on
 * a blocking screen, so an item sits in the list well before it has a digest: `status`
 * tracks that, and `record` — a complete, ordinary `EvidenceRecord` — only appears once
 * it's done. A package is simply an array of these, with no separate container type; the
 * package's own identity is a plain id string carried alongside the array in `App.tsx`.
 */
export interface CaptureItem {
  id: string;
  blob: Blob;
  source: CaptureSource;
  kind: MediaKind;
  durationSeconds?: number;
  hasAudio?: boolean;
  captureMeta?: CaptureMeta;
  status: CaptureItemStatus;
  /** Present once `status` is 'ready'. */
  record?: EvidenceRecord;
  /** Present once `status` is 'error'. */
  error?: string;
}

/**
 * A record as it lives in the vault: the evidence itself plus vault-only metadata that
 * has no place on `EvidenceRecord`, because it describes the record's life in storage
 * rather than the incident it documents.
 */
export interface VaultRecord {
  record: EvidenceRecord;
  /** ISO 8601, when this was saved to the vault — distinct from `capturedAt`. */
  savedAt: string;
  /**
   * True for the synthetic entries the vault can seed itself with. Hackathon rule §06
   * bars testing against real hateful content, and this app was built with no other
   * evidence to populate a vault with. Demo entries are marked everywhere they're shown
   * and never touch the real OpenTimestamps calendars.
   */
  isDemo: boolean;
  /** Demo-only: a fabricated Bitcoin block height, to show what a confirmed record looks like. */
  demoConfirmedHeight?: number;
}
