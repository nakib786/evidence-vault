/** Drives one `nearbyPlaces.ts` lookup (mosques, or police) — one instance per kind, per item. */
import { useCallback, useState } from 'react';
import type { NearbyPlace } from '../lib/nearbyPlaces';

export type NearbyPlacesState = 'idle' | 'loading' | 'done' | 'error';

export interface UseNearbyPlacesResult {
  state: NearbyPlacesState;
  places: NearbyPlace[];
  request: (lat: number, lon: number, radiusMeters: number) => void;
}

export function useNearbyPlaces(
  fetcher: (lat: number, lon: number, radiusMeters: number) => Promise<NearbyPlace[]>,
): UseNearbyPlacesResult {
  const [state, setState] = useState<NearbyPlacesState>('idle');
  const [places, setPlaces] = useState<NearbyPlace[]>([]);

  const request = useCallback(
    (lat: number, lon: number, radiusMeters: number) => {
      setState('loading');
      void fetcher(lat, lon, radiusMeters)
        .then((results) => {
          setPlaces(results);
          setState('done');
        })
        .catch(() => setState('error'));
    },
    [fetcher],
  );

  return { state, places, request };
}
