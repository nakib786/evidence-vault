/**
 * A fixed, always-reachable way to leave this app in one tap — the same pattern used by
 * domestic-violence and other safety resources. It replaces this tab's page with an
 * ordinary, unrelated site rather than navigating to it normally, so pressing "back" from
 * that page does not return here.
 *
 * Deliberately does nothing else first: no confirmation dialog, no attempt to clear
 * anything. A capture still in progress and not yet saved to the vault is memory-only
 * already (see `App.tsx`'s file-level comment) — leaving the page discards it exactly as
 * closing the tab would, and this has to work in the one tap it promises, not two.
 *
 * One honest limit, not papered over: a native `<dialog>` (see `Modal.tsx`) paints above
 * everything else on the page, including this button, while it's open. Escape closes any
 * of those dialogs first if that happens.
 */
const SAFE_URL = 'https://www.google.com';

export default function QuickExitButton() {
  return (
    <button
      type="button"
      data-tour="quick-exit"
      onClick={() => window.location.replace(SAFE_URL)}
      aria-label="Quick exit — leave this site immediately, replaced with an ordinary page"
      title="Leave this site immediately"
      className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink-muted shadow-[0_1px_2px_rgb(15_23_42_/_0.06),0_10px_24px_-12px_rgb(15_23_42_/_0.28)] transition-colors hover:border-danger/40 hover:bg-danger-soft hover:text-danger"
    >
      <ExitIcon />
      Quick exit
    </button>
  );
}

function ExitIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3.5 shrink-0"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" />
      <path d="m14.5 16 4-4-4-4" />
      <path d="M18 12H8.5" />
    </svg>
  );
}
