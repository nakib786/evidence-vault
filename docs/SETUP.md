# Setup & tech stack

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + Tailwind | Already known from Free Fly — zero ramp-up |
| Upload | `<input type="file" accept="image/*" capture>` | Fallback path — identical behavior on iPhone/Android, no Share Target API/iOS gaps |
| Live capture | `navigator.mediaDevices.getUserMedia` + `<canvas>` frame grab | Records directly through the device camera inside the app; hash the frame the instant it's captured, before it can be pre-edited or AI-generated — see RESEARCH.md's "Added scope" section |
| Hashing | Web Crypto API (`crypto.subtle.digest`) | Built into every browser, no dependency |
| Tamper-proof timestamp | `opentimestamps` (npm) | Free, decentralized, no server to run |
| OCR pre-fill | `tesseract.js` | Client-side WASM, nothing leaves device |
| Severity/category tagging (optional) | Cloudflare Workers AI (Llama Guard) | Same infra as hosting, no self-hosted model to manage |
| PDF generation | `jspdf` or `pdf-lib` | Client-side, no backend needed |
| Local "my reports" list (optional) | IndexedDB / localStorage | No accounts, no database |
| Hosting | Cloudflare Pages (+ Pages Functions if a thin server hop is needed, e.g. CORS-proxying the AI call) | Matches existing deploy pattern |
| Fonts | Atkinson Hyperlegible / Lexend (body), Manrope / DM Sans (headings) | See DESIGN.md |

## Prerequisites to have ready before Aug 22

