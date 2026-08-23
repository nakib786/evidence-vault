/**
 * How to describe a vault entry's timestamp proof, in one place — the list and the detail
 * screen both need this and must never disagree with each other.
 */
import { confirmedBlockHeights } from './ots';
import type { VaultRecord } from './types';

export interface ProofStatus {
  tone: 'affirm' | 'caution' | 'info';
  label: string;
  detail: string;
}

export function describeProofStatus(entry: VaultRecord): ProofStatus {
  const { record, isDemo, demoConfirmedHeight } = entry;

  if (!record.proof) {
    return {
      tone: 'caution',
      label: 'No timestamp',
      detail: 'This record has a fingerprint but no timestamp proof attached.',
    };
  }

  if (isDemo) {
    return demoConfirmedHeight
      ? {
          tone: 'affirm',
          label: `Confirmed — demo block #${demoConfirmedHeight}`,
          detail:
            'Demo data. This block height is fabricated to show what a confirmed record looks like — ' +
            'it was never submitted to a real calendar and cannot be verified with real OpenTimestamps tooling.',
        }
      : {
          tone: 'caution',
          label: 'Pending — demo',
          detail: 'Demo data. This status is illustrative and was never submitted to a real calendar.',
        };
  }

  try {
    const heights = confirmedBlockHeights(record.proof.ots);
    if (heights.length > 0) {
      return {
        tone: 'affirm',
        label: `Confirmed on Bitcoin block #${heights[0]}`,
        detail: 'Independently verifiable with the standard OpenTimestamps tooling — see the export screen.',
      };
    }
  } catch {
    // Falls through to the pending/submitted read below.
  }

  return record.proof.pendingUris.length > 0
    ? {
        tone: 'caution',
        label: 'Pending confirmation',
        detail: 'Submitted to the calendars; confirmation usually completes within a few hours.',
      }
    : {
        tone: 'info',
        label: 'Submitted',
        detail: 'A fingerprint was submitted, with no calendar left pending in the saved proof.',
      };
}
