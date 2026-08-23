/**
 * Same-origin relay for OpenTimestamps' calendar confirmation check.
 *
 * `GET {calendar}/timestamp/{hex}` tells you whether a calendar has upgraded a pending
 * timestamp to a Bitcoin attestation yet — but the calendar servers send no CORS headers on
 * that endpoint (confirmed against every calendar this app uses; see `src/lib/ots.ts`), so a
 * browser can never read the response directly, no matter which site is asking. Requests
 * made from a Cloudflare Function to another server aren't subject to CORS at all — that's a
 * browser-only restriction — so this relays the same request from Cloudflare's edge instead
 * and hands back the raw bytes. From the browser's point of view this endpoint is
 * same-origin, so there's no CORS problem left to solve.
 *
 * Stateless by design, per the point of this proxy: nothing is written to KV, D1, R2, or the
 * Cache API. Every request is forwarded live and the response is marked `no-store`, so no
 * copy of anything that passes through this endpoint is ever kept anywhere once it's been
 * sent back.
 *
 * `calendar` is restricted to an allowlist of the exact hosts this app's own OTS client uses
 * (`CALENDARS` in `src/lib/ots.ts`, plus the two `btc.calendar.*` / `eternitywall.com` hosts
 * those pool servers resolve pending attestations to) — not a pass-through — so this can't be
 * turned into an open proxy to arbitrary hosts.
 */

const ALLOWED_CALENDARS = new Set([
  'https://alice.btc.calendar.opentimestamps.org',
  'https://bob.btc.calendar.opentimestamps.org',
  'https://finney.calendar.eternitywall.com',
  'https://a.pool.opentimestamps.org',
  'https://b.pool.opentimestamps.org',
  'https://a.pool.eternitywall.com',
]);

// A calendar message hex can be longer than a bare 32-byte digest once Merkle-tree
// append/prepend ops are folded in — bounded generously, not tied to exactly 64 chars.
const HEX_RE = /^[0-9a-f]{2,4096}$/i;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET',
};

interface RequestContext {
  request: Request;
}

export async function onRequestGet({ request }: RequestContext): Promise<Response> {
  const url = new URL(request.url);
  const calendar = url.searchParams.get('calendar');
  const hex = url.searchParams.get('hex');

  if (!calendar || !ALLOWED_CALENDARS.has(calendar)) {
    return new Response('Unknown calendar', { status: 400, headers: CORS_HEADERS });
  }
  if (!hex || !HEX_RE.test(hex)) {
    return new Response('Invalid hex', { status: 400, headers: CORS_HEADERS });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${calendar}/timestamp/${hex}`);
  } catch {
    return new Response('Calendar unreachable', { status: 502, headers: CORS_HEADERS });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' },
  });
}

export function onRequestOptions(): Response {
  return new Response(null, { headers: CORS_HEADERS });
}
