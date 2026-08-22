/**
 * Shared UI primitives.
 *
 * The accessibility requirements from docs/DESIGN.md are encoded here once — large tap
 * targets, visible focus, and status that is never signalled by colour alone — so the
 * screens can't quietly drift out of conformance.
 */
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  block?: boolean;
};

export function Button({
  variant = 'primary',
  block = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-base font-semibold ' +
    'transition-colors disabled:cursor-not-allowed disabled:opacity-45';
  const variants = {
    primary: 'bg-accent text-white hover:bg-accent-hover',
    secondary: 'bg-surface text-ink border border-line-strong hover:bg-sunken',
    quiet: 'bg-transparent text-ink-muted hover:text-ink hover:bg-sunken',
    danger: 'bg-danger-soft text-danger border border-danger/25 hover:bg-danger/10',
  } as const;

  return (
    <button
      className={`${base} ${variants[variant]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * Extra props are forwarded to the element. That matters for `data-*` attributes: the
 * guided tour anchors onto `data-tour` values, and an earlier version of this component
 * swallowed unknown props, so every anchored tour step silently vanished.
 */
export function Card({
  children,
  className = '',
  as: Tag = 'section',
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div';
} & HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={`rounded-2xl border border-line bg-surface p-5 ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * A status message. `tone` picks the colour, but every tone also renders its own text
 * label, so the meaning survives when colour is unavailable.
 */
export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'caution' | 'affirm' | 'danger';
  title: string;
  children?: ReactNode;
}) {
  const tones = {
    info: { box: 'border-line bg-sunken', text: 'text-ink', mark: 'Note' },
    caution: { box: 'border-caution/30 bg-caution-soft', text: 'text-ink', mark: 'Take care' },
    affirm: { box: 'border-affirm/30 bg-affirm-soft', text: 'text-ink', mark: 'Done' },
    danger: { box: 'border-danger/30 bg-danger-soft', text: 'text-ink', mark: 'Important' },
  } as const;
  const t = tones[tone];

  return (
    <div className={`rounded-xl border p-4 ${t.box} ${t.text}`} role="status">
      <p className="font-display text-sm font-bold">
        <span className="sr-only">{t.mark}: </span>
        {title}
      </p>
      {children ? <div className="mt-1.5 text-sm text-ink-muted">{children}</div> : null}
    </div>
  );
}

export function ProgressBar({ ratio, label }: { ratio: number | null; label: string }) {
  const pct = ratio === null ? null : Math.round(ratio * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="text-sm tabular-nums text-ink-subtle">{pct === null ? '' : `${pct}%`}</p>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-sunken"
        role="progressbar"
        aria-valuenow={pct ?? undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full bg-accent transition-[width] duration-300 ${
            pct === null ? 'w-1/3 animate-pulse' : ''
          }`}
          style={pct === null ? undefined : { width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  optional = false,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: ReactNode;
  optional?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block font-display text-sm font-semibold text-ink">
        {label}
        {optional ? <span className="ml-1.5 font-sans font-normal text-ink-subtle">optional</span> : null}
      </label>
      {hint ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export const inputClass =
  'w-full rounded-xl border border-line-strong bg-surface px-4 py-3 text-base text-ink ' +
  'placeholder:text-ink-subtle focus:border-accent focus:outline-none';

/** Progress through the four screens, announced to assistive tech. */
export function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <nav aria-label="Progress">
      <ol className="flex items-center gap-2">
        {steps.map((name, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'upcoming';
          return (
            <li key={name} className="flex flex-1 items-center gap-2">
              <div className="flex-1">
                <div
                  className={`h-1.5 rounded-full ${
                    state === 'upcoming' ? 'bg-line' : 'bg-accent'
                  }`}
                />
                <p
                  className={`mt-1.5 text-xs ${
                    state === 'current' ? 'font-semibold text-ink' : 'text-ink-subtle'
                  }`}
                >
                  {name}
                  {state === 'current' ? <span className="sr-only"> (current step)</span> : null}
                  {state === 'done' ? <span className="sr-only"> (completed)</span> : null}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
