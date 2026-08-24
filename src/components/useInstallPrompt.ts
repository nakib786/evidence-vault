import { useCallback, useEffect, useState } from 'react';
import { isIosWebkit } from '../lib/platform';

/**
 * Chrome/Edge/Android's non-standard install event. Not in lib.dom.d.ts, so it's typed
 * locally rather than pulled in as a dependency for one interface.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari's own flag — display-mode media query support there is unreliable.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Surfaces a one-click install prompt where the platform supports one (Chrome/Edge on
 * Android and desktop), and flags iOS/iPadOS separately — there, no code can trigger
 * installation; the OS only allows it through the Share sheet's "Add to Home Screen",
 * done by hand. See the caller for how the two are presented differently.
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    // The event is single-use regardless of outcome — Chrome won't fire it again until
    // the next full page load.
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return {
    installed,
    canPromptInstall: deferredPrompt !== null,
    promptInstall,
    isIos: isIosWebkit() && !installed,
  };
}
