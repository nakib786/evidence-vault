/**
 * The two-step welcome: what this is, then an offer of the walkthrough.
 *
 * Split into two dialogs on purpose. DESIGN.md asks for one decision per screen, and
 * "here is what this tool does" and "do you want a tour" are genuinely different
 * questions. Stacking them into one wall of text would be the exact cognitive load the
 * brief warns against.
 *
 * The figures quoted here are real and sourced, and they are the point rather than
 * decoration: a reader has about fifteen seconds to decide whether this is worth their
 * time, and a number they can check does that better than an adjective.
 *
 * Both dialogs are dismissible by Escape, by the backdrop, and by an explicit button.
 * Someone who opened this app mid-crisis can be documenting within one keystroke.
 */
import type { ReactNode } from 'react';
import Modal from './Modal';
import { Button } from './ui';

export function IntroModal({
  open,
  onContinue,
  onDismiss,
}: {
  open: boolean;
  onContinue: () => void;
  onDismiss: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onDismiss}
      title="Evidence that holds up"
      labelId="intro-modal-title"
      actions={
        <>
          <Button className="sm:flex-1" onClick={onContinue}>
            Continue
          </Button>
          <Button variant="quiet" className="sm:flex-1" onClick={onDismiss}>
            Skip, take me to the app
          </Button>
        </>
      }
    >
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
          A common reason people give is that reporting will not lead to anything. Evidence is part
          of that. Posts get deleted. A screenshot proves nothing by itself, because anyone can make
          one in an image editor. Video sits on a phone until the phone is gone.
        </p>

        <section>
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-ink">
            What it does
          </h3>
          <ol className="mt-3 space-y-3">
            <Step n={1}>
              Records video with sound, takes a photo, or imports a file you already have.
            </Step>
            <Step n={2}>
              Fingerprints the file with SHA-256 the moment it arrives. Change one pixel or one
              frame and the fingerprint no longer matches.
            </Step>
            <Step n={3}>
              Registers that fingerprint on a public blockchain ledger, which fixes the date beyond
              argument. No cryptocurrency is bought, sold or held. The ledger is used only as a
              noticeboard that nobody can edit after the fact.
            </Step>
            <Step n={4}>
              Reads text out of an image in English, Arabic or Urdu, on your device.
            </Step>
            <Step n={5}>
              Shows who takes these reports where you live, and whether they take them by phone,
              online, or in person.
            </Step>
            <Step n={6}>
              Exports the report, the original file, the proof, a cover letter, and a certificate of
              authenticity written to your jurisdiction&rsquo;s rules of evidence.
            </Step>
          </ol>
        </section>

        <section>
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-ink">
            Why it matters
          </h3>
          <p className="mt-2 text-ink-muted">
            CAIR logged <strong className="font-semibold text-ink">8,683 complaints in 2025</strong>,
            the most since it started counting in 1996. What moves a platform, a police force or a
            court is rarely one screenshot. It is a pattern built from many incidents that each hold
            up on their own.
          </p>
          <p className="mt-2 text-ink-muted">
            Anyone can check a record made here using standard, publicly available tools. That stays
            true if this project is never touched again.
          </p>
        </section>

        <section className="rounded-xl bg-sunken p-4">
          <h3 className="font-display text-sm font-bold text-ink">Your evidence stays here</h3>
          <p className="mt-1.5 text-sm text-ink-muted">
            The file never leaves your device. The only thing sent anywhere is the fingerprint: 64
            characters of hex that cannot be turned back into your file or reveal what it shows.
            There is no account and no database.
          </p>
        </section>

        <section className="rounded-xl border border-caution/30 bg-caution-soft p-4">
          <h3 className="font-display text-sm font-bold text-ink">
            <span className="sr-only">Please note: </span>
            This is a working prototype
          </h3>
          <p className="mt-1.5 text-sm text-ink-muted">
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
      </div>
    </Modal>
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
          About a minute. It points things out on the page as you go, and you can stop at any point.
        </p>

        <ol className="space-y-2.5">
          {[
            ['Capture', 'Record video with sound, take a photo, or use a file you already have.'],
            ['Secure', 'Your file is fingerprinted and the date is registered.'],
            ['Review', 'Add context. The content stays blurred unless you choose to look.'],
            ['Send', 'See who takes these reports where you live, and how they take them.'],
            ['Export', 'Save the package. Nothing is kept here.'],
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
          You can reopen this any time from &ldquo;How it works&rdquo; at the top of the page.
        </p>
      </div>
    </Modal>
  );
}

function Marker({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-xs font-bold text-accent"
    >
      {n}
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
