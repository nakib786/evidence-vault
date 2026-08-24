/**
 * Screen 5 — hand the record over and get out.
 *
 * No dashboard, no account, no "are you sure you want to leave". The user came here to
 * produce something they can send to someone else; once they have it, the job is done.
 * A copy also goes to the vault by default — the export screen triggers that save itself,
 * on mount, rather than waiting for a click — because a record someone forgot to save is a
 * worse failure mode than one they have to actively discard. Discarding it stays one tap
 * away ("Don't keep this copy") and is honoured immediately, including undoing a save
 * that's still in flight — see `handleOptOut` below.
 */
import { useEffect, useRef, useState } from 'react';
import { Button, Callout, Card } from './ui';
import PackageExportBundle from './PackageExportBundle';
import { PinInput } from './PinInput';
import { DEFAULT_DEMO_PIN } from '../lib/vaultCrypto';
import type { EvidenceRecord } from '../lib/types';
import type { useVault } from './useVault';

interface Props {
  items: EvidenceRecord[];
  packageId: string;
  vault: ReturnType<typeof useVault>;
  onStartOver: () => void;
  onOpenVault: () => void;
}

export default function ExportScreen({ items, packageId, vault, onStartOver, onOpenVault }: Props) {
  const [pin, setPin] = useState(DEFAULT_DEMO_PIN);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [optedOut, setOptedOut] = useState(false);
  // Mirrors `optedOut` for the in-flight save loop to check without a stale closure — a
  // click on "Don't keep this copy" while `handleSave` is mid-`await` needs to be seen by
  // that same still-running call, not just by the next render.
  const optedOutRef = useRef(false);
  const savedCount = items.filter((r) => vault.entries.some((e) => e.record.id === r.id)).length;
  const allSaved = savedCount === items.length;
  const multi = items.length > 1;

  // Takes an explicit PIN rather than always reading state, so `PinInput`'s `onComplete` —
  // which can fire on Enter before a state update from the same keystroke has settled —
  // hands over the value it just produced instead of racing that update.
  const handleSave = async (pinValue: string = pin): Promise<void> => {
    setSaveError(null);
    setSaving(true);
    try {
      if (!vault.unlocked) {
        const ok = await vault.unlock(pinValue);
        if (!ok) {
          setSaveError('That PIN doesn’t match the vault on this device.');
          setPin('');
          return;
        }
      }
      // Every item is saved as its own ordinary vault entry — the vault has always stored
      // one record per entry, and a package is nothing more to it than several of those
      // saved together. Nothing about the vault's storage format needs to know a package
      // exists.
      for (const record of items) {
        if (optedOutRef.current) break;
        if (!vault.entries.some((e) => e.record.id === record.id)) {
          await vault.save(record);
        }
      }
      if (optedOutRef.current) {
        for (const record of items) {
          if (vault.entries.some((e) => e.record.id === record.id)) {
            await vault.remove(record.id);
          }
        }
      }
    } catch {
      setSaveError(
        multi ? 'Not every item could be saved to the vault.' : 'The record could not be saved to the vault.',
      );
    } finally {
      setSaving(false);
    }
  };

  // Auto-save on arrival — the vault keeps a copy by default. Fires once per visit to this
  // screen (a fresh mount each time, per `App.tsx`'s conditional rendering by step).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void handleSave();
  }, []);

  const handleOptOut = async (): Promise<void> => {
    optedOutRef.current = true;
    setOptedOut(true);
    if (saving) return; // the running handleSave's post-loop check will clean up
    for (const record of items) {
      if (vault.entries.some((e) => e.record.id === record.id)) {
        await vault.remove(record.id);
      }
    }
  };

  const handleKeepAfterAll = async (): Promise<void> => {
    optedOutRef.current = false;
    setOptedOut(false);
    await handleSave();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold text-ink">
          {multi ? `Your report is ready (${items.length} items)` : 'Your record is ready'}
        </h1>
        <p className="text-ink-muted">
          Save these files somewhere you trust. A copy is also kept in your vault on this
          device by default — remove it below if you’d rather nothing was kept.
        </p>
      </div>

      <PackageExportBundle items={items} packageId={packageId} />

      {/* ---- Vault (on by default, one tap to opt out) ----------------------- */}
      <Card className="space-y-4" data-tour="export-vault-save">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">A copy is kept in your vault</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Stored on this device only, encrypted with a PIN, so you can come back to it, check
            whether the timestamp has confirmed yet, and re-download these files again later for a
            lawyer or police — without redoing this flow.
          </p>
        </div>

        {optedOut ? (
          <div className="space-y-3">
            <Callout tone="info" title="Not kept">
              {multi ? 'These items were' : 'This record was'} not saved anywhere. Closing this page
              deletes {multi ? 'them' : 'it'} for good.
            </Callout>
            <Button variant="quiet" onClick={handleKeepAfterAll} disabled={saving}>
              Keep a copy after all
            </Button>
          </div>
        ) : allSaved ? (
          <div className="space-y-3">
            <Callout tone="affirm" title={multi ? 'All items saved to your vault' : 'Saved to your vault'}>
              You can open them any time from “Vault” at the top of the page.
            </Callout>
            <Button variant="quiet" onClick={handleOptOut}>
              Don’t keep this copy
            </Button>
          </div>
        ) : (
          <>
            {saving ? <p className="text-sm text-ink-muted">Saving to your vault…</p> : null}

            {!vault.unlocked ? (
              <div className="space-y-1.5">
                <PinInput
                  label="Vault PIN"
                  value={pin}
                  onChange={setPin}
                  onComplete={(value) => void handleSave(value)}
                  disabled={saving}
                />
                <p className="text-xs text-ink-subtle">
                  Demo PIN: {DEFAULT_DEMO_PIN} — prefilled. Not real security; see “Vault” for what
                  that means.
                </p>
              </div>
            ) : null}

            {saveError ? <Callout tone="caution" title="Couldn’t save that">{saveError}</Callout> : null}

            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => void handleSave()} disabled={saving}>
                {saving
                  ? 'Saving…'
                  : saveError
                    ? 'Try again'
                    : multi
                      ? savedCount > 0
                        ? `Save the rest (${items.length - savedCount}) to vault`
                        : `Save all ${items.length} to vault`
                      : 'Save to vault'}
              </Button>
              <Button variant="quiet" onClick={handleOptOut} disabled={saving}>
                Don’t keep this copy
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-bold text-ink">What you might do next</h2>
        <ul className="space-y-2 text-sm text-ink-muted">
          <li>
            <strong className="font-semibold text-ink">Report it to the platform.</strong> Most have a
            reporting flow; the report gives you the details in one place.
          </li>
          <li>
            <strong className="font-semibold text-ink">Send it to an organisation that tracks this.</strong>{' '}
            Community and civil-rights organisations collect these to establish patterns, which a
            single incident cannot show on its own.
          </li>
          <li>
            <strong className="font-semibold text-ink">Keep it.</strong> A record you never send is
            still worth having if the same thing happens again.
          </li>
        </ul>
        <p className="text-sm text-ink-subtle">
          If you are in immediate danger, contact your local emergency services. This tool does not
          notify anyone.
        </p>
      </Card>

      {savedCount > 0 ? (
        <Button variant="quiet" block onClick={onOpenVault}>
          Open the vault
        </Button>
      ) : null}
      <Button variant="quiet" block onClick={onStartOver}>
        Document something else
      </Button>
    </div>
  );
}
