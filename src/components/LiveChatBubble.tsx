/**
 * A floating help bubble, docked in the corner across every screen: the same FAQ answers
 * as the header's "FAQ" link, one tap away without losing your place in the flow.
 *
 * It does not simulate a person or an AI on the other end. No typing indicator, no fake
 * "agent" name, no invented reply — that would be exactly the kind of quiet dishonesty
 * this app tries hard to avoid everywhere else (see the footer and lib/faq). What you get
 * when you open it is the static FAQ list, plainly labelled as that, plus an honest note
 * about what a real live-help version of this panel would need before it could exist.
 */
import { useEffect, useRef, useState } from 'react';
import { FAQ } from '../lib/faq';

export default function LiveChatBubble({ suppressed = false }: { suppressed?: boolean }) {
  const [open, setOpen] = useState(false);
  // The pulsing dot's whole job is to catch a first-time glance at the bubble — once
  // someone has actually opened it, it has done that job and continuing to blink would
  // just be nagging, not signalling anything new.
  const [seen, setSeen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Not a focus trap — the rest of the page stays reachable on purpose, since this is a
  // docked panel rather than a modal — just enough to land keyboard/screen-reader focus
  // somewhere sensible the moment it opens, and to let Escape close it like every other
  // dismissible surface in the app.
  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (suppressed) return null;

  return (
    <>
      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-labelledby="live-chat-title"
          className="fixed inset-x-4 bottom-24 z-40 flex max-h-[min(34rem,calc(100dvh-7rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-20px_rgb(15_23_42_/_0.35),0_4px_16px_-6px_rgb(15_23_42_/_0.18)] sm:inset-x-auto sm:bottom-28 sm:right-6 sm:w-[23rem]"
        >
          <div className="flex items-start justify-between gap-3 border-b border-line bg-accent-soft px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-white"
                aria-hidden="true"
              >
                <ChatMarkIcon />
              </span>
              <div>
                <p id="live-chat-title" className="font-display text-sm font-bold text-ink">
                  Help &amp; FAQ
                </p>
                <p className="text-xs text-ink-muted">Answers only — no one is on the other end yet</p>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close help"
              className="-m-1.5 shrink-0 rounded-lg p-1.5 text-ink-subtle hover:bg-surface hover:text-ink"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="mb-4 rounded-2xl border-2 border-accent bg-accent-soft px-4 py-4 text-sm text-ink shadow-[0_8px_24px_-10px_rgb(15_23_42_/_0.3)]">
              <p className="flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wider text-accent">
                <span aria-hidden="true">
                  <RoadmapIcon />
                </span>
                Coming next — live human help
              </p>
              <p className="mt-2 font-display text-[15px] font-bold leading-snug text-ink">
                Real people, not an AI stand-in, reachable from this same bubble.
              </p>
              <p className="mt-2 leading-relaxed text-ink-muted">
                Right now this panel only holds the FAQ below, and says so plainly rather than
                pretending otherwise. The plan is to put trained volunteers and advocates behind
                this exact spot — remote, real-time help for someone who needs it — once there
                is a way to staff and vet that safely. It fits where this is already headed:
                native iOS and Android apps, where a chat like this stays with you instead of
                living only in a browser tab.
              </p>
              <ul className="mt-3 space-y-1.5 leading-relaxed text-ink">
                <li className="flex gap-2">
                  <span aria-hidden="true" className="text-accent">•</span>
                  <span>A live handoff to a real advocate, never an AI pretending to be one</span>
                </li>
                <li className="flex gap-2">
                  <span aria-hidden="true" className="text-accent">•</span>
                  <span>A fast path to a crisis line for anyone who needs help right now</span>
                </li>
                <li className="flex gap-2">
                  <span aria-hidden="true" className="text-accent">•</span>
                  <span>Push notifications on iOS and Android when someone replies</span>
                </li>
                <li className="flex gap-2">
                  <span aria-hidden="true" className="text-accent">•</span>
                  <span>Support in more languages than the English, Arabic and Urdu the app already reads</span>
                </li>
              </ul>
            </div>

            <div className="mb-4 max-w-[92%] rounded-2xl rounded-tl-sm border border-line bg-sunken px-3.5 py-2.5 text-sm leading-relaxed text-ink-muted">
              Nobody&rsquo;s typing back here — this is the same FAQ as the header link, just
              reachable from wherever you are. Tap a question for the answer.
            </div>

            <div className="space-y-5">
              {FAQ.map((category) => (
                <section key={category.title}>
                  <h3 className="mb-2 font-display text-xs font-bold uppercase tracking-wider text-accent">
                    {category.title}
                  </h3>
                  <div className="space-y-1.5">
                    {category.items.map((item) => (
                      <details
                        key={item.q}
                        className="group rounded-xl border border-line bg-sunken/60 open:bg-sunken"
                      >
                        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-3.5 py-2.5 font-display text-[13px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                          <span>{item.q}</span>
                          <span
                            aria-hidden="true"
                            className="mt-0.5 shrink-0 text-sm font-bold leading-none text-ink-subtle transition-transform duration-150 group-open:rotate-45"
                          >
                            +
                          </span>
                        </summary>
                        <div className="px-3.5 pb-3 text-[13px] leading-relaxed text-ink-muted">
                          {item.a}
                        </div>
                      </details>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        data-tour="live-chat"
        onClick={() => {
          setOpen((v) => !v);
          setSeen(true);
        }}
        aria-expanded={open}
        aria-label={open ? 'Close help' : 'Open help and FAQ'}
        className="fixed bottom-4 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-[0_14px_32px_-10px_rgb(15_23_42_/_0.45)] transition-transform hover:scale-105 hover:bg-accent-hover active:scale-95 sm:bottom-6 sm:right-6"
      >
        {open ? <CloseIcon large /> : <ChatMarkIcon large />}
        {!open && !seen ? (
          <span className="absolute right-0.5 top-0.5 flex size-3" aria-hidden="true">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-affirm opacity-75" />
            <span className="relative inline-flex size-3 rounded-full border-2 border-canvas bg-affirm" />
          </span>
        ) : null}
      </button>
    </>
  );
}

function ChatMarkIcon({ large = false }: { large?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={large ? 'size-6' : 'size-[18px]'}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H9l-4.2 3.5a.5.5 0 0 1-.8-.4V16A2.5 2.5 0 0 1 4 13.5v-8Z" />
      <path d="M8 8.7h8M8 11.7h5" />
    </svg>
  );
}

function RoadmapIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3.5"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 2 4.5 13.5H11L10 22l9-12h-6.5z" />
    </svg>
  );
}

function CloseIcon({ large = false }: { large?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={large ? 'size-6' : 'size-4'}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
