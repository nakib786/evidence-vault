/**
 * Evidence Vault — a four-screen flow for documenting hate speech with a tamper-evident,
 * independently verifiable record.
 *
 * All state lives in this component and nowhere else. There is no store, no cache and no
 * persistence layer, which is a deliberate design choice rather than a shortcut: closing
 * the tab is a complete and irreversible delete, and that property is easier to trust when
 * it is structural. See docs/SECURITY.md.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import CaptureScreen, { type CapturePayload } from './components/CaptureScreen';
import ReviewScreen from './components/ReviewScreen';
import HandoverScreen from './components/HandoverScreen';
import ExportScreen from './components/ExportScreen';
import VaultScreen from './components/VaultScreen';
import VaultRecordScreen from './components/VaultRecordScreen';
import VerifyScreen from './components/VerifyScreen';
import { Button, StepIndicator } from './components/ui';
import Modal from './components/Modal';
import { useTour } from './components/useTour';
import { useVault } from './components/useVault';
import { IntroModal, TourModal } from './components/WelcomeModals';
import { FaqModal } from './components/FaqModal';
import { isIntroHidden, setIntroHidden, type TourSection } from './lib/tour';
import { buildDemoCapture } from './lib/demoCapture';
import { secureBlob } from './lib/secure';
import { DEFAULT_DEMO_PIN } from './lib/vaultCrypto';
import {
  emptyDetails,
  emptyHandover,
  type CaptureItem,
  type EvidenceRecord,
  type HandoverChoice,
  type ReportDetails,
  type Step,
} from './lib/types';

const STEPS: { id: Step; label: string }[] = [
  { id: 'capture', label: 'Capture' },
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

  // A package in progress: one or more captured photos/videos, each fingerprinted and
  // timestamped in the background the instant it's taken (see `secureBlob`) rather than on
  // a blocking screen — an item sits here as 'securing' for the brief moment before its
  // `record` exists, so the review list can show it right away instead of making the user
  // wait one loading screen per item. `packageId` names the bundle everything downloads as.
  const [items, setItems] = useState<CaptureItem[]>([]);
  const [packageId] = useState(makeId);
  const [packageHandover, setPackageHandover] = useState<HandoverChoice>(emptyHandover());

  const readyItems = useMemo(() => items.filter((it) => it.record).map((it) => it.record!), [items]);

  const reset = useCallback(() => {
    setItems([]);
    setPackageHandover(emptyHandover());
    setStep('capture');
  }, []);

  // Adding an item never navigates anywhere by itself — the whole point is that photos and
  // videos can be taken back-to-back, fingerprinted in the background as they land, while
  // the user stays on the capture screen. Moving on to fill in the report is a separate,
  // explicit action; see `goToReview` below.
  const handleCaptured = useCallback((payload: CapturePayload) => {
    const id = makeId();
    setItems((prev) => [
      ...prev,
      {
        id,
        blob: payload.blob,
        source: payload.source,
        kind: payload.kind,
        durationSeconds: payload.durationSeconds,
        hasAudio: payload.hasAudio,
        captureMeta: payload.captureMeta,
        status: 'securing',
      },
    ]);

    void (async () => {
      try {
        const { digest, digestHex, proof } = await secureBlob(payload.blob);
        const record: EvidenceRecord = {
          id,
          blob: payload.blob,
          mimeType: payload.blob.type || 'application/octet-stream',
          byteLength: payload.blob.size,
          source: payload.source,
          kind: payload.kind,
          durationSeconds: payload.durationSeconds,
          hasAudio: payload.hasAudio,
          captureMeta: payload.captureMeta,
          capturedAt: new Date().toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          digest,
          digestHex,
          proof,
          details: emptyDetails(),
          handover: emptyHandover(),
        };
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: 'ready', record } : it)));
      } catch {
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? { ...it, status: 'error', error: 'This file could not be fingerprinted. You can remove it and try again.' }
              : it,
          ),
        );
      }
    })();
  }, []);

  // The explicit "done capturing, review it" action — called once, after however many items
  // were taken in this batch, rather than automatically after each one.
  const goToReview = useCallback(() => {
    setStep('review');
  }, []);

  const handleRemoveItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const handleItemDetails = useCallback((id: string, details: ReportDetails) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id && it.record ? { ...it, record: { ...it.record, details } } : it)),
    );
  }, []);

  const handleHandover = useCallback((handover: HandoverChoice) => {
    setPackageHandover(handover);
  }, []);

  // The package-wide choice gets copied onto every item at the moment of leaving the
  // handover screen, so every downstream piece (the certificate, the cover letter, the
  // vault) can keep reading `record.handover` exactly as it always has for one item —
  // nothing downstream needs to know a package can hold more than one.
  const applyHandoverToItems = useCallback((handover: HandoverChoice) => {
    setItems((prev) =>
      prev.map((it) => (it.record ? { ...it, record: { ...it.record, handover } } : it)),
    );
  }, []);

  const vault = useVault();
  const [view, setView] = useState<'flow' | 'vault' | 'verify'>('flow');
  const [vaultEntryId, setVaultEntryId] = useState<string | null>(null);
  const [confirmHomeOpen, setConfirmHomeOpen] = useState(false);

  // What the tour should be narrating right now. The vault is a separate `view`, not part
  // of the `step` machine, and "locked" / "empty" / "has records" are each a different set
  // of elements on screen — so it gets three sections of its own rather than one, the same
  // reason the main flow is split by `Step` instead of being a single long section.
  const vaultTourSection: TourSection = !vault.unlocked
    ? 'vault-locked'
    : vault.entries.length === 0
      ? 'vault-empty'
      : 'vault-list';
  const tourSection: TourSection =
    view === 'verify' ? 'verify' : view === 'vault' ? (vaultEntryId ? 'vault-record' : vaultTourSection) : step;

  const stopRef = useRef<() => void>(() => {});

  /**
   * Reaching the end of a section's steps hands control here instead of stopping the tour,
   * so one "How it works" click walks the whole app rather than only whatever screen was
   * already open. Each branch makes exactly one real state change — never fakes a screen —
   * and that change is what carries `tourSection` on to the next screen; see useTour's own
   * comment for why the tour can't drive this itself.
   *
   * A plain function rather than `useCallback`: it needs to close over this render's
   * freshest state (particularly `vault`, whose methods are only valid for the currently
   * unlocked key), and a fresh identity every render is harmless here because useTour reads
   * it through a ref rather than an effect dependency.
   */
  function advanceDemo(): void {
    switch (tourSection) {
      case 'capture':
        void (async () => {
          try {
            const payload = await buildDemoCapture();
            handleCaptured(payload);
            // Capturing no longer navigates by itself (see `handleCaptured`), so the demo
            // takes the same explicit "done capturing" step a real user would.
            goToReview();
          } catch {
            // No sample file to fall back on — stop cleanly rather than leaving the tour
            // stuck on a step that will never move.
            stopRef.current();
          }
        })();
        break;
      case 'review': {
        // Fill in a jurisdiction before moving on, so "who to contact" and "certificate" —
        // which only render once a country is chosen — have something real to show
        // instead of two of the next section's three steps being skipped.
        const demoHandover: HandoverChoice = {
          countryId: 'us',
          regionId: 'us-ny',
          selectedAgencyIds: ['nypd'],
          declarantName: '',
          declarantContact: '',
          includeCertificate: true,
        };
        handleHandover(demoHandover);
        applyHandoverToItems(demoHandover);
        setStep('handover');
        break;
      }
      case 'handover':
        setStep('export');
        break;
      case 'export':
        setVaultEntryId(null);
        setView('vault');
        break;
      case 'vault-locked':
        void vault.unlock(DEFAULT_DEMO_PIN);
        break;
      case 'vault-empty':
        void vault.loadDemo();
        break;
      case 'vault-list': {
        const first = vault.entries[0];
        if (first) setVaultEntryId(first.record.id);
        else stopRef.current();
        break;
      }
      case 'vault-record':
        // Walk into the standalone verify page next, rather than ending the tour here.
        setVaultEntryId(null);
        setView('verify');
        break;
      case 'verify':
        // The end of the walkthrough — return to the start rather than leaving whoever's
        // watching stranded on the verify page.
        reset();
        setView('flow');
        setVaultEntryId(null);
        stopRef.current();
        break;
    }
  }

  const tour = useTour(tourSection, advanceDemo);
  useEffect(() => {
    stopRef.current = tour.stop;
  }, [tour.stop]);

  const closeVault = useCallback(() => {
    setView('flow');
    setVaultEntryId(null);
  }, []);

  // Captured items live only in memory until they're saved to the vault or exported (see
  // the file-level comment on `items`), so leaving mid-session with any still pending is a
  // real, irreversible loss — the same as closing the tab. Anything already in the vault is
  // encrypted on disk and safe to walk away from without asking.
  const hasUnsavedWork = items.length > 0;

  function goHome(): void {
    if (tour.active) tour.stop();
    reset();
    setView('flow');
    setVaultEntryId(null);
    setConfirmHomeOpen(false);
  }

  function handleHomeClick(): void {
    if (hasUnsavedWork) {
      setConfirmHomeOpen(true);
    } else {
      goHome();
    }
  }

  // Read storage once, at mount, via a lazy initialiser — deriving this during render
  // keeps it out of an effect and avoids a second render pass just to open a dialog. The
  // welcome sequence shows every session by default; the only thing that ever suppresses
  // it is the explicit "Don't show this again" checkbox in the intro dialog.
  const [welcome, setWelcome] = useState<'intro' | 'tour' | null>(() =>
    isIntroHidden() ? null : 'intro',
  );
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);

  const closeWelcome = useCallback(() => {
    setWelcome(null);
    setIntroHidden(dontShowAgain);
  }, [dontShowAgain]);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="min-h-dvh app-texture">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <div className="mx-auto max-w-xl px-4 pb-16 pt-6 sm:px-6">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <EvidenceMark />
            <span className="font-display text-base font-bold tracking-tight text-ink">
              Evidence Vault
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
            <button
              type="button"
              onClick={handleHomeClick}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-muted underline underline-offset-2 hover:bg-sunken hover:text-ink"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => {
                if (view === 'vault') {
                  setView('flow');
                } else {
                  setVaultEntryId(null);
                  setView('vault');
                }
              }}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-muted underline underline-offset-2 hover:bg-sunken hover:text-ink"
            >
              {view === 'vault' ? 'Back to app' : 'Vault'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (view === 'verify') {
                  setView('flow');
                } else {
                  if (tour.active) tour.stop();
                  setView('verify');
                }
              }}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-muted underline underline-offset-2 hover:bg-sunken hover:text-ink"
            >
              {view === 'verify' ? 'Back to app' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (tour.active) tour.stop();
                setWelcome('intro');
              }}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-muted underline underline-offset-2 hover:bg-sunken hover:text-ink"
            >
              What is this?
            </button>
            <button
              type="button"
              onClick={() => (tour.active ? tour.stop() : tour.start())}
              className="ev-tour-toggle rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-muted underline underline-offset-2 hover:bg-sunken hover:text-ink"
            >
              {tour.active ? 'End tour' : 'How it works'}
            </button>
            <button
              type="button"
              onClick={() => setFaqOpen(true)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-muted underline underline-offset-2 hover:bg-sunken hover:text-ink"
            >
              FAQ
            </button>
            <p className="w-full text-right text-xs leading-tight text-ink-subtle sm:w-auto">
              Everything stays
              <br />
              on your device
            </p>
          </div>
        </header>

        {view === 'flow' ? (
          <div className="mb-8">
            <StepIndicator current={stepIndex} steps={STEPS.map((s) => s.label)} />
          </div>
        ) : null}

        <IntroModal
          open={welcome === 'intro'}
          onContinue={() => setWelcome('tour')}
          onDismiss={closeWelcome}
          dontShowAgain={dontShowAgain}
          onDontShowAgainChange={setDontShowAgain}
        />
        <TourModal
          open={welcome === 'tour'}
          onStart={() => {
            closeWelcome();
            tour.start();
          }}
          onSkip={closeWelcome}
        />
        <FaqModal open={faqOpen} onClose={() => setFaqOpen(false)} />

        <Modal
          open={confirmHomeOpen}
          onClose={() => setConfirmHomeOpen(false)}
          title="Leave this in-progress evidence?"
          labelId="confirm-home-title"
          actions={
            <>
              <Button variant="danger" className="sm:flex-1" onClick={goHome}>
                Discard and go home
              </Button>
              <Button variant="quiet" className="sm:flex-1" onClick={() => setConfirmHomeOpen(false)}>
                Stay here
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink-muted">
            {items.length === 1
              ? "You've captured one item"
              : `You've captured ${items.length} items`}{' '}
            this session that {items.length === 1 ? "hasn't" : "haven't"} been saved to the vault or
            exported yet. Going home now discards {items.length === 1 ? 'it' : 'them'} — the same as
            closing the tab, this can't be undone.
          </p>
        </Modal>

        <main id="main">
          {view === 'verify' ? (
            <VerifyScreen vault={vault} onBack={() => setView('flow')} />
          ) : view === 'vault' ? (
            vaultEntryId ? (
              (() => {
                const entry = vault.entries.find((e) => e.record.id === vaultEntryId);
                return entry ? (
                  <VaultRecordScreen
                    entry={entry}
                    vault={vault}
                    onBack={() => setVaultEntryId(null)}
                    onRemoved={() => setVaultEntryId(null)}
                    onOpenVerify={() => {
                      if (tour.active) tour.stop();
                      setView('verify');
                    }}
                  />
                ) : null;
              })()
            ) : (
              <VaultScreen vault={vault} onClose={closeVault} onOpen={setVaultEntryId} />
            )
          ) : (
            <>
              {step === 'capture' ? (
                <CaptureScreen items={items} onCaptured={handleCaptured} onDone={goToReview} />
              ) : null}

              {step === 'review' && items.length > 0 ? (
                <ReviewScreen
                  items={items}
                  onChangeItem={handleItemDetails}
                  onRemoveItem={handleRemoveItem}
                  onAddAnother={() => setStep('capture')}
                  onContinue={() => setStep('handover')}
                  onDiscardAll={reset}
                />
              ) : null}

              {step === 'handover' && readyItems.length > 0 ? (
                <HandoverScreen
                  items={readyItems}
                  choice={packageHandover}
                  onChange={handleHandover}
                  onContinue={() => {
                    applyHandoverToItems(packageHandover);
                    setStep('export');
                  }}
                  onBack={() => setStep('review')}
                />
              ) : null}

              {step === 'export' && readyItems.length > 0 ? (
                <ExportScreen
                  items={readyItems}
                  packageId={packageId}
                  vault={vault}
                  onStartOver={reset}
                  onOpenVault={() => {
                    setVaultEntryId(null);
                    setView('vault');
                  }}
                />
              ) : null}
            </>
          )}
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
          <div className="mt-4 border-t border-line pt-3">
            <p>Planned next: native apps for iOS and Android, plus browser extensions for the major browsers.</p>
            <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <li className="inline-flex items-center gap-1.5">
                <AppleGlyph /> iOS
              </li>
              <li className="inline-flex items-center gap-1.5">
                <AndroidGlyph /> Android
              </li>
              <li className="inline-flex items-center gap-1.5">
                <ChromeGlyph /> Chrome
              </li>
              <li className="inline-flex items-center gap-1.5">
                <FirefoxGlyph /> Firefox
              </li>
              <li className="inline-flex items-center gap-1.5">
                <EdgeGlyph /> Edge
              </li>
              <li className="inline-flex items-center gap-1.5">
                <SafariGlyph /> Safari
              </li>
            </ul>
          </div>
        </footer>
      </div>
    </div>
  );
}

