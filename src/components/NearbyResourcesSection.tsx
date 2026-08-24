/**
 * "Find help nearby" — mosques and police/community-safety contacts, plus the hand-verified
 * national organisations already in `jurisdictions.ts`. Shown on the home screen and the
 * review screen, not tucked inside the per-record form: this is useful whether or not anyone
 * is in the middle of documenting something, and deliberately doesn't touch `ReportDetails` —
 * nothing found here is added to any record. It asks for its own location the same way the
 * per-record one in `ReviewScreen` does (GPS first, an IP-based approximation offered if
 * that's declined or unavailable) plus a manual option this screen alone has, because the two
 * are unrelated: a coordinate added to a report and a coordinate used only to run this search.
 * The manual option also matters here specifically: GPS/IP give one answer for "near me right
 * now", but someone might want to check what's near a different city, or GPS/IP might simply
 * be wrong or unavailable and typing coordinates in is the only way to search at all.
 *
 * The live half of this (mosques, police) comes from OpenStreetMap's Overpass API — see
 * `lib/nearbyPlaces.ts` for why that's the actual data source rather than a specific
 * organisation's own directory, and for the honesty framing every result carries.
 */
import { useState } from 'react';
import { Button, Callout, Card, inputClass } from './ui';
import { isIosWebkit } from '../lib/platform';
import { formatCoordinates } from '../lib/geo';
import { COUNTRIES } from '../lib/jurisdictions';
import {
  DEFAULT_MOSQUE_RADIUS_METERS,
  DEFAULT_POLICE_RADIUS_METERS,
  findNearbyMosques,
  findNearbyPolice,
  formatDistance,
  type NearbyPlace,
} from '../lib/nearbyPlaces';
import { useGeolocation } from './useGeolocation';
import { useApproxLocation } from './useApproxLocation';
import { useNearbyPlaces, type UseNearbyPlacesResult } from './useNearbyPlaces';
import type { GeoLocation } from '../lib/types';

