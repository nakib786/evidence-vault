/**
 * A one-shot request for the device's own GPS coordinates, triggered only by an explicit
 * click — never on mount, for the same reason `CaptureScreen` never opens the camera until
 * asked: the permission prompt should never appear as a surprise on a screen about hate
 * speech. `navigator.geolocation.getCurrentPosition` is what raises that native browser
 * prompt in the first place, so calling it from a button handler both asks and reads in one
 * step; there is nothing to auto-detect ahead of that consent.
 */
import { useCallback, useState } from 'react';
import type { GeoLocation } from '../lib/types';

export type GeoRequestState = 'idle' | 'requesting' | 'denied' | 'unavailable' | 'error';

export interface UseGeolocationResult {
  state: GeoRequestState;
  errorMessage: string | null;
  request: (onSuccess: (location: GeoLocation) => void) => void;
}

export function useGeolocation(): UseGeolocationResult {
  const [state, setState] = useState<GeoRequestState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const request = useCallback((onSuccess: (location: GeoLocation) => void) => {
    if (!('geolocation' in navigator)) {
      setState('unavailable');
      setErrorMessage('This browser does not support location lookup.');
      return;
    }
    setState('requesting');
    setErrorMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState('idle');
        onSuccess({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy ?? null,
          readAt: new Date().toISOString(),
          source: 'gps',
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState('denied');
          setErrorMessage('Location permission was declined.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setState('unavailable');
          setErrorMessage('Your device could not determine a location.');
        } else {
          setState('error');
          setErrorMessage('The location request timed out.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, []);

  return { state, errorMessage, request };
}
