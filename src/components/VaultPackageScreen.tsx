/**
 * One saved report made of several items — a burst, or a few photos and videos taken
 * back-to-back before review (see `lib/vaultGroups.ts`). Each item still opens into the
 * ordinary single-item `VaultRecordScreen` for its full detail and proof; what this screen
 * adds is the list view of the whole report, a way to drop one item without losing the
 * rest, and a re-download of the combined package bundle.
 */
import { useEffect, useState } from 'react';
import { Button, Callout, Card } from './ui';
import PackageExportBundle from './PackageExportBundle';
import { describeProofStatus } from '../lib/vaultStatus';
import { labelFor, CATEGORIES } from '../lib/taxonomy';
import { formatDuration } from '../lib/media';
import type { VaultRecord } from '../lib/types';
import type { useVault } from './useVault';

interface Props {
  packageId: string;
  entries: VaultRecord[];
  vault: ReturnType<typeof useVault>;
  onBack: () => void;
  onOpenItem: (id: string) => void;
  /**
   * Called once this report has dropped to one item or none — it no longer reads as a
   * report at all, so control hands back to the plain vault list, where a lone survivor
   * shows up as an ordinary single entry (see `lib/vaultGroups.ts`).
   */
  onDissolved: () => void;
}

export default function VaultPackageScreen({ packageId, entries, vault, onBack, onOpenItem, onDissolved }: Props) {
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [confirmRemoveAll, setConfirmRemoveAll] = useState(false);
  const [busy, setBusy] = useState(false);

  // If a removal brought this report down to one item or fewer from underneath this
  // screen, hand control back immediately rather than rendering a "report" of one.
  useEffect(() => {
    if (entries.length <= 1) onDissolved();
  }, [entries.length, onDissolved]);

  if (entries.length <= 1) return null;

  const isDemo = entries.some((e) => e.isDemo);
  const savedAt = entries.reduce((latest, e) => (e.savedAt > latest ? e.savedAt : latest), entries[0].savedAt);

  const removeOne = async (id: string): Promise<void> => {
    setBusy(true);
    try {
      await vault.remove(id);
      setConfirmRemoveId(null);
    } finally {
      setBusy(false);
    }
  };

  const removeAll = async (): Promise<void> => {
    setBusy(true);
    try {
      for (const entry of entries) await vault.remove(entry.record.id);
      setConfirmRemoveAll(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink"
      >
        <BackGlyph /> Back to vault
      </button>

      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold text-ink">Report — {entries.length} items</h1>
        <p className="text-ink-muted">
          Captured in the same session and saved together. Open any item for its full detail and proof,
          or remove one without losing the rest.
        </p>
      </div>

      {isDemo ? (
        <Callout tone="caution" title="This is a demo report">
          Synthetic content, included because this hackathon build cannot use real evidence.
        </Callout>
      ) : null}

      <div className="space-y-3" data-tour="vault-package-items">
        {entries.map((entry, i) => (
          <ItemRow
            key={entry.record.id}
            entry={entry}
            index={i}
            total={entries.length}
            confirming={confirmRemoveId === entry.record.id}
            busy={busy}
            onOpen={() => onOpenItem(entry.record.id)}
            onAskRemove={() => setConfirmRemoveId(entry.record.id)}
            onCancelRemove={() => setConfirmRemoveId(null)}
            onConfirmRemove={() => void removeOne(entry.record.id)}
          />
        ))}
      </div>

      <div className="space-y-2">
        <h2 className="font-display text-lg font-bold text-ink">Download this report again</h2>
        <p className="text-sm text-ink-muted">
          Regenerated fresh from what’s saved here, exactly like the export screen — send it to as
          many people as this needs to go to.
        </p>
      </div>
      <PackageExportBundle items={entries.map((e) => e.record)} packageId={packageId} />

      <Card className="space-y-3">
        <p className="text-xs text-ink-subtle">Saved {new Date(savedAt).toLocaleString()}</p>
        {confirmRemoveAll ? (
          <Callout tone="danger" title="Remove this entire report?">
            <p>
              Removes all {entries.length} items from the vault on this device. Nothing else is
              affected, and this can’t be undone.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button variant="danger" className="sm:flex-1" onClick={() => void removeAll()} disabled={busy}>
                Yes, remove all {entries.length}
              </Button>
              <Button variant="quiet" className="sm:flex-1" onClick={() => setConfirmRemoveAll(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </Callout>
        ) : (
          <Button variant="danger" onClick={() => setConfirmRemoveAll(true)}>
            Remove entire report
          </Button>
        )}
      </Card>
    </div>
  );
}

function ItemRow({
  entry,
  index,
  total,
  confirming,
  busy,
  onOpen,
  onAskRemove,
  onCancelRemove,
  onConfirmRemove,
}: {
  entry: VaultRecord;
  index: number;
  total: number;
  confirming: boolean;
  busy: boolean;
  onOpen: () => void;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
}) {
  const { record, isDemo } = entry;
  const status = describeProofStatus(entry);
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    if (record.kind !== 'image') return;
    const url = URL.createObjectURL(record.blob);
    setThumb(url);
    return () => URL.revokeObjectURL(url);
  }, [record]);

  const toneClass = {
    affirm: 'bg-affirm-soft text-affirm',
    caution: 'bg-caution-soft text-caution',
    info: 'bg-sunken text-ink-muted',
  }[status.tone];

  return (
    <Card as="div" className="space-y-3">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-4 rounded-xl text-left"
        >
          <div className="size-16 shrink-0 overflow-hidden rounded-xl border border-line bg-sunken">
            {thumb ? (
              <img src={thumb} alt="" className="evidence-blur size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-ink-subtle">
                {record.kind === 'audio' ? <MicGlyph /> : <VideoGlyph />}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Item {index + 1} of {total} —{' '}
              {record.kind === 'video' ? 'video' : record.kind === 'audio' ? 'audio' : 'photo'}
              {record.kind !== 'image' && record.durationSeconds ? ` · ${formatDuration(record.durationSeconds)}` : ''}
            </p>
            <p className="truncate text-sm font-medium text-ink">
              {record.details.platform ||
                (record.details.category ? labelFor(CATEGORIES, record.details.category) : 'No details added')}
            </p>
            <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneClass}`}>
              {status.label}
            </span>
          </div>
        </button>
        {isDemo ? (
          <span className="shrink-0 rounded-full bg-sunken px-2 py-0.5 text-[11px] font-semibold text-ink-subtle">
            Demo
          </span>
        ) : null}
      </div>

      {confirming ? (
        <div className="flex flex-col gap-2 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-muted">Remove this item from the report?</p>
          <div className="flex gap-2">
            <Button variant="danger" className="px-3 py-1.5 text-sm" onClick={onConfirmRemove} disabled={busy}>
              Remove
            </Button>
            <Button variant="quiet" className="px-3 py-1.5 text-sm" onClick={onCancelRemove} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-t border-line pt-3">
          <button
            type="button"
            onClick={onAskRemove}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-danger hover:bg-danger-soft"
          >
            <RemoveIcon />
            Remove from report
          </button>
        </div>
      )}
    </Card>
  );
}

function RemoveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-8 0v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function VideoGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="m16 10 5-3v10l-5-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MicGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21M9 21h6" />
    </svg>
  );
}

function BackGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m14 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
