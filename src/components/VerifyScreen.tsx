/**
 * Standalone, native verification: upload a file and its .ots proof, and check the proof
 * against the file entirely in this browser — no vault entry needed, no account. Works for
 * any Evidence Vault record, saved in this browser's vault or not, and for any standard
 * OpenTimestamps proof from elsewhere — the proof format was always meant to outlive any one
 * app, so verifying it shouldn't require this one either.
 */
import { useCallback, useRef, useState, type RefObject } from 'react';
import { Button, Callout, Card } from './ui';
import ProofLivePanel from './ProofLivePanel';
import { useProofCheck } from './useProofCheck';
import { verifyFileAgainstProof, type VerifyResult } from '../lib/verify';
import { formatDigestForHumans } from '../lib/hash';
import { download } from '../lib/download';
import { mergeProofs, parseDetachedOts, collectPendingUris, type UpgradeResult } from '../lib/ots';
import type { EvidenceRecord, VaultRecord } from '../lib/types';
import type { useVault } from './useVault';

interface Props {
  vault: ReturnType<typeof useVault>;
  onBack: () => void;
}

export default function VerifyScreen({ vault, onBack }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofBytes, setProofBytes] = useState<Uint8Array | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgraded, setUpgraded] = useState(false);
  const [savingToVault, setSavingToVault] = useState(false);
  const [savedToVaultNote, setSavedToVaultNote] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback((): void => {
    setFile(null);
    setProofFile(null);
    setProofBytes(null);
    setResult(null);
    setError(null);
    setUpgraded(false);
    setSavedToVaultNote(null);
  }, []);

  const handleVerify = useCallback(async (): Promise<void> => {
    if (!file || !proofFile) return;
    setVerifying(true);
    setError(null);
    setResult(null);
    setUpgraded(false);
    setSavedToVaultNote(null);
    try {
      const bytes = new Uint8Array(await proofFile.arrayBuffer());
      const verified = await verifyFileAgainstProof(file, bytes);
      setProofBytes(bytes);
      setResult(verified);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? `Could not read the proof file: ${err.message}`
          : 'Could not read the proof file. Make sure it is the .ots file saved alongside this exact file.',
      );
    } finally {
      setVerifying(false);
    }
  }, [file, proofFile]);

  const isConfirmed = (result?.confirmedHeights.length ?? 0) > 0;

  const onUpgraded = useCallback((upgrade: UpgradeResult): void => {
    setProofBytes(upgrade.ots);
    setUpgraded(true);
    setResult((prev) =>
      prev ? { ...prev, confirmedHeights: upgrade.confirmedHeights, pendingUris: upgrade.pendingUris } : prev,
    );
  }, []);

  const proofCheck = useProofCheck({
    trackingKey: result?.matches && !isConfirmed ? result.proofDigestHex : null,
    ots: proofBytes,
    pendingUris: result?.pendingUris ?? [],
    onUpgraded,
  });

  // The check above already updates this page's own view of the proof live. If this file
  // also happens to be saved in the vault, offer to fold whatever was just learned straight
  // back into that record too, rather than making someone download-then-reupload.
  const matchingEntry: VaultRecord | undefined =
    result?.matches && vault.unlocked && !vault.isDuress
      ? vault.entries.find((e) => !e.isDemo && e.record.digestHex === result.fileDigestHex)
      : undefined;

  const handleUpdateVaultRecord = useCallback(
    async (entry: VaultRecord): Promise<void> => {
      if (!proofBytes || !entry.record.proof) return;
      setSavingToVault(true);
      setSavedToVaultNote(null);
      try {
        const merged = mergeProofs(entry.record.proof.ots, proofBytes);
        const pendingUris = collectPendingUris(parseDetachedOts(merged).timestamp);
        const updated: EvidenceRecord = { ...entry.record, proof: { ...entry.record.proof, ots: merged, pendingUris } };
        await vault.save(updated, { isDemo: false });
        setSavedToVaultNote('Saved to the matching vault record.');
      } catch {
        setSavedToVaultNote('Could not update the vault record.');
      } finally {
        setSavingToVault(false);
      }
    },
    [vault, proofBytes],
  );

  const status = !result
    ? null
    : !result.matches
      ? { tone: 'danger' as const, title: 'This file does not match this proof' }
      : isConfirmed
        ? { tone: 'affirm' as const, title: `Confirmed on Bitcoin block #${result.confirmedHeights[0]}` }
        : result.pendingUris.length > 0
          ? { tone: 'caution' as const, title: 'Pending confirmation' }
          : { tone: 'info' as const, title: 'Submitted' };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink"
      >
        <BackGlyph /> Back to app
      </button>

      <div className="space-y-1.5">
        <h1 className="font-display text-xl font-bold text-ink">Verify a stamp</h1>
        <p className="text-sm text-ink-muted">
          Upload a file and its <code className="rounded bg-sunken px-1 py-0.5 font-mono text-xs">.ots</code> proof
          to check them against each other — entirely in this browser; neither file is uploaded anywhere. Works for
          any Evidence Vault record, not only ones saved in this browser's vault, and for any standard
          OpenTimestamps proof.
        </p>
      </div>

      <Card className="space-y-4" data-tour="verify-upload">
        <FilePicker
          label="Evidence file"
          hint="The exact file the proof was made for — a re-encoded or edited copy will not match."
          chosen={file}
          onChoose={setFile}
          inputRef={fileInputRef}
        />
        <FilePicker
          label="Proof file (.ots)"
          hint="The detached OpenTimestamps proof saved alongside it."
          chosen={proofFile}
          onChoose={setProofFile}
          inputRef={proofInputRef}
          accept=".ots"
        />
        <Button
          variant="primary"
          block
          onClick={() => void handleVerify()}
          disabled={!file || !proofFile || verifying}
        >
          {verifying ? 'Verifying…' : 'Verify'}
        </Button>
      </Card>

      {error ? (
        <Callout tone="danger" title="Could not verify">
          {error}
        </Callout>
      ) : null}

      {result && status ? (
        <Card className="space-y-4">
          <h2 className="font-display text-sm font-bold text-ink">Result</h2>
          <Callout tone={status.tone} title={status.title}>
            {!result.matches ? (
              <>
                The fingerprint inside the proof does not match the fingerprint of the uploaded file. Either this
                isn’t the file the proof was made for, or the file changed after the proof was made — even a
                re-save that looks identical produces a different fingerprint.
              </>
            ) : isConfirmed ? (
              <>Independently verifiable with the standard OpenTimestamps tooling — see below.</>
            ) : result.pendingUris.length > 0 ? (
              <>Submitted to the calendars; confirmation usually completes within a few hours.</>
            ) : (
              <>A fingerprint was submitted, with no calendar left pending in this proof.</>
            )}
          </Callout>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">File fingerprint</p>
              <p className="mt-1 break-all rounded-lg bg-sunken px-3 py-2 font-mono text-xs text-ink">
                {formatDigestForHumans(result.fileDigestHex)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Proof fingerprint</p>
              <p className="mt-1 break-all rounded-lg bg-sunken px-3 py-2 font-mono text-xs text-ink">
                {formatDigestForHumans(result.proofDigestHex)}
              </p>
            </div>
          </div>

          {result.matches && !isConfirmed ? <ProofLivePanel state={proofCheck} /> : null}

          {matchingEntry ? (
            <div className="space-y-1.5 rounded-lg bg-sunken px-3 py-2.5">
              <p className="text-sm text-ink">
                This matches a record already in your vault, saved{' '}
                {new Date(matchingEntry.savedAt).toLocaleDateString()}.
              </p>
              <Button
                variant="secondary"
                onClick={() => void handleUpdateVaultRecord(matchingEntry)}
                disabled={savingToVault}
              >
                {savingToVault ? 'Updating…' : 'Update the matching vault record'}
              </Button>
              {savedToVaultNote ? <p className="text-xs text-ink-subtle">{savedToVaultNote}</p> : null}
            </div>
          ) : null}

          {result.matches && upgraded && proofBytes ? (
            <div className="space-y-1.5">
              <Button
                variant="secondary"
                onClick={() =>
                  download(
                    new Blob([proofBytes as unknown as BlobPart], { type: 'application/octet-stream' }),
                    proofFile?.name ?? 'proof.ots',
                  )
                }
              >
                Download the updated proof
              </Button>
              <p className="text-xs text-ink-subtle">
                The check above found a new attestation. This is the same proof file with that attestation added —
                save it over the old one.
              </p>
            </div>
          ) : null}

          <Button variant="quiet" onClick={reset}>
            Verify another
          </Button>
        </Card>
      ) : null}
    </div>
  );
}

function FilePicker({
  label,
  hint,
  chosen,
  onChoose,
  inputRef,
  accept,
}: {
  label: string;
  hint: string;
  chosen: File | null;
  onChoose: (file: File) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  accept?: string;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="font-display text-sm font-semibold text-ink">{label}</p>
        <p className="text-sm text-ink-muted">{hint}</p>
      </div>
      {/* Kept out of the tab order: the visible button below is the real control. */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onChoose(f);
          e.target.value = '';
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>
          {chosen ? 'Change file' : 'Choose a file'}
        </Button>
        {chosen ? <p className="truncate font-mono text-xs text-ink-subtle">{chosen.name}</p> : null}
      </div>
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
