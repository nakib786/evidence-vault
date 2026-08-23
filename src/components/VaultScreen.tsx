/**
 * The vault: a PIN-locked, on-device list of records saved from the export screen, plus
 * whatever demo entries have been loaded in. Locking here means dropping the derived key
 * from memory — closing the vault re-locks it, on the same logic as the rest of the app:
 * nothing sensitive should outlive the moment you're actually looking at it.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Button, Callout, Card, inputClass } from './ui';
import { describeProofStatus } from '../lib/vaultStatus';
import { DEFAULT_DEMO_PIN, DEFAULT_DURESS_PIN } from '../lib/vaultCrypto';
import { labelFor, CATEGORIES } from '../lib/taxonomy';
import type { VaultRecord } from '../lib/types';
import type { useVault } from './useVault';

/** How long the vault stays open with no interaction before it re-locks on its own. */
const AUTO_LOCK_MS = 3 * 60_000;

/**
 * Re-locks the vault after a period of no interaction, and on the Escape key immediately —
 * a quick way to close it if someone walks in. Runs for both a real and a duress session
 * alike, so idle behaviour never tells the two apart.
 */
function useVaultSafety(active: boolean, onLock: () => void): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) return;

    const reset = (): void => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(onLock, AUTO_LOCK_MS);
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onLock();
    };

    reset();
    const activityEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    activityEvents.forEach((evt) => window.addEventListener(evt, reset));
    window.addEventListener('keydown', onKeyDown);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      activityEvents.forEach((evt) => window.removeEventListener(evt, reset));
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [active, onLock]);
}

interface Props {
  vault: ReturnType<typeof useVault>;
  onClose: () => void;
  onOpen: (id: string) => void;
}

