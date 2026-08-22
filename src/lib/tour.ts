/**
 * The guided walkthrough.
 *
 * Steps are grouped by screen rather than defined as one flat list, because the tour has
 * to survive the app changing screens underneath it. When the step changes, the runner
 * tears down the previous popover set and starts the next one, so the tour narrates the
 * real application rather than a mock of it.
 *
 * Every step is skippable and skipping is a first-class action, not a greyed-out "no
 * thanks". Someone who opened this app in a bad moment should not have to sit through a
 * product tour to document what happened to them.
 */
import type { Step } from './types';

export interface TourStep {
  /**
   * `[data-tour="..."]` value. Always a real element, never null.
   *
   * driver.js handles an elementless step by appending a hidden dummy node to the end of
   * `<body>` and scrolling to it, which shoved the popover to the bottom edge of the
   * viewport and jumped the page. Anchoring every step to something actually on screen
   * avoids that entirely — and the two welcome dialogs already cover the "what is this"
   * ground a centred intro step used to.
   */
  anchor: string;
  title: string;
  description: string;
}

export const TOUR_STEPS: Record<Step, TourStep[]> = {
  capture: [
    {
      anchor: '[data-tour="capture-video"]',
      title: 'Record what is happening',
      description:
        'For anything spoken: abuse in the street, a confrontation, someone shouting at a person ' +
        'in a shop. It records sound as well as picture, because the words are usually what ' +
        'matters. The file is fingerprinted the moment you stop.',
    },
    {
      anchor: '[data-tour="capture-photo"]',
      title: 'Or photograph it',
      description:
        'For a screen, a poster, or graffiti. Taking it through the app is the stronger record. ' +
        'The image is fingerprinted before it becomes a file that anyone could edit.',
    },
    {
      anchor: '[data-tour="capture-upload"]',
      title: 'Or use something you already have',
      description:
        'A screenshot from earlier works fine. The report will note that the file existed before ' +
        'the app saw it, so nobody is misled about what the proof covers.',
    },
  ],
  process: [
    {
      anchor: '[data-tour="securing"]',
      title: 'Fingerprinting',
      description:
        'Your file gets a SHA-256 fingerprint, a short code worked out from its exact contents. ' +
        'Change one pixel and the code changes completely. That is what makes tampering visible.',
    },
  ],
  review: [
    {
      anchor: '[data-tour="evidence-preview"]',
      title: 'Blurred on purpose',
      description:
        'You just captured something aimed at you or your community. You should not have to look ' +
        'at it again to finish the record, so it stays blurred until you decide otherwise.',
    },
    {
      anchor: '[data-tour="classification"]',
      title: 'You describe it, not an algorithm',
      description:
        'There is no AI classifier here. You saw it, so you are better placed to categorise it ' +
        'than a model would be. Nothing you write is sent anywhere to be analysed.',
    },
    {
      anchor: '[data-tour="proof"]',
      title: 'Your proof',
      description:
        'Only the fingerprint leaves your device, to public timestamp servers that register it on ' +
        'a public blockchain ledger. It cannot be turned back into your file or reveal anything ' +
        'about it, and no cryptocurrency is bought, sold or held.',
    },
  ],
  handover: [
    {
      anchor: '[data-tour="jurisdiction"]',
      title: 'Where you are',
      description:
        'Reporting routes differ by country and by city. Tell us where you are and we will show ' +
        'who actually takes these reports near you.',
    },
    {
      anchor: '[data-tour="agencies"]',
      title: 'Who to contact, and how',
      description:
        'Most police services have no online hate-crime form. The real route is often a phone ' +
        'call. Each entry shows its actual channels so you do not spend time on one that does ' +
        'not exist.',
    },
    {
      anchor: '[data-tour="certificate"]',
      title: 'For a lawyer or a court',
      description:
        'You can generate a certificate of authenticity written to the rules of evidence where ' +
        'you are, so a lawyer can adopt it instead of starting from scratch.',
    },
  ],
  export: [
    {
      anchor: '[data-tour="downloads"]',
      title: 'Your files',
      description:
        'Save these somewhere you trust. Keep the original and its proof file together and ' +
        'unedited. That pairing is what anyone can verify later, without needing this app at all.',
    },
  ],
};

export const TOUR_STORAGE_KEY = 'evidence-vault:tour-seen';

/**
 * Whether to offer the tour automatically.
 *
 * This reads and writes exactly one boolean in localStorage and nothing else. It records
 * that a tour was shown — never what was captured, reported, or written. Wrapped in
 * try/catch because storage throws outright in some private-browsing modes, and a
 * disabled storage API should cost the user a repeated tour, not a broken app.
 */
export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** True when the walkthrough has never been offered on this device. */
export const tourNotYetSeen = (): boolean => !hasSeenTour();

export function markTourSeen(): void {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, '1');
  } catch {
    /* storage unavailable — the tour simply offers itself again next time */
  }
}
