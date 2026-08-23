/**
 * The two-step welcome: what this is, then an offer of the walkthrough.
 *
 * Split into two dialogs on purpose. DESIGN.md asks for one decision per screen, and
 * "here is what this tool does" and "do you want a tour" are genuinely different
 * questions. Stacking them into one wall of text would be the exact cognitive load the
 * brief warns against.
 *
 * The intro itself is paginated for the same reason: one slide, one idea, rather than a
 * single dialog someone has to scroll through to find out whether it's worth reading. It
 * shows on every session by default — the "Don't show this again" checkbox is the only
 * thing that ever turns it off, and that's a choice the person makes, not a side effect of
 * having clicked through it once before.
 *
 * The figures quoted here are real and sourced, and they are the point rather than
 * decoration: a reader has about fifteen seconds to decide whether this is worth their
 * time, and a number they can check does that better than an adjective.
 *
 * Both dialogs are dismissible by Escape and by an explicit button, so someone who opened
 * this app mid-crisis can be documenting within one keystroke. The intro's backdrop click is
 * turned off deliberately: paging through several slides means several chances to misclick
 * outside the dialog, and losing the whole walkthrough to that would be worse than the mild
 * inconsistency of one dialog behaving differently from the other.
 */
import { useEffect, useState, type ReactNode } from 'react';
import Modal from './Modal';
import { Button } from './ui';

interface Slide {
  eyebrow: string;
  title: string;
  content: ReactNode;
}

const SLIDES: Slide[] = [
  {
    eyebrow: 'Why this exists',
    title: 'Evidence that holds up',
    content: (
      <div className="space-y-6">
        <figure className="border-l-[3px] border-accent pl-4">
          <p className="font-display text-3xl font-bold leading-none text-ink">Over half</p>
          <p className="mt-1.5 text-sm text-ink-muted">
            of hate crimes in the United States are never reported to police.
          </p>
          <figcaption className="mt-1 text-xs text-ink-subtle">
            US Bureau of Justice Statistics
          </figcaption>
        </figure>
        <p className="text-ink-muted">
          A common reason people give is that reporting will not lead to anything. Evidence is
          part of that. Posts get deleted. A screenshot proves nothing by itself, because anyone
          can make one in an image editor. Video sits on a phone until the phone is gone.
        </p>
      </div>
    ),
  },
  {
    eyebrow: 'What it does — 1 of 3',
    title: 'Capture, then fingerprint',
    content: (
      <ol className="space-y-3">
        <Step n={1}>
          Records video with sound, takes a photo, or imports a file you already have.
        </Step>
        <Step n={2}>
          Fingerprints the file with SHA-256 the moment it arrives. Change one pixel or one frame
          and the fingerprint no longer matches.
        </Step>
        <Step n={3}>
          Registers that fingerprint on a public blockchain ledger, which fixes the date beyond
          argument. No cryptocurrency is bought, sold or held. The ledger is used only as a
          noticeboard that nobody can edit after the fact.
        </Step>
      </ol>
    ),
  },
  {
    eyebrow: 'What it does — 2 of 3',
    title: 'Read, route, and export',
    content: (
      <ol className="space-y-3">
        <Step n={4}>Reads text out of an image in English, Arabic or Urdu, on your device.</Step>
        <Step n={5}>
          Shows who takes these reports where you live, and whether they take them by phone,
          online, or in person.
        </Step>
        <Step n={6}>
          Exports the report, the original file, the proof, a cover letter, and a certificate of
          authenticity written to your jurisdiction&rsquo;s rules of evidence.
        </Step>
      </ol>
    ),
  },
  {
    eyebrow: 'What it does — 3 of 3',
    title: 'Or save it to your vault',
    content: (
      <div className="space-y-3">
        <p className="text-ink-muted">
          From the export screen you can also keep a record on this device instead of, or as
          well as, exporting it: a PIN-locked vault, encrypted with a key derived from that PIN.
          The browser&rsquo;s own storage holds ciphertext, not your files.
        </p>
        <p className="text-ink-muted">
          Locking the vault drops that key from memory. Useful if you&rsquo;re documenting more
          than one incident and want a running record you can come back to, without exporting
          and re-importing files by hand each time.
        </p>
      </div>
    ),
  },
  {
    eyebrow: 'Why it matters',
    title: 'One record rarely moves anything',
    content: (
      <div className="space-y-3">
        <p className="text-ink-muted">
          CAIR logged <strong className="font-semibold text-ink">8,683 complaints in 2025</strong>,
          the most since it started counting in 1996. What moves a platform, a police force or a
          court is rarely one screenshot. It is a pattern built from many incidents that each hold
          up on their own.
        </p>
        <p className="text-ink-muted">
          Anyone can check a record made here using standard, publicly available tools. That stays
          true if this project is never touched again.
        </p>
      </div>
    ),
  },
  {
    eyebrow: 'Privacy',
    title: 'Your evidence stays here',
    content: (
      <section className="rounded-xl bg-sunken p-4">
        <p className="text-sm text-ink-muted">
          The file never leaves your device. The only thing sent anywhere is the fingerprint: 64
          characters of hex that cannot be turned back into your file or reveal what it shows.
          There is no account and no database.
        </p>
      </section>
    ),
  },
  {
    eyebrow: 'Please note',
    title: 'This is a working prototype',
    content: (
      <section className="rounded-xl border border-caution/30 bg-caution-soft p-4">
        <p className="text-sm text-ink-muted">
          What you are about to use genuinely works. The fingerprinting, the timestamps and the
          exports are real, not mocked. It is an early build, and the full product is planned to
          go further:
        </p>
        <ul className="mt-3 space-y-2.5 text-sm text-ink-muted">
          <Planned title="A browser extension">
            Capture a post from the platform together with the live metadata behind it: author
            handle, post ID, server timestamps, the page as it was actually served. That is
            stronger than a photograph of a screen.
          </Planned>
          <Planned title="Native Android and iOS apps">
            Faster capture from the lock screen, long recordings handled properly, and camera
            metadata a browser cannot reach.
          </Planned>
          <Planned title="An app that does not look like one">
            A changeable icon and name on mobile, so it does not announce itself on your home
            screen. For someone documenting a person they live or work with, that is a safety
            requirement.
          </Planned>
        </ul>
      </section>
    ),
  },
];

