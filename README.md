# Evidence Vault

**Document hate speech in a way that still holds up later — without handing your evidence to anyone.**

**Live: https://evidence-vault-8o6.pages.dev**

Built for [The Harvest Anti-Muslim Hate Hackathon](https://combattingislamophobia.org/hackathons/rules) (GNCI), 22–24 August 2026.

---

## The problem

Someone sees a post targeting them or their community. By the time they decide to report it, it has been deleted. Or they screenshot it, and the platform asks how they know it is real. Or they hand it to a community organisation that needs to show a pattern across dozens of incidents, and every screenshot is just a PNG that anyone could have made in an image editor.

The tools that solve this properly — [eyeWitness to Atrocities](https://www.eyewitness.global/) is the gold standard — solve it by uploading everything to an institutionally-backed vault with a legal team attached. That model works, and it is completely out of reach for the people who need this on a Tuesday afternoon.

## What this does

Evidence Vault produces a **tamper-evident, independently verifiable record** of a piece of content, entirely on your own device.

1. **Capture** — **record video with sound**, photograph it live, or import a file you already have.
2. **Secure** — the file is fingerprinted with SHA-256 and the fingerprint is submitted to public [OpenTimestamps](https://opentimestamps.org) calendar servers, which register it on a public blockchain ledger. No cryptocurrency is bought, sold or held; the ledger is used only as a public record nobody can alter after the fact.
3. **Review** — add context in your own words. Optionally pull the text off an image with on-device OCR, in English, Arabic or Urdu.
4. **Send** — pick your jurisdiction and see who actually takes these reports near you, and through which channel. Optionally generate a **certificate of authenticity** written to your jurisdiction's evidence rules.
5. **Export** — a PDF report, the original file, a `.ots` proof, a cover letter, and the certificate — all saved locally. From here you can also, optionally, **keep an encrypted copy in the vault** on this device — see below.

Video matters here more than stills. Street harassment, a confrontation, abuse shouted at someone — none of that is a screenshot, and the words are usually the evidence. Recordings carry audio by default, are hashed the moment recording stops, and appear in the report as a timecoded contact sheet, because a PDF cannot play a video.

The result proves two things to anyone you hand it to: **this exact file existed no later than this timestamp**, and **it has not been altered since**. Verification uses the standard OpenTimestamps tooling and does not depend on this app, its authors, or any server we control — including after this project stops being maintained.

## The part that matters most

**Nothing leaves your device.** Not the image, not your notes, not the text read off the image.

The single exception is a 32-byte SHA-256 digest sent to public timestamp calendars. A digest is a one-way fingerprint: it cannot be turned back into the image, and it reveals nothing about what the image contains. The calendars learn that *a* file existed. They cannot learn *which* file, what it showed, or who you are.

There is no account, no database, no analytics, and no server-side storage of any kind — that stays true everywhere in the app, always. There is no API this app talks to except the timestamp calendars.

The export screen **keeps a copy in a vault by default**, so a record can be revisited later, its timestamp re-checked once confirmed, and its files re-downloaded as many times as it needs to go out — to a platform, then a community organisation, then a lawyer, then police — without repeating capture. That save can be undone with one tap, right there on the export screen ("Don't keep this copy"), and takes effect immediately, including cancelling a save still in progress. Skip that and closing the tab is a complete, irreversible delete — nothing lingers unless it was actively kept. The vault:

- Lives entirely in this browser's local storage (IndexedDB) — never a server, never synced anywhere.
- Is encrypted at rest with AES-256-GCM, keyed by PBKDF2 from a PIN, so the raw browser storage holds ciphertext rather than your files.
- Is gated by a **demo PIN** for this hackathon build, printed on the lock screen and explained as exactly that — see [Safety and limits](#safety-and-limits).
- Supports a **duress PIN** — entering it on the lock screen instead of the real PIN opens a decoy vault of demo-only content, for anyone ever compelled to unlock it. Set to a published demo value (`9999`) automatically on first use, shown on the lock screen alongside the main PIN so judges can find it; change or remove it from inside the unlocked vault. The real key is never derived and real entries are never read during a duress unlock — see [docs/SECURITY.md](docs/SECURITY.md) for exactly what that guarantees and what it doesn't.
- Auto-locks after a few minutes idle, and locks instantly on the Escape key.

For completeness, beyond the vault (which is undoable with one tap and visibly labelled everywhere it appears), the app writes exactly one other thing to your browser's storage: a single boolean recording that the walkthrough has been shown, so it does not reappear every visit. It records that a tour was shown — never what you captured, wrote, or reported.

### Why there is no AI classifier

The original plan included a hosted content classifier to auto-suggest a severity tag. It was cut, for two reasons that both point the same way:

- **Hackathon rule §06** states: *"Do not upload hateful material or personal data to a third-party AI service unless you have explicit authorization and a lawful, documented reason."* We have neither.
- The obvious candidate, Llama Guard 3 on Workers AI, is **text-only** — it cannot classify an image at all. Its supported languages are English, French, German, Hindi, Italian, Portuguese, Spanish and Thai: **no Arabic, no Urdu**. An English-only classifier would have quietly under-rated exactly the content this tool exists to document.

So the person who saw the content chooses the category, from [a taxonomy of conduct](src/lib/taxonomy.ts). They are a better classifier than an English-only model, and the app stays zero-egress. The Arabic and Urdu support went into the OCR instead, where it runs locally and costs nobody their privacy.

## Where this is going

The app is a **working prototype** — the fingerprinting, timestamps, exports and verification are real, not mocked — and it says so in its own opening dialog rather than only in this file. What a full product needs next:

- **A browser extension.** Capture a post from the platform along with the live metadata behind it — author handle, post ID, server timestamps, the page as served — instead of relying on a photograph of a screen. This closes the biggest remaining gap: right now the app can prove a *file* is unaltered, but not that the file faithfully represents a page.
- **Native Android and iOS apps.** Faster capture from the lock screen, better handling of long recordings, and access to camera metadata a browser cannot reach.
- **A disguisable app.** A changeable icon and app name, so the app on a home screen does not announce itself as a reporting tool. For someone documenting a person they live or work with, that is a safety requirement rather than a nicety — and it is the feature most directly aimed at the reporter's own risk.
- **A secure, opt-in vault sync.** The vault lives only in this browser today — deliberately, not as an oversight (see [The part that matters most](#the-part-that-matters-most)). A full product could add a properly built, compliant database instead of a plain one: encrypted before anything leaves the device so the record stays unreadable to whoever operates it, letting someone reach their own vault from a second device, and — only with an explicit tap, one record at a time — hand a record straight to a platform, a community organisation, or police as a time-limited, revocable link rather than an emailed file. Doing this safely needs the legal backing and audited hosting infrastructure eyeWitness to Atrocities has and this prototype doesn't (see [docs/SECURITY.md](docs/SECURITY.md)) — a reason to design it carefully later, not a reason to fake it now.

## Getting it to someone who can act

There is **no API** — public or private — for submitting evidence to police forces or courts in the United States or Canada. Any tool with a "send to police" button either opens a web form for you or is lying about what it does. Filing a false report is itself an offence, and leaving someone *believing* they had filed a report when they had not would be actively dangerous.

So the app does the useful, truthful thing instead. It asks where you are and shows who actually takes these reports — local police, federal bodies, and community organisations — with each one's **real** channels.

That last part changed the design. Researching this surfaced something worth stating plainly: **most police services have no online hate-crime form at all.** The NYPD directs people to call their precinct; Chicago publishes a phone number for its hate crimes unit. Presenting a web link as the default would send people down a path that mostly does not exist, so phone, web and in-person routes are shown with equal weight and each entry says what it will actually accept.

### The certificate of authenticity

Both countries have a route for authenticating electronic records by written certification rather than live testimony, and both are built around exactly what this app already produces:

- **United States** — [Federal Rules of Evidence 902(13) and 902(14)](https://www.americanbar.org/groups/litigation/resources/newsletters/trial-evidence/new-rules-self-authenticating-electronic-evidence/), in force since December 2017. Rule 902(14) is written almost literally around hash comparison: a copy of data is self-authenticating if identified by a reliable digital process and certified by a qualified person.
- **Canada** — [Canada Evidence Act ss. 31.1–31.3](https://laws-lois.justice.gc.ca/eng/acts/C-5/section-31.1.html). Section 31.1 places the authentication burden on the party presenting an electronic document; 31.2 and 31.3 deal with the best evidence rule and proving the integrity of the electronic documents system.

The app generates a certificate drafted to that structure, which you print and sign by hand. It is careful about two things: it never asserts the *content* is true, only that the file is unaltered and existed by a given time; and it says in its own text that it is a template requiring review by counsel, not legal advice.

Courts get an honest answer too — they do not accept evidence from the public, so the app says so and explains what to do instead.

### The vault

The app is called Evidence Vault, and until now nothing in it actually stayed anywhere — closing the tab deleted the record, structurally, with no way back. That's a defensible default, but it left the name over-promising: there was no vault to revisit.

The export screen now offers to keep an encrypted copy, on this device only. Opening it later shows:

- The record, exactly as captured, with the same blur-until-revealed treatment as the main flow.
- Its timestamp status — pending, or confirmed with the Bitcoin block height — with a button to re-check a pending proof against the calendars.
- Every export file, regenerated on demand, so the same package can go out to a platform, a community organisation, a lawyer and the police in turn, without repeating the capture flow each time.
- A remove action, scoped to this device only.

It's locked with a **PIN**, demo-labelled as such: `1234` is shown on the lock screen itself, described plainly as *not real security* — anyone who reads the code or the screen has it. What is real underneath: the vault is encrypted at rest with a key derived from that PIN via PBKDF2, using AES-256-GCM, so the mechanism the lock screen demonstrates is genuine, even though the specific PIN it ships with is public by design. A shipped, non-hackathon version would have the person set their own PIN privately, the first time, rather than publishing a default.

Because rule §06 rules out testing this against anything real, the vault can seed itself with three synthetic entries built from the same `fixtures/` images the rest of the app uses for demos — one with no timestamp, one pending, one shown as confirmed with a fabricated block height. Every synthetic entry is labelled **Demo** everywhere it appears, was never submitted to a real calendar, and is excluded from the live re-check (which only ever runs against a real, user-saved record's real proof).

That live re-check has a real limitation worth stating outright: OpenTimestamps calendars serve their submission endpoint (`POST /digest`) with the CORS headers a browser needs, but not all of them do the same for the endpoint an upgrade check reads from (`GET /timestamp/…`). When a calendar doesn't, the browser blocks the response and the app says so plainly rather than implying a retry will help — and points at the standalone `ots` CLI or opentimestamps.org, neither of which are affected, since they aren't browsers.

## Try it

Open **https://evidence-vault-8o6.pages.dev** — no account, no sign-up. Or run it locally:

```bash
npm install && npm run dev
```

Sample images to test with are served at `/fixtures/` and committed under [`fixtures/`](fixtures/). They are synthetic (see [Safety](#safety-and-limits)).

To verify a proof the app produced, using the reference implementation rather than our code:

```bash
pip install opentimestamps-client && ots verify evidence-xxxx.png.ots
```

## How it is built

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 19 + Vite 8 + Tailwind 4 | TypeScript throughout |
| Hashing | Web Crypto (`crypto.subtle`) | No dependency |
| Timestamping | **Hand-rolled OpenTimestamps client** — [`src/lib/ots.ts`](src/lib/ots.ts) | ~330 lines, zero dependencies. See below. |
| Vault storage | IndexedDB, hand-rolled wrapper — [`src/lib/vaultStore.ts`](src/lib/vaultStore.ts) | Entries encrypted with AES-256-GCM before they're written; key derived from a PIN via PBKDF2 — [`src/lib/vaultCrypto.ts`](src/lib/vaultCrypto.ts) |
| OCR | tesseract.js 7, self-hosted WASM + language data | English, Arabic, Urdu |
| Video | `MediaRecorder` + `canvas` frame extraction | Codec negotiated per browser; contact sheet for the report |
| PDF | jsPDF | Lazy-loaded; only the export screen pays for it |
| Walkthrough | driver.js | Lazy-loaded; skippable, and never shown mid-flow |
| Fonts | Atkinson Hyperlegible + Manrope, self-hosted | Both OFL-1.1 |
| Hosting | Cloudflare Pages | Static; no server-side code at all |

### Why the OpenTimestamps client is hand-written

The `opentimestamps` npm package was last published in **January 2021**, is **LGPL-3.0**, and depends on `fs`, `request`, `request-promise` and `bitcore-lib` — none of which work in a browser bundle without heavy Node polyfills.

Since the wire format is small and well specified, [`src/lib/ots.ts`](src/lib/ots.ts) implements it directly: varint/varbyte codecs, the timestamp tree parser and serialiser, multi-calendar merging, and the detached `.ots` file format. It is MIT-clean and adds nothing to the dependency tree.

Three findings from building it that are not in any documentation we could find:

- The calendars answer `OPTIONS` with **404**, so a browser request must stay CORS-*simple*. Sending the digest with `Content-Type: application/octet-stream` triggers a preflight and fails; sending it as a bare `Uint8Array` body with no `Content-Type` works.
- Four calendars are queried in parallel and their proofs are **merged into a single `.ots`**, so a proof does not depend on any one calendar operator staying online.
- The endpoint an *upgrade* check reads from (`GET /timestamp/…`, used by the vault's "check for confirmation") does not consistently send CORS headers, unlike `/digest`. A plain script or the reference `ots` CLI reads it fine; a browser silently can't. There's no client-side fix for a response header a server doesn't send — see [the vault](#the-vault) above for how the app handles that honestly instead of hiding it.

Correctness is not taken on trust. [`scripts/ots_validate.py`](scripts/ots_validate.py) parses our output with the **reference Python implementation**, [`scripts/ots-verify-roundtrip.mjs`](scripts/ots-verify-roundtrip.mjs) exercises the full multi-calendar submission path, and [`scripts/ots-upgrade-check.mjs`](scripts/ots-upgrade-check.mjs) checks the upgrade path against both a known-confirmed proof and the live calendars:

```bash
npm run test:ots && python scripts/ots_validate.py .tmp/multi.bin.ots
npm run test:ots-upgrade
```

## Design

The person using this just saw something targeting them. Every screen follows from that — see [`docs/DESIGN.md`](docs/DESIGN.md).

- **The captured image is blurred until you choose to look at it.** You never have to see it again to finish the record.
- **Every field is optional.** A record with only a fingerprint and a timestamp is still useful. Demanding a written account from someone who is upset is friction this tool should not add.
- **Nothing traps you.** No retention prompts, no "are you sure", no dashboard to get lost in.
- **No gamification**, no alarm-red interface mirroring the state the user is already in.

Accessibility targets WCAG 2.2 AA: full keyboard operation, visible focus, semantic landmarks, status never signalled by colour alone, and body text set in Atkinson Hyperlegible — a typeface designed for readability under cognitive load.

## Safety and limits

**No real hateful content was created, collected or used anywhere in this project.** The demo fixtures are synthetic: they reproduce the *layout* of a social media post, while the body text is an explicit placeholder that names the category it stands in for rather than enacting it. They are generated from source by [`scripts/make-fixtures.mjs`](scripts/make-fixtures.mjs). The vault's own demo entries reuse these same synthetic fixtures — see [the vault](#the-vault) — and are labelled **Demo** everywhere they're shown, so nothing in it can be mistaken for a real submission.

What a record here **does** establish:
- This exact file existed no later than the confirmed timestamp.
- It has not been altered since — any change breaks the proof.

What it **does not** establish:
- That the content is genuine, or that the account shown published it. A timestamp proves when a file existed, not that its contents are true.
- Who created the content, or their intent.
- Any legal conclusion. This is a record, not a legal determination, and its authors are not lawyers.

The exported PDF states all of this on its own final page, so the limits travel with the document rather than living only in this README.

**Live capture is the stronger record.** An imported screenshot could in principle have been edited before the app ever saw it; a live capture is hashed from the camera frame before it is written to a file. The report always says which route was used.

**Known gaps.** OCR accuracy on stylised or low-contrast images is imperfect and every transcript is presented as a draft for the user to correct. Arabic and Urdu transcripts ship as a companion `.txt` file because the PDF's built-in fonts cannot render those scripts. Timestamps are pending for a few hours until the ledger confirms them. The app depends on public calendar servers being reachable at capture time; if they are not, it says so and continues with the fingerprint alone.

## Disclosures

Prior materials, licences, and AI-assisted work are logged in [`docs/SETUP.md`](docs/SETUP.md#disclosure-log). Security architecture and threat model: [`docs/SECURITY.md`](docs/SECURITY.md). Prior art review: [`docs/RESEARCH.md`](docs/RESEARCH.md).

## Licence

MIT.
