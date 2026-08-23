/**
 * Rasterize the app logo into the PNG sizes a PWA manifest and iOS need.
 *
 * Run manually with `node scripts/make-icons.mjs` whenever public/logo.svg changes.
 * Not wired into predev/prebuild — the output is committed, like favicon.svg.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'icons');
const logo = await readFile(join(root, 'public', 'logo.svg'), 'utf8');

// Full-bleed circular mark, used as-is for "any" purpose icons.
const seal = logo;

// Maskable variant: same mark shrunk into the ~80% safe zone OS masks won't clip,
// sitting on an opaque square so the seal doesn't disappear when the mask crops corners.
const maskable = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#00586d"/>
  <g transform="translate(16 16) scale(0.72) translate(-16 -16)">
    ${seal.replace(/<\/?svg[^>]*>/g, '')}
  </g>
</svg>`;

await mkdir(out, { recursive: true });

async function render(svg, size, name) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  await writeFile(join(out, name), png);
  console.log(`  ${name}  ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`);
}

await render(seal, 192, 'icon-192.png');
await render(seal, 512, 'icon-512.png');
await render(maskable, 512, 'icon-512-maskable.png');
await render(maskable, 180, 'apple-touch-icon.png');

console.log('\nIcons written to public/icons/');
