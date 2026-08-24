/**
 * The visitor's own public IP addresses, for the footer's transparency note.
 *
 * A single connection is always one family or the other — the earlier version of this
 * read Cloudflare's `CF-Connecting-IP` for *this* request, which meant it could only ever
 * show whichever protocol the browser's own happy-eyeballs logic picked to reach this
 * site (usually IPv6, on a dual-stack network), never both. Getting both means making two
 * separate lookups against hosts that are deliberately single-family — one with only an A
 * record, one with only an AAAA — so each one forces that specific protocol. That can't be
 * done same-origin without owning a domain split the same way, so this calls ipify, a
 * public IP-echo API built for exactly this: no key, no tracking, CORS-open. Each lookup
 * fails independently and quietly (e.g. a v6-only network simply has no v4 to report),
 * and nothing here is ever persisted — held in memory only for as long as this is mounted.
 */
import { useEffect, useState } from 'react';

export interface MyIpState {
  ipv4: string | null;
  ipv6: string | null;
  loadingV4: boolean;
  loadingV6: boolean;
}

async function lookup(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { ip?: string };
    return data.ip ?? null;
  } catch {
    return null;
  }
}

export function useMyIp(): MyIpState {
  const [ipv4, setIpv4] = useState<string | null>(null);
  const [ipv6, setIpv6] = useState<string | null>(null);
  const [loadingV4, setLoadingV4] = useState(true);
  const [loadingV6, setLoadingV6] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void lookup('https://api.ipify.org?format=json').then((ip) => {
      if (!cancelled) {
        setIpv4(ip);
        setLoadingV4(false);
      }
    });
    void lookup('https://api6.ipify.org?format=json').then((ip) => {
      if (!cancelled) {
        setIpv6(ip);
        setLoadingV6(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ipv4, ipv6, loadingV4, loadingV6 };
}
