/**
 * The guided walkthrough.
 *
 * Steps are grouped by screen rather than defined as one flat list, because the tour has
 * to survive the app changing screens underneath it. When one section runs out of steps,
 * `useTour` hands control back to the app (see `App.tsx`'s `advanceDemo`), which drives
 * the real state machine one step further — captures a sample file, fills in a jurisdiction,
 * unlocks the vault with the published demo PIN, and so on. That state change is what
 * actually moves the tour to the next section; the tour itself only ever narrates whatever
 * screen is really on screen, never a mock of it.
 *
 * Every step is skippable and skipping is a first-class action, not a greyed-out "no
 * thanks". Someone who opened this app in a bad moment should not have to sit through a
 * product tour to document what happened to them.
 */
import type { Step } from './types';

/**
 * How long each step dwells before autoplay moves on. Shared with `App.tsx`, which uses
 * the same number to hold the 'process' section open for at least this long — real
 * fingerprinting and timestamping usually finish in a couple of seconds, far faster than
 * this, and letting the screen change the moment they do cuts that step short for anyone
 * watching the tour rather than driving it by hand.
 */
export const AUTOPLAY_MS = 25_000;

/**
 * Every screen the tour can narrate. `Step` covers the main capture-to-export flow; the
 * vault is reached separately (via the header button, not the step machine). It gets four
 * sections rather than one, because "locked", "unlocked but empty", "unlocked with
 * records", and "one open record" are each a different set of elements on screen — the
 * same reason the main flow is split by `Step` instead of being one long section.
 *
 * `'verify'` is its own section for the same reason: the standalone verify page is reached
 * from the header too, and its elements only exist while it's the screen actually on
 * screen. It's also where the walkthrough ends — see `App.tsx`'s `advanceDemo`.
 */
export type TourSection = Step | 'vault-locked' | 'vault-empty' | 'vault-list' | 'vault-record' | 'verify';

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

export const TOUR_STEPS: Record<TourSection, TourStep[]> = {
  capture: [
    {
      anchor: '[data-tour="capture-live"]',
      title: 'One camera, photo or video',
      description:
        'Open it once and switch between the two — a photo for a screen, a poster, or graffiti; ' +
        'video with sound for anything spoken, like a confrontation or abuse shouted at someone. ' +
        'You can add more than one to a single report, and each is fingerprinted the instant you ' +
        'capture it.',
    },
    {
      anchor: '[data-tour="capture-upload"]',
      title: 'Or use something you already have',
      description:
        'A screenshot from earlier works fine. The report will note that the file existed before ' +
        'the app saw it, so nobody is misled about what the proof covers.',
    },
  ],
  review: [
    {
      anchor: '[data-tour="item-status"]',
      title: 'Fingerprinted the instant you captured it',
      description:
        'No separate loading screen — your file gets a SHA-256 fingerprint and a timestamp ' +
        'request in the background the moment the shutter fires. Change one pixel later and the ' +
        'fingerprint changes completely, which is what makes tampering visible.',
    },
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
    {
      anchor: '[data-tour="export-vault-save"]',
      title: 'Kept for you, by default',
      description:
        'A copy is also saved to your on-device vault automatically the moment you arrive here — ' +
        'no extra click. Change your mind and removing it is one tap, no questions asked.',
    },
  ],
  'vault-locked': [
    {
      anchor: '[data-tour="vault-unlock"]',
      title: 'Locked with a PIN',
      description:
        'Records you choose to keep live here, encrypted at rest with a key derived from this ' +
        'PIN. Locking the vault drops that key from memory, so what sits in browser storage is ' +
        'ciphertext, not your files.',
    },
  ],
  'vault-empty': [
    {
      anchor: '[data-tour="vault-demo"]',
      title: 'Nothing real to show you',
      description:
        'This hackathon build cannot be tested against real hateful content, so the vault starts ' +
        'empty. Load three synthetic demo records to see how a saved record actually behaves.',
    },
  ],
  'vault-list': [
    {
      anchor: '[data-tour="vault-entries"]',
      title: 'Every record you have kept',
      description:
        'One card per record, with its timestamp status at a glance — pending, confirmed, or a ' +
        'demo that was never sent anywhere real. Tap one to open it.',
    },
    {
      anchor: '[data-tour="vault-duress"]',
      title: 'A second PIN, for being forced to open it',
      description:
        'Set a duress PIN here and entering it on the lock screen opens a decoy vault of demo ' +
        'records instead of what you actually saved. Your real entries stay encrypted and ' +
        'untouched the whole time — a duress unlock never reads, decrypts, or even looks at them.',
    },
  ],
  'vault-record': [
    {
      anchor: '[data-tour="vault-preview"]',
      title: 'Still blurred in here',
      description:
        'Saving something to the vault does not change how it is shown. It stays blurred until ' +
        'you choose to look, same as the moment you first captured it.',
    },
    {
      anchor: '[data-tour="vault-verify"]',
      title: 'Watches the calendars for you',
      description:
        'This re-checks automatically every few minutes and shows real queue and batching data ' +
        'from the calendars while you wait, so there is nothing to click. The same check — just ' +
        'the file and its proof, no vault needed — also runs on the verify page.',
    },
    {
      anchor: '[data-tour="downloads"]',
      title: 'Download it again',
      description:
        'Regenerated fresh from what is saved here, as many times as you need — once for the ' +
        'platform, again for a lawyer, again for the police — without repeating capture.',
    },
    {
      anchor: '[data-tour="vault-remove"]',
      title: 'Remove it, if you need to',
      description:
        'This only deletes the copy on this device. It does not unsend anything you already ' +
        'shared, and it cannot be undone.',
    },
  ],
  verify: [
    {
      anchor: '[data-tour="verify-upload"]',
      title: 'Check any file and proof, on their own',
      description:
        'No vault, no account — upload a file and its .ots proof and this checks them against ' +
        'each other right here, entirely in the browser. Works for any record from this app, or ' +
        'any standard OpenTimestamps proof from somewhere else.',
    },
  ],
};

const INTRO_HIDDEN_KEY = 'evidence-vault:intro-hidden';

/**
 * Whether the welcome sequence (intro slideshow, then the tour offer) should stay off.
 *
 * The default is to show it every session — someone documenting something is unlikely to
 * remember a dialog from a previous visit, and the stakes of not knowing what this tool
 * does are higher than the mild friction of seeing the intro again. The only way this ever
 * returns true is the explicit "Don't show this again" checkbox in the intro dialog; there
 * is no implicit "seen once" tracking. Wrapped in try/catch because storage throws outright
 * in some private-browsing modes, and a disabled storage API should cost the user a
 * repeated dialog, not a broken app.
 */
export function isIntroHidden(): boolean {
  try {
    return localStorage.getItem(INTRO_HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function setIntroHidden(hidden: boolean): void {
  try {
    if (hidden) {
      localStorage.setItem(INTRO_HIDDEN_KEY, '1');
    } else {
      localStorage.removeItem(INTRO_HIDDEN_KEY);
    }
  } catch {
    /* storage unavailable — the intro simply shows again next time, which is the default anyway */
  }
}
