/**
 * A dismissible banner nudging toward installing the PWA. Split by platform because the
 * two paths are genuinely different rather than a UI choice: Chrome/Edge (Android and
 * desktop) can trigger the native install prompt from a click, while iOS/iPadOS's WebKit
 * exposes no such API — there, "Add to Home Screen" only exists inside the Share sheet, so
 * the best this can do is point at it. See useInstallPrompt for the platform detection.
 */
import { useState } from 'react';
import { Button } from './ui';
import { useInstallPrompt } from './useInstallPrompt';
import { dismissInstallNudge, isInstallNudgeDismissed } from '../lib/installPrompt';

export default function InstallNudge({ suppressed = false }: { suppressed?: boolean }) {
  const { installed, canPromptInstall, promptInstall, isIos } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(isInstallNudgeDismissed);

  if (suppressed || installed || dismissed || !(canPromptInstall || isIos)) return null;

  function dismiss() {
    dismissInstallNudge();
    setDismissed(true);
  }

  return (
    <div
      role="status"
      className="mb-6 flex items-start gap-3 rounded-xl border border-line bg-sunken p-4"
    >
      <span className="mt-0.5 text-accent" aria-hidden="true">
        {isIos ? <ShareIcon /> : <InstallIcon />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-bold text-ink">Install Evidence Vault</p>
        <p className="mt-1 text-sm text-ink-muted">
          {isIos ? (
            <>
              Tap <ShareIcon inline /> <strong>Share</strong>, then{' '}
              <strong>&quot;Add to Home Screen&quot;</strong> — it opens like an app and keeps working
              offline.
            </>
          ) : (
            'Add it to your home screen for one-tap access, even offline. No app store, nothing to update.'
          )}
        </p>
        {canPromptInstall ? (
          <Button variant="secondary" className="mt-3" onClick={() => void promptInstall()}>
            Install
          </Button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install suggestion"
        className="-m-1.5 shrink-0 rounded-lg p-1.5 text-ink-subtle hover:bg-line hover:text-ink"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function InstallIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <path d="M9 8h6M9 12h6M12 15.5v3M10.3 17.2 12 18.5l1.7-1.3" />
    </svg>
  );
}

function ShareIcon({ inline = false }: { inline?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={inline ? 'inline size-4 -translate-y-0.5' : 'size-5'}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <rect x="4" y="10" width="16" height="11" rx="2.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
