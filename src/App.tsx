/**
 * Evidence Vault — a four-screen flow for documenting hate speech with a tamper-evident,
 * independently verifiable record.
 *
 * All state lives in this component and nowhere else. There is no store, no cache and no
 * persistence layer, which is a deliberate design choice rather than a shortcut: closing
 * the tab is a complete and irreversible delete, and that property is easier to trust when
 * it is structural. See docs/SECURITY.md.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import CaptureScreen, { type CapturePayload } from './components/CaptureScreen';
import ProcessScreen from './components/ProcessScreen';
import ReviewScreen from './components/ReviewScreen';
import HandoverScreen from './components/HandoverScreen';
import ExportScreen from './components/ExportScreen';
import { StepIndicator } from './components/ui';
import { useTour } from './components/useTour';
import { IntroModal, TourModal } from './components/WelcomeModals';
import { markTourSeen, tourNotYetSeen } from './lib/tour';
import {
  emptyDetails,
  emptyHandover,
  type EvidenceRecord,
  type HandoverChoice,
  type ReportDetails,
  type Step,
  type TimestampProof,
} from './lib/types';

const STEPS: { id: Step; label: string }[] = [
  { id: 'capture', label: 'Capture' },
  { id: 'process', label: 'Secure' },
  { id: 'review', label: 'Review' },
  { id: 'handover', label: 'Send' },
  { id: 'export', label: 'Export' },
];

/** Short, non-sequential, and meaningless outside this record. */
function makeId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export default function App() {
  const [step, setStep] = useState<Step>('capture');
  const [pending, setPending] = useState<CapturePayload | null>(null);
  const [record, setRecord] = useState<EvidenceRecord | null>(null);

  // One object URL per captured blob. Derived during render rather than pushed into
  // state from an effect, so revealing the preview costs a single render instead of two.
  const previewUrl = useMemo(
    () => (pending ? URL.createObjectURL(pending.blob) : ''),
    [pending],
  );
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const reset = useCallback(() => {
    setPending(null);
    setRecord(null);
    setStep('capture');
  }, []);

  const handleCaptured = useCallback((payload: CapturePayload) => {
    setPending(payload);
    setStep('process');
  }, []);

  const handleProcessed = useCallback(
    (digest: Uint8Array, digestHex: string, proof: TimestampProof | undefined) => {
      setPending((current) => {
        if (!current) return current;
        setRecord({
          id: makeId(),
          blob: current.blob,
          mimeType: current.blob.type || 'application/octet-stream',
          byteLength: current.blob.size,
          source: current.source,
          kind: current.kind,
          durationSeconds: current.durationSeconds,
          hasAudio: current.hasAudio,
          capturedAt: new Date().toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          digest,
          digestHex,
          details: emptyDetails(),
          handover: emptyHandover(),
          proof,
        });
        setStep('review');
        return current;
      });
    },
    [],
  );

  const handleDetails = useCallback((details: ReportDetails) => {
    setRecord((r) => (r ? { ...r, details } : r));
  }, []);

  const handleHandover = useCallback((handover: HandoverChoice) => {
    setRecord((r) => (r ? { ...r, handover } : r));
  }, []);

  const tour = useTour(step);

  // Read storage once, at mount, via a lazy initialiser — deriving this during render
  // keeps it out of an effect and avoids a second render pass just to open a dialog.
  // First-time visitors land on the intro; everyone else goes straight to the app.
  const [welcome, setWelcome] = useState<'intro' | 'tour' | null>(() =>
    tourNotYetSeen() ? 'intro' : null,
  );

  const closeWelcome = useCallback(() => {
    setWelcome(null);
    markTourSeen();
  }, []);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <div className="mx-auto max-w-xl px-4 pb-16 pt-6 sm:px-6">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ShieldIcon />
            <span className="font-display text-base font-bold tracking-tight text-ink">
              Evidence Vault
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => (tour.active ? tour.stop() : setWelcome('intro'))}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-muted underline underline-offset-2 hover:bg-sunken hover:text-ink"
            >
              {tour.active ? 'End tour' : 'How it works'}
            </button>
            <p className="text-right text-xs leading-tight text-ink-subtle">
              Everything stays
              <br />
              on your device
            </p>
          </div>
        </header>

        <div className="mb-8">
          <StepIndicator current={stepIndex} steps={STEPS.map((s) => s.label)} />
        </div>

        <IntroModal
          open={welcome === 'intro'}
          onContinue={() => setWelcome('tour')}
          onDismiss={closeWelcome}
        />
        <TourModal
          open={welcome === 'tour'}
          onStart={() => {
            closeWelcome();
            tour.start();
          }}
          onSkip={closeWelcome}
        />

        <main id="main">
          {step === 'capture' ? <CaptureScreen onCaptured={handleCaptured} /> : null}

          {step === 'process' && pending ? (
            <ProcessScreen blob={pending.blob} onComplete={handleProcessed} onCancel={reset} />
          ) : null}

          {step === 'review' && record ? (
            <ReviewScreen
              record={record}
              previewUrl={previewUrl}
              onChange={handleDetails}
              onContinue={() => setStep('handover')}
              onDiscard={reset}
            />
          ) : null}

          {step === 'handover' && record ? (
            <HandoverScreen
              record={record}
              choice={record.handover ?? emptyHandover()}
              onChange={handleHandover}
              onContinue={() => setStep('export')}
              onBack={() => setStep('review')}
            />
          ) : null}

          {step === 'export' && record ? (
            <ExportScreen record={record} onStartOver={reset} />
          ) : null}
        </main>

        <footer className="mt-14 border-t border-line pt-5 text-xs leading-relaxed text-ink-subtle">
          <p>
            Evidence Vault runs entirely in your browser. Your file, your notes and the text read
            from an image are never uploaded. The only thing that leaves this device is a 32-byte
            fingerprint, sent to public timestamp servers that register it on a blockchain ledger.
            It cannot be turned back into your file or reveal anything about it, and no
            cryptocurrency is bought, sold or held.
          </p>
          <p className="mt-2">
            This tool records; it does not report on your behalf, and it notifies nobody. If someone
            is in immediate danger, contact your local emergency services.
          </p>
        </footer>
      </div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 text-accent" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3 5 6v5.5c0 4.2 2.9 7.9 7 9.5 4.1-1.6 7-5.3 7-9.5V6z" />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