export default function VaultScreen({ vault, onClose, onOpen }: Props) {
  const [pin, setPin] = useState(DEFAULT_DEMO_PIN);
  const [error, setError] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!vault.unlocked) {
      void vault.checkConfig();
      void vault.checkDuressConfig();
    }
  }, [vault]);

  useVaultSafety(vault.unlocked, () => {
    vault.lock();
    onClose();
  });

  const handleUnlock = async (): Promise<void> => {
    setError(null);
    const ok = await vault.unlock(pin);
    if (!ok) setError('That PIN doesn’t match. Try again, or reset the demo vault below.');
  };

  if (!vault.unlocked) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold text-ink">Your vault</h1>
          <p className="text-ink-muted">
            {vault.hasConfig === false
              ? 'Records you save from the export screen live here, encrypted with a PIN.'
              : 'Enter the PIN to open it.'}
          </p>
        </div>

        <Callout tone="caution" title={`Demo PIN: ${DEFAULT_DEMO_PIN}`}>
          Printed here for judging — this isn’t real security. Anyone who reads the PIN or this
          project’s source can unlock this vault. A shipped version would have you set a private
          PIN, or use your device’s own lock, on first use. What is real: entries are encrypted at
          rest with a key derived from whatever PIN is used, so the raw browser storage holds
          ciphertext, not your files.
        </Callout>

        {vault.hasDuressConfig ? (
          <Callout tone="caution" title={`Duress PIN (demo): ${DEFAULT_DURESS_PIN}`}>
            Also printed here for judging, so this feature is easy to find: entering this instead
            of the PIN above unlocks a <em>decoy</em> vault — synthetic demo records only, never
            anything actually saved — to demonstrate the vault's duress-PIN protection end to end.
            It's set to this published value automatically on first use; change or remove it from
            inside the real vault once unlocked. A real deployment would never disclose that this
            exists, let alone what it is — publishing it here is a hackathon-only concession, for
            the same reason the PIN above is. See docs/SECURITY.md for exactly what it guarantees.
          </Callout>
        ) : null}

        <Card as="div" className="space-y-4" data-tour="vault-unlock">
          <div className="space-y-1.5">
            <label htmlFor={id} className="block font-display text-sm font-semibold text-ink">
              Vault PIN
            </label>
            <input
              id={id}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="w-full rounded-xl border border-line-strong bg-surface px-4 py-3 text-base text-ink focus:border-accent focus:outline-none"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleUnlock();
              }}
            />
          </div>

          {error ? <Callout tone="danger" title="Wrong PIN">{error}</Callout> : null}

          <Button block onClick={handleUnlock} disabled={vault.loading || !pin}>
            {vault.loading ? 'Checking…' : 'Unlock'}
          </Button>
        </Card>

        <div className="space-y-2 text-center">
          {resetConfirm ? (
            <Callout tone="danger" title="Reset the demo vault?">
              <p>This permanently deletes everything saved in it on this device and clears the PIN.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="danger"
                  className="sm:flex-1"
                  onClick={async () => {
                    await vault.reset();
                    setResetConfirm(false);
                    setPin(DEFAULT_DEMO_PIN);
                  }}
                >
                  Yes, reset it
                </Button>
                <Button variant="quiet" className="sm:flex-1" onClick={() => setResetConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </Callout>
          ) : (
            <button
              type="button"
              onClick={() => setResetConfirm(true)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-subtle underline underline-offset-2 hover:bg-sunken hover:text-ink"
            >
              Forgot the PIN, or want a clean demo? Reset the vault
            </button>
          )}
        </div>

        <Button variant="quiet" block onClick={onClose}>
          Back to the app
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold text-ink">Your vault</h1>
          <p className="text-ink-muted">Saved on this device only, encrypted with your PIN.</p>
        </div>
        <Button
          variant="quiet"
          className="shrink-0 px-3 py-1.5 text-sm"
          onClick={() => {
            vault.lock();
            onClose();
          }}
        >
          Lock &amp; close
        </Button>
      </div>

      {vault.entries.length === 0 ? (
        <Card className="space-y-4" data-tour="vault-demo">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">Nothing saved yet</h2>
            <p className="mt-1.5 text-sm text-ink-muted">
              Save a record from the export screen to see it here. Or, since this hackathon build
              can’t use real evidence, load three synthetic demo records to see how the vault
              behaves.
            </p>
          </div>
          <Button variant="secondary" onClick={() => void vault.loadDemo()}>
            Load demo records
          </Button>
        </Card>
      ) : (
        <>
          <div className="space-y-3" data-tour="vault-entries">
            {vault.entries.map((entry) => (
              <VaultCard key={entry.record.id} entry={entry} onOpen={() => onOpen(entry.record.id)} />
            ))}
          </div>
          <Button variant="quiet" block onClick={() => void vault.loadDemo()}>
            {vault.entries.some((e) => e.isDemo) ? 'Reload demo records' : 'Add demo records'}
          </Button>
        </>
      )}

      {!vault.isDuress ? <DuressPinSettings vault={vault} /> : null}
    </div>
  );
}

/**
 * Owner-only setup, reachable only from inside an already-unlocked real session — never
 * shown on the lock screen, and never shown inside a duress session either (guarded by the
 * caller above). A duress PIN advertised anywhere reachable before authentication would
 * defeat the point: it tells whoever is forcing the unlock that a second, real PIN exists
 * to ask for instead.
 */
