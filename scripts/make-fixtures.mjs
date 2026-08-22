/**
 * Generates the synthetic demo images used to exercise capture, OCR and export.
 *
 * Hackathon rule §06 forbids creating new hateful material, "even as a test prompt or
 * sample dataset", and says a safe surrogate scores exactly as well as the real thing.
 * So these fixtures reproduce the *shape* of a report — a post with an author, a
 * timestamp and a body of text — while the body itself is an explicit stand-in that
 * names the category it represents instead of enacting it.
 *
 * That is not a compromise for the demo. A reviewer watching the walkthrough sees the
 * app read real text out of a realistic layout, and sees that no hateful content was
 * needed to build or test any of it.
 *
 * Usernames and handles are fabricated. Any resemblance to a real account is accidental;
 * they are deliberately implausible to reduce the chance of collision.
 *
 * Run: npm run fixtures
 */
import { Resvg } from '@resvg/resvg-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'fixtures');
/* Also served by the app so judges can try the flow without supplying their own image. */
const publicDir = join(root, 'public', 'fixtures');

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

/** A mock post card. `lines` are pre-wrapped so we don't need a text layout engine. */
function postCard({ handle, display, meta, lines, rtl = false, fontSize = 25 }) {
  const W = 900;
  const pad = 44;
  const bodyTop = 176;
  const lineHeight = fontSize * 1.55;
  const H = Math.ceil(bodyTop + lines.length * lineHeight + 96);
  const anchor = rtl ? 'end' : 'start';
  const textX = rtl ? W - pad : pad;

  const body = lines
    .map(
      (line, i) =>
        `<text x="${textX}" y="${bodyTop + i * lineHeight}" text-anchor="${anchor}" ` +
        `font-family="Segoe UI, Arial, sans-serif" font-size="${fontSize}" fill="#0f1419"` +
        `${rtl ? ' direction="rtl"' : ''}>${esc(line)}</text>`,
    )
    .join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#ffffff"/>
    <rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="#cfd9de" stroke-width="2" rx="18"/>
    <circle cx="${pad + 26}" cy="72" r="26" fill="#8ba3b5"/>
    <text x="${pad + 26}" y="81" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
          font-size="24" font-weight="700" fill="#ffffff">${esc(display.slice(0, 1))}</text>
    <text x="${pad + 68}" y="64" font-family="Segoe UI, Arial, sans-serif" font-size="24"
          font-weight="700" fill="#0f1419">${esc(display)}</text>
    <text x="${pad + 68}" y="94" font-family="Segoe UI, Arial, sans-serif" font-size="21"
          fill="#536471">${esc(handle)}</text>
    <line x1="${pad}" y1="126" x2="${W - pad}" y2="126" stroke="#eff3f4" stroke-width="2"/>
    ${body}
    <text x="${pad}" y="${H - 42}" font-family="Segoe UI, Arial, sans-serif" font-size="19"
          fill="#536471">${esc(meta)}</text>
  </svg>`;
}

const FIXTURES = [
  {
    name: 'synthetic-post-english',
    svg: postCard({
      display: 'Placeholder Account',
      handle: '@synthetic_example_not_real',
      meta: '11:42 AM · 22 Aug 2026 · Synthetic demo content',
      lines: [
        'SYNTHETIC EXAMPLE — NOT REAL CONTENT.',
        '',
        'This block stands in for a post containing dehumanising',
        'language directed at a religious community. The real',
        'wording is deliberately not reproduced anywhere in this',
        'project, in either the code or the test data.',
        '',
        'It exists so the optical character recognition, the',
        'fingerprinting and the report export can be demonstrated',
        'end to end without creating or handling hateful material.',
      ],
    }),
  },
  {
    name: 'synthetic-post-arabic',
    svg: postCard({
      display: 'حساب تجريبي',
      handle: '@synthetic_example_ar',
      meta: 'محتوى تجريبي — 22 أغسطس 2026',
      rtl: true,
      lines: [
        'مثال تجريبي — ليس محتوى حقيقيًا.',
        '',
        'هذا النص بديل يوضح كيفية قراءة النص العربي',
        'داخل التطبيق. لا يحتوي على أي عبارات مسيئة.',
        '',
        'الهدف منه هو اختبار التعرف الضوئي على الحروف',
        'والتأكد من عمل التقرير باللغة العربية.',
      ],
    }),
  },
  {
    name: 'synthetic-post-urdu',
    svg: postCard({
      display: 'نمونہ اکاؤنٹ',
      handle: '@synthetic_example_ur',
      meta: 'تجرباتی مواد — 22 اگست 2026',
      rtl: true,
      lines: [
        'نمونہ مثال — یہ حقیقی مواد نہیں ہے۔',
        '',
        'یہ متن صرف اردو تحریر کی جانچ کے لیے ہے۔',
        'اس میں کوئی نفرت انگیز بات شامل نہیں ہے۔',
        '',
        'اس کا مقصد رپورٹ اور تحریر کی شناخت کو',
        'جانچنا ہے۔',
      ],
    }),
  },
];

await mkdir(outDir, { recursive: true });
await mkdir(publicDir, { recursive: true });

for (const { name, svg } of FIXTURES) {
  const png = new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng();
  await writeFile(join(outDir, `${name}.png`), png);
  await writeFile(join(publicDir, `${name}.png`), png);
  console.log(`  ${name}.png  ${(png.length / 1024).toFixed(0)} KB`);
}

console.log(`\n${FIXTURES.length} synthetic fixtures written to fixtures/`);
