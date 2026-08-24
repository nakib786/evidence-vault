/**
 * A coarse, city-level location guess, inferred by Cloudflare's own edge from the request
 * that reaches it — the fallback offered when GPS location isn't shared or isn't available
 * (see `useApproxLocation`). `request.cf` is populated by Cloudflare on every request; this
 * calls no third-party geolocation service, so it's first-party and stateless in the same
 * shape as `ots-check.ts`: nothing is written to KV, D1, R2, the Cache API, or a log, and the
 * response is marked `no-store`. It is genuinely coarse — city-level at best — which is why
 * the frontend labels anything built from it as approximate rather than a precise reading.
 */

interface CfProperties {
  latitude?: string;
  longitude?: string;
  city?: string;
  region?: string;
  country?: string;
}

interface RequestContext {
  request: Request & { cf?: CfProperties };
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

function toFiniteNumber(value: string | undefined): number | null {
  const n = value ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function onRequestGet({ request }: RequestContext): Response {
  const cf = request.cf;
  const body = {
    latitude: toFiniteNumber(cf?.latitude),
    longitude: toFiniteNumber(cf?.longitude),
    city: cf?.city ?? null,
    region: cf?.region ?? null,
    country: cf?.country ?? null,
  };
  return new Response(JSON.stringify(body), { headers: CORS_HEADERS });
}

export function onRequestOptions(): Response {
  return new Response(null, { headers: CORS_HEADERS });
}