/**
 * The mark is a seal around a hash, not a shield-and-checkmark — the latter is generic
 * security-site furniture that says nothing about what this app actually does. Every
 * record here starts from a SHA-256 fingerprint, so the hash glyph is the honest logo.
 * The glyph sits a few degrees off true inside the seal on purpose: a dead-straight hash
 * in a perfect circle reads as a stock icon; the small tilt reads as stamped by hand.
 *
 * Same mark as public/favicon.svg and public/logo.svg — a filled seal reads at 16px in a
 * browser tab, where the old outline-on-transparent version would have disappeared.
 */
function EvidenceMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-6" aria-hidden="true">
      <defs>
        <linearGradient id="ev-mark-seal" x1="7" y1="4" x2="25" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--color-accent)" />
          <stop offset="1" stopColor="var(--color-accent-hover)" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#ev-mark-seal)" />
      <g fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" transform="rotate(-6 16 16)">
        <path d="M12.7 9.3v13.4M19.3 9.3v13.4" />
        <path d="M9.3 12.7h13.4M9.3 19.3h13.4" />
      </g>
    </svg>
  );
}

/** Small line-art platform/browser marks for the footer's "planned next" list. */
function PlatformGlyph({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3.5"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function AppleGlyph() {
  return (
    <PlatformGlyph>
      <path d="M12.7 8.3c-.9 0-1.7.3-2.4.3-.8 0-1.7-.3-2.6-.3-1.8 0-3.5 1.6-3.5 4.4 0 3 2 6.6 4.3 6.6 1 0 1.5-.6 2.6-.6s1.6.6 2.6.6c1.7 0 3.5-3 4-5.1-2.4-1-2.7-4.4.3-5.7-.9-1.1-2.1-1.4-3-1.4-1 0-1.4.4-1.9.4" />
      <path d="M13.5 6.9c.5-.6.8-1.4.7-2.2-.8.1-1.5.6-2 1.2-.5.6-.8 1.4-.6 2.1.8.1 1.5-.4 1.9-1.1" />
    </PlatformGlyph>
  );
}

function AndroidGlyph() {
  return (
    <PlatformGlyph>
      <path d="M6 10.5a6 6 0 0 1 12 0v5.5H6z" />
      <line x1="4" y1="11" x2="4" y2="15.5" />
      <line x1="20" y1="11" x2="20" y2="15.5" />
      <line x1="8" y1="16" x2="8" y2="20.5" />
      <line x1="16" y1="16" x2="16" y2="20.5" />
      <line x1="8" y1="4.5" x2="9.3" y2="6.3" />
      <line x1="16" y1="4.5" x2="14.7" y2="6.3" />
      <circle cx="9.3" cy="9" r="0.4" fill="currentColor" stroke="none" />
      <circle cx="14.7" cy="9" r="0.4" fill="currentColor" stroke="none" />
    </PlatformGlyph>
  );
}

function ChromeGlyph() {
  return (
    <PlatformGlyph>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.2" />
      <line x1="12" y1="3" x2="12" y2="8.8" />
      <line x1="5.2" y1="16.5" x2="10" y2="13.8" />
      <line x1="18.8" y1="16.5" x2="14" y2="13.8" />
    </PlatformGlyph>
  );
}

function FirefoxGlyph() {
  return (
    <PlatformGlyph>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 8c2-1.6 5-1 6 1.2 1 2.2-.2 4.6-2.6 5-2 .3-3.8-.8-4.2-2.6" />
    </PlatformGlyph>
  );
}

function EdgeGlyph() {
  return (
    <PlatformGlyph>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.5 10c1.5-2.5 4-2.7 5.7-1 1.7 1.7 3.8 3.2 6.3 1.3" />
      <path d="M6 15c1.8-1.6 4-1.6 5.7.1 1.7 1.7 4 2.2 6-.4" />
    </PlatformGlyph>
  );
}

function SafariGlyph() {
  return (
    <PlatformGlyph>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5 13 13l-4.5 2.5L11 11z" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
    </PlatformGlyph>
  );
}
