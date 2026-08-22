/**
 * Screen 4 — hand the record over and get out.
 *
 * No dashboard, no account, no "are you sure you want to leave". The user came here to
 * produce something they can send to someone else; once they have it, the job is done.
 *
 * The files are offered separately rather than as one archive because the pairing matters:
 * the proof only verifies against the *original* file, and saying so plainly is more
 * useful than hiding it inside a zip.
 */
import { useEffect, useState } from 'react';
import { Button, Callout, Card } from './ui';
import { buildReportPdf, needsCompanionTextFile } from '../lib/pdf';
import { extensionForMime } from '../lib/media';
import { buildCertificatePdf } from '../lib/certificate';
import { buildCoverLetter } from '../lib/coverletter';
import type { EvidenceRecord } from '../lib/types';

interface Props {
  record: EvidenceRecord;
  onStartOver: () => void;
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on the next tick so the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ExportScreen({ record, onStartOver }: Props) {
  const [pdf, setPdf] = useState<Blob | null>(null);
  const [certificate, setCertificate] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const stem = `evidence-${record.id}`;
  const isVideoRecord = record.kind === 'video';
  const imageName = `${stem}.${extensionForMime(record.mimeType)}`;
  const hasNonLatinTranscript = needsCompanionTextFile(record.details.transcript);

  useEffect(() => {
    let cancelled = false;
    buildReportPdf(record)
      .then((blob) => {
        if (!cancelled) setPdf(blob);
      })
      .catch(() => {
        if (!cancelled) setError('The report could not be generated.');
      });
    return () => {
      cancelled = true;
    };
  }, [record]);

  useEffect(() => {
    // No synchronous setState here: when no certificate is wanted there is nothing to
    // clear, because `certificate` only ever moves from null to a built blob.
    if (!record.handover?.includeCertificate) return;
    let cancelled = false;
    buildCertificatePdf({
      record,
      evidenceFilename: imageName,
      proofFilename: record.proof ? `${imageName}.ots` : undefined,
    })
      .then((blob) => {
        if (!cancelled) setCertificate(blob);
      })
      .catch(() => {
        if (!cancelled) setError('The certificate could not be generated.');
      });
    return () => {
      cancelled = true;
    };
  }, [record, imageName]);

  const mark = (key: string) => setSaved((prev) => new Set(prev).add(key));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold text-ink">Your record is ready</h1>
        <p className="text-ink-muted">
          Save these files somewhere you trust. Nothing is stored here — once you close this page,
          it is gone from the app.
        </p>
      </div>

      {error ? <Callout tone="caution" title="Something went wrong">{error}</Callout> : null}

      <Card className="space-y-4" data-tour="downloads">
        <DownloadRow
          title="Evidence report"
          filename={`${stem}.pdf`}
          description={
            isVideoRecord
              ? 'The document to send onward. Contains sampled frames from the recording, your account, the fingerprint, and instructions for verifying it.'
              : 'The document to send onward. Contains the image, your account, the fingerprint, and instructions for verifying it.'
          }
          disabled={!pdf}
          done={saved.has('pdf')}
          onDownload={() => {
            if (pdf) {
              download(pdf, `${stem}.pdf`);
              mark('pdf');
            }
          }}
          busyLabel={pdf ? undefined : 'Preparing…'}
        />

        <DownloadRow
          title={isVideoRecord ? 'Original recording' : 'Original image'}
          filename={imageName}
          description={
            isVideoRecord
              ? 'Keep this exactly as it is. The proof only verifies against these precise bytes — re-encoding, trimming or compressing the video will break the match.'
              : 'Keep this exactly as it is. The proof below only verifies against these precise bytes — re-saving, cropping or resizing it will break the match.'
          }
          done={saved.has('image')}
          onDownload={() => {
            download(record.blob, imageName);
            mark('image');
          }}
        />

        {record.proof ? (
          <DownloadRow
            title="Timestamp proof"
            filename={`${imageName}.ots`}
            description="An OpenTimestamps proof file. Anyone can check it with the standard tooling — it does not depend on this app existing."
            done={saved.has('ots')}
            onDownload={() => {
              download(
                new Blob([record.proof!.ots as unknown as BlobPart], { type: 'application/octet-stream' }),
                `${imageName}.ots`,
              );
              mark('ots');
            }}
          />
        ) : null}

        {record.handover?.includeCertificate ? (
          <DownloadRow
            title="Certificate of authenticity"
            filename={`${stem}-certificate.pdf`}
            description="Print this, sign it by hand, and keep it with the other files. Written to the evidence rules of the jurisdiction you chose, for a lawyer to review and adopt."
            disabled={!certificate}
            done={saved.has('cert')}
            busyLabel={certificate ? undefined : 'Preparing…'}
            onDownload={() => {
              if (certificate) {
                download(certificate, `${stem}-certificate.pdf`);
                mark('cert');
              }
            }}
          />
        ) : null}

        {record.handover?.countryId ? (
          <DownloadRow
            title="Cover letter"
            filename={`${stem}-cover-letter.txt`}
            description="A plain-text summary you can paste into an email or an online reporting form, listing what is in the package and how to verify it."
            done={saved.has('letter')}
            onDownload={() => {
              download(
                new Blob([buildCoverLetter(record, { stem, evidenceFilename: imageName })], {
                  type: 'text/plain;charset=utf-8',
                }),
                `${stem}-cover-letter.txt`,
              );
              mark('letter');
            }}
          />
        ) : null}

        {hasNonLatinTranscript ? (
          <DownloadRow
            title="Transcript"
            filename={`${stem}-transcript.txt`}
            description="The transcript in UTF-8. Included separately because the PDF's fonts cannot render every script."
            done={saved.has('txt')}
            onDownload={() => {
              download(
                new Blob([record.details.transcript], { type: 'text/plain;charset=utf-8' }),
                `${stem}-transcript.txt`,
              );
              mark('txt');
            }}
          />
        ) : null}
      </Card>

      <Callout tone="info" title="Keep the image and the proof file together">
        The proof verifies one specific file. If they are separated, or the image is edited, the
        proof can no longer be checked. Storing both in the same folder is enough.
      </Callout>

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-bold text-ink">What you might do next</h2>
        <ul className="space-y-2 text-sm text-ink-muted">
          <li>
            <strong className="font-semibold text-ink">Report it to the platform.</strong> Most have a
            reporting flow; the report gives you the details in one place.
          </li>
          <li>
            <strong className="font-semibold text-ink">Send it to an organisation that tracks this.</strong>{' '}
            Community and civil-rights organisations collect these to establish patterns, which a
            single incident cannot show on its own.
          </li>
          <li>
            <strong className="font-semibold text-ink">Keep it.</strong> A record you never send is
            still worth having if the same thing happens again.
          </li>
        </ul>
        <p className="text-sm text-ink-subtle">
          If you are in immediate danger, contact your local emergency services. This tool does not
          notify anyone.
        </p>
      </Card>

      <Button variant="quiet" block onClick={onStartOver}>
        Document something else
      </Button>
    </div>
  );
}

function DownloadRow({
  title,
  filename,
  description,
  onDownload,
  disabled = false,
  done = false,
  busyLabel,
}: {
  title: string;
  filename: string;
  description: string;
  onDownload: () => void;
  disabled?: boolean;
  done?: boolean;
  busyLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-line pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex-1">
        <h3 className="font-display text-base font-bold text-ink">
          {title}
          {done ? (
            <span className="ml-2 rounded-full bg-affirm-soft px-2 py-0.5 align-middle text-xs font-semibold text-affirm">
              Saved
            </span>
          ) : null}
        </h3>
        <p className="mt-1 font-mono text-xs text-ink-subtle">{filename}</p>
        <p className="mt-1.5 text-sm text-ink-muted">{description}</p>
      </div>
      <Button
        variant={done ? 'secondary' : 'primary'}
        className="shrink-0 sm:w-36"
        onClick={onDownload}
        disabled={disabled}
      >
        {busyLabel ?? (done ? 'Save again' : 'Save')}
      </Button>
    </div>
  );
}
