/**
 * Screen 2 — review everything captured so far, add context per item, and remove anything
 * that shouldn't be in the final package.
 *
 * A capture session can hold more than one photo or video now — a poster and the person
 * shouting at it, say — so this is a list rather than a single form, and it's landed on
 * immediately after every capture: fingerprinting and timestamp submission run in the
 * background the instant the shutter fires (see App.tsx's `handleCaptured` and
 * `lib/secure.ts`), not on a screen of their own. An item shows up here as "Fingerprinting…"
 * for the brief moment before that finishes, rather than making the user wait through a
 * loading screen per item.
 *
 * The image is blurred until the user chooses to look at it (docs/DESIGN.md principle 3).
 * Someone who just captured content targeting them should not have it thrust back in their
 * face to fill in a form, and none of the fields below actually require seeing it.
 */
import { useEffect, useId, useMemo, useState } from 'react';
import { Button, Callout, Card, Field, inputClass } from './ui';
import { formatDigestForHumans } from '../lib/hash';
import { CATEGORIES, SEVERITIES, IMMEDIATE_DANGER } from '../lib/taxonomy';
import { OCR_LANGUAGES, recognise, type OcrProgress } from '../lib/ocr';
import { formatDuration } from '../lib/media';
import { describeCaptureMeta } from '../lib/captureMeta';
import type { CaptureItem, ReportDetails } from '../lib/types';

interface Props {
  items: CaptureItem[];
  onChangeItem: (id: string, details: ReportDetails) => void;
  onRemoveItem: (id: string) => void;
  onAddAnother: () => void;
  onContinue: () => void;
  onDiscardAll: () => void;
}

export default function ReviewScreen({
  items,
  onChangeItem,
  onRemoveItem,
  onAddAnother,
  onContinue,
  onDiscardAll,
}: Props) {
  const readyCount = items.filter((it) => it.status === 'ready').length;
  const securingCount = items.filter((it) => it.status === 'securing').length;
  const canContinue = readyCount > 0 && securingCount === 0;
  const multi = items.length > 1;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold text-ink">
          {multi ? `Review what you’ve captured (${items.length})` : 'Add what you know'}
        </h1>
        <p className="text-ink-muted">
          {multi
            ? 'Every field is optional. Remove anything that shouldn’t be in this package before you continue.'
            : 'Every field here is optional. Fill in what you can, and leave the rest.'}
        </p>
      </div>

      <div className="space-y-5">
        {items.map((item, i) => (
          <ItemCard
            key={item.id}
            item={item}
            index={i}
            total={items.length}
            onChange={(details) => onChangeItem(item.id, details)}
            onRemove={() => onRemoveItem(item.id)}
          />
        ))}
      </div>

      <Button variant="secondary" block onClick={onAddAnother}>
        Add another photo or video
      </Button>

      <div className="space-y-2">
        <Button block onClick={onContinue} disabled={!canContinue}>
          {securingCount > 0
            ? `Fingerprinting${securingCount > 1 ? ` ${securingCount} items` : ''}…`
            : 'Create the report'}
        </Button>
        <Button variant="quiet" block onClick={onDiscardAll}>
          Discard everything and start over
        </Button>
      </div>
    </div>
  );
}

