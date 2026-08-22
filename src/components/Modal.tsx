/**
 * Modal dialog, built on the native `<dialog>` element.
 *
 * Native rather than hand-rolled deliberately. `showModal()` gives us a real focus trap,
 * Escape-to-close, an inert background and correct `aria-modal` semantics from the
 * platform — all things a bespoke implementation gets subtly wrong, and this is a project
 * where WCAG 2.2 AA is a requirement rather than an aspiration.
 *
 * Escape always closes. A dialog someone cannot dismiss is exactly the trap DESIGN.md's
 * first principle rules out.
 */
import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog. */
  title: string;
  /** Optional small line above the title. */
  eyebrow?: string;
  children: ReactNode;
  /**
   * Rendered in the sticky footer. Pass the **primary action first**: the footer stacks
   * on mobile (primary on top) and reverses on wider screens (primary on the right),
   * which is the convention in both layouts.
   */
  actions: ReactNode;
  labelId?: string;
}

export default function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  actions,
  labelId = 'modal-title',
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      // Start at the top: these dialogs can scroll, and browsers otherwise restore
      // whatever offset the previous one had.
      dialog.scrollTop = 0;
    } else if (!open && dialog.open) {
      // Safe to close outright: nothing listens for `close`, so this cannot be mistaken
      // for the user dismissing the sequence.
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    /*
     * `cancel`, not `close`.
     *
     * `cancel` fires only when the user dismisses the dialog with Escape — never for a
     * scripted `close()`. That is exactly the distinction this component needs, and it
     * means advancing from one dialog to the next cannot be mistaken for a dismissal.
     *
     * `close` is unusable for this on two counts: it carries nothing to tell a user
     * dismissal from a programmatic one, and it does not fire reliably for a scripted
     * close in every engine.
     */
    const handleCancel = () => onClose();

    // The backdrop is part of the dialog's own box, so a click landing directly on the
    // element (rather than on its content) means the backdrop was hit.
    const handleClick = (event: MouseEvent) => {
      if (event.target === dialog) onClose();
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleClick);
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleClick);
    };
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelId}
      className="ev-dialog w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink backdrop:bg-ink/45"
    >
      <div className="max-h-[min(46rem,calc(100dvh-4rem))] overflow-y-auto">
        <div className="px-6 pb-2 pt-6 sm:px-7">
          {eyebrow ? (
            <p className="mb-1.5 font-display text-xs font-bold uppercase tracking-wider text-accent">
              {eyebrow}
            </p>
          ) : null}
          <h2 id={labelId} className="font-display text-xl font-bold text-ink sm:text-2xl">
            {title}
          </h2>
        </div>

        <div className="px-6 py-3 sm:px-7">{children}</div>

        <div className="sticky bottom-0 flex flex-col gap-2 border-t border-line bg-surface px-6 py-4 sm:flex-row-reverse sm:px-7">
          {actions}
        </div>
      </div>
    </dialog>
  );
}
