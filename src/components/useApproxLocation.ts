/**
 * The IP-based fallback offered once GPS location has been declined, is unavailable, or
 * errors out — see `functions/api/approx-location.ts` for where the coordinates actually
 * come from (Cloudflare's own edge, not GPS, not a third-party geolocation service). Same
 * shape as `useGeolocation`: nothing runs until the user presses the button.
 */
import { useCallback, useState } from 'react';
import type { GeoLocation } from '../lib/types';

export type ApproxLocationState = 'idle' | 'requesting' | 'unavailable' | 'error';

export interface UseApproxLocationResult {
  state: ApproxLocationState;
  request: (onSuccess: (location: GeoLocation) => void) => void;
}

interface ApproxLocationResponse {
  latitude: number | null;
  longitude: number | null;
}

export function useApproxLocation(): UseApproxLocationResult {
  const [state, setState] = useState<ApproxLocationState>('idle');

  const request = useCallback((onSuccess: (location: GeoLocation) => void) => {
    setState('requesting');
    void (async () => {
      try {
        const res = await fetch('/api/approx-location', { cache: 'no-store' });
        if (!res.ok) throw new Error('lookup failed');
        const data = (await res.json()) as ApproxLocationResponse;
        if (data.latitude == null || data.longitude == null) {
          setState('unavailable');
          return;
        }
        setState('idle');
        onSuccess({
          latitude: data.latitude,
          longitude: data.longitude,
          accuracyMeters: null,
          readAt: new Date().toISOString(),
          source: 'ip',
        });
      } catch {
        setState('error');
      }
    })();
  }, []);

  return { state, request };
}