export function IntroModal({
  open,
  onContinue,
  onDismiss,
  dontShowAgain,
  onDontShowAgainChange,
}: {
  open: boolean;
  onContinue: () => void;
  onDismiss: () => void;
  dontShowAgain: boolean;
  onDontShowAgainChange: (value: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const lastIndex = SLIDES.length - 1;
  const isLast = index === lastIndex;

  // Start from the first slide every time the dialog opens, rather than wherever a
  // previous pass through it left off.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, lastIndex));
      if (event.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, lastIndex]);

  const slide = SLIDES[index];

  return (
    <Modal
      open={open}
      onClose={onDismiss}
      title={slide.title}
      eyebrow={slide.eyebrow}
      labelId="intro-modal-title"
      dismissOnBackdropClick={false}
      actions={
        <>
          <Button
            className="sm:flex-1"
            onClick={() => (isLast ? onContinue() : setIndex((i) => Math.min(i + 1, lastIndex)))}
          >
            {isLast ? 'Continue' : 'Next'}
          </Button>
          {index > 0 ? (
            <Button
              variant="quiet"
              className="sm:flex-1"
              onClick={() => setIndex((i) => Math.max(i - 1, 0))}
            >
              Back
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <SlideProgress current={index} total={SLIDES.length} />
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-xs font-semibold text-ink-muted hover:bg-sunken hover:text-ink"
          >
            Skip
          </button>
        </div>

        <p className="sr-only" aria-live="polite">
          Slide {index + 1} of {SLIDES.length}: {slide.title}
        </p>

        {slide.content}
      </div>

      {isLast ? (
        <div className="mt-6 border-t border-line pt-4">
          <label className="flex items-center gap-2.5 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(event) => onDontShowAgainChange(event.target.checked)}
              className="size-4 rounded border-line-strong [accent-color:var(--color-accent)]"
            />
            Don&rsquo;t show this again
          </label>
        </div>
      ) : null}
    </Modal>
  );
}

/** Slim progress bars, one per slide — the same visual language as the app's own step indicator. */
function SlideProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex flex-1 items-center gap-1.5" role="presentation">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`h-1.5 flex-1 rounded-full ${i <= current ? 'bg-accent' : 'bg-line'}`}
        />
      ))}
    </div>
  );
}

export function TourModal({
  open,
  onStart,
  onSkip,
}: {
  open: boolean;
  onStart: () => void;
  onSkip: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onSkip}
      title="Want a quick look around?"
      labelId="tour-modal-title"
      actions={
        <>
          <Button className="sm:flex-1" onClick={onStart}>
            Show me around
          </Button>
          <Button variant="quiet" className="sm:flex-1" onClick={onSkip}>
            No thanks, I&rsquo;ll start
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-ink-muted">
          It plays through the whole app on its own, end to end — using a sample file so you
          don&rsquo;t have to record or upload anything — moving on every ten seconds. Pause it,
          or stop at any point; nothing it does is kept.
        </p>

        <ol className="space-y-2.5">
          {[
            ['Capture', 'Record video with sound, take a photo, or use a file you already have.'],
            ['Secure', 'Your file is fingerprinted and the date is registered.'],
            ['Review', 'Add context. The content stays blurred unless you choose to look.'],
            ['Send', 'See who takes these reports where you live, and how they take them.'],
            ['Export', 'Save the package. Nothing is kept here.'],
            ['Vault', 'Unlocks it, loads a few sample records, and opens one to show it off.'],
          ].map(([name, detail], i) => (
            <li key={name} className="flex gap-3">
              <Marker n={i + 1} />
              <p className="text-sm text-ink-muted">
                <span className="font-display font-semibold text-ink">{name}.</span> {detail}
              </p>
            </li>
          ))}
        </ol>

        <p className="text-sm text-ink-subtle">
          You can start this again any time from &ldquo;How it works&rdquo; at the top of the page —
          it picks up from wherever you are, and carries on through the rest by itself.
        </p>
      </div>
    </Modal>
  );
}

/**
 * A plain numeral, not a circle-in-a-tinted-disc — that badge is template furniture that
 * shows up identically on every "three easy steps" landing page regardless of what the
 * steps are. A tabular numeral read like a clause in a document fits a project whose whole
 * point is a paper trail, and it says the same thing with one less shape to render.
 */
function Marker({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 w-6 shrink-0 border-r-2 border-accent-soft pr-1.5 font-display text-sm font-bold tabular-nums text-accent"
    >
      {String(n).padStart(2, '0')}
    </span>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <Marker n={n} />
      <p className="text-sm text-ink-muted">{children}</p>
    </li>
  );
}

function Planned({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-caution" />
      <span>
        <span className="font-semibold text-ink">{title}.</span> {children}
      </span>
    </li>
  );
}
