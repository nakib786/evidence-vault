/**
 * One vault entry: the record as it was saved, a live re-check of its timestamp proof,
 * and every file it can produce again — as many times as it needs to go out to a
 * platform, a community organisation, a lawyer and the police, without repeating capture.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Callout, Card } from './ui';
import ExportBundle from './ExportBundle';
import ProofLivePanel from './ProofLivePanel';
import { useProofCheck } from './useProofCheck';
import { formatDigestForHumans } from '../lib/hash';
import { formatDuration } from '../lib/media';
import { CATEGORIES, SEVERITIES, labelFor } from '../lib/taxonomy';
import { findCountry } from '../lib/jurisdictions';
import { mergeProofs, parseDetachedOts, collectPendingUris, confirmedBlockHeights, type UpgradeResult } from '../lib/ots';
import { describeProofStatus } from '../lib/vaultStatus';
import { formatLocation, locationMapUri } from '../lib/geo';
import type { EvidenceRecord, VaultRecord } from '../lib/types';
import type { useVault } from './useVault';

interface Props {
  entry: VaultRecord;
  vault: ReturnType<typeof useVault>;
  onBack: () => void;
  onRemoved: () => void;
  onOpenVerify: () => void;
}

const isRtl = (text: string): boolean => /[؀-ۿ]/.test(text);

export default function VaultRecordScreen({ entry, vault, onBack, onRemoved, onOpenVerify }: Props) {
  const { record, isDemo, savedAt } = entry;
  const [revealed, setRevealed] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Created and revoked by the same effect run — not split across a useMemo and a
  // separate cleanup effect, which under React StrictMode's dev-only double-invocation
  // revokes the one URL a memo created before the second effect pass has a new one to
  // replace it with, leaving the <img>/<video> pointed at an already-revoked blob: URL.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(record.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [record]);
  const isVideoRecord = record.kind === 'video';
  const status = describeProofStatus(entry);
  const country = record.handover?.countryId ? findCountry(record.handover.countryId) : undefined;

  // Read from a ref inside `onUpgraded` below, so the callback always builds off the latest
  // record even though `useProofCheck`'s effects are keyed on `record.id` alone — not on
  // `record` itself, which changes identity every time a check saves an upgraded proof, and
  // would otherwise restart the polling loop it's in the middle of running.
  const recordRef = useRef(record);
  useEffect(() => {
    recordRef.current = record;
  }, [record]);

  const isConfirmed = status.tone === 'affirm';

  const onUpgraded = useCallback(
    async (result: UpgradeResult): Promise<void> => {
      const current = recordRef.current;
      if (!current.proof) return;
      const updated: EvidenceRecord = { ...current, proof: { ...current.proof, ots: result.ots } };
      recordRef.current = updated;
      await vault.save(updated, { isDemo: false });
    },
    [vault],
  );

  const proofCheck = useProofCheck({
    trackingKey: !isDemo && record.proof && !isConfirmed ? record.id : null,
    ots: record.proof?.ots ?? null,
    pendingUris: record.proof?.pendingUris ?? [],
    onUpgraded,
  });

  // The automatic check above (see useProofCheck / functions/api/ots-check.ts) covers the
  // normal case. This is the fallback for everything else: a proof already upgraded outside
  // this browser entirely — a different device, the CLI, or opentimestamps.org — brought
  // back into this record so its status can catch up without waiting on this device's own
  // next check.
  const handleImportProof = useCallback(
    async (file: File): Promise<void> => {
      const current = recordRef.current;
      if (!current.proof) return;
      setImporting(true);
      setImportNote(null);
      try {
        const incoming = new Uint8Array(await file.arrayBuffer());
        const merged = mergeProofs(current.proof.ots, incoming);
        const pendingUris = collectPendingUris(parseDetachedOts(merged).timestamp);
        const updated: EvidenceRecord = { ...current, proof: { ...current.proof, ots: merged, pendingUris } };
        recordRef.current = updated;
        await vault.save(updated, { isDemo: false });
        const heights = confirmedBlockHeights(merged);
        setImportNote(
          heights.length > 0
            ? `Confirmed on Bitcoin block #${heights[0]}.`
            : 'Imported. Still pending — no confirmed attestation in that file yet either.',
        );
      } catch (err) {
        setImportNote(
          err instanceof Error && err.message.startsWith('That proof is for a different file')
            ? err.message
            : 'Could not read that as an OpenTimestamps proof for this record.',
        );
      } finally {
        setImporting(false);
      }
    },
    [vault],
  );

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink"
      >
        <BackGlyph /> Back to vault
      </button>

      {isDemo ? (
        <Callout tone="caution" title="This is a demo record">
          Synthetic content and a fabricated proof, included because this hackathon build cannot
          use real evidence. It was never submitted to a real timestamp calendar and cannot be
          verified with real OpenTimestamps tooling.
        </Callout>
      ) : null}

      {/* ---- Preview ---- */}
      <Card className="space-y-3" data-tour="vault-preview">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-sm font-bold text-ink">What was captured</h2>
          <Button variant="quiet" className="px-3 py-1.5 text-sm" onClick={() => setRevealed((v) => !v)} aria-pressed={revealed}>
            {revealed ? 'Hide' : isVideoRecord ? 'Show recording' : 'Show image'}
          </Button>
        </div>
        <div className="overflow-hidden rounded-xl border border-line bg-sunken">
          {isVideoRecord ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption -- reporter's own recording; transcript is shown separately below
            <video
              src={previewUrl ?? undefined}
              controls={revealed}
              preload="metadata"
              playsInline
              className={`max-h-80 w-full bg-black object-contain transition-[filter] ${revealed ? '' : 'evidence-blur pointer-events-none'}`}
            />
          ) : (
            <img
              src={previewUrl ?? undefined}
              alt={revealed ? 'The saved content.' : 'The saved content, currently blurred.'}
              className={`max-h-80 w-full object-contain transition-[filter] ${revealed ? '' : 'evidence-blur'}`}
            />
          )}
        </div>
      </Card>

      {/* ---- Details ---- */}
      <Card as="div" className="space-y-3">
        <Row label="Saved to vault" value={new Date(savedAt).toLocaleString()} />
        <Row
          label="Captured"
          value={`${new Date(record.capturedAt).toLocaleString()} (${record.timeZone})`}
        />
        {isVideoRecord ? (
          <Row label="Length" value={record.durationSeconds ? formatDuration(record.durationSeconds) : 'Not available'} />
        ) : null}
        {record.details.platform ? <Row label="Platform" value={record.details.platform} /> : null}
        {record.details.sourceUrl ? <Row label="Link" value={record.details.sourceUrl} /> : null}
        {record.details.category ? <Row label="Category" value={labelFor(CATEGORIES, record.details.category)} /> : null}
        {record.details.severity ? <Row label="Severity" value={labelFor(SEVERITIES, record.details.severity)} /> : null}
        {record.details.location ? (
          <Row
            label="Location"
            value={
              <>
                {formatLocation(record.details.location)}{' '}
                <a
                  href={locationMapUri(record.details.location)}
                  className="text-accent underline underline-offset-2 hover:text-accent-hover"
                >
                  Open in maps
                </a>
              </>
            }
          />
        ) : null}
        {country ? <Row label="Reported toward" value={country.name} /> : null}
        {record.details.contactName ? <Row label="Reporter name" value={record.details.contactName} /> : null}
        {record.details.contactEmail ? <Row label="Reporter email" value={record.details.contactEmail} /> : null}
        {record.details.contactPhone ? <Row label="Reporter phone" value={record.details.contactPhone} /> : null}
      </Card>

      {record.details.note.trim() ? (
        <Card as="div" className="space-y-2">
          <h2 className="font-display text-sm font-bold text-ink">Reporter’s account</h2>
          <p className="whitespace-pre-wrap text-sm text-ink-muted">{record.details.note}</p>
        </Card>
      ) : null}

      {record.details.transcript.trim() ? (
        <Card as="div" className="space-y-2">
          <h2 className="font-display text-sm font-bold text-ink">Transcript</h2>
          <p
            dir={isRtl(record.details.transcript) ? 'rtl' : undefined}
            className="whitespace-pre-wrap font-mono text-sm text-ink-muted"
          >
            {record.details.transcript}
          </p>
        </Card>
      ) : null}

      {/* ---- Proof ---- */}
      <Card className="space-y-3" data-tour="vault-verify">
        <h2 className="font-display text-sm font-bold text-ink">Proof attached to this record</h2>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Fingerprint</p>
          <p className="mt-1 break-all rounded-lg bg-sunken px-3 py-2 font-mono text-xs text-ink">
            {formatDigestForHumans(record.digestHex)}
          </p>
        </div>
        <Callout tone={status.tone} title={status.label}>
          {status.detail}
        </Callout>

        {!isDemo && record.proof && !isConfirmed ? <ProofLivePanel state={proofCheck} /> : null}

        {!isDemo && record.proof && !isConfirmed ? (
          <div className="space-y-2 border-t border-line pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Already checked it somewhere else?
            </p>
            <p className="text-xs text-ink-subtle">
              If a check outside this app — the CLI, opentimestamps.org, or a check on the verify page — found a
              confirmation, import that <code className="rounded bg-sunken px-1 py-0.5 font-mono">.ots</code> file
              here to bring it into this record.
            </p>
            <input
              ref={importInputRef}
              type="file"
              accept=".ots"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImportProof(f);
                e.target.value = '';
              }}
            />
            <Button variant="secondary" onClick={() => importInputRef.current?.click()} disabled={importing}>
              {importing ? 'Importing…' : 'Import a proof file'}
            </Button>
            {importNote ? <p className="text-sm text-ink-muted">{importNote}</p> : null}
          </div>
        ) : null}

        {!isDemo && record.proof ? (
          <p className="text-xs text-ink-subtle">
            You can also verify this record independently, with just the original file and the .ots proof
            downloaded below, on the{' '}
            <button type="button" onClick={onOpenVerify} className="text-accent underline underline-offset-2 hover:text-accent-hover">
              verify page
            </button>
            .
          </p>
        ) : null}
      </Card>

      {/* ---- Re-download ---- */}
      <div className="space-y-2">
        <h2 className="font-display text-lg font-bold text-ink">Download these files again</h2>
        <p className="text-sm text-ink-muted">
          Regenerated fresh each time from what’s saved here — send the same package to as many
          people as this needs to go to.
        </p>
      </div>
      <ExportBundle record={record} />

      {/* ---- Remove ---- */}
      <Card className="space-y-3" data-tour="vault-remove">
        {confirmRemove ? (
          <Callout tone="danger" title="Remove this record?">
            <p>This only removes it from the vault on this device. Nothing else is affected.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                variant="danger"
                className="sm:flex-1"
                onClick={async () => {
                  await vault.remove(record.id);
                  onRemoved();
                }}
              >
                Yes, remove it
              </Button>
              <Button variant="quiet" className="sm:flex-1" onClick={() => setConfirmRemove(false)}>
                Cancel
              </Button>
            </div>
          </Callout>
        ) : (
          <Button variant="danger" onClick={() => setConfirmRemove(true)}>
            Remove from vault
          </Button>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className="text-sm text-ink sm:text-right">{value}</p>
    </div>
  );
}

function BackGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m14 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
