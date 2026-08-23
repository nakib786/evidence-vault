/**
 * One vault entry: the record as it was saved, a live re-check of its timestamp proof,
 * and every file it can produce again — as many times as it needs to go out to a
 * platform, a community organisation, a lawyer and the police, without repeating capture.
 */
import { useEffect, useState } from 'react';
import { Button, Callout, Card } from './ui';
import ExportBundle from './ExportBundle';
import { formatDigestForHumans } from '../lib/hash';
import { formatDuration } from '../lib/media';
import { CATEGORIES, SEVERITIES, labelFor } from '../lib/taxonomy';
import { findCountry } from '../lib/jurisdictions';
import { upgradeProof } from '../lib/ots';
import { describeProofStatus } from '../lib/vaultStatus';
import type { VaultRecord } from '../lib/types';
import type { useVault } from './useVault';

interface Props {
  entry: VaultRecord;
  vault: ReturnType<typeof useVault>;
  onBack: () => void;
  onRemoved: () => void;
}

const isRtl = (text: string): boolean => /[؀-ۿ]/.test(text);

export default function VaultRecordScreen({ entry, vault, onBack, onRemoved }: Props) {
  const { record, isDemo, savedAt } = entry;
  const [revealed, setRevealed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkNote, setCheckNote] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

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

  const checkConfirmation = async (): Promise<void> => {
    if (!record.proof) return;
    setChecking(true);
    setCheckNote(null);
    try {
      const result = await upgradeProof(record.proof.ots);
      if (result.errors.length > 0 && !result.changed) {
        // Calendars serve the /digest submission endpoint with CORS enabled, but not
        // every calendar does the same for the GET this upgrade check needs — a browser
        // silently blocks reading that response even though a plain HTTP client (or the
        // reference `ots` CLI) reads it fine. There is no client-side retry that fixes
        // this, so point at the tool that isn't affected rather than imply trying again
        // might help.
        setCheckNote(
          'This browser could not read a response from the calendar — some of them don’t allow that ' +
            'for this particular check. Use the standalone tool below, which isn’t affected.',
        );
        return;
      }
      if (!result.changed) {
        setCheckNote('Still pending — nothing new from the calendars yet.');
        return;
      }
      await vault.save(
        { ...record, proof: { ...record.proof, ots: result.ots } },
        { isDemo: false },
      );
      setCheckNote(
        result.confirmedHeights.length > 0
          ? `Confirmed on Bitcoin block #${result.confirmedHeights[0]}.`
          : 'The proof grew a new attestation, but is not yet confirmed on the ledger.',
      );
    } catch {
      setCheckNote('The check could not run here. Use the standalone tool below instead.');
    } finally {
      setChecking(false);
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

        {!isDemo && record.proof ? (
          <div className="space-y-2">
            <Button variant="secondary" onClick={checkConfirmation} disabled={checking}>
              {checking ? 'Checking…' : 'Check for confirmation'}
            </Button>
            {checkNote ? <p className="text-sm text-ink-muted">{checkNote}</p> : null}
            <p className="text-xs text-ink-subtle">
              This button works when the calendar allows it, and says so plainly when one doesn’t. It
              never depends on this app either way: with the original file and the .ots proof
              downloaded below, anyone can check confirmation with{' '}
              <code className="rounded bg-sunken px-1 py-0.5 font-mono">
                pip install opentimestamps-client &amp;&amp; ots upgrade
              </code>
              , or at{' '}
              <a
                href="https://opentimestamps.org"
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent underline underline-offset-2 hover:text-accent-hover"
              >
                opentimestamps.org
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              .
            </p>
          </div>
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

function Row({ label, value }: { label: string; value: string }) {
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