export default function NearbyResourcesSection() {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const geo = useGeolocation();
  const approxLoc = useApproxLocation();
  const nearbyPolice = useNearbyPlaces(findNearbyPolice);
  const nearbyMosques = useNearbyPlaces(findNearbyMosques);

  const communityOrgs = COUNTRIES.flatMap((c) => c.community);

  const parsedLat = Number(manualLat);
  const parsedLon = Number(manualLon);
  const manualIsValid =
    manualLat.trim() !== '' &&
    manualLon.trim() !== '' &&
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLon) &&
    parsedLat >= -90 &&
    parsedLat <= 90 &&
    parsedLon >= -180 &&
    parsedLon <= 180;

  const useManualLocation = () => {
    if (!manualIsValid) return;
    setLocation({
      latitude: parsedLat,
      longitude: parsedLon,
      accuracyMeters: null,
      readAt: new Date().toISOString(),
      source: 'manual',
    });
    setShowManualEntry(false);
    setManualLat('');
    setManualLon('');
  };

  return (
    <Card as="div" className="space-y-4" data-tour="nearby-help">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">Find help nearby</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Police / community-safety contacts near you, mosques, and the national organisations
          already listed elsewhere in this app — so they’re not something you have to go
          searching for separately.
        </p>
      </div>

      {location ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-sunken p-3">
            <div>
              <p className="font-mono text-sm text-ink">{formatCoordinates(location)}</p>
              {location.source === 'ip' ? (
                <p className="text-xs text-ink-subtle">Approximate — from your IP address, city-level at best.</p>
              ) : location.source === 'manual' ? (
                <p className="text-xs text-ink-subtle">Entered manually.</p>
              ) : null}
            </div>
            <Button variant="quiet" className="px-3 py-1.5 text-sm" onClick={() => setLocation(null)}>
              Change
            </Button>
          </div>

          <NearbyFinder
            title="Nearby police stations"
            buttonLabel="Find nearby police stations"
            defaultRadiusKm={DEFAULT_POLICE_RADIUS_METERS / 1000}
            maxRadiusKm={100}
            hookResult={nearbyPolice}
            onRequest={(radiusMeters) => nearbyPolice.request(location.latitude, location.longitude, radiusMeters)}
          />
          <NearbyFinder
            title="Nearby mosques"
            buttonLabel="Find nearby mosques"
            defaultRadiusKm={DEFAULT_MOSQUE_RADIUS_METERS / 1000}
            maxRadiusKm={300}
            hookResult={nearbyMosques}
            onRequest={(radiusMeters) => nearbyMosques.request(location.latitude, location.longitude, radiusMeters)}
          />

          <p className="text-xs text-ink-subtle">
            For an emergency, always call 911 (US &amp; Canada) rather than a number found
            here. These come from OpenStreetMap’s community-maintained map data — not
            verified by this app — so confirm a number before relying on it.
          </p>
        </>
      ) : (
        <div className="space-y-2">
          <Button
            variant="secondary"
            onClick={() => geo.request((loc) => setLocation(loc))}
            disabled={geo.state === 'requesting'}
          >
            {geo.state === 'requesting' ? 'Getting your location…' : 'Use my current location'}
          </Button>
          {geo.state === 'denied' ? (
            <Callout tone="caution" title="Location permission declined">
              {isIosWebkit() ? (
                <p>
                  On iPhone or iPad this needs two things allowed: Location Services for this
                  browser under Settings → Privacy &amp; Security → Location Services, and the
                  per-site permission the browser itself asks for. If you tapped “Don’t Allow”
                  earlier, reload this page to be asked again.
                </p>
              ) : (
                <p>
                  Check this site’s permission in your browser — usually a location icon in the
                  address bar, or Settings → Site settings → Location — then try again.
                </p>
              )}
            </Callout>
          ) : geo.state === 'unavailable' || geo.state === 'error' ? (
            <Callout tone="caution" title="Couldn’t get your location">
              {geo.errorMessage ?? 'Something went wrong reading your location.'}
            </Callout>
          ) : null}
          {geo.state === 'denied' || geo.state === 'unavailable' || geo.state === 'error' ? (
            <div className="space-y-1.5">
              <Button
                variant="quiet"
                className="px-3 py-1.5 text-sm"
                onClick={() => approxLoc.request((loc) => setLocation(loc))}
                disabled={approxLoc.state === 'requesting'}
              >
                {approxLoc.state === 'requesting' ? 'Approximating…' : 'Or approximate it from my IP address instead'}
              </Button>
              {approxLoc.state === 'unavailable' || approxLoc.state === 'error' ? (
                <p className="text-xs text-caution">Couldn’t approximate a location either.</p>
              ) : null}
            </div>
          ) : null}

          {showManualEntry ? (
            <div className="space-y-2 rounded-xl border border-line bg-sunken p-3">
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Latitude"
                  aria-label="Latitude"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  className={`${inputClass} py-2`}
                />
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Longitude"
                  aria-label="Longitude"
                  value={manualLon}
                  onChange={(e) => setManualLon(e.target.value)}
                  className={`${inputClass} py-2`}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  className="px-3 py-1.5 text-sm"
                  onClick={useManualLocation}
                  disabled={!manualIsValid}
                >
                  Use this location
                </Button>
                <Button
                  variant="quiet"
                  className="px-3 py-1.5 text-sm"
                  onClick={() => {
                    setShowManualEntry(false);
                    setManualLat('');
                    setManualLon('');
                  }}
                >
                  Cancel
                </Button>
              </div>
              {(manualLat.trim() !== '' || manualLon.trim() !== '') && !manualIsValid ? (
                <p className="text-xs text-caution">
                  Latitude must be between -90 and 90, longitude between -180 and 180.
                </p>
              ) : null}
            </div>
          ) : (
            <Button variant="quiet" className="px-3 py-1.5 text-sm" onClick={() => setShowManualEntry(true)}>
              Or enter coordinates manually
            </Button>
          )}
        </div>
      )}

      <div className="space-y-2 border-t border-line pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          Hand-verified, not location-based
        </p>
        <ul className="space-y-2">
          {communityOrgs.map((org) => (
            <li key={org.id} className="rounded-lg bg-sunken p-2.5 text-sm">
              <p className="font-semibold text-ink">{org.name}</p>
              <p className="text-xs text-ink-muted">{org.role}</p>
              {org.channels.map((ch) => (
                <p key={ch.label} className="mt-0.5 text-xs text-ink-subtle">
                  {ch.label}:{' '}
                  {ch.kind === 'online' ? (
                    <a
                      href={ch.value}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent underline underline-offset-2 hover:text-accent-hover"
                    >
                      {ch.value}
                    </a>
                  ) : (
                    ch.value
                  )}
                </p>
              ))}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

/**
 * One "find X nearby" control: a radius the user can adjust, a button, a loading/error state,
 * and a plain-text result list. Radius lives here rather than in the parent because it's a
 * per-search-kind setting a mosque search and a police search have no reason to share.
 */
function NearbyFinder({
  title,
  buttonLabel,
  defaultRadiusKm,
  maxRadiusKm,
  hookResult,
  onRequest,
}: {
  title: string;
  buttonLabel: string;
  defaultRadiusKm: number;
  maxRadiusKm: number;
  hookResult: UseNearbyPlacesResult;
  onRequest: (radiusMeters: number) => void;
}) {
  const [radiusKm, setRadiusKm] = useState(defaultRadiusKm);
  const radiusIsValid = Number.isFinite(radiusKm) && radiusKm > 0 && radiusKm <= maxRadiusKm;

  return (
    <div className="rounded-xl border border-line bg-sunken p-3">
      <p className="font-display text-sm font-semibold text-ink">{title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-ink-muted">
          Within
          <input
            type="number"
            inputMode="decimal"
            min={1}
            max={maxRadiusKm}
            step={1}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            aria-label={`Search radius for ${title.toLowerCase()}, in kilometres`}
            className={`${inputClass} w-20 px-2 py-1.5 text-sm`}
          />
          km
        </label>
        <Button
          variant="secondary"
          className="px-3 py-1.5 text-sm"
          onClick={() => onRequest(radiusKm * 1000)}
          disabled={hookResult.state === 'loading' || !radiusIsValid}
        >
          {hookResult.state === 'loading' ? 'Looking…' : hookResult.state === 'done' ? 'Search again' : buttonLabel}
        </Button>
      </div>
      {!radiusIsValid ? (
        <p className="mt-1.5 text-xs text-caution">Enter a radius between 1 and {maxRadiusKm} km.</p>
      ) : null}
      {hookResult.state === 'error' ? (
        <p className="mt-2 text-xs text-danger">Couldn’t reach the lookup service just now. Try again in a moment.</p>
      ) : null}
      {hookResult.state === 'done' ? (
        hookResult.places.length === 0 ? (
          <p className="mt-2 text-xs text-ink-subtle">
            Nothing found within {radiusKm} km in OpenStreetMap’s data.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {hookResult.places.map((place: NearbyPlace) => (
              <li key={place.id} className="rounded-lg bg-surface p-2.5 text-sm">
                <p className="font-semibold text-ink">{place.name}</p>
                <p className="text-xs text-ink-subtle">
                  {formatDistance(place.distanceMeters)}
                  {place.address ? ` · ${place.address}` : ''}
                </p>
                {place.phone ? <p className="text-xs text-ink-muted">{place.phone}</p> : null}
                {place.website ? (
                  <a
                    href={place.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-accent underline underline-offset-2 hover:text-accent-hover"
                  >
                    Website
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
