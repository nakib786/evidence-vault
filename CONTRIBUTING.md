# Contributing to Evidence Vault

Thanks for your interest in improving Evidence Vault. It's a small, privacy- and security-sensitive prototype, so a few things matter more here than in a typical repo — please read "Ground rules" before opening a PR.

## Getting started

```bash
npm install
npm run dev
```

`npm run dev` and `npm run build` both run `scripts/copy-ocr-assets.mjs` first (via `predev`/`prebuild`) to stage the Tesseract OCR language data into `public/tesseract/` — you don't need to run that separately.

## Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) then build for production |
| `npm run lint` | Run `oxlint` over the codebase |
| `npm run fixtures` | Regenerate the synthetic demo images under `fixtures/` via `scripts/make-fixtures.mjs` |
| `npm run test:ots` | Exercise the hand-rolled OpenTimestamps client (`src/lib/ots.ts`) against the real multi-calendar submission path |
| `npm run test:ots-upgrade` | Check the upgrade/confirmation path against a known-confirmed proof and the live calendars |

If you touch `src/lib/ots.ts`, also cross-check the result against the reference implementation:

```bash
pip install opentimestamps-client
python scripts/ots_validate.py .tmp/multi.bin.ots
```

## Ground rules

- **No real hateful content, anywhere** — not in a fixture, a test, a screenshot, or a PR description. Demo content must stay synthetic: layout-accurate, with placeholder text that names the category it stands in for rather than enacting it. New fixtures should be generated through `scripts/make-fixtures.mjs`, not built from a real captured post.
- **Zero-egress stays zero-egress.** The only network call the app makes is the SHA-256 digest submitted to public OpenTimestamps calendars (`src/lib/ots.ts`). A PR that adds any other outbound call — analytics, a hosted API, a runtime CDN fetch — needs to explain why it doesn't compromise the "nothing leaves your device" guarantee described in the README.
- **Accessibility is WCAG 2.2 AA, not a nice-to-have.** Keyboard operability, visible focus, and never signalling status by colour alone are load-bearing for who this app is for — see [`docs/DESIGN.md`](docs/DESIGN.md).
- **Vault and crypto changes need extra care.** [`src/lib/vaultCrypto.ts`](src/lib/vaultCrypto.ts) and [`src/lib/vaultStore.ts`](src/lib/vaultStore.ts) implement the at-rest encryption for the local vault. Read [`docs/SECURITY.md`](docs/SECURITY.md) first so a change doesn't quietly weaken the threat model it documents.

## Before opening a PR

- Run `npm run lint` and `npm run build` locally.
- If you changed `src/lib/ots.ts`, also run `npm run test:ots` and `npm run test:ots-upgrade`.
- Keep the PR scoped to one change — this is a small prototype, and small PRs are far easier to review against the ground rules above.

## Where to read more

- [`docs/DESIGN.md`](docs/DESIGN.md) — product and accessibility rationale
- [`docs/SECURITY.md`](docs/SECURITY.md) — threat model, and what the vault does and doesn't guarantee
- [`docs/RESEARCH.md`](docs/RESEARCH.md) — prior art review
- [`docs/SETUP.md`](docs/SETUP.md) — disclosure log (licenses, AI-assisted work)

## License

By contributing, you agree your contribution is licensed under the project's [MIT License](LICENSE).