- [ ] Node.js + npm/pnpm installed and working
- [ ] Cloudflare account confirmed, Pages project name reserved (not deployed — just confirm access)
- [ ] GitHub repo created (empty is fine — first commit happens at fresh-work start)
- [ ] Google Fonts / font files for the chosen typefaces identified
- [ ] Test/synthetic example comments prepared for demoing OCR + tagging (per rules §06 — never use real scraped hateful content)
- [ ] Registration completed — participant agreement signed **by Fri Aug 21, 11:59 PM PT** (separate, earlier deadline from the build window — don't miss this)

## What's allowed before the fresh-work start (rules §04)

> "Work made for this submission begins at Saturday, August 22, 2026 at 12:00 PM Pacific Time. Planning the problem beforehand is allowed. You may use existing tools, templates, libraries, datasets, accessibility aids and reusable infrastructure."

**Allowed now:** everything in this docs folder — research, stack choice, wireframes/flow sketches, picking existing libraries, a build checklist. Generic personal boilerplate/templates you already had before this event also count as "existing... reusable infrastructure."

**Must wait until Sat Aug 22, 12:00 PM PT:** any code, component, or asset that becomes part of the submitted artifact itself.

## Disclosure log

*Required for submission under rules §04–05. This table is the source text for the disclosure section of the submission email.*

### Pre-existing materials used

| Item | Version | Licence | Used for |
|---|---|---|---|
| React / React DOM | 19.2 | MIT | UI framework |
| Vite | 8.2 | MIT | Build tooling |
| Tailwind CSS | 4.x | MIT | Styling |
| TypeScript | 6.0 | Apache-2.0 | Language |
| tesseract.js | 7.0.0 | Apache-2.0 | On-device OCR |
| tesseract.js language data (eng, ara, urd) | 4.0.0 | Apache-2.0 | OCR models, self-hosted |
| jsPDF | 4.2.1 | MIT | PDF report and certificate generation |
| driver.js | 1.8.0 | MIT | Skippable guided walkthrough |
| Atkinson Hyperlegible | 5.3.0 (@fontsource) | OFL-1.1 | Body typeface |
| Manrope | 5.3.0 (@fontsource) | OFL-1.1 | Heading typeface |
| OpenTimestamps public calendar servers | n/a (hosted service) | Free public service, no key or registration | Timestamp attestations |
| `javascript-opentimestamps` | 0.4.5 | LGPL-3.0 | **Dev-only test oracle. Not shipped** — see note below |
| `opentimestamps-client` (Python) | current | LGPL-3.0 | **Dev-only test oracle. Not shipped** |
| `@resvg/resvg-js` | current | MPL-2.0 | **Dev-only.** Renders the synthetic demo fixtures |
| The four documents in this `docs/` folder | — | Own work | Planning and research, written before the fresh-work start under rules §04 |

**Note on the LGPL dependencies.** Neither OpenTimestamps library is bundled, imported, or linked into the shipped application. They exist only in `devDependencies`, where they are used to independently verify that our own `.ots` output parses correctly under the reference implementation. The shipped timestamping code (`src/lib/ots.ts`) is original work written during the event and carries no third-party code.

### Built during the event (from Sat 22 Aug 2026, 12:00 PM PT)

Everything in `src/`, `scripts/`, `public/_headers`, and this README. Specifically including:

- `src/lib/ots.ts` — an original, dependency-free OpenTimestamps client (wire-format codec, timestamp-tree parser/serialiser, multi-calendar merge, detached `.ots` writer)
- `src/lib/{hash,ocr,pdf,taxonomy,types}.ts` — hashing, OCR wrapper, PDF report builder, classification taxonomy
- `src/components/*` — all four screens and the shared UI primitives
- `scripts/*` — asset staging, fixture generation, and the two verification harnesses
- `src/lib/media.ts` — video recording, codec negotiation, duration recovery and frame extraction
- `src/lib/jurisdictions.ts` — the reporting-channel directory for the US and Canada
- `src/lib/certificate.ts` — the certificate of authenticity, drafted to FRE 902(13)/(14) and Canada Evidence Act ss. 31.1–31.3
- `src/lib/coverletter.ts` — the plain-text cover letter
- `src/lib/tour.ts` and `src/components/useTour.ts` — the guided walkthrough
- `src/components/Modal.tsx` and `src/components/WelcomeModals.tsx` — the onboarding dialogs, including the prototype disclosure
- The synthetic demo fixtures in `fixtures/`

### AI tools and services

| Tool | Used for | Data sent off-device | Human check |
|---|---|---|---|
| Tesseract.js (OCR) | Drafting the transcript from the image | **None.** Runs entirely in a Web Worker on the user's device; model files are served from our own origin | Transcript is presented as an editable draft; the user corrects it before export, and the PDF states it was machine-drafted |
| *(none)* | Severity / category classification | — | Chosen by the user from a fixed taxonomy. **No classifier is used and no content is sent to any inference service** — see below |

**Cloudflare Workers AI / Llama Guard was planned and deliberately dropped.** Rule §06 forbids uploading hateful material to a third-party AI service without explicit authorisation and a documented lawful reason, and we have neither. Independently, `@cf/meta/llama-guard-3-8b` is text-only and cannot classify an image, and supports no Arabic or Urdu. Classification is therefore performed by the person filing the report.

**Legal references are cited, not authored.** The certificate of authenticity is drafted with reference to published rules of evidence (FRE 902(13)/(14); Canada Evidence Act ss. 31.1–31.3). No member of this team is a lawyer, the certificate is a template rather than legal advice, and both the document itself and the UI say so. Agency contact details were verified against official sources on 2026-08-22 and the UI directs users to confirm them on the agency's own site.

**Claude (Anthropic) was used as a coding assistant** during development — for research, code authorship, and review. All architectural decisions, the safety analysis, and the final content of the application were reviewed by a human before submission.

### Safety and privacy limits

- No real hateful content was created, collected, scraped, or processed at any point. Demo fixtures are synthetic and generated from source (`scripts/make-fixtures.mjs`).
- The application stores nothing server-side and has no account system, database, analytics, or telemetry.
- The only outbound network request carrying user-derived data is a 32-byte SHA-256 digest sent to public OpenTimestamps calendars. It is one-way and reveals nothing about the image.
- Geolocation is not collected at all, and is additionally blocked at the browser level via `Permissions-Policy`. Camera and microphone are permitted to `self` only, and are never opened until the user chooses a live capture mode.
- The only value written to browser storage is a single boolean recording that the walkthrough has been shown. It records that a tour was displayed, never any report content.
- The declarant's name and contact on the certificate of authenticity are the only personal data the app ever handles. They are optional, never prefilled, never stored, and the UI warns that this document — unlike every other file in the export — identifies the person who signs it.
- **No report is transmitted to any agency.** The app cannot file a police report and does not claim to; it routes the user to the correct channel and they take it themselves. This is stated on the screen itself, not just in documentation.
- Known limits — OCR accuracy, the Arabic/Urdu PDF font gap, pending-until-confirmed timestamps, and what a timestamp does and does not prove — are documented in the README and restated on the final page of every exported report.

## Project structure (proposed)

```
/src
  /components   — Capture, Process, Review, Export screens
  /lib          — hash.ts, timestamp.ts (OpenTimestamps wrapper), ocr.ts, pdf.ts
/public
/docs           — this planning doc set (DESIGN.md, SECURITY.md, RESEARCH.md, SETUP.md)
```

## Submission checklist (rules §05 — don't build against a stale memory of this, re-check `/hackathons/rules` closer to the deadline)

- [ ] Short project summary: problem, intended users, proposed response
- [ ] Working artifact (the deployed prototype)
- [ ] Public/access-enabled GitHub or Drive link, judge-openable
- [ ] Demo video **with accurate captions or an accompanying transcript**
- [ ] Disclosures: prior materials, external assets, AI tools, datasets, licenses, safety/privacy limits
- [ ] Email everything to salam@combattingislamophobia.org by **Mon Aug 24, 12:00 PM PT** — this email is the only thing that counts as submission
