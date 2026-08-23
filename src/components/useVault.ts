/**
 * Vault session state: the derived key (memory only, cleared on lock), the decrypted
 * entries, and the actions that touch IndexedDB. Shared between the export screen (save)
 * and the vault screens (browse, verify, delete) so a PIN entered once unlocks both.
 */
import { useCallback, useRef, useState } from 'react';
import { DEFAULT_DURESS_PIN, unlockWithPin, setupPin } from '../lib/vaultCrypto';
import {
  clearDuressPinConfig,
  clearVault,
  deleteEntry,
  loadDuressPinConfig,
  loadPinConfig,
  loadVaultEntries,
  saveDuressPinConfig,
  savePinConfig,
  saveVaultEntry,
} from '../lib/vaultStore';
import { buildDemoEntries } from '../lib/vaultDemo';
import type { EvidenceRecord, VaultRecord } from '../lib/types';

const asDecoyEntries = (
  demo: { record: EvidenceRecord; demoConfirmedHeight?: number }[],
): VaultRecord[] =>
  demo.map(({ record, demoConfirmedHeight }) => ({
    record,
    savedAt: new Date().toISOString(),
    isDemo: true,
    demoConfirmedHeight,
  }));

export function useVault() {
  const [key, setKeyState] = useState<CryptoKey | null>(null);
  // Mirrors `key`, updated in the same statement rather than on the next render. `unlock`
  // is often awaited and then immediately followed by a `save` in the very same async
  // function (see ExportScreen) — that `save` call still closes over whichever render's
  // `key` was in scope when it was defined, which is the *pre-unlock* one, since a state
  // update from `setKey` doesn't retroactively change an already-created closure. Reading
  // `keyRef.current` instead inside `save`/`remove`/`loadDemo` sidesteps that entirely:
  // a ref mutation is visible immediately, to every closure, with no render in between.
  const keyRef = useRef<CryptoKey | null>(null);
  const setKey = useCallback((next: CryptoKey | null) => {
    keyRef.current = next;
    setKeyState(next);
  }, []);
  const [entries, setEntries] = useState<VaultRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasConfig, setHasConfig] = useState<boolean | null>(null);
  /**
   * True when the current session was unlocked with the duress PIN rather than the real
   * one. `key` stays null for the whole session — nothing here ever derives the real key
   * or reads real ciphertext, so there is nothing in memory that could leak it. `entries`
   * holds fabricated records only, never persisted.
   */
  const [isDuress, setIsDuress] = useState(false);
  const [hasDuressConfig, setHasDuressConfig] = useState(false);

  const checkConfig = useCallback(async (): Promise<boolean> => {
    const existing = Boolean(await loadPinConfig());
    setHasConfig(existing);
    return existing;
  }, []);

  const checkDuressConfig = useCallback(async (): Promise<boolean> => {
    const existing = Boolean(await loadDuressPinConfig());
    setHasDuressConfig(existing);
    return existing;
  }, []);

  const refresh = useCallback(async (activeKey: CryptoKey): Promise<void> => {
    setEntries(await loadVaultEntries(activeKey));
  }, []);

  /**
   * Returns false for a PIN that matches neither the real vault nor its duress PIN; true
   * otherwise (including first run, and including a duress-PIN match).
   *
   * The real canary is always checked first, so if the two PINs were ever set to the same
   * value the real vault always wins and the duress PIN silently becomes unreachable —
   * `setDuressPin` below refuses to save a duress PIN that collides with the real one so
   * this situation can't arise from the settings screen.
   */
  const unlock = useCallback(
    async (pin: string): Promise<boolean> => {
      setLoading(true);
      try {
        const existing = await loadPinConfig();
        if (!existing) {
          const setup = await setupPin(pin);
          await savePinConfig({ salt: setup.salt, canaryIv: setup.canaryIv, canaryCiphertext: setup.canaryCiphertext });
          setHasConfig(true);

          // Hackathon-only convenience: pre-configure the published duress PIN on first run,
          // so the decoy-vault feature is there to try without a separate setup step first —
          // same reasoning as shipping a published DEFAULT_DEMO_PIN. Skipped if the person's
          // real PIN happens to be that same value, since a colliding duress PIN is silently
          // unreachable anyway (see the doc comment above). Never overwrites a duress PIN
          // that's already configured — this only ever runs once, on the very first unlock.
          if (pin !== DEFAULT_DURESS_PIN) {
            const duressSetup = await setupPin(DEFAULT_DURESS_PIN);
            await saveDuressPinConfig({
              salt: duressSetup.salt,
              canaryIv: duressSetup.canaryIv,
              canaryCiphertext: duressSetup.canaryCiphertext,
            });
            setHasDuressConfig(true);
          }

          setIsDuress(false);
          setKey(setup.key);
          await refresh(setup.key);
          return true;
        }

        const unlocked = await unlockWithPin(pin, existing.salt, existing.canaryIv, existing.canaryCiphertext);
        if (unlocked) {
          setIsDuress(false);
          setKey(unlocked);
          await refresh(unlocked);
          return true;
        }

        const duress = await loadDuressPinConfig();
        if (duress) {
          const duressUnlocked = await unlockWithPin(pin, duress.salt, duress.canaryIv, duress.canaryCiphertext);
          if (duressUnlocked) {
            setIsDuress(true);
            setKey(null);
            setEntries(asDecoyEntries(await buildDemoEntries()));
            return true;
          }
        }

        return false;
      } finally {
        setLoading(false);
      }
    },
    [refresh, setKey],
  );

  const lock = useCallback(() => {
    setKey(null);
    setEntries([]);
    setIsDuress(false);
  }, [setKey]);

  const save = useCallback(
    async (record: EvidenceRecord, opts: { isDemo?: boolean; demoConfirmedHeight?: number } = {}): Promise<void> => {
      if (isDuress) {
        // Looks like a normal save, but only ever touches the in-memory decoy list — a
        // duress session must never write anything real to disk.
        setEntries((prev) => [
          { record, savedAt: new Date().toISOString(), isDemo: true, demoConfirmedHeight: opts.demoConfirmedHeight },
          ...prev,
        ]);
        return;
      }
      const activeKey = keyRef.current;
      if (!activeKey) throw new Error('Vault is locked');
      await saveVaultEntry(activeKey, record, opts);
      await refresh(activeKey);
    },
    [isDuress, refresh],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      if (isDuress) {
        setEntries((prev) => prev.filter((e) => e.record.id !== id));
        return;
      }
      await deleteEntry(id);
      if (keyRef.current) await refresh(keyRef.current);
    },
    [isDuress, refresh],
  );

  const loadDemo = useCallback(async (): Promise<void> => {
    const demo = await buildDemoEntries();
    if (isDuress) {
      setEntries(asDecoyEntries(demo));
      return;
    }
    const activeKey = keyRef.current;
    if (!activeKey) return;
    for (const { record, demoConfirmedHeight } of demo) {
      await saveVaultEntry(activeKey, record, { isDemo: true, demoConfirmedHeight });
    }
    await refresh(activeKey);
  }, [isDuress, refresh]);

  /**
   * Sets or replaces the duress PIN. Requires the real vault to already be unlocked —
   * this is owner-only configuration, never something reachable from the lock screen.
   * Refuses a candidate that matches the real PIN, since `unlock` above always checks the
   * real canary first and a matching duress PIN would just never be reached.
   */
  const setDuressPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!pin || !keyRef.current) return false;
    const realConfig = await loadPinConfig();
    if (realConfig) {
      const matchesReal = await unlockWithPin(pin, realConfig.salt, realConfig.canaryIv, realConfig.canaryCiphertext);
      if (matchesReal) return false;
    }
    const setup = await setupPin(pin);
    await saveDuressPinConfig({ salt: setup.salt, canaryIv: setup.canaryIv, canaryCiphertext: setup.canaryCiphertext });
    setHasDuressConfig(true);
    return true;
  }, []);

  const removeDuressPin = useCallback(async (): Promise<void> => {
    await clearDuressPinConfig();
    setHasDuressConfig(false);
  }, []);

  const reset = useCallback(async (): Promise<void> => {
    if (isDuress) {
      // A "reset" performed under duress must never touch the real vault — it only clears
      // the decoy list on screen, so the illusion holds even if asked to "delete it all."
      setEntries([]);
      return;
    }
    await clearVault();
    setKey(null);
    setEntries([]);
    setHasConfig(false);
    setHasDuressConfig(false);
    setIsDuress(false);
  }, [isDuress, setKey]);

  return {
    unlocked: key !== null || isDuress,
    isDuress,
    entries,
    loading,
    hasConfig,
    hasDuressConfig,
    checkConfig,
    checkDuressConfig,
    unlock,
    lock,
    save,
    remove,
    loadDemo,
    setDuressPin,
    removeDuressPin,
    reset,
  };
}
