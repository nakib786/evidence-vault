/**
 * Turns the vault's saved records into a plain summary — how many, what they're
 * categorised as, how severe, where they happened, and how their timestamp proofs stand.
 *
 * This exists because a single incident rarely moves a platform, a police force or a court
 * on its own (see the FAQ's "why bother" answer) — a pattern across several does, and that
 * pattern is otherwise invisible unless someone opens every record and adds it up by hand.
 * Every number here reads straight off what's already saved on this device; nothing is
 * inferred, and nothing is sent anywhere to compute it.
 */
import { confirmedBlockHeights } from './ots';
import { CATEGORIES, SEVERITIES, labelFor } from './taxonomy';
import type { VaultRecord } from './types';

export interface TallyRow {
  id: string;
  label: string;
  count: number;
}

export interface VaultInsights {
  total: number;
  demoCount: number;
  byCategory: TallyRow[];
  bySeverity: TallyRow[];
  byPlatform: TallyRow[];
  confirmed: number;
  pending: number;
  noProof: number;
  earliestCapturedAt: string;
  latestCapturedAt: string;
}

function tally(entries: VaultRecord[], pick: (e: VaultRecord) => string, labelOf: (id: string) => string): TallyRow[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const id = pick(entry);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, label: labelOf(id), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Same three-way read `VaultRecordScreen` and `describeProofStatus` each do, but reduced to
 * a bucket rather than the full label/detail text a single record's own screen needs.
 */
function proofBucket(entry: VaultRecord): 'confirmed' | 'pending' | 'none' {
  const { record, isDemo, demoConfirmedHeight } = entry;
  if (!record.proof) return 'none';
  if (isDemo) return demoConfirmedHeight ? 'confirmed' : 'pending';
  try {
    if (confirmedBlockHeights(record.proof.ots).length > 0) return 'confirmed';
  } catch {
    /* not parseable yet as a confirmed proof — falls through to pending */
  }
  return 'pending';
}

export function summarizeVault(entries: VaultRecord[]): VaultInsights | null {
  if (entries.length === 0) return null;

  const byCategory = tally(
    entries,
    (e) => e.record.details.category,
    (id) => labelFor(CATEGORIES, id),
  );
  const bySeverity = tally(
    entries,
    (e) => e.record.details.severity,
    (id) => labelFor(SEVERITIES, id),
  );
  const byPlatform = tally(
    entries,
    (e) => e.record.details.platform.trim(),
    (id) => id || 'Not specified',
  );

  let confirmed = 0;
  let pending = 0;
  let noProof = 0;
  for (const entry of entries) {
    const bucket = proofBucket(entry);
    if (bucket === 'confirmed') confirmed += 1;
    else if (bucket === 'pending') pending += 1;
    else noProof += 1;
  }

  const capturedTimes = entries.map((e) => e.record.capturedAt).sort();

  return {
    total: entries.length,
    demoCount: entries.filter((e) => e.isDemo).length,
    byCategory,
    bySeverity,
    byPlatform,
    confirmed,
    pending,
    noProof,
    earliestCapturedAt: capturedTimes[0],
    latestCapturedAt: capturedTimes[capturedTimes.length - 1],
  };
}
