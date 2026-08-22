/**
 * Copy Tesseract's worker, WASM core, and language data out of node_modules and into
 * public/tesseract/ so the app can serve them from its own origin.
 *
 * By default tesseract.js fetches all three from jsDelivr at runtime. That would put a
 * third-party CDN in the middle of a tool whose entire claim is that nothing leaves your
 * device, and it would force a `connect-src` exception in the CSP (docs/SECURITY.md).
 * Serving them ourselves keeps `connect-src` limited to the OpenTimestamps calendars.
 *
 * Runs automatically via the `predev` / `prebuild` npm scripts.
 */
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'tesseract');

/** Language packs bundled offline. Arabic and Urdu matter for this problem domain. */
const LANGS = ['eng', 'ara', 'urd'];
const LANG_REVISION = '4.0.0';

async function main() {
  await rm(out, { recursive: true, force: true });
  await mkdir(join(out, 'core'), { recursive: true });
  await mkdir(join(out, 'lang'), { recursive: true });

  // 1. Worker script.
  await cp(
    join(root, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js'),
    join(out, 'worker.min.js'),
  );

  // 2. WASM core. Copy every variant — tesseract.js picks one based on the browser's
  //    SIMD support at runtime, so we cannot know in advance which is needed.
  const coreDir = join(root, 'node_modules', 'tesseract.js-core');
  for (const entry of await readdir(coreDir)) {
    if (entry.endsWith('.js') || entry.endsWith('.wasm')) {
      await cp(join(coreDir, entry), join(out, 'core', entry));
    }
  }

  // 3. Language data.
  for (const lang of LANGS) {
    const src = join(
      root, 'node_modules', '@tesseract.js-data', lang, LANG_REVISION, `${lang}.traineddata.gz`,
    );
    if (!existsSync(src)) {
      console.warn(`  ! missing language data for "${lang}" — skipping`);
      continue;
    }
    await cp(src, join(out, 'lang', `${lang}.traineddata.gz`));
  }

  const bytes = await dirSize(out);
  console.log(`OCR assets staged in public/tesseract (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
}

async function dirSize(dir) {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    total += entry.isDirectory() ? await dirSize(p) : (await stat(p)).size;
  }
  return total;
}

await main();
