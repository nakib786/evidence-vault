/**
 * A 4-digit PIN entry: one large box per digit, masked by default with an eye toggle to
 * reveal it, auto-advancing focus — the same pattern as a phone's lock screen, replacing
 * what used to be a single plain text field that showed the PIN in the open at all times.
 *
 * The vault's underlying crypto (`vaultCrypto.ts`) doesn't actually care about PIN length
 * or character set — it just hashes whatever string it's given. Fixing the UI at 4 digits
 * is a deliberate product choice made alongside this component, not a constraint the crypto
 * imposes; see the call sites in `VaultScreen.tsx` and `ExportScreen.tsx`.
 *
 * State lives here, not in the parent, because the four boxes need to stay individually
 * addressable by position (box 3 holding a digit while box 1 is mid-edit, say) — a single
 * string handed down and re-sliced on every keystroke can't represent that without special
 * cases. `value`/`onChange` still make this a controlled-ish component from the outside
 * (for prefilling the demo PIN, or resetting after an error), reconciled through the effect
 * below whenever the parent's value doesn't match what the boxes currently show.
 */
import { useEffect, useId, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';

interface PinInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /**
   * Fires on Enter, once every box holds a digit — an explicit keyboard submit, the same as
   * pressing a "Continue" button. Deliberately does *not* also fire the instant the last
   * digit is typed: a person should see all four digits sit there and choose to submit, not
   * have it happen out from under them the moment they finish typing.
   */
  onComplete?: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
}

export function PinInput({
  label,
  value,
  onChange,
  onComplete,
  length = 4,
  autoFocus = false,
  disabled = false,
}: PinInputProps) {
  const labelId = useId();
  const boxRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [digits, setDigits] = useState<string[]>(() => Array.from({ length }, (_, i) => value[i] ?? ''));
  const [revealed, setRevealed] = useState(false);

  // Reconciles an external change (prefilling the demo PIN, a caller resetting the field)
  // into the boxes. Guarded on the joined value already matching, so this never fights the
  // boxes' own state on the keystroke that produced that exact value in the first place.
  // A reset to empty — a caller clearing the field after a wrong PIN — also sends focus
  // back to the first box, so the next attempt can start typing immediately.
  useEffect(() => {
    if (digits.join('') !== value) {
      setDigits(Array.from({ length }, (_, i) => value[i] ?? ''));
      if (value === '') boxRefs.current[0]?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resync only when the external value itself changes
  }, [value, length]);

  // Focuses the first box once, on mount — not via the JSX `autoFocus` prop. React applies
  // that prop by setting the DOM `autofocus` attribute, which some browsers re-honour on
  // later, unrelated DOM mutations (every other box's `value` update included), repeatedly
  // yanking focus back to box 0 mid-sequence and breaking the auto-advance below.
  useEffect(() => {
    if (autoFocus) boxRefs.current[0]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only, deliberately
  }, []);

  const focusBox = (i: number): void => {
    const box = boxRefs.current[i];
    box?.focus();
    box?.select();
  };

  const commit = (next: string[]): void => {
    setDigits(next);
    onChange(next.join(''));
  };

  const handleInput = (i: number, raw: string): void => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = digit;
    commit(next);
    if (digit && i < length - 1) focusBox(i + 1);
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault();
      const next = [...digits];
      next[i - 1] = '';
      commit(next);
      focusBox(i - 1);
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      focusBox(i - 1);
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      e.preventDefault();
      focusBox(i + 1);
    } else if (e.key === 'Enter' && onComplete && digits.every((d) => d !== '')) {
      onComplete(digits.join(''));
    }
  };

  const handlePaste = (i: number, e: ClipboardEvent<HTMLInputElement>): void => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!text) return;
    e.preventDefault();
    const next = [...digits];
    for (let k = 0; k < text.length && i + k < length; k += 1) next[i + k] = text[k];
    commit(next);
    focusBox(Math.min(i + text.length, length - 1));
  };

  return (
    <div className="space-y-1.5">
      <span id={labelId} className="block font-display text-sm font-semibold text-ink">
        {label}
      </span>
      <div className="flex items-center gap-2.5">
        <div role="group" aria-labelledby={labelId} className="flex gap-2.5">
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                boxRefs.current[i] = el;
              }}
              type={revealed ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              maxLength={1}
              aria-label={`Digit ${i + 1} of ${length}`}
              disabled={disabled}
              value={digit}
              onChange={(e) => handleInput(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={(e) => handlePaste(i, e)}
              onFocus={(e) => e.target.select()}
              className="size-14 rounded-xl border border-line-strong bg-surface text-center font-display
                text-2xl font-bold text-ink [&::-ms-clear]:hidden [&::-ms-reveal]:hidden
                focus:border-accent focus:outline-none disabled:opacity-50"
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          aria-pressed={revealed}
          aria-label={revealed ? 'Hide PIN' : 'Show PIN'}
          title={revealed ? 'Hide PIN' : 'Show PIN'}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line-strong
            bg-surface text-ink-muted hover:bg-sunken hover:text-ink"
        >
          {revealed ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.64A9.9 9.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.6 17.6 0 0 1-3.44 4.3M6.3 6.96C3.86 8.62 2.5 12 2.5 12s3.5 6.5 9.5 6.5a9.3 9.3 0 0 0 3.24-.58" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}
