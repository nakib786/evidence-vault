/**
 * The "check now / live calendar activity" block for a pending proof. Shared between the
 * vault's record screen and the standalone verify page — see `useProofCheck` for the state
 * this renders.
 */
import { Button } from './ui';
import type { ProofCheckState } from './useProofCheck';

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatAgo(ts: number, now: number): string {
  const diffSec = Math.max(0, Math.round((now - ts) / 1000));
  if (diffSec < 60) return 'just now';
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min} min ago`;
  return `${Math.round(min / 60)} hr ago`;
}

function formatHours(h: number): string {
  return h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)} hr`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export default function ProofLivePanel({ state }: { state: ProofCheckState }) {
  const { active, checking, checkNote, lastCheckedAt, secondsLeft, calendarStats, btcCadence, runCheck, now } = state;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button variant="secondary" onClick={() => runCheck()} disabled={checking}>
          {checking ? 'Checking…' : 'Check now'}
        </Button>
        {active ? (
          <p className="text-xs text-ink-subtle">
            {lastCheckedAt ? `Checked ${formatAgo(lastCheckedAt, now)}` : 'Checking automatically…'}
            {secondsLeft !== null ? ` · next automatic check in ${formatCountdown(secondsLeft)}` : ''}
          </p>
        ) : null}
      </div>
      {checkNote ? <p className="text-sm text-ink-muted">{checkNote}</p> : null}

      {active ? (
        <div className="space-y-1.5 rounded-lg bg-sunken px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Live calendar activity</p>
          {calendarStats.length === 0 ? (
            <p className="text-xs text-ink-subtle">Loading…</p>
          ) : (
            calendarStats.map((s) => (
              <p key={s.calendar} className="text-xs text-ink-muted">
                <span className="font-mono">{hostOf(s.calendar)}</span>
                {s.error ? (
                  ' — unavailable right now'
                ) : (
                  <>
                    {': '}
                    {s.pendingCommitments !== undefined
                      ? `${s.pendingCommitments.toLocaleString()} timestamps queued`
                      : 'queue depth unavailable'}
                    {s.avgHoursBetweenTx ? `, batches to Bitcoin about every ${formatHours(s.avgHoursBetweenTx)}` : ''}
                    {s.txWaitingConfirmation
                      ? `, ${s.txWaitingConfirmation} batch${s.txWaitingConfirmation === 1 ? '' : 'es'} awaiting confirmation`
                      : ''}
                  </>
                )}
              </p>
            ))
          )}
          {btcCadence ? (
            <p className="text-xs text-ink-muted">
              Bitcoin is producing new blocks roughly every {Math.round(btcCadence.avgMinutesBetweenBlocks)} min right
              now.
            </p>
          ) : null}
          <p className="text-xs text-ink-subtle">
            Once a calendar batches this fingerprint and that batch is mined, the proof upgrades — this screen picks
            it up automatically, usually within a few hours of submission.
          </p>
        </div>
      ) : null}

      <p className="text-xs text-ink-subtle">
        This checks live, right here in the browser. It never depends on this app either way: with the original file
        and the .ots proof, anyone can also check confirmation independently with{' '}
        <code className="rounded bg-sunken px-1 py-0.5 font-mono">pip install opentimestamps-client &amp;&amp; ots upgrade</code>
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
  );
}
