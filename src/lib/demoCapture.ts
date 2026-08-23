/**
 * A stand-in capture, for the self-playing tour. It lets the tour walk itself from the
 * capture screen through export without a real camera, microphone, or file to hand — the
 * same fixture `vaultDemo.ts` seeds the vault with (see the hackathon rule §06 note there
 * for why fixtures exist instead of real evidence). Everything downstream of this — the
 * hash, the timestamp submission, the exports — runs for real against these bytes; only
 * the file's origin is synthetic.
 */
import type { CapturePayload } from '../components/CaptureScreen';

const DEMO_FIXTURE = '/fixtures/synthetic-post-english.png';

export async function buildDemoCapture(): Promise<CapturePayload> {
  const res = await fetch(DEMO_FIXTURE);
  if (!res.ok) throw new Error(`Could not load demo fixture ${DEMO_FIXTURE}`);
  const blob = await res.blob();
  return { blob, source: 'upload', kind: 'image' };
}
