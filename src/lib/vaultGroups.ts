/**
 * Groups vault entries that were captured in the same session (a burst, or several photos
 * taken back-to-back) so the vault list can show them as one report instead of one row per
 * item — see `EvidenceRecord.packageId`. An entry with no `packageId`, or the lone survivor
 * of a group after items were removed, renders on its own rather than as a group of one.
 */
import type { VaultRecord } from './types';

export type VaultRow = { kind: 'single'; entry: VaultRecord } | { kind: 'package'; packageId: string; entries: VaultRecord[] };

export function groupVaultEntries(entries: VaultRecord[]): VaultRow[] {
  const groups = new Map<string, VaultRecord[]>();
  const order: VaultRow[] = [];
  const placeholders = new Map<string, VaultRow>();

  for (const entry of entries) {
    const pid = entry.record.packageId;
    if (!pid) {
      order.push({ kind: 'single', entry });
      continue;
    }
    let group = groups.get(pid);
    if (!group) {
      group = [];
      groups.set(pid, group);
      const row: VaultRow = { kind: 'package', packageId: pid, entries: group };
      placeholders.set(pid, row);
      order.push(row);
    }
    group.push(entry);
  }

  return order.map((row) => {
    if (row.kind === 'single') return row;
    // Chronological within the group, regardless of where entries landed in the save order.
    const entries = [...row.entries].sort((a, b) => a.record.capturedAt.localeCompare(b.record.capturedAt));
    return entries.length === 1 ? { kind: 'single', entry: entries[0] } : { kind: 'package', packageId: row.packageId, entries };
  });
}

export function entriesForPackage(entries: VaultRecord[], packageId: string): VaultRecord[] {
  return entries
    .filter((e) => e.record.packageId === packageId)
    .sort((a, b) => a.record.capturedAt.localeCompare(b.record.capturedAt));
}
