/**
 * Live Bitcoin network cadence, from mempool.space's public API (CORS-enabled, no
 * auth, no user data sent — just a GET for public chain stats). This is one leg of
 * the wait between an OpenTimestamps calendar batching a proof and that batch
 * showing up as a confirmed Bitcoin attestation: the batch still needs a block.
 */

export interface BitcoinCadence {
  /** Recent average minutes between blocks. */
  avgMinutesBetweenBlocks: number;
}

export async function fetchBitcoinCadence(signal?: AbortSignal): Promise<BitcoinCadence | null> {
  try {
    const res = await fetch('https://mempool.space/api/v1/difficulty-adjustment', { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { timeAvg?: number };
    if (typeof data.timeAvg !== 'number') return null;
    return { avgMinutesBetweenBlocks: data.timeAvg / 60_000 };
  } catch {
    return null;
  }
}
