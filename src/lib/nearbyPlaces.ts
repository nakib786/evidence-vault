/**
 * "What's nearby" for a location the reporter has already chosen to share — mosques, and
 * police/community-safety contacts — read live from OpenStreetMap's Overpass API.
 *
 * This is community-maintained map data, not verified by this app: entries can be missing,
 * closed, or carry a stale phone number. It's offered as a starting point for something that
 * is otherwise genuinely hard to find quickly, not as a directory this app stands behind —
 * every caller of this module should say so plainly next to the results, the same way
 * `jurisdictions.ts` is upfront that a phone number should be confirmed on the agency's own
 * site. Unlike everything else this app does, a query here does leave the device: the
 * coordinates are sent to a public Overpass server to run the search (see `OVERPASS_ENDPOINTS`
 * below for why there are two). Only ever called from an explicit button press — never
 * automatically alongside a location being captured.
 *
 * There's no free, no-auth API for a specific organisation's own mosque directory (BCMA or
 * otherwise) that this could call instead — OpenStreetMap is what's actually reachable, and
 * it already carries real names, addresses, phone numbers and websites for many mosques
 * (spot-checked against several in the Vancouver area). `NearbyResourcesSection` pairs this
 * live search with the hand-verified organisations already in `jurisdictions.ts`, rather
 * than presenting this as a single unified directory.
 */

export interface NearbyPlace {
  id: string;
  name: string;
  distanceMeters: number;
  address: string | null;
  phone: string | null;
  website: string | null;
}

/**
 * The primary instance is a single shared public server that rate-limits by client IP and, when
 * throttled, drops the CORS header on its response — which the browser then reports as a plain
 * "Failed to fetch" / CORS error with no status code to distinguish it from a real outage.
 * maps.mail.ru runs an independent Overpass mirror against the same OSM data, so a second try
 * there recovers from exactly that failure mode instead of surfacing it to the user as broken.
 *
 * Picking a fallback took live testing against real queries, not just a docs list or a check
 * that the endpoint answers at all — three earlier candidates each looked fine at a glance and
 * weren't: overpass.kumi.systems 500s on every real query (its own status page shows it's been
 * silently re-pointed elsewhere); overpass.openstreetmap.fr 403s any request whose User-Agent
 * isn't on its own allowlist, i.e. every real browser; and overpass.osm.ch answers 200 with
 * well-formed but *empty* results for almost anything — no error to catch and retry from, just
 * a search that silently finds nothing (its `osm3s.timestamp_osm_base` isn't even a real date,
 * suggesting an unpopulated or misconfigured backend). This one was confirmed to return real,
 * current data for both the mosque and police queries before landing here.
 */
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const RESULT_LIMIT = 8;

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

/** Great-circle distance in metres — good enough at this scale, no need for anything fancier. */
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function addressFromTags(tags: Record<string, string>): string | null {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const city = tags['addr:city'];
  const combined = [street, city].filter(Boolean).join(', ');
  return combined || null;
}

/**
 * How many raw elements to ask Overpass for before we sort by distance ourselves — scaled to
 * `radiusMeters` rather than fixed, since Overpass doesn't return elements in distance order
 * and a cap too low relative to the search area could silently drop the actually-closest
 * results in a dense area. Floor and ceiling keep a user-adjusted radius from ever sending an
 * unreasonably small or large `out center N` request.
 */
function fetchCapFor(radiusMeters: number): number {
  return Math.min(500, Math.max(30, Math.round(radiusMeters / 150)));
}

async function queryOverpass(
  filter: string,
  lat: number,
  lon: number,
  radiusMeters: number,
): Promise<NearbyPlace[]> {
  const fetchCap = fetchCapFor(radiusMeters);
  const query = `[out:json][timeout:20];(nwr(around:${radiusMeters},${lat},${lon})${filter};);out center ${fetchCap};`;

  let data: OverpassResponse | undefined;
  let lastError: unknown;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) throw new Error('Overpass request failed');
      data = (await res.json()) as OverpassResponse;
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!data) throw lastError instanceof Error ? lastError : new Error('Overpass request failed');

  const places: NearbyPlace[] = [];
  for (const el of data.elements) {
    const elLat = el.lat ?? el.center?.lat;
    const elLon = el.lon ?? el.center?.lon;
    const tags = el.tags ?? {};
    if (elLat == null || elLon == null || !tags.name) continue;
    places.push({
      id: `${el.type}/${el.id}`,
      name: tags.name,
      distanceMeters: haversineMeters(lat, lon, elLat, elLon),
      address: addressFromTags(tags),
      phone: tags.phone ?? tags['contact:phone'] ?? null,
      website: tags.website ?? tags['contact:website'] ?? null,
    });
  }

  return places.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, RESULT_LIMIT);
}

export const DEFAULT_MOSQUE_RADIUS_METERS = 50000;
export const DEFAULT_POLICE_RADIUS_METERS = 8000;

/** Mosques are sparse enough that a tight radius often turns up nothing outside a dense city — the default is wide; the caller (or the user, via the UI) can narrow or widen it. */
export const findNearbyMosques = (
  lat: number,
  lon: number,
  radiusMeters: number = DEFAULT_MOSQUE_RADIUS_METERS,
): Promise<NearbyPlace[]> => queryOverpass('[amenity=place_of_worship][religion=muslim]', lat, lon, radiusMeters);

/** Police/community-safety points are common enough that a wide radius would mostly add noise by default. */
export const findNearbyPolice = (
  lat: number,
  lon: number,
  radiusMeters: number = DEFAULT_POLICE_RADIUS_METERS,
): Promise<NearbyPlace[]> => queryOverpass('[amenity=police]', lat, lon, radiusMeters);

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m away` : `${(meters / 1000).toFixed(1)} km away`;
}
