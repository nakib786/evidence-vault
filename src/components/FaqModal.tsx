/**
 * Frequently asked questions.
 *
 * The rest of the app explains itself one screen at a time, in the order someone actually
 * moves through it. This is the opposite: everything in one place, for the moment someone
 * stops and asks "wait, what does that actually mean?" — most often about fingerprinting,
 * which sounds simple and is not, or about "blockchain," which sounds complicated and
 * barely matters here. Both get answered in plain language, with no assumption that the
 * reader has ever written code or opened a terminal.
 *
 * Built as a set of native `<details>` disclosures rather than the app's own accordion,
 * because there isn't one — `<details>`/`<summary>` gets keyboard support, screen-reader
 * semantics and open/close state for free, which matters here more than usual: this is the
 * one screen aimed squarely at someone who isn't comfortable with technology.
 */
import type { ReactNode } from 'react';
import Modal from './Modal';
import { Button } from './ui';

interface FaqItem {
  q: string;
  a: ReactNode;
}

interface FaqCategory {
  title: string;
  items: FaqItem[];
}

const FAQ: FaqCategory[] = [
  {
    title: 'The basics',
    items: [
      {
        q: 'What is Evidence Vault?',
        a: (
          <>
            A tool that helps you keep a record of hate speech — a post, a video, a photo — in a
            way other people can trust later, even after the original has been deleted. It
            fingerprints your file, timestamps that fingerprint on a public record nobody can
            quietly edit, and helps you find who to report it to. All of it runs on your own
            device.
          </>
        ),
      },
      {
        q: 'Who is this for?',
        a: (
          <>
            Anyone who has seen or experienced hate speech and wants proof of it before it
            disappears. You do not need any technical background. If you can take a photo on a
            phone, you can use this.
          </>
        ),
      },
      {
        q: 'Do I need an account, or to pay for anything?',
        a: <>No. There is no sign-up and no payment. Open the page and start.</>,
      },
      {
        q: 'Do I need to understand hashes, fingerprints or blockchains to use it?',
        a: (
          <>
            No — all of that happens automatically in the background while you use the app
            normally. This page exists for anyone curious about what is happening behind the
            scenes, not because you need to know it.
          </>
        ),
      },
    ],
  },
  {
    title: 'Fingerprinting, slowly — the confusing part',
    items: [
      {
        q: 'What does "fingerprinting" a file actually mean?',
        a: (
          <>
            Think of it like a wax seal, not a real fingerprint. The app runs your file through a
            well-known public formula, called SHA-256, that turns it into a short code: 64
            letters and numbers, always exactly that length, no matter whether the file is a
            small photo or a long video. That code is what we call the file&rsquo;s
            &ldquo;fingerprint.&rdquo;
          </>
        ),
      },
      {
        q: 'Why does changing one pixel change the whole fingerprint?',
        a: (
          <>
            That is the formula doing its job. SHA-256 is built so that even the smallest
            change — one pixel, one extra space in a caption — produces a totally different
            code, in a way nobody can predict in advance. That is exactly what makes it useful:
            if a file&rsquo;s fingerprint no longer matches the one on record, you know
            something in the file changed.
          </>
        ),
      },
      {
        q: 'Can someone use the fingerprint to get my file back?',
        a: (
          <>
            No, and this is the part that trips most people up — &ldquo;fingerprint&rdquo; makes
            it sound reversible, the way a real fingerprint could theoretically be traced back to
            a hand. It cannot work that way. The formula only runs in one direction: file in,
            code out. There is no way, and there will never be a way, to turn that 64-character
            code back into your photo or video. That is exactly why it is safe to send the
            fingerprint to a public server while your actual file never leaves your device.
          </>
        ),
      },
      {
        q: 'So what actually gets sent off my device?',
        a: (
          <>
            Only that code — 32 bytes, 64 characters. Not your photo, not your video, not your
            written notes, not any text read off an image. On its own, that code does not reveal
            what your file shows, who is in it, or anything else about it.
          </>
        ),
      },
      {
        q: 'Could two different files ever end up with the same fingerprint by accident?',
        a: (
          <>
            In practice, no. The odds are so small they are not worth worrying about — this is
            the same fingerprinting technology banks and software companies rely on to detect
            tampering in files that matter.
          </>
        ),
      },
    ],
  },
  {
    title: 'The timestamp, and the blockchain part',
    items: [
      {
        q: 'What does "registered on a blockchain" mean, and do I need cryptocurrency?',
        a: (
          <>
            No cryptocurrency is ever bought, sold or held — not by you, not by the app. Think of
            a blockchain, here, as a public noticeboard that thousands of independent computers
            each keep their own copy of, so no single person can sneak back and quietly edit an
            old entry. The app writes your fingerprint to that noticeboard using free public
            services. After that, anyone — including someone who has never heard of this app —
            can check that your exact fingerprint existed by a certain date, and nobody can
            change that record afterwards, including us.
          </>
        ),
      },
      {
        q: 'Why does the timestamp take a few hours to confirm?',
        a: (
          <>
            The public ledger only writes new entries in occasional batches, not instantly. Your
            fingerprint is submitted the moment you capture something, but it has to wait its
            turn for the next batch. Until then it shows as &ldquo;pending,&rdquo; and you can
            check back later — including from the vault — to see once it has confirmed.
          </>
        ),
      },
      {
        q: 'What is OpenTimestamps?',
        a: (
          <>
            The open, independent standard the app uses to do this timestamping. Nobody owns or
            controls it, which is the point: your proof stays checkable by anyone, with free
            tools, forever — even if this app and the people who built it are long gone.
          </>
        ),
      },
      {
        q: 'What if the timestamp servers are unreachable when I capture something?',
        a: (
          <>
            The app tells you plainly rather than pretending everything went through, and keeps
            going with the fingerprint alone. A record with just a fingerprint and no timestamp
            yet is still real and still useful — you can complete the timestamp later.
          </>
        ),
      },
    ],
  },
  {
    title: 'Privacy — what actually leaves your device',
    items: [
      {
        q: 'Does this app upload my photos, videos or notes anywhere?',
        a: (
          <>
            No. Never. Your file, your written notes, and any text read off an image all stay on
            your device the entire time. The only thing that ever leaves is the 32-byte
            fingerprint described above.
          </>
        ),
      },
      {
        q: 'Is there tracking, analytics, or an account system watching what I do?',
        a: (
          <>
            None of that exists here. No analytics, no accounts, no database anywhere. The app
            does not know who you are and is not trying to find out.
          </>
        ),
      },
      {
        q: 'What happens if I just close the tab?',
        a: (
          <>
            By default, everything is gone — completely, immediately, and with no way to get it
            back. That is intentional, not a bug: nothing is kept unless you deliberately choose
            to keep it, which is what the vault (below) is for.
          </>
        ),
      },
      {
        q: 'Is anything I write shared automatically with anyone?',
        a: (
          <>
            No. Nothing is ever sent anywhere without you choosing to export it and send it
            yourself. You decide exactly what goes out and to whom.
          </>
        ),
      },
    ],
  },
  {
    title: 'The vault',
    items: [
      {
        q: 'What is "the vault" for?',
        a: (
          <>
            An optional way to keep a record on your own device so you can come back to it —
            check whether the timestamp has confirmed, or download the files again to send to a
            different person or agency — without starting the whole capture process over.
          </>
        ),
      },
      {
        q: 'Is the vault actually secure?',
        a: (
          <>
            Yes. It is locked behind a PIN, and everything inside is encrypted — scrambled with a
            key generated from that PIN — before anything touches your browser&rsquo;s storage.
            Someone who somehow got at the raw storage would see scrambled data, not your files.
          </>
        ),
      },
      {
        q: 'I can see the PIN printed right on the lock screen — is that a mistake?',
        a: (
          <>
            No, that is deliberate for this hackathon build: the demo PIN is shown openly and
            labelled as exactly that — not real security, just a way to see how the vault behaves
            without inventing a PIN to test with. A real release would have you set your own
            private PIN the first time, and never publish a default.
          </>
        ),
      },
      {
        q: 'Can I delete something from the vault?',
        a: (
          <>
            Yes, any time, with one button. That removes the copy on this device only — it cannot
            unsend anything you have already shared elsewhere, and it cannot be undone.
          </>
        ),
      },
    ],
  },
  {
    title: 'Exporting and reporting it',
    items: [
      {
        q: 'What do I actually get when I export a record?',
        a: (
          <>
            A package: a PDF report, your original file, the timestamp proof file, a cover
            letter, and — if you choose to generate one — a certificate of authenticity. All
            saved straight to your own device, nowhere else.
          </>
        ),
      },
      {
        q: 'Does the app report this to the police for me?',
        a: (
          <>
            No — and it says so honestly rather than pretending otherwise. There is no official
            system any app can plug into to file a report with police or a court in the US or
            Canada. Instead it shows you who actually takes these reports where you live, and
            how — phone, an online form, or in person — so you are not guessing or filling out a
            form that does not exist.
          </>
        ),
      },
      {
        q: 'What is the "certificate of authenticity," and do I need a lawyer for it?',
        a: (
          <>
            A document, written to match real evidence rules in the US (Federal Rules of Evidence
            902(13)/(14)) or Canada (Canada Evidence Act ss.&nbsp;31.1&ndash;31.3), that lets
            someone argue your file is genuine and unaltered without you testifying about it in
            person. You print and sign it yourself. It is a template, not legal advice, and says
            so on the document itself — a lawyer should still review it.
          </>
        ),
      },
      {
        q: 'What languages can it read text in, and does that leave my device?',
        a: (
          <>
            English, Arabic and Urdu, using on-device text recognition. &ldquo;On-device&rdquo;
            means exactly that: the reading happens on your device too, so nothing about the
            image is sent anywhere to do it.
          </>
        ),
      },
    ],
  },
  {
    title: 'What this proves, what it does not, and why it matters',
    items: [
      {
        q: 'Will this hold up in court?',
        a: (
          <>
            It proves two specific, real things: this exact file existed no later than a given
            date, and it has not been changed since. It does not prove the content is true, who
            posted it, or their intent, and it is not a legal conclusion. Treat it as strong
            supporting evidence, not a verdict — courts in both the US and Canada have rules built
            almost exactly around this kind of proof, which is what the certificate above is
            written to.
          </>
        ),
      },
      {
        q: 'If one report rarely changes anything by itself, why bother?',
        a: (
          <>
            Because patterns are what actually move a platform, a police force or a court — and a
            pattern is built out of individual incidents that each hold up on their own. One
            verifiable record, added to others, is what turns &ldquo;someone said this
            happened&rdquo; into something an organisation can act on. That is the whole goal
            here: making each individual record strong enough to be worth keeping.
          </>
        ),
      },
      {
        q: 'Can I check a record without this app, later — even years from now?',
        a: (
          <>
            Yes, and that is the point. Verification uses the free, public, standard
            OpenTimestamps tool, not anything belonging to this app. Your proof stays checkable
            even if this project is never touched again.
          </>
        ),
      },
      {
        q: 'What is still missing, or planned next?',
        a: (
          <>
            This is a working early prototype, not a finished product — the fingerprinting and
            timestamps are real, not mocked, but there is more planned: a browser extension that
            captures a post along with its real metadata, native phone apps for faster capture,
            and a version that does not visibly announce itself as a reporting tool on someone&rsquo;s
            home screen.
          </>
        ),
      },
    ],
  },
];

export function FaqModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Questions people ask"
      eyebrow="FAQ"
      labelId="faq-modal-title"
      actions={
        <Button className="sm:flex-1" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-7">
        <p className="text-sm text-ink-muted">
          Tap a question to open it. Nothing here is required reading — the app works the same
          whether or not you ever open this.
        </p>

        {FAQ.map((category) => (
          <section key={category.title}>
            <h3 className="mb-2.5 font-display text-xs font-bold uppercase tracking-wider text-accent">
              {category.title}
            </h3>
            <div className="space-y-2">
              {category.items.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-xl border border-line bg-sunken/60 open:bg-sunken"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3 font-display text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
                    <span>{item.q}</span>
                    <span
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-base font-bold leading-none text-ink-subtle transition-transform duration-150 group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <div className="px-4 pb-4 text-sm leading-relaxed text-ink-muted">{item.a}</div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}
