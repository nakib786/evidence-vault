/**
 * On-device OCR, used to pre-fill the transcript field.
 *
 * Every asset — worker script, WASM core, language data — is served from our own origin
 * (see scripts/copy-ocr-assets.mjs). Nothing about the image is sent anywhere; the
 * recognition runs in a Web Worker on the user's machine.
 *
 * The result is always presented as a draft for the user to correct. OCR misreads
 * handwriting, stylised fonts and low-contrast screenshots, and a transcript that goes
 * into a report someone may act on should not be machine output nobody checked.
 */

export interface OcrLanguage {
  id: string;
  label: string;
  /** Right-to-left scripts need `dir="rtl"` on the textarea to be readable. */
  rtl?: boolean;
}

/**
 * Arabic and Urdu are included deliberately: the hosted safety classifiers we looked at
 * cover neither, which would have quietly under-served a large share of the people this
 * tool is for.
 */
export const OCR_LANGUAGES: OcrLanguage[] = [
  { id: 'eng', label: 'English' },
  { id: 'ara', label: 'Arabic — العربية', rtl: true },
  { id: 'urd', label: 'Urdu — اردو', rtl: true },
];

export interface OcrProgress {
  /** 0–1, or null while the stage has no measurable progress. */
  ratio: number | null;
  label: string;
}

export interface OcrResult {
  text: string;
  /** Mean per-word confidence, 0–100. Low values are worth warning the user about. */
  confidence: number;
  language: string;
}

const STAGE_LABELS: Record<string, string> = {
  'loading tesseract core': 'Starting the text reader',
  'initializing tesseract': 'Starting the text reader',
  'loading language traineddata': 'Loading the language pack',
  'initializing api': 'Getting ready',
  'recognizing text': 'Reading the image',
};

/**
 * Run OCR over an image.
 *
 * @param signal Aborting only stops us reporting progress and terminates the worker —
 *   it cannot interrupt a recognition pass already inside the WASM core.
 */
export async function recognise(
  image: Blob,
  language = 'eng',
  onProgress?: (p: OcrProgress) => void,
  signal?: AbortSignal,
): Promise<OcrResult> {
  // Imported here rather than at module scope: tesseract.js and its WASM glue are a
  // large download, and most sessions never request a transcript at all.
  const { createWorker } = await import('tesseract.js');

  const worker = await createWorker(language, 1, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract/core',
    langPath: '/tesseract/lang',
    logger: (m: { status: string; progress: number }) => {
      if (signal?.aborted) return;
      onProgress?.({
        ratio: typeof m.progress === 'number' ? m.progress : null,
        label: STAGE_LABELS[m.status] ?? 'Working',
      });
    },
  });

  try {
    const { data } = await worker.recognize(image);
    return {
      text: (data.text ?? '').trim(),
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
      language,
    };
  } finally {
    await worker.terminate();
  }
}
