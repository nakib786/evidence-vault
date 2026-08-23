/**
 * Hands a visitor back the IP address their own request arrived with — nothing more.
 *
 * `CF-Connecting-IP` is set by Cloudflare's edge on every request that reaches this
 * function; it is read here and echoed straight back, never written to KV, D1, R2, the
 * Cache API, or a log. The response is marked `no-store` so nothing about this request is
 * kept anywhere once it's been sent, mirroring the same statelessness as
 * `functions/api/ots-check.ts`.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

interface RequestContext {
  request: Request;
}

export function onRequestGet({ request }: RequestContext): Response {
  const ip = request.headers.get('CF-Connecting-IP');
  return new Response(JSON.stringify({ ip }), { headers: CORS_HEADERS });
}

export function onRequestOptions(): Response {
  return new Response(null, { headers: CORS_HEADERS });
}