function DuressPinSettings({ vault }: { vault: ReturnType<typeof useVault> }) {
  const [open, setOpen] = useState(false);
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const pin1Id = useId();
  const pin2Id = useId();

  useEffect(() => {
    void vault.checkDuressConfig();
  }, [vault]);

  const handleSave = async (): Promise<void> => {
    setError(null);
    setSavedNote(null);
    if (!pin1 || pin1 !== pin2) {
      setError('Enter the same PIN twice.');
      return;
    }
    const ok = await vault.setDuressPin(pin1);
    if (!ok) {
      setError('That matches your real PIN — a duress PIN has to be different to be reachable at all.');
      return;
    }
    setPin1('');
    setPin2('');
    setOpen(false);
    setSavedNote('Duress PIN set. Entering it on the lock screen now opens a decoy vault instead of this one.');
  };

  return (
    <Card as="div" className="space-y-3" data-tour="vault-duress">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div>
          <h2 className="font-display text-sm font-bold text-ink">
            Duress PIN <span className="font-normal text-ink-subtle">— {vault.hasDuressConfig ? 'set' : 'not set'}</span>
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            A second PIN to hand over instead, if you're ever forced to open this vault.
          </p>
        </div>
        <span aria-hidden="true" className="shrink-0 text-lg text-ink-subtle">
          {open ? '−' : '+'}
        </span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-line pt-4">
          <p className="text-sm text-ink-muted">
            Entering a duress PIN on the lock screen unlocks the vault normally — but instead of what
            you've actually saved, it shows only synthetic demo records, marked "Demo" the same way
            they already are everywhere else in this app. Your real entries stay encrypted on this
            device the whole time; a duress unlock never reads them, decrypts them, or even looks at
            them. Whoever's watching sees an ordinary, working vault — because that's exactly what a
            demo vault normally looks like here.
          </p>

          {vault.hasDuressConfig ? (
            <p className="text-sm text-ink-muted">
              This build sets a published demo value automatically on first use (shown on the lock
              screen, same as the main PIN) so the feature is easy for judges to find and try.
              Saving a new PIN below replaces whatever is currently set — including that default,
              if you haven't already changed it. A real deployment would never publish this and
              would have the person set it privately, the same as the main PIN.
            </p>
          ) : null}

          <Callout tone="caution" title="What this doesn't do">
            It doesn't hide that a vault app exists on this device, or that more encrypted data sits in
            storage than a duress unlock shows. It's a way to avoid handing over the real thing in the
            moment, not full deniability against someone who examines the device afterward.
          </Callout>

          <div className="space-y-1.5">
            <label htmlFor={pin1Id} className="block font-display text-sm font-semibold text-ink">
              New duress PIN
            </label>
            <input
              id={pin1Id}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className={inputClass}
              value={pin1}
              onChange={(e) => setPin1(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={pin2Id} className="block font-display text-sm font-semibold text-ink">
              Confirm
            </label>
            <input
              id={pin2Id}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className={inputClass}
              value={pin2}
              onChange={(e) => setPin2(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSave();
              }}
            />
          </div>

          {error ? <Callout tone="danger" title="Can't save that">{error}</Callout> : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="sm:flex-1" onClick={handleSave} disabled={!pin1 || !pin2}>
              Save duress PIN
            </Button>
            {vault.hasDuressConfig ? (
              removeConfirm ? (
                <>
                  <Button
                    variant="danger"
                    className="sm:flex-1"
                    onClick={async () => {
                      await vault.removeDuressPin();
                      setRemoveConfirm(false);
                      setSavedNote('Duress PIN removed.');
                    }}
                  >
                    Confirm remove
                  </Button>
                  <Button variant="quiet" className="sm:flex-1" onClick={() => setRemoveConfirm(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button variant="quiet" className="sm:flex-1" onClick={() => setRemoveConfirm(true)}>
                  Remove duress PIN
                </Button>
              )
            ) : null}
          </div>
        </div>
      ) : null}

      {savedNote ? <Callout tone="affirm" title="Saved">{savedNote}</Callout> : null}
    </Card>
  );
}

function VaultCard({ entry, onOpen }: { entry: VaultRecord; onOpen: () => void }) {
  const { record, isDemo, savedAt } = entry;
  const status = describeProofStatus(entry);
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    if (record.kind !== 'image') return;
    // Created and revoked within the same effect run, deliberately — splitting creation
    // into a useMemo and leaving only cleanup in the effect revokes the memo's one URL
    // twice under React StrictMode's dev-only double-invocation, with nothing recreating
    // it, so the <img> ends up pointed at an already-revoked blob: URL.
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
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:bg-sunken focus-visible:bg-sunken"
    >
      <div className="size-16 shrink-0 overflow-hidden rounded-xl border border-line bg-sunken">
        {thumb ? (
          <img src={thumb} alt="" className="evidence-blur size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-ink-subtle">
            <VideoGlyph />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="font-display text-sm font-bold text-ink">
            {new Date(record.capturedAt).toLocaleDateString(undefined, {
              dateStyle: 'medium',
            })}
          </p>
          {isDemo ? (
            <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] font-semibold text-ink-subtle">
              Demo
            </span>
          ) : null}
        </div>
        <p className="truncate text-sm text-ink-muted">
          {record.details.platform || (record.details.category ? labelFor(CATEGORIES, record.details.category) : 'No details added')}
        </p>
        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneClass}`}>
          {status.label}
        </span>
      </div>

      <p className="shrink-0 text-xs text-ink-subtle">
        Saved {new Date(savedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
      </p>
    </button>
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
