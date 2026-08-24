/**
 * Auto-detects a country to prefill the "Where this can go" screen's Country dropdown, from
 * the same first-party, IP-based signal `NearbyResourcesSection`'s fallback uses (see
 * `functions/api/approx-location.ts`) — not GPS, and not a new third-party call. Fires once on
 * mount, the same way `useMyIp` already does for the footer: a plain same-origin fetch raises
 * no permission prompt to ask about first, unlike `useGeolocation`. Only ever a prefill — the
 * field stays an ordinary dropdown, and the caller is expected to let the person change it.
 */
import { useEffect, useState } from 'react';

/** The matched country id, `'intl'` when the detected country isn't one of `knownIds`, or `null` before/if detection never resolves. */
export function useDetectedCountry(knownIds: string[]): string | null {
  const [detected, setDetected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/approx-location', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { country: string | null };
        if (cancelled || !data.country) return;
        const id = data.country.toLowerCase();
        setDetected(knownIds.includes(id) ? id : 'intl');
      } catch {
        // No prefill — the dropdown still works exactly as it did before this existed.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- knownIds is a fresh array each render; only run once on mount.
  }, []);

  return detected;
}
