/**
 * The set of downloadable files for a package of one or more items: one combined report,
 * one combined cover letter, and per item its original file, its proof, and (if chosen) its
 * certificate. See `ExportBundle` for the single-item version this mirrors — kept separate
 * rather than unified, because a package's file list genuinely has a different shape (one
 * shared report instead of one per item) and forcing both through one component would mean
 * a maze of `items.length > 1` branches instead of two components that each read plainly.
 */
import { useEffect, useState } from 'react';
import { Callout, Card, DownloadRow } from './ui';
import { buildPackageReportPdf, needsCompanionTextFile } from '../lib/pdf';
import { extensionForMime } from '../lib/media';
import { buildCertificatePdf } from '../lib/certificate';
import { buildPackageCoverLetter } from '../lib/coverletter';
import { download } from '../lib/download';
import type { EvidenceRecord } from '../lib/types';

export default function PackageExportBundle({
  items,
  packageId,
}: {
  items: EvidenceRecord[];
  packageId: string;
}) {
  const [pdf, setPdf] = useState<Blob | null>(null);
  const [certificates, setCertificates] = useState<Record<string, Blob>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const reportFilename = `evidence-package-${packageId}.pdf`;
  const evidenceFilenames = items.map((r) => `evidence-${r.id}.${extensionForMime(r.mimeType)}`);
  const wantsCertificate = items.some((r) => r.handover?.includeCertificate);

  useEffect(() => {
    let cancelled = false;
    buildPackageReportPdf(items)
      .then((blob) => {
        if (!cancelled) setPdf(blob);
      })
      .catch(() => {
        if (!cancelled) setError('The report could not be generated.');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    // Same reasoning as ExportBundle: this component is always mounted fresh per package,
    // so there is nothing to clear when no certificate was requested for any item.
    if (!wantsCertificate) return;
    let cancelled = false;
    (async () => {
      const built: Record<string, Blob> = {};
      for (let i = 0; i < items.length; i += 1) {
        const record = items[i];
        if (!record.handover?.includeCertificate) continue;
        try {
          const blob = await buildCertificatePdf({
            record,
            evidenceFilename: evidenceFilenames[i],
            proofFilename: record.proof ? `${evidenceFilenames[i]}.ots` : undefined,
          });
          built[record.id] = blob;
        } catch {
          if (!cancelled) setError('A certificate could not be generated.');
        }
      }
      if (!cancelled) setCertificates(built);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, wantsCertificate]);

  const mark = (key: string) => setSaved((prev) => new Set(prev).add(key));

  return (
    <>
      {error ? (
        <Callout tone="caution" title="Something went wrong">
          {error}
        </Callout>
      ) : null}

      <Card className="space-y-5" data-tour="downloads">
        <DownloadRow
          title="Evidence report"
          filename={reportFilename}
          description={
            items.length > 1
              ? `The document to send onward. Walks through all ${items.length} items — each photo, ` +
                'video contact sheet or audio transcript, your account for it, and how to verify it.'
              : 'The document to send onward. Contains the content, your account, the fingerprint, and ' +
                'instructions for verifying it.'
          }
          disabled={!pdf}
          done={saved.has('pdf')}
          onDownload={() => {
            if (pdf) {
              download(pdf, reportFilename);
              mark('pdf');
            }
          }}
          busyLabel={pdf ? undefined : 'Preparing…'}
        />

        {items.map((record, i) => {
          const evidenceFilename = evidenceFilenames[i];
          const isVideoRecord = record.kind === 'video';
          const isAudioRecord = record.kind === 'audio';
          const cert = certificates[record.id];
          return (
            <div key={record.id} className="space-y-3 border-t border-line pt-4 first:border-0 first:pt-0">
              {items.length > 1 ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                  Item {i + 1} of {items.length} — {isVideoRecord ? 'video' : isAudioRecord ? 'audio' : 'photo'}
                </p>
              ) : null}

              <DownloadRow
                title={isVideoRecord ? 'Original recording' : isAudioRecord ? 'Original audio' : 'Original image'}
                filename={evidenceFilename}
                description={
                  isVideoRecord
                    ? 'Keep this exactly as it is. The proof only verifies against these precise bytes — ' +
                      're-encoding, trimming or compressing the video will break the match.'
                    : isAudioRecord
                      ? 'Keep this exactly as it is. The proof only verifies against these precise bytes — ' +
                        're-encoding or trimming the audio will break the match.'
                      : 'Keep this exactly as it is. The proof only verifies against these precise bytes — ' +
                        're-saving, cropping or resizing it will break the match.'
                }
                done={saved.has(`image-${record.id}`)}
                onDownload={() => {
                  download(record.blob, evidenceFilename);
                  mark(`image-${record.id}`);
                }}
              />

              {record.proof ? (
                <DownloadRow
                  title="Timestamp proof"
                  filename={`${evidenceFilename}.ots`}
                  description="An OpenTimestamps proof file for this item. Anyone can check it with the standard tooling — it does not depend on this app existing."
                  done={saved.has(`ots-${record.id}`)}
                  onDownload={() => {
                    download(
                      new Blob([record.proof!.ots as unknown as BlobPart], { type: 'application/octet-stream' }),
                      `${evidenceFilename}.ots`,
                    );
                    mark(`ots-${record.id}`);
                  }}
                />
              ) : null}

              {record.handover?.includeCertificate ? (
                <DownloadRow
                  title="Certificate of authenticity"
                  filename={`evidence-${record.id}-certificate.pdf`}
                  description="Print this, sign it by hand, and keep it with this item's other files. It attests to this one file's hash, so it stays separate even though the report above is combined."
                  disabled={!cert}
                  done={saved.has(`cert-${record.id}`)}
                  busyLabel={cert ? undefined : 'Preparing…'}
                  onDownload={() => {
                    if (cert) {
                      download(cert, `evidence-${record.id}-certificate.pdf`);
                      mark(`cert-${record.id}`);
                    }
                  }}
                />
              ) : null}

              {needsCompanionTextFile(record.details.transcript) ? (
                <DownloadRow
                  title="Transcript"
                  filename={`evidence-${record.id}-transcript.txt`}
                  description="This item's transcript in UTF-8. Included separately because the PDF's fonts cannot render every script."
                  done={saved.has(`txt-${record.id}`)}
                  onDownload={() => {
                    download(
                      new Blob([record.details.transcript], { type: 'text/plain;charset=utf-8' }),
                      `evidence-${record.id}-transcript.txt`,
                    );
                    mark(`txt-${record.id}`);
                  }}
                />
              ) : null}
            </div>
          );
        })}

        {items[0]?.handover?.countryId ? (
          <DownloadRow
            title="Cover letter"
            filename={`evidence-package-${packageId}-cover-letter.txt`}
            description="A plain-text summary you can paste into an email or an online reporting form, listing everything in the package and how to verify it."
            done={saved.has('letter')}
            onDownload={() => {
              download(
                new Blob(
                  [buildPackageCoverLetter(items, { packageId, reportFilename, evidenceFilenames })],
                  { type: 'text/plain;charset=utf-8' },
                ),
                `evidence-package-${packageId}-cover-letter.txt`,
              );
              mark('letter');
            }}
          />
        ) : null}
      </Card>

      <Callout tone="info" title="Keep each item with its own proof file">
        A proof file verifies one specific original file. If a pair is separated, or a file is edited,
        its proof can no longer be checked. Keeping each item and its proof in the same folder is enough.
      </Callout>
    </>
  );
}
