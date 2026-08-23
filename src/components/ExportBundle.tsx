/**
 * The set of downloadable files for one record: report, original, proof, certificate,
 * cover letter, transcript. Used at the end of the main flow (`ExportScreen`) and again
 * from the vault, where a saved record can be re-downloaded as many times as needed —
 * once for the platform, again for a lawyer, again for police, without redoing the flow.
 *
 * Files are still offered individually because the pairing matters — the proof only
 * verifies against the *original* file, and saying so plainly per-file is more useful
 * than hiding it inside an archive — but everything can also be saved as one zip, built
 * on-device from the same pieces, for whoever wants a single attachment instead.
 */
import { useEffect, useState } from 'react';
import { Callout, Card, DownloadRow } from './ui';
import { buildReportPdf, needsCompanionTextFile } from '../lib/pdf';
import { extensionForMime } from '../lib/media';
import { buildCertificatePdf } from '../lib/certificate';
import { buildCoverLetter } from '../lib/coverletter';
import { download } from '../lib/download';
import { buildZip, type ZipEntry } from '../lib/zip';
import type { EvidenceRecord } from '../lib/types';

export default function ExportBundle({ record }: { record: EvidenceRecord }) {
  const [pdf, setPdf] = useState<Blob | null>(null);
  const [certificate, setCertificate] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [zipBusy, setZipBusy] = useState(false);

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
    // `certificate` only ever moves from null to a built blob for a given mount — this
    // component is always mounted fresh per record (see ExportScreen and
    // VaultRecordScreen), so there is nothing to clear when no certificate is wanted.
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

  const zipReady = !!pdf && (!record.handover?.includeCertificate || !!certificate);

  const handleDownloadZip = async (): Promise<void> => {
    if (!pdf) return;
    setZipBusy(true);
    setError(null);
    try {
      const entries: ZipEntry[] = [
        { name: `${stem}.pdf`, data: pdf },
        { name: imageName, data: record.blob },
      ];
      if (record.proof) {
        entries.push({ name: `${imageName}.ots`, data: record.proof.ots });
      }
      if (record.handover?.includeCertificate && certificate) {
        entries.push({ name: `${stem}-certificate.pdf`, data: certificate });
      }
      if (record.handover?.countryId) {
        entries.push({
          name: `${stem}-cover-letter.txt`,
          data: buildCoverLetter(record, { stem, evidenceFilename: imageName }),
        });
      }
      if (hasNonLatinTranscript) {
        entries.push({ name: `${stem}-transcript.txt`, data: record.details.transcript });
      }
      const blob = await buildZip(entries);
      download(blob, `${stem}.zip`);
      mark('zip');
    } catch {
      setError('The zip could not be built.');
    } finally {
      setZipBusy(false);
    }
  };

  return (
    <>
      {error ? <Callout tone="caution" title="Something went wrong">{error}</Callout> : null}

      <Card className="space-y-4" data-tour="downloads">
        <DownloadRow
          title="Everything, zipped"
          filename={`${stem}.zip`}
          description="The report, the original file, the proof, and anything else below, bundled into one .zip — already paired together, nothing to keep track of separately."
          disabled={!zipReady}
          done={saved.has('zip')}
          busyLabel={zipBusy ? 'Zipping…' : zipReady ? undefined : 'Preparing…'}
          onDownload={() => void handleDownloadZip()}
        />

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
        proof can no longer be checked. The zip above already keeps them together; if downloading
        files individually instead, storing both in the same folder is enough.
      </Callout>
    </>
  );
}
