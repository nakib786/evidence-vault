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
import VaultPackageScreen from './components/VaultPackageScreen';
import VerifyScreen from './components/VerifyScreen';
import { Button, StepIndicator } from './components/ui';
import Modal from './components/Modal';
import InstallNudge from './components/InstallNudge';
import LiveChatBubble from './components/LiveChatBubble';
import QuickExitButton from './components/QuickExitButton';
import NearbyResourcesSection from './components/NearbyResourcesSection';
import { useTour } from './components/useTour';
import { useVault } from './components/useVault';
import { useMyIp } from './components/useMyIp';
import { IntroModal, TourModal } from './components/WelcomeModals';
import { FaqModal } from './components/FaqModal';
import { isIntroHidden, setIntroHidden, type TourSection } from './lib/tour';
import { buildDemoCapture } from './lib/demoCapture';
import { entriesForPackage } from './lib/vaultGroups';
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
          packageId,
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
  }, [packageId]);

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
  // Set when browsing a multi-item report as a group (see `lib/vaultGroups.ts`). Opening a
  // single item from inside it leaves this set, so its own "Back" returns to the report
  // rather than the flat list — see the `vaultEntryId` branch below.
  const [vaultPackageId, setVaultPackageId] = useState<string | null>(null);
  const [confirmHomeOpen, setConfirmHomeOpen] = useState(false);

  // Every exit from the vault section re-locks it, from wherever that exit happens —
  // the top nav's Vault toggle, Home, jumping to Verify from inside a record, the idle
  // timeout, all of it. One effect keyed on `view` catches every path rather than each
  // exit having to remember to lock on its own, so re-entering the vault always means
  // typing the PIN again, not picking up a session left open in memory.
  const prevViewRef = useRef(view);
  const vaultLockRef = useRef(vault.lock);
  useEffect(() => {
    vaultLockRef.current = vault.lock;
  }, [vault.lock]);
  useEffect(() => {
    if (prevViewRef.current === 'vault' && view !== 'vault') {
      vaultLockRef.current();
      setVaultEntryId(null);
      setVaultPackageId(null);
    }
    prevViewRef.current = view;
  }, [view]);

  // What the tour should be narrating right now. The vault is a separate `view`, not part
  // of the `step` machine, and "locked" / "empty" / "has records" / "one open record" /
  // "a multi-item report" are each a different set of elements on screen — so it gets
  // sections of its own rather than one, the same reason the main flow is split by `Step`
  // instead of being a single long section.
  const vaultTourSection: TourSection = !vault.unlocked
    ? 'vault-locked'
    : vault.entries.length === 0
      ? 'vault-empty'
      : 'vault-list';
  const tourSection: TourSection =
    view === 'verify'
      ? 'verify'
      : view === 'vault'
        ? vaultEntryId
          ? 'vault-record'
          : vaultPackageId
            ? 'vault-package'
            : vaultTourSection
        : step;

  const stopRef = useRef<() => void>(() => {});

  /**
   * Everything needed to put a previous screen of the guided tour back on screen. Pushed by
   * `advanceDemo` right before each forward move, and popped by `retreatDemo` below when
   * Back is pressed on a section's very first step (see `useTour`'s own comment for why that
   * needs App-level help rather than something driver.js can do by itself).
   *
   * Plain navigational state is enough for most of these — `retreatDemo` just hands the
   * fields back to their setters and lets `tourSection` recompute from there, same as it
   * does for any other state change. The one exception is the vault's lock state, which
   * isn't part of this navigation at all: unlocking it is a side effect `advanceDemo` sets
   * off (see the `'vault-locked'` case below), not a value stored anywhere this snapshot
   * would naturally capture, so `relock` says to explicitly re-lock it when this checkpoint
   * is the one being restored.
   */
  interface TourCheckpoint {
    step: Step;
    view: 'flow' | 'vault' | 'verify';
    vaultEntryId: string | null;
    vaultPackageId: string | null;
    relock: boolean;
  }
  const tourCheckpointsRef = useRef<TourCheckpoint[]>([]);

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
    // Where Back should return to if pressed on the very first step of whatever section
    // this move is about to land on — i.e. this render's state, before the branch below
    // changes any of it. `relock` only ever applies to the checkpoint pushed just before
    // the vault is unlocked; see the interface comment above.
    function checkpoint(relock = false): void {
      tourCheckpointsRef.current.push({ step, view, vaultEntryId, vaultPackageId, relock });
    }

    switch (tourSection) {
      case 'capture':
        checkpoint();
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
        checkpoint();
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
        checkpoint();
        setStep('export');
        break;
      case 'export':
        checkpoint();
        setVaultEntryId(null);
        setVaultPackageId(null);
        setView('vault');
        break;
      case 'vault-locked':
        checkpoint(true);
        void vault.unlock(DEFAULT_DEMO_PIN);
        break;
      case 'vault-empty':
        // No checkpoint: once these demo records are loaded they stay in the vault for the
        // rest of the session (this only ever seeds real, if synthetic, storage — see
        // `useVault.loadDemo`), so there's no real "empty" screen left to retreat back into.
        // Back from 'vault-list' instead pops the 'vault-locked' checkpoint above it, which
        // is the nearest state that's still true.
        void vault.loadDemo();
        break;
      case 'vault-list': {
        checkpoint();
        const first = vault.entries[0];
        if (first) setVaultEntryId(first.record.id);
        else stopRef.current();
        break;
      }
      case 'vault-package': {
        // Only ever reached by hand (see `lib/tour.ts`), so unlike every other case this
        // isn't part of `advanceDemo`'s own chain — it's here so autoplay and "Done" have
        // somewhere to go if the tour happens to be open while someone is browsing a report,
        // rather than silently doing nothing. Opening its first item mirrors 'vault-list'.
        checkpoint();
        const first = entriesForPackage(vault.entries, vaultPackageId ?? '')[0];
        if (first) setVaultEntryId(first.record.id);
        else stopRef.current();
        break;
      }
      case 'vault-record':
        checkpoint();
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
        setVaultPackageId(null);
        stopRef.current();
        break;
    }
  }

  /**
   * Undoes one step of `advanceDemo`, for Back pressed on a section's first step. Returns
   * whether it actually moved anything, which is how `useTour` knows whether to land the
   * section it's about to rebuild on that section's last step (see its own comment) or, if
   * there was nothing earlier on record, to leave the click as a no-op.
   *
   * 'vault-package' gets its own direct rule rather than going through the checkpoint stack:
   * it's always opened by hand, straight off the vault list (see `advanceDemo`'s comment on
   * that case), so "back" from it unconditionally means the vault list, the same as its own
   * on-screen Back control — not whatever unrelated checkpoint happens to be sitting on top
   * of the stack from an earlier, unfinished walk through the main flow.
   */
  function retreatDemo(): boolean {
    if (tourSection === 'vault-package') {
      setVaultPackageId(null);
      return true;
    }
    const checkpoint = tourCheckpointsRef.current.pop();
    if (!checkpoint) return false;
    setStep(checkpoint.step);
    setView(checkpoint.view);
    // Leaving the vault for any reason — including forward, to Verify — locks it right back
    // up (see the view-exit effect above), which drops `entries` along with the key. A
    // checkpoint recorded while a record or package was open can go stale for exactly that
    // reason: if the vault has since re-locked, restoring its id would just hand back an id
    // `vault.entries` no longer has, and the lookup in the render below would show nothing at
    // all rather than a screen. Recovering the actual open record would mean the PIN again,
    // which nothing here has, so this falls back to whatever the vault honestly is right now
    // — locked — instead of pointing at one that no longer exists.
    const vaultStillOpen = checkpoint.view !== 'vault' || vault.unlocked;
    setVaultEntryId(vaultStillOpen ? checkpoint.vaultEntryId : null);
    setVaultPackageId(vaultStillOpen ? checkpoint.vaultPackageId : null);
    if (checkpoint.relock) vault.lock();
    return true;
  }

  const tour = useTour(tourSection, advanceDemo, retreatDemo);
  useEffect(() => {
    stopRef.current = tour.stop;
  }, [tour.stop]);
  // Each run of the tour retreats only through screens it advanced through itself this run
  // — see `retreatDemo`'s own comment — so a fresh start (however it's launched: the header
  // button, the welcome dialog, ending and reopening it) should never inherit an earlier
  // run's checkpoints.
  useEffect(() => {
    if (tour.active) tourCheckpointsRef.current = [];
  }, [tour.active]);

  const closeVault = useCallback(() => {
    setView('flow');
    setVaultEntryId(null);
    setVaultPackageId(null);
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
    setVaultPackageId(null);
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
  const myIp = useMyIp();

  return (
    <div className="min-h-dvh app-texture">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <div className="mx-auto max-w-xl px-4 pb-16 pt-6 sm:px-6">
        <header className="mb-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <EvidenceMark />
              <span className="font-display text-base font-bold tracking-tight text-ink">
                Evidence Vault
              </span>
            </div>
            <nav
              aria-label="Main"
              className="flex items-center gap-0.5 rounded-full border border-line bg-surface p-1
                shadow-[0_1px_2px_rgb(15_23_42_/_0.04),0_8px_20px_-14px_rgb(15_23_42_/_0.2)]"
            >
              <NavPill label="Home" active={view === 'flow'} onClick={handleHomeClick}>
                <HomeGlyph />
              </NavPill>
              <NavPill
                label="Vault"
                active={view === 'vault'}
                onClick={() => {
                  if (view === 'vault') {
                    setView('flow');
                  } else {
                    setVaultEntryId(null);
                    setVaultPackageId(null);
                    setView('vault');
                  }
                }}
              >
                <VaultGlyph />
              </NavPill>
              <NavPill
                label="Verify"
                active={view === 'verify'}
                onClick={() => {
                  if (view === 'verify') {
                    setView('flow');
                  } else {
                    if (tour.active) tour.stop();
                    setView('verify');
                  }
                }}
              >
                <VerifyGlyph />
              </NavPill>
            </nav>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <p className="text-xs leading-tight text-ink-subtle">
              Everything stays on your device
            </p>
            <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
              <button
                type="button"
                onClick={() => {
                  if (tour.active) tour.stop();
                  setWelcome('intro');
                }}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-subtle underline underline-offset-2 hover:bg-sunken hover:text-ink"
              >
                What is this?
              </button>
              <button
                type="button"
                onClick={() => (tour.active ? tour.stop() : tour.start())}
                className="ev-tour-toggle rounded-lg px-2 py-1 text-xs font-semibold text-ink-subtle underline underline-offset-2 hover:bg-sunken hover:text-ink"
              >
                {tour.active ? 'End tour' : 'How it works'}
              </button>
              <button
                type="button"
                onClick={() => setFaqOpen(true)}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-subtle underline underline-offset-2 hover:bg-sunken hover:text-ink"
              >
                FAQ
              </button>
            </div>
          </div>
        </header>

        <InstallNudge suppressed={welcome !== null || tour.active} />

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
            ) : vaultPackageId ? (
              <VaultPackageScreen
                packageId={vaultPackageId}
                entries={entriesForPackage(vault.entries, vaultPackageId)}
                vault={vault}
                onBack={() => setVaultPackageId(null)}
                onOpenItem={setVaultEntryId}
                onDissolved={() => setVaultPackageId(null)}
              />
            ) : (
              <VaultScreen vault={vault} onClose={closeVault} onOpen={setVaultEntryId} onOpenPackage={setVaultPackageId} />
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

        {view === 'flow' && (step === 'capture' || step === 'review') ? (
          <div className="mt-10">
            <NearbyResourcesSection />
          </div>
        ) : null}

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
            <p>
              Planned next: a screen/tab recording capture mode (for a scrolling comment thread or a
              livestream, without pointing a camera at a screen), native apps for iOS and Android, and
              browser extensions for the major browsers.
            </p>
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
          <div className="mt-4 border-t border-line pt-3" data-tour="ip-echo">
            <p>
              Your IP address for this visit — IPv4:{' '}
              <IpBadge loading={myIp.loadingV4} value={myIp.ipv4} /> &nbsp;·&nbsp; IPv6:{' '}
              <IpBadge loading={myIp.loadingV6} value={myIp.ipv6} />
              . Shown so you know what any site you report to can already see about you — never
              logged or stored here.
            </p>
          </div>
        </footer>
      </div>

      {/* Left visible through the tour itself (unlike the welcome dialogs) so the tour can
          point at it — see the 'live-chat' step in `lib/tour.ts`. driver.js already dims and
          disables every element except whatever step is currently highlighted, the same
          treatment every other on-screen control gets, so this needs no special handling
          beyond staying mounted. */}
      <LiveChatBubble suppressed={welcome !== null || confirmHomeOpen || faqOpen} />
      <QuickExitButton />
    </div>
  );
}

/**
 * One button in the primary nav — an app-style tab rather than the underlined text links
 * this replaced, since the header is the first thing that has to read as "an app" rather
 * than "a web page" once this ships as one. `active` marks the section currently open;
 * tapping the active pill is how each section already closed itself (a plain view toggle),
 * so that behavior carries over unchanged — only the visual language does not.
 */
function NavPill({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
        active ? 'bg-accent text-white' : 'text-ink-muted hover:bg-sunken hover:text-ink'
      }`}
    >
      {children}
      {label}
    </button>
  );
}

function HomeGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10.2V19a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-8.8" />
    </svg>
  );
}

function VaultGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
      <circle cx="12" cy="15.2" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function VerifyGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5 19 6v6c0 4.5-3 7.5-7 8.5-4-1-7-4-7-8.5V6z" />
      <path d="m9 12 2 2 4-4.2" />
    </svg>
  );
}

/** A visibly-highlighted chip for one looked-up IP address, so it doesn't blend into the footer's small print. */
function IpBadge({ loading, value }: { loading: boolean; value: string | null }) {
  return (
    <span className="inline-block rounded-full bg-accent-soft px-2 py-0.5 font-mono text-xs font-semibold text-accent">
      {loading ? 'looking up…' : (value ?? 'unavailable')}
    </span>
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
