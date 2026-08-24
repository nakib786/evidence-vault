/** Shared formatting for `GeoLocation`, used by the report, certificate, cover letter and vault. */
import type { GeoLocation } from './types';

/** Bare coordinates, no caveat — what gets prefilled into a free-text field the user can edit. */
export function formatCoordinates(location: GeoLocation): string {
  return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
}

/** Coordinates plus an honest note on precision — what goes in the report, certificate and vault. */
export function formatLocation(location: GeoLocation): string {
  const coords = formatCoordinates(location);
  if (location.source === 'ip') {
    return `${coords}  (approximate — from the reporter's IP address, city-level at best, not device GPS)`;
  }
  return location.accuracyMeters != null
    ? `${coords}  (accurate to within about ${Math.round(location.accuracyMeters)} m)`
    : coords;
}

/** A `geo:` URI, understood by the OS's own maps app on Android and iOS — no network call of ours. */
export function locationMapUri(location: GeoLocation): string {
  return `geo:${location.latitude},${location.longitude}?q=${location.latitude},${location.longitude}`;
}
