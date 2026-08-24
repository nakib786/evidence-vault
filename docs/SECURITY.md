# Security & privacy

## Core architectural decision: no server-side storage of evidence content

The single biggest security decision for this project: **the actual uploaded image never leaves the user's device**, except optionally, transiently, to a moderation-classification API call (see below). Hashing, timestamping, and PDF generation all happen client-side.

**Why:** storing a database of screenshots documenting hate targeting real people is a liability a student hackathon team has no infrastructure to safely carry — breach exposure, subpoena risk, becoming a target yourself for hosting the data. eyeWitness to Atrocities can do this because it has a legal team, encrypted hosted infrastructure, and an institutional partner (LexisNexis) built for exactly this. We don't have that, and shouldn't pretend to. See [RESEARCH.md](RESEARCH.md) for the full comparison.

This also directly satisfies hackathon rules §06 (Safety, data and AI): *"Do not expose personal information, enable doxxing, profile people by protected identity or build tools for targeted harassment or surveillance."* A tool that holds no persistent database of who-reported-what-about-whom is structurally safer against all of those failure modes.

### The vault: local persistence, still not server-side

The export screen keeps a copy in the vault by default: a saved record persists in the browser's IndexedDB, encrypted at rest (AES-256-GCM, key derived from a PIN via PBKDF2 — see `src/lib/vaultCrypto.ts`), so it can be revisited, its timestamp re-checked, and its files re-downloaded later. That save is undoable with one tap ("Don't keep this copy") on the same screen, applied immediately — including to a save still in progress — so nothing is ever silently kept past the moment someone chooses to discard it. This is a genuine change to the "closing the tab deletes everything" property, and is disclosed as such in the README rather than left implicit. It does **not** change the server-side claim above: the vault never leaves the device, is never synced, and this app still has no backend, no database, and no account system of any kind.

The PIN for this hackathon build is a published default (`1234`), shown on the lock screen and explicitly labelled as demo-only, not real security — a real deployment would have the person set their own PIN privately on first use, the same way it would collect any other credential. What the encryption mechanism protects against, honestly: a browser extension or another piece of code reading raw IndexedDB tables sees ciphertext, not images; it does **not** protect against someone who has the (published) PIN or has read this source.

### Duress PIN: a second unlock code that shows decoy content

Documenting hate speech or harassment can put the person doing it at risk from the people they're documenting — a partner, an employer, a state actor — who may at some point be able to physically compel them to unlock this vault. A PIN screen alone doesn't help in that scenario; refusing isn't always a safe option, and complying hands over everything.

The vault supports a second PIN — a duress PIN — configurable from inside the unlocked vault (`src/components/VaultScreen.tsx`, the "Duress PIN" panel; logic in `src/components/useVault.ts`). Entering it on the lock screen unlocks the vault exactly as normal, but instead of the person's real saved records, it shows only synthetic demo entries — the same fixtures `src/lib/vaultDemo.ts` already builds for judging, marked "Demo" the same way they already are everywhere else in this app. To whoever's watching, that's not a special mode; it's what an ordinary, freshly-loaded vault already looks like here.

What makes this safe rather than security theatre:

- **The duress PIN is a completely independent credential** — its own PBKDF2 salt and its own AES-GCM canary (`src/lib/vaultCrypto.ts`), stored under a separate key in IndexedDB (`src/lib/vaultStore.ts`). It is not derived from, and does not need to know, the real PIN.
- **A duress unlock never derives the real key.** `useVault`'s `unlock()` checks the real PIN's canary first; only if that fails does it check the duress canary. On a duress match, the hook holds `key = null` for the entire session — there is no real key in memory to extract, log, or accidentally expose.
- **A duress unlock never reads real ciphertext.** The decoy records are built fresh in memory from the same public fixtures the demo mode already uses; the function never calls `loadVaultEntries` against the real store. The real entries sit untouched on disk the whole time.
- **Every action inside a duress session is sandboxed to memory.** Saving, removing, or "resetting the vault" while in a duress session only mutates the in-memory decoy list — none of it calls the real `saveVaultEntry`, `deleteEntry`, or `clearVault`. Even a demand to "delete everything" can be complied with, cosmetically, without touching the real data.
- **Changing or removing the duress PIN is owner-only and post-authentication.** That control lives inside the already-unlocked real vault, never on the lock screen.
- **`setDuressPin` refuses a candidate that matches the real PIN** — the real canary is always checked first, so a colliding duress PIN would simply be unreachable.

