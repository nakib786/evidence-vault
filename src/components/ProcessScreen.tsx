/**
 * Screen 2 — fingerprint the file and get it timestamped.
 *
 * This runs on its own without asking anything, because there is nothing useful to ask.
 * The user watches two short steps and moves on. OCR deliberately does *not* happen here:
 * it needs a language choice and downloads a sizeable model, so it belongs on the review
 * screen where the user can decide whether they want it at all.
 */
import { useEffect, useRef, useState } from 'react';
import { Button, Callout, Card, ProgressBar } from './ui';
import { sha256Blob, toHex, formatDigestForHumans } from '../lib/hash';
import { stampDigest } from '../lib/ots';
import type { TimestampProof } from '../lib/types';

type Phase = 'hashing' | 'stamping' | 'done' | 'failed';

interface Props {
  blob: Blob;
  onComplete: (digest: Uint8Array, digestHex: string, proof: TimestampProof | undefined) => void;
  onCancel: () => void;
}

export default function ProcessScreen({ blob, onComplete, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>('hashing');
  const [digestHex, setDigestHex] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<{ digest: Uint8Array; hex: string; proof?: TimestampProof } | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    // StrictMode double-invokes effects in development: mount → effect → cleanup →
    // effect. The ref below keeps the calendars from being asked twice for one capture.
    //
    // Deliberately no AbortController here. An earlier version aborted on cleanup, which
    // meant StrictMode's synthetic cleanup killed the in-flight requests while the guard
    // stopped the second run from restarting them — every stamp failed in development.
    // The requests are short and submitting a digest twice is harmless, so letting them
    // run to completion is both simpler and safer than trying to cancel them.
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const digest = await sha256Blob(blob);
        const hex = toHex(digest);
        setDigestHex(hex);
        resultRef.current = { digest, hex };
        setPhase('stamping');

        try {
          const stamp = await stampDigest(digest);
          resultRef.current.proof = {
            ots: stamp.ots,
            calendars: stamp.calendars,
            pendingUris: stamp.pendingUris,
            submittedAt: new Date().toISOString(),
          };
        } catch (err) {
          // A failed timestamp is recoverable — the digest is still valid and useful, so
          // we surface the problem rather than throwing the capture away.
          setError(err instanceof Error ? err.message : 'The timestamp servers could not be reached.');
        }

        setPhase('done');
      } catch {
        setError('This file could not be read. It may be corrupted.');
        setPhase('failed');
      }
    })();
  }, [blob]);

  // Advance automatically once there is nothing left to watch.
  useEffect(() => {
    if (phase !== 'done' || error) return;
    const t = setTimeout(() => {
      const r = resultRef.current;
      if (r) onComplete(r.digest, r.hex, r.proof);
    }, 700);
    return () => clearTimeout(t);
  }, [phase, error, onComplete]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold text-ink">Securing your record</h1>
        <p className="text-ink-muted">This takes a moment. You don’t need to do anything.</p>
      </div>

      <Card className="space-y-5" data-tour="securing">
        <ProgressBar
          ratio={phase === 'hashing' ? null : 1}
          label={phase === 'hashing' ? 'Fingerprinting the image' : 'Image fingerprinted'}
        />
        <ProgressBar
          ratio={phase === 'hashing' ? 0 : phase === 'stamping' ? null : 1}
          label={
            phase === 'hashing'
              ? 'Timestamp proof'
              : phase === 'stamping'
                ? 'Requesting timestamp proof'
                : error
                  ? 'Timestamp proof unavailable'
                  : 'Timestamp proof requested'
          }
        />
      </Card>

      {digestHex ? (
        <Card className="space-y-2">
          <h2 className="font-display text-sm font-bold text-ink">Your file’s fingerprint</h2>
          <p className="text-sm text-ink-muted">
            A unique SHA-256 signature of this exact image. Change a single pixel and it changes
            completely.
          </p>
          <p className="break-all rounded-lg bg-sunken px-3 py-2 font-mono text-xs text-ink">
            {formatDigestForHumans(digestHex)}
          </p>
        </Card>
      ) : null}

      {error ? (
        <>
          <Callout tone="caution" title="Couldn’t reach the timestamp servers">
            {error} Your fingerprint is still valid and you can carry on — but without a timestamp,
            the record shows what the file is, not when it existed. You can try again later with the
            saved proof file.
          </Callout>
          <div className="space-y-2">
            <Button
              block
              onClick={() => {
                const r = resultRef.current;
                if (r) onComplete(r.digest, r.hex, r.proof);
              }}
            >
              Continue without a timestamp
            </Button>
            <Button variant="quiet" block onClick={onCancel}>
              Start over
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
