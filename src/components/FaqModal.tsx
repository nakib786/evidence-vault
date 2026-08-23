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
 *
 * The questions themselves live in lib/faq — LiveChatBubble shows the same list.
 */
import Modal from './Modal';
import { Button } from './ui';
import { FAQ } from '../lib/faq';

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