What this honestly does **not** do: it doesn't hide that a vault app is installed, and it doesn't hide that more encrypted data sits in this device's storage than a duress unlock reveals — someone who images the disk and inspects IndexedDB directly can see there's more ciphertext than the decoy records account for, the same limitation every hidden-volume-style scheme (e.g. VeraCrypt) has. It buys a normal-looking, functioning vault to hand over in the moment; it is not full deniability against forensic inspection after the fact.

**Hackathon-only concession, same as the main PIN:** on first use, `useVault` automatically configures the duress PIN to a published default (`DEFAULT_DURESS_PIN`, `9999`), and the lock screen shows it in a callout next to the main "Demo PIN: 1234" one — but only once it's actually configured, so a fresh vault's lock screen says nothing about it existing until after first unlock. This exists purely so judges can find and try the feature without a setup step. It's also the one deliberate crack in the "nothing before authentication hints a duress PIN exists" property described above — a real deployment would never do this, would never show a duress PIN's value anywhere, and likely wouldn't disclose that the feature exists at all. The mechanism itself doesn't depend on secrecy of the *value* 9999 in the demo build; it depends on the two credentials being independent and the duress path never touching real data, both of which hold regardless of what the duress PIN's value is.

Two smaller safety features ride along with this, both in `VaultScreen.tsx`: the vault re-locks itself after three minutes of no interaction, and the Escape key re-locks it instantly — so it doesn't have to be left open (real or decoy) longer than the person is actually looking at it.

### If this ever grows a database: how to do it without recreating the risk

Nothing above should be read as "a database is off the table forever." It is off the table for *this* prototype, because a student hackathon team has no legal team, no encrypted hosted infrastructure, and no institutional partner to safely carry a database of screenshots documenting hate targeting real people — see the eyeWitness to Atrocities comparison in [RESEARCH.md](RESEARCH.md). A real product built past this hackathon could reasonably add one, but only if it stays at least as safe as having no database at all:

- **Opt-in, off by default.** The zero-egress promise stays true for everyone who never turns this on.
- **Zero-knowledge, not just "encrypted at rest."** Encrypt on-device with a key the server never receives — the same AES-256-GCM/PBKDF2 approach the vault already uses locally, extended so a synced copy is still unreadable to whoever operates the database. A breach of the database alone should yield ciphertext, not evidence.
- **Per-record, consent-gated sharing, not a standing feed.** "Share directly with a concerned authority" should mean generating a specific, time-limited, revocable decryption grant for one record, handed to one named recipient, only when the person taps to do it — never an always-on pipe that hands new reports to police or a platform automatically. Automatic reporting is already ruled out above for a different reason (there is no such API to plug into); it stays ruled out here for a second one: the person filing the report should always decide, per record, who sees it and when.
- **An auditable chain of custody** that logs who a record's grant was issued to and when, without the operator being able to read the record itself — the same kind of custody trail eyeWitness's LexisNexis-hosted layer exists to provide.
- **Compliance matched to who might receive it** — relevant data-protection law in the reporter's jurisdiction (e.g. PIPEDA in Canada), and, if a share target is ever a police service directly rather than a link the person forwards themselves, the additional handling rules that implies (e.g. CJIS in the US) — decided with legal review before it ships, not after.
- **A named institutional partner and legal review.** This is the actual gap between this prototype and eyeWitness's product, and no amount of good architecture substitutes for it.

Skipping all of this and shipping a plain database would be strictly worse than what exists today: it would turn "no persistent database of who-reported-what-about-whom" — the property that satisfies hackathon rule §06 — into a single high-value target holding exactly the personal, protected-identity-linked data that rule exists to keep out of harm's way.

## Threat model

