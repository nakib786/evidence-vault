/**
 * Live tracking for one OpenTimestamps proof: an automatic re-poll of the calendars for a
 * confirmation, routed through the same-origin relay in `functions/api/ots-check.ts` (the
 * calendars' own confirmation-check endpoint sends no CORS headers, so a browser can only
 * complete this check via that relay — see its doc comment), plus the live queue-depth/
 * batching-cadence panel alongside it. Shared by the vault's record screen and the standalone
 * verify page — the two places a proof's live status is ever shown.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { upgradeProof, fetchCalendarStats, type CalendarStats, type UpgradeResult } from '../lib/ots';
import { fetchBitcoinCadence, type BitcoinCadence } from '../lib/btcNetwork';

/** How often the auto-check re-polls the calendars for a confirmation. */
const AUTO_CHECK_MS = 10 * 60_000;
/** How often the live queue/batch stats panel refreshes. */
const STATS_REFRESH_MS = 2 * 60_000;

export interface ProofCheckState {
  /** Whether polling is running at all for the current inputs. */
  active: boolean;
  checking: boolean;
  checkNote: string | null;
  lastCheckedAt: number | null;
  secondsLeft: number | null;
  calendarStats: CalendarStats[];
  btcCadence: BitcoinCadence | null;
  runCheck: (opts?: { manual?: boolean }) => Promise<void>;
  /** Clock reading from the same once-a-second tick that drives `secondsLeft`, for callers
   *  that need "how long ago" text without reading `Date.now()` during their own render. */
  now: number;
}

interface Params {
  /** Stable identity for the proof being tracked — polling restarts when this changes. Pass
   *  `null` to disable tracking entirely (e.g. nothing uploaded yet, or already confirmed). */
  trackingKey: string | null;
  ots: Uint8Array | null;
  pendingUris: string[];
  /** Called after a check finds something new. Do whatever persistence makes sense at the
   *  call site (save to the vault, update local state) — this hook holds no proof itself. */
  onUpgraded?: (result: UpgradeResult) => void | Promise<void>;
}

export function useProofCheck({ trackingKey, ots, pendingUris, onUpgraded }: Params): ProofCheckState {
  const [checking, setChecking] = useState(false);
  const [checkNote, setCheckNote] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [nextCheckAt, setNextCheckAt] = useState<number | null>(null);
  const [calendarStats, setCalendarStats] = useState<CalendarStats[]>([]);
  const [btcCadence, setBtcCadence] = useState<BitcoinCadence | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Read the latest inputs from inside the interval closures below, so the effects that
  // start/stop those intervals can stay keyed on `trackingKey` alone — not on `ots`, which
  // changes identity every time a check finds a new attestation and would otherwise restart
  // the polling loop it's in the middle of running.
  const inputsRef = useRef({ ots, pendingUris, onUpgraded });
  useEffect(() => {
    inputsRef.current = { ots, pendingUris, onUpgraded };
  }, [ots, pendingUris, onUpgraded]);

  const active = Boolean(trackingKey) && Boolean(ots) && pendingUris.length > 0;

  const runCheck = useCallback(async (opts: { manual?: boolean } = {}): Promise<void> => {
    const manual = opts.manual ?? true;
    const current = inputsRef.current;
    if (!current.ots) return;
    setChecking(true);
    if (manual) setCheckNote(null);
    try {
      // '' — same origin as this page. See functions/api/ots-check.ts for why a direct
      // fetch from a browser can never complete this check on its own.
      const result = await upgradeProof(current.ots, { proxyBase: '' });
      setLastCheckedAt(Date.now());
      if (result.errors.length > 0 && !result.changed) {
        // A genuine hiccup (the relay or a calendar timed out, or is briefly down) — not the
        // normal "still pending" case, which comes back as a plain 404 and lands below
        // instead. Auto-checks stay quiet about this; only a manual click surfaces it, so a
        // transient failure doesn't nag every ten minutes on its own.
        if (manual) {
          setCheckNote('Could not reach a calendar just now. Try again shortly, or use the standalone tool below.');
        }
        return;
      }
      if (!result.changed) {
        if (manual) setCheckNote('Still pending — nothing new from the calendars yet.');
        return;
      }
      await current.onUpgraded?.(result);
      setCheckNote(
        result.confirmedHeights.length > 0
          ? `Confirmed on Bitcoin block #${result.confirmedHeights[0]}.`
          : 'The proof grew a new attestation, but is not yet confirmed on the ledger.',
      );
    } catch {
      if (manual) setCheckNote('The check could not run here. Use the standalone tool below instead.');
    } finally {
      setChecking(false);
    }
  }, []);

  // Auto-check: re-poll the calendars for a confirmation on a timer, without waiting for a
  // click. Paused whenever the tab isn't visible, and catches up immediately when it becomes
  // visible again if a check is overdue.
  useEffect(() => {
    setCheckNote(null);
    setLastCheckedAt(null);
    if (!active) {
      setNextCheckAt(null);
      return;
    }
    let cancelled = false;
    const nextAtRef = { current: Date.now() + AUTO_CHECK_MS };
    setNextCheckAt(nextAtRef.current);

    const tick = async (): Promise<void> => {
      if (document.hidden || cancelled) return;
      await runCheck({ manual: false });
      if (cancelled) return;
      nextAtRef.current = Date.now() + AUTO_CHECK_MS;
      setNextCheckAt(nextAtRef.current);
    };

    void tick();
    const interval = setInterval(tick, AUTO_CHECK_MS);

    const onVisible = (): void => {
      if (!document.hidden && Date.now() >= nextAtRef.current) void tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on trackingKey, not ots (see inputsRef above)
  }, [active, trackingKey, runCheck]);

  // Live queue-depth / batching-cadence panel — genuinely live data (unlike the confirmation
  // check above, calendar homepages do send CORS headers), refreshed independently of
  // whether the confirmation poll can complete.
  useEffect(() => {
    setCalendarStats([]);
    setBtcCadence(null);
    if (!active) return;
    let cancelled = false;
    const calendars = inputsRef.current.pendingUris;
    if (calendars.length === 0) return;

    const refreshStats = async (): Promise<void> => {
      if (document.hidden || cancelled) return;
      const [stats, cadence] = await Promise.all([fetchCalendarStats(calendars), fetchBitcoinCadence()]);
      if (!cancelled) {
        setCalendarStats(stats);
        setBtcCadence(cadence);
      }
    };

    void refreshStats();
    const interval = setInterval(refreshStats, STATS_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [active, trackingKey]);

  // Ticks `now` once a second so the "next check in mm:ss" countdown updates, paused (and
  // not wasting CPU) whenever the tab is hidden.
  useEffect(() => {
    if (!active || nextCheckAt === null) return;
    const id = setInterval(() => {
      if (!document.hidden) setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [active, nextCheckAt]);

  const secondsLeft = active && nextCheckAt !== null ? Math.max(0, Math.round((nextCheckAt - now) / 1000)) : null;

  return { active, checking, checkNote, lastCheckedAt, secondsLeft, calendarStats, btcCadence, runCheck, now };
}
