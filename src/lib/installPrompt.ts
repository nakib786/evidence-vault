const INSTALL_DISMISSED_KEY = 'evidence-vault:install-dismissed';

/**
 * Whether the "install this app" nudge should stay off. Same shape as `isIntroHidden` in
 * tour.ts: dismissal is the only thing that ever sets this, there's no implicit "seen once"
 * tracking, and storage errors (private browsing) fail open to showing the nudge again
 * rather than throwing.
 */
export function isInstallNudgeDismissed(): boolean {
  try {
    return localStorage.getItem(INSTALL_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissInstallNudge(): void {
  try {
    localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
  } catch {
    /* storage unavailable — the nudge simply shows again next time */
  }
}