| Risk | Mitigation |
|---|---|
| Malicious file upload (disguised executable, oversized file, malformed image) | Client-side MIME/type allowlist (images only), size cap, no server-side processing of the raw file at all — it's never executed or parsed server-side because there is no server-side storage |
| XSS via uploaded content or user text fields | Strict Content-Security-Policy (see below); never render user text as raw HTML — text-only rendering, no `dangerouslySetInnerHTML`/`innerHTML` equivalents |
| Data leakage via third-party AI calls | Only call the moderation/classification API with the minimum needed (see AI disclosure section); never send it identifying metadata beyond the image itself |
| Reporter's own safety (geolocation exposure) | Geolocation is opt-in only, off by default, with explicit copy explaining it captures *the reporter's* location, not the offending poster's |
| Tampering with evidence after capture | This is the actual point of the hash + OpenTimestamps step — any post-capture edit changes the hash, breaking the timestamp proof |
| Pre-doctored/AI-generated file passed off as a live capture | Live-capture mode (`getUserMedia`) hashes the frame at the instant it's captured, before it's ever saved as an editable file — closes the gap an upload-only flow leaves open |
| Camera access without consent | Browser's native camera permission prompt is the only gate — no camera access without an explicit user grant; never request it before the user picks "record live" |
| Someone else with access to this device reading a saved vault entry | Entries are encrypted at rest (AES-256-GCM), not just gated behind an app-level PIN screen — reading raw IndexedDB storage still yields ciphertext |
| The demo build's PIN being public, undermining the vault's confidentiality | Labelled as demo-only, in-app, everywhere the PIN is shown; a real deployment would collect a private PIN or use device biometrics on first use instead of shipping a default |
| The reporter being physically compelled to unlock the vault | Optional duress PIN opens a decoy vault of demo-only content instead, without deriving the real key or reading real entries — see above |
| A duress unlock behaving detectably differently from a real one (timing, an "are you sure" that a real vault wouldn't show, etc.) | Same unlock function, same KDF cost, same UI components render both; saves/removes/reset inside a duress session are accepted and reflected on screen exactly as a real session would, just never persisted |
| The vault being left open and unattended | Auto-locks after 3 minutes idle; Escape re-locks instantly |

## Content Security Policy

Ship a strict CSP from day one, not as a retrofit:
- `default-src 'self'`
- `script-src 'self'` (+ nonce-based inline only if unavoidable — avoid `unsafe-inline`)
- `img-src 'self' data:` (data: needed for client-side image preview/thumbnailing)
- `connect-src` scoped explicitly to the OpenTimestamps calendar servers and the Workers AI endpoint — nothing else
- No third-party analytics/trackers — not needed for a hackathon prototype and actively at odds with the privacy stance

## OWASP file-upload considerations (adapted for a no-server-storage app)

The classic OWASP file-upload cheat sheet assumes files land on a server — most of it doesn't apply here since we don't persist uploads. What still applies:
- Validate file type/size client-side before any processing (defense against malformed input crashing the hashing/OCR step, not a security boundary by itself — client-side checks are UX, not security, since they're bypassable; but since nothing is ever executed or trusted server-side, there's no privilege to escalate)
- If the Workers AI moderation call is used, that Worker function must validate size/type server-side too, since that's the one point where a file does cross a network boundary

## AI tool disclosure (required by hackathon rules §06)

Every AI-assisted component must be named in the submission with limits and human checks disclosed. Track these as we build:

| Tool | What it's used for | Data sent | Human check performed |
|---|---|---|---|
| Tesseract.js (OCR) | Pre-fill text fields from screenshot | Runs 100% client-side — nothing sent anywhere | User reviews/edits before submit |
| Cloudflare Workers AI (Llama Guard) | Auto-suggest severity/category tag | The uploaded image, transiently, to Cloudflare's inference endpoint | User can override the suggested tag before export |

**Hard rule from §06, restated:** never test against real scraped hateful content. Use redacted, synthetic, or GNCI-provided examples only — real hateful content gets no scoring advantage and creates exactly the exposure risk this whole architecture is designed to avoid.

## Privacy-by-design checklist

- [ ] No account/login required — nothing to breach
- [ ] No analytics/tracking scripts
- [ ] Geolocation off by default, explained plainly if offered
- [ ] Data minimization: only collect what's needed for the report (platform, context note, the image) — no unnecessary form fields
- [ ] TLS everywhere (Cloudflare Pages provides this by default)
- [ ] If any transient server-side processing happens (the AI call), don't log or persist the payload — process and discard
- [ ] Vault persistence defaults to on per record, undoable with one tap and applied immediately (never silent), and encrypted at rest — not merely gated behind a PIN screen
- [ ] Duress PIN: independent credential, never derives or exposes the real key, never reads or writes real entries, and is changeable only from inside an already-unlocked real session (its initial value is a published demo default for judging — see above — not something a real deployment would ship)

## Disclosure note for submission

Per rules §04, we must disclose what existed before the fresh-work start vs. what was built during the event. Keep a running log (see [SETUP.md](SETUP.md)) — this file itself documents the *plan*, decided during the allowed pre-event research/planning window; the actual implementation happens inside the 48 hours.