function ItemCard({
  item,
  index,
  total,
  onChange,
  onRemove,
}: {
  item: CaptureItem;
  index: number;
  total: number;
  onChange: (details: ReportDetails) => void;
  onRemove: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [lang, setLang] = useState('eng');
  const [ocrState, setOcrState] = useState<'idle' | 'running' | 'done' | 'failed'>('idle');
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [ocrNote, setOcrNote] = useState<string | null>(null);

  const ids = useId();
  const id = (name: string) => `${ids}-${name}`;

  // One object URL per item's blob, for the preview and the OCR pass — created once per
  // item and revoked when this card unmounts (removed, or the whole screen moves on).
  const previewUrl = useMemo(() => URL.createObjectURL(item.blob), [item.blob]);
  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  const record = item.record;
  const isVideoRecord = item.kind === 'video';
  const rtl = OCR_LANGUAGES.find((l) => l.id === lang)?.rtl ?? false;
  const captureFacts = record?.captureMeta ? describeCaptureMeta(record.captureMeta) : [];

  const set = <K extends keyof ReportDetails>(key: K, value: ReportDetails[K]): void => {
    if (record) onChange({ ...record.details, [key]: value });
  };

  const runOcr = async (): Promise<void> => {
    if (!record) return;
    setOcrState('running');
    setOcrNote(null);
    try {
      const result = await recognise(item.blob, lang, setOcrProgress);
      if (!result.text) {
        setOcrState('done');
        setOcrNote('No readable text was found in this image. You can type the text yourself.');
        return;
      }
      onChange({ ...record.details, transcript: result.text });
      setOcrState('done');
      setOcrNote(
        result.confidence < 70
          ? `The text reader was not very confident (${Math.round(result.confidence)}%). Please check it closely against the image.`
          : `Draft transcript added. Please check it against the image before continuing.`,
      );
    } catch {
      setOcrState('failed');
      setOcrNote('The text reader could not run. You can type the text yourself.');
    } finally {
      setOcrProgress(null);
    }
  };

  return (
    <Card className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        {total > 1 ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            Item {index + 1} of {total} — {isVideoRecord ? 'video' : 'photo'}
          </p>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-danger hover:bg-danger-soft"
        >
          <RemoveIcon />
          Remove
        </button>
      </div>

      {/* ---- The evidence, hidden until asked for ---- */}
      <div className="space-y-3" data-tour={index === 0 ? 'evidence-preview' : undefined}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-sm font-bold text-ink">What you captured</h2>
          <Button
            variant="quiet"
            className="px-3 py-1.5 text-sm"
            onClick={() => setRevealed((v) => !v)}
            aria-pressed={revealed}
          >
            {revealed ? 'Hide' : isVideoRecord ? 'Show recording' : 'Show image'}
          </Button>
        </div>
        <div className="overflow-hidden rounded-xl border border-line bg-sunken">
          {isVideoRecord ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption -- user's own recording; they supply the transcript below
            <video
              src={previewUrl}
              controls={revealed}
              preload="metadata"
              playsInline
              className={`max-h-80 w-full bg-black object-contain transition-[filter] ${revealed ? '' : 'evidence-blur pointer-events-none'}`}
              aria-label={
                revealed
                  ? 'The recording you captured.'
                  : 'The recording you captured, currently blurred. Use the show button to reveal it.'
              }
            />
          ) : (
            <img
              src={previewUrl}
              alt={
                revealed
                  ? 'The content you captured.'
                  : 'The content you captured, currently blurred. Use the show image button to reveal it.'
              }
              className={`max-h-80 w-full object-contain transition-[filter] ${revealed ? '' : 'evidence-blur'}`}
            />
          )}
        </div>

        {isVideoRecord || captureFacts.length > 0 ? (
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {isVideoRecord ? (
              <>
                <div className="flex gap-1.5">
                  <dt className="text-ink-subtle">Length</dt>
                  <dd className="font-medium text-ink">
                    {item.durationSeconds ? formatDuration(item.durationSeconds) : 'Not available'}
                  </dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-ink-subtle">Sound</dt>
                  <dd className="font-medium text-ink">
                    {item.source === 'upload' ? 'From the original file' : item.hasAudio ? 'Recorded' : 'Not recorded'}
                  </dd>
                </div>
              </>
            ) : null}
            {captureFacts.map((fact) => (
              <div key={fact.label} className="flex gap-1.5">
                <dt className="text-ink-subtle">{fact.label}</dt>
                <dd className="font-medium text-ink">{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {!revealed ? (
          <p className="text-xs text-ink-subtle">
            Blurred on purpose. You don’t have to look at it again to finish this record.
          </p>
        ) : null}
      </div>

      {/* ---- Fingerprint status ---- */}
      <div data-tour={index === 0 ? 'item-status' : undefined}>
        {item.status === 'securing' ? (
          <Callout tone="info" title="Fingerprinting…">
            Computing a SHA-256 fingerprint and requesting a timestamp in the background. This
            usually takes a second or two — you can keep adding items or filling in the fields
            below while it finishes.
          </Callout>
        ) : item.status === 'error' ? (
          <Callout tone="caution" title="This item could not be secured">
            {item.error ?? 'Something went wrong while fingerprinting this file.'} Remove it and
            capture it again.
          </Callout>
        ) : record ? (
          <div className="space-y-2 rounded-xl border border-line bg-sunken p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Fingerprint</p>
            <p className="break-all font-mono text-xs text-ink">{formatDigestForHumans(record.digestHex)}</p>
            {record.proof ? (
              <p className="text-xs text-affirm">
                Timestamp accepted by {record.proof.pendingUris.length} independent calendar
                {record.proof.pendingUris.length === 1 ? '' : 's'} — awaiting confirmation on the ledger.
              </p>
            ) : (
              <p className="text-xs text-caution">
                No timestamp attached. The fingerprint still proves the file hasn’t changed.
              </p>
            )}
          </div>
        ) : null}
      </div>

      {record ? (
        <>
          {/* ---- Context ---- */}
          <div className="space-y-5 border-t border-line pt-5">
            <Field label="Where did this happen?" htmlFor={id('platform')} optional
              hint="A platform, an app, a workplace, a street — whatever fits.">
              <input
                id={id('platform')}
                className={inputClass}
                value={record.details.platform}
                onChange={(e) => set('platform', e.target.value)}
                placeholder="e.g. a social media platform"
              />
            </Field>

            <Field label="Link to the content" htmlFor={id('url')} optional
              hint="If there is a public link, it helps whoever reviews this find it.">
              <input
                id={id('url')}
                type="url"
                inputMode="url"
                className={inputClass}
                value={record.details.sourceUrl}
                onChange={(e) => set('sourceUrl', e.target.value)}
                placeholder="https://"
              />
            </Field>

            <Field label="What happened?" htmlFor={id('note')} optional
              hint="In your own words. This is often the most useful part of the record.">
              <textarea
                id={id('note')}
                className={`${inputClass} min-h-28 resize-y`}
                value={record.details.note}
                onChange={(e) => set('note', e.target.value)}
              />
            </Field>
          </div>

          {/* ---- Contact details (optional, and called out as such) ---- */}
          <Callout tone="info" title="Optional — how a reviewer can reach you">
            <p>
              Leave this blank to stay anonymous. Nothing here is required, and like everything
              else in this record it never leaves your device unless you choose to export or share it.
            </p>
            <div className="mt-4 space-y-4">
              <Field label="Name" htmlFor={id('contactName')} optional>
                <input
                  id={id('contactName')}
                  className={inputClass}
                  value={record.details.contactName}
                  onChange={(e) => set('contactName', e.target.value)}
                  placeholder="Jane Doe"
                  autoComplete="name"
                />
              </Field>

              <Field label="Email" htmlFor={id('contactEmail')} optional>
                <input
                  id={id('contactEmail')}
                  type="email"
                  inputMode="email"
                  className={inputClass}
                  value={record.details.contactEmail}
                  onChange={(e) => set('contactEmail', e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </Field>

              <Field label="Phone number" htmlFor={id('contactPhone')} optional>
                <input
                  id={id('contactPhone')}
                  type="tel"
                  inputMode="tel"
                  className={inputClass}
                  value={record.details.contactPhone}
                  onChange={(e) => set('contactPhone', e.target.value)}
                  placeholder="+1 555 555 5555"
                  autoComplete="tel"
                />
              </Field>
            </div>
          </Callout>

          {/* ---- Classification ---- */}
          <div className="space-y-5 border-t border-line pt-5" data-tour={index === 0 ? 'classification' : undefined}>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">How would you describe it?</h2>
              <p className="mt-1 text-sm text-ink-muted">
                You choose these labels — nothing is guessed by software, and nothing you wrote is sent
                anywhere to be analysed.
              </p>
            </div>

            <Field label="Category" htmlFor={id('category')} optional>
              <select
                id={id('category')}
                className={inputClass}
                value={record.details.category}
                onChange={(e) => set('category', e.target.value)}
              >
                <option value="">Not specified</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              {record.details.category ? (
                <p className="text-sm text-ink-subtle">
                  {CATEGORIES.find((c) => c.id === record.details.category)?.hint}
                </p>
              ) : null}
            </Field>

            <Field label="Severity" htmlFor={id('severity')} optional>
              <select
                id={id('severity')}
                className={inputClass}
                value={record.details.severity}
                onChange={(e) => set('severity', e.target.value)}
              >
                <option value="">Not specified</option>
                {SEVERITIES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>

            {record.details.severity === IMMEDIATE_DANGER ? (
              <Callout tone="danger" title="If someone is in danger right now, contact emergency services first">
                This tool preserves a record. It does not alert anyone, and nobody is notified that you
                made it. Please call your local emergency number before finishing here.
              </Callout>
            ) : null}
          </div>

          {/* ---- Transcript ---- */}
          <div className="space-y-4 border-t border-line pt-5">
            <div>
              <h2 className="font-display text-lg font-bold text-ink">
                {isVideoRecord ? 'What was said' : 'Text in the image'}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                {isVideoRecord
                  ? 'Optional. Write down what you heard, as closely as you can remember. A reviewer can search text, but not a recording — and this is often what makes a report actionable.'
                  : 'Optional, and it runs entirely on your device. Useful because a reviewer can search text but not a picture.'}
              </p>
            </div>

            {!isVideoRecord ? (
              <>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    className={`${inputClass} sm:w-48`}
                    value={lang}
                    onChange={(e) => setLang(e.target.value)}
                    aria-label="Language of the text in the image"
                    disabled={ocrState === 'running'}
                  >
                    {OCR_LANGUAGES.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={runOcr}
                    disabled={ocrState === 'running'}
                  >
                    {ocrState === 'running' ? 'Reading…' : 'Read text from image'}
                  </Button>
                </div>

                {ocrState === 'running' && ocrProgress ? (
                  <p className="text-sm text-ink-muted" role="status">
                    {ocrProgress.label}
                    {ocrProgress.ratio !== null ? ` — ${Math.round(ocrProgress.ratio * 100)}%` : '…'}
                  </p>
                ) : null}

                {ocrNote ? (
                  <Callout tone={ocrState === 'failed' ? 'caution' : 'info'} title="About this transcript">
                    {ocrNote}
                  </Callout>
                ) : null}
              </>
            ) : null}

            <Field
              label="Transcript"
              htmlFor={id('transcript')}
              optional
              hint={
                isVideoRecord
                  ? 'Quote it directly where you can. Note anything you are unsure of rather than guessing.'
                  : 'Correct anything the reader got wrong — this text goes into your report.'
              }
            >
              <textarea
                id={id('transcript')}
                dir={rtl && !isVideoRecord ? 'rtl' : undefined}
                className={`${inputClass} min-h-32 resize-y font-mono text-sm`}
                value={record.details.transcript}
                onChange={(e) => set('transcript', e.target.value)}
              />
            </Field>
          </div>
        </>
      ) : null}
    </Card>
  );
}

function RemoveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-8 0v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}
