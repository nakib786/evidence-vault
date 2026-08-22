/**
 * Screen 3 — the user adds context and checks what will go in the report.
 *
 * The image is blurred until the user chooses to look at it (docs/DESIGN.md principle 3).
 * Someone who just captured content targeting them should not have it thrust back in
 * their face to fill in a form, and none of the fields below actually require seeing it.
 *
 * Every field is optional. A record with nothing but a fingerprint and a timestamp is
 * still a useful record, and demanding a written account from someone who is upset is
 * exactly the kind of friction this tool should not add.
 */
import { useId, useState } from 'react';
import { Button, Callout, Card, Field, inputClass } from './ui';
import { formatDigestForHumans } from '../lib/hash';
import { CATEGORIES, SEVERITIES, IMMEDIATE_DANGER } from '../lib/taxonomy';
import { OCR_LANGUAGES, recognise, type OcrProgress } from '../lib/ocr';
import { formatDuration } from '../lib/media';
import type { EvidenceRecord, ReportDetails } from '../lib/types';

interface Props {
  record: EvidenceRecord;
  previewUrl: string;
  onChange: (details: ReportDetails) => void;
  onContinue: () => void;
  onDiscard: () => void;
}

export default function ReviewScreen({ record, previewUrl, onChange, onContinue, onDiscard }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [lang, setLang] = useState('eng');
  const [ocrState, setOcrState] = useState<'idle' | 'running' | 'done' | 'failed'>('idle');
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [ocrNote, setOcrNote] = useState<string | null>(null);

  const ids = useId();
  const id = (name: string) => `${ids}-${name}`;
  const { details } = record;
  const set = <K extends keyof ReportDetails>(key: K, value: ReportDetails[K]): void =>
    onChange({ ...details, [key]: value });

  const rtl = OCR_LANGUAGES.find((l) => l.id === lang)?.rtl ?? false;
  const isVideoRecord = record.kind === 'video';

  const runOcr = async (): Promise<void> => {
    setOcrState('running');
    setOcrNote(null);
    try {
      const result = await recognise(record.blob, lang, setOcrProgress);
      if (!result.text) {
        setOcrState('done');
        setOcrNote('No readable text was found in this image. You can type the text yourself.');
        return;
      }
      set('transcript', result.text);
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
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold text-ink">Add what you know</h1>
        <p className="text-ink-muted">
          Every field here is optional. Fill in what you can, and leave the rest.
        </p>
      </div>

      {/* ---- The evidence, hidden until asked for ---- */}
      <Card className="space-y-3" data-tour="evidence-preview">
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

        {isVideoRecord ? (
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex gap-1.5">
              <dt className="text-ink-subtle">Length</dt>
              <dd className="font-medium text-ink">
                {record.durationSeconds ? formatDuration(record.durationSeconds) : 'Not available'}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-ink-subtle">Sound</dt>
              <dd className="font-medium text-ink">
                {record.source === 'upload' ? 'From the original file' : record.hasAudio ? 'Recorded' : 'Not recorded'}
              </dd>
            </div>
          </dl>
        ) : null}

        {!revealed ? (
          <p className="text-xs text-ink-subtle">
            Blurred on purpose. You don’t have to look at it again to finish this record.
          </p>
        ) : null}
      </Card>

      {/* ---- Context ---- */}
      <Card className="space-y-5">
        <Field label="Where did this happen?" htmlFor={id('platform')} optional
          hint="A platform, an app, a workplace, a street — whatever fits.">
          <input
            id={id('platform')}
            className={inputClass}
            value={details.platform}
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
            value={details.sourceUrl}
            onChange={(e) => set('sourceUrl', e.target.value)}
            placeholder="https://"
          />
        </Field>

        <Field label="What happened?" htmlFor={id('note')} optional
          hint="In your own words. This is often the most useful part of the record.">
          <textarea
            id={id('note')}
            className={`${inputClass} min-h-28 resize-y`}
            value={details.note}
            onChange={(e) => set('note', e.target.value)}
          />
        </Field>
      </Card>

      {/* ---- Classification ---- */}
      <Card className="space-y-5" data-tour="classification">
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
            value={details.category}
            onChange={(e) => set('category', e.target.value)}
          >
            <option value="">Not specified</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {details.category ? (
            <p className="text-sm text-ink-subtle">
              {CATEGORIES.find((c) => c.id === details.category)?.hint}
            </p>
          ) : null}
        </Field>

        <Field label="Severity" htmlFor={id('severity')} optional>
          <select
            id={id('severity')}
            className={inputClass}
            value={details.severity}
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

        {details.severity === IMMEDIATE_DANGER ? (
          <Callout tone="danger" title="If someone is in danger right now, contact emergency services first">
            This tool preserves a record. It does not alert anyone, and nobody is notified that you
            made it. Please call your local emergency number before finishing here.
          </Callout>
        ) : null}
      </Card>

      {/* ---- Transcript ---- */}
      <Card className="space-y-4">
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
          label={isVideoRecord ? 'Transcript' : 'Transcript'}
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
            value={details.transcript}
            onChange={(e) => set('transcript', e.target.value)}
          />
        </Field>
      </Card>

      {/* ---- Integrity summary ---- */}
      <Card className="space-y-3" data-tour="proof">
        <h2 className="font-display text-sm font-bold text-ink">Proof attached to this record</h2>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Fingerprint</p>
          <p className="mt-1 break-all rounded-lg bg-sunken px-3 py-2 font-mono text-xs text-ink">
            {formatDigestForHumans(record.digestHex)}
          </p>
        </div>
        {record.proof ? (
          <Callout tone="affirm" title={`Timestamp accepted by ${record.proof.pendingUris.length} independent calendar${record.proof.pendingUris.length === 1 ? '' : 's'}`}>
            Awaiting confirmation on the ledger, which usually completes within a few hours. The proof is
            already verifiable by anyone, without needing this app.
          </Callout>
        ) : (
          <Callout tone="caution" title="No timestamp attached">
            The fingerprint still proves the file hasn’t changed, but not when it existed.
          </Callout>
        )}
      </Card>

      <div className="space-y-2">
        <Button block onClick={onContinue}>
          Create the report
        </Button>
        <Button variant="quiet" block onClick={onDiscard}>
          Discard and start over
        </Button>
      </div>
    </div>
  );
}
