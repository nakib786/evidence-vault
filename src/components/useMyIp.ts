/**
 * The visitor's own IP address, read back from `functions/api/my-ip.ts` — a same-origin,
 * stateless echo of the `CF-Connecting-IP` header Cloudflare's edge sets on the request.
 * Nothing here persists it: no localStorage, no vault entry, just a value held in memory
 * for as long as this component is mounted, gone the moment the tab closes.
 */
import { useEffect, useState } from 'react';

export interface MyIpState {
  ip: string | null;
  loading: boolean;
}

export function useMyIp(): MyIpState {
  const [ip, setIp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/my-ip', { cache: 'no-store' });
        if (!res.ok) throw new Error('lookup failed');
        const data = (await res.json()) as { ip: string | null };
        if (!cancelled) setIp(data.ip);
      } catch {
        if (!cancelled) setIp(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ip, loading };
}
