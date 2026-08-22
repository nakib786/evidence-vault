# Security & privacy

## Core architectural decision: no server-side storage of evidence content

The single biggest security decision for this project: **the actual uploaded image never leaves the user's device**, except optionally, transiently, to a moderation-classification API call (see below). Hashing, timestamping, and PDF generation all happen client-side.

**Why:** storing a database of screenshots documenting hate targeting real people is a liability a student hackathon team has no infrastructure to safely carry — breach exposure, subpoena risk, becoming a target yourself for hosting the data. eyeWitness to Atrocities can do this because it has a legal team, encrypted hosted infrastructure, and an institutional partner (LexisNexis) built for exactly this. We don't have that, and shouldn't pretend to. See [RESEARCH.md](RESEARCH.md) for the full comparison.

This also directly satisfies hackathon rules §06 (Safety, data and AI): *"Do not expose personal information, enable doxxing, profile people by protected identity or build tools for targeted harassment or surveillance."* A tool that holds no persistent database of who-reported-what-about-whom is structurally safer against all of those failure modes.

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

## Disclosure note for submission

Per rules §04, we must disclose what existed before the fresh-work start vs. what was built during the event. Keep a running log (see [SETUP.md](SETUP.md)) — this file itself documents the *plan*, decided during the allowed pre-event research/planning window; the actual implementation happens inside the 48 hours.
