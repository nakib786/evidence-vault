# Research — prior art & reusable components

Compiled ahead of The Harvest (Aug 22–25, 2026). Per the official rules §04, planning and research before the fresh-work start (Sat Aug 22, 12:00 PM PT) is explicitly allowed — only the actual build has to happen inside the 48-hour window.

## The problem space

Existing evidence-capture tools split into two camps: **legal/forensic-grade** (built for courts, heavy institutional backing) and **general screenshot/archiving** (lightweight, not built for hate speech specifically). Nothing found combines "built for hate speech reporting" + "open source" + "mobile-first" + "zero server-side storage."

## Legal/forensic-grade evidence tools

| Tool | What it does | License | Relevance |
|---|---|---|---|
| [eyeWitness to Atrocities](https://www.eyewitness.global/) | Mobile app embedding GPS/sensor metadata + hash at capture, encrypted on-device vault, uploads to a LexisNexis-hosted chain-of-custody server reviewed by a legal team | Closed source | Gold-standard reference architecture — see breakdown below |
| [Evidence Collector](https://evidencecollector.org/en) | Forensic screenshot tool: SHA-256 hash at capture + FreeTSA timestamp + OpenTimestamps (Bitcoin) anchor | Unclear/commercial | Proves the hash+timestamp pattern is standard practice, not a novel idea — good to cite |
| [ArchiveBox](https://github.com/archivebox/archivebox) | Self-hosted web archiving with audit logging | Open source (MIT) | Reference for "archive full context, not just a screenshot" |

### eyeWitness architecture breakdown (what to borrow vs. skip)

1. **Capture layer** — embeds GPS, timestamp, device sensor data, nearby Bluetooth/Wi-Fi into the file; hashes it for tamper-evidence. *Borrow the hash-at-capture concept.*
2. **Custody layer** — encrypted upload to a hosted vault (LexisNexis), which is what legally establishes chain of custody. *Skip — this requires institutional backing we don't have and shouldn't take on the liability of hosting hateful content targeting real people.*
3. **Human layer** — 4 full-time staff + ~40 pro bono lawyers triage submissions into court-ready dossiers. *Skip — not our role. Our tool formats output for whoever the user hands it to (platform, CAIR-style org, school/HR); we don't do the triage ourselves.*

## Reusable open source components

| Component | Purpose | Package |
|---|---|---|
| **OpenTimestamps** | Free, decentralized, Bitcoin-anchored proof-of-existence for a file hash. Zero server to run/maintain. Directly substitutes for eyeWitness's institutional custody layer. | `opentimestamps` (npm) |
| **[SingleFile](https://github.com/gildas-lormeau/SingleFile)** | Open source browser extension, saves a full self-contained HTML snapshot of a page (not just an image) and *already has OpenTimestamps-based "proof of existence" built in*. Desktop-only. | Browser extension, MIT-ish license — check exact terms before redistributing |
| **[Tesseract.js](https://github.com/naptha/tesseract.js)** | Client-side OCR (WASM), auto-extracts visible text from an uploaded screenshot so users confirm pre-filled fields instead of typing from scratch | `tesseract.js` (npm) |
| **Cloudflare Workers AI — Llama Guard** | Hosted content-moderation/classification model, callable from a Worker with no infra to manage; fits our Cloudflare deploy target | Cloudflare Workers AI binding |
| **[Detoxify](https://github.com/unitaryai/detoxify)** | Open source toxicity classifier (PyTorch) — fallback option if we want a self-hosted/offline classifier instead of a hosted API | `detoxify` (PyPI) — heavier to deploy than Workers AI |

**Decision:** prefer Cloudflare Workers AI over Detoxify for the hackathon build — same infra as our hosting, zero deployment overhead, generous free tier. Note Google's Perspective API is **shutting down Dec 31, 2026** — don't build a dependency on it.

## Adjacent prior art (not directly reusable, but informs design/positioning)

- **[HeartMob / Right To Be](https://iheartmob.org/pages/about-page)** (formerly Hollaback) — closed platform for harassment reporting + bystander support. Prior art for a "counter-speech" feature; not open source.
- **Dog-whistle/coded-language glossaries** — no single open source database found; mostly academic papers (e.g. "Digital Dog Whistles: The New Online Language of Extremism"). A curated glossary would be original work, not something to integrate.

## Key architectural decision this research led to

Do **not** replicate eyeWitness's server-side vault. Client-side hash + OpenTimestamps + local PDF export, no server-side storage of the actual hateful content. This is both easier to build in 48 hours and the more defensible design choice — see [SECURITY.md](SECURITY.md) for the full rationale.

## Added scope: live capture, not just upload

Uploading an existing screenshot has a real weakness eyeWitness's actual product doesn't have: the file could already have been edited or AI-generated before it ever reaches our app — increasingly plausible as image-generation/editing tools get better at faking a convincing "screenshot." eyeWitness's app avoids this because it captures photo/video *through its own camera*, embedding metadata at the exact moment of capture, so there's no gap for a pre-doctored file to enter the chain.

**Decision:** add a live-capture mode alongside upload — record directly through the device camera inside our PWA (`navigator.mediaDevices.getUserMedia`), hash the frame the instant it's captured, before it's ever saved as an editable file. This borrows eyeWitness's actual core authenticity mechanism (capture-time metadata, not post-hoc upload) while staying inside our client-side, no-server-storage architecture — see [SETUP.md](SETUP.md) for the stack addition and [DESIGN.md](DESIGN.md) for the updated capture screen.

This also extends the eyeWitness parallel to the "handover" step: eyeWitness compiles verified footage into dossiers via its own legal team for investigators and courts. We don't have that team or infrastructure, so Evidence Vault's equivalent is a well-structured, self-contained export (hash + timestamp proof + context) that the *user* hands directly to a platform, police, or court themselves — same intent (getting verifiable evidence to the people who can act on it), lighter mechanism.
