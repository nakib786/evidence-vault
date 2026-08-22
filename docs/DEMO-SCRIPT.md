# Demo video — shot script

**Target length: 3:30–4:00.** Rules §05 require accurate captions or an accompanying transcript; [`DEMO-TRANSCRIPT.txt`](DEMO-TRANSCRIPT.txt) and [`DEMO-CAPTIONS.vtt`](DEMO-CAPTIONS.vtt) are both ready to submit alongside the video.

Communication is 10% of the score and Innovation is 15%. Three things a reviewer must come away with:

1. It produces a proof **anyone can independently verify**, without trusting us.
2. **None of the content ever leaves the device.**
3. It gets the evidence to someone who can act — **honestly**, without pretending to file a police report.

## Before recording

- [ ] Open **https://evidence-vault-8o6.pages.dev** in a clean browser window — no extensions, no bookmarks bar
- [ ] Phone, or a narrow browser window (~400px). This is a mobile-first tool; show it as one
- [ ] Have `fixtures/synthetic-post-english.png` where the file picker can reach it
- [ ] Have a short **synthetic** video clip ready for the recording shot (see note below)
- [ ] Terminal open, already `cd`'d to the folder holding the exported files
- [ ] Clear the tour flag so the walkthrough appears: in the console, `localStorage.removeItem('evidence-vault:tour-seen')`
- [ ] Close anything with personal data — no email, no notifications, no real accounts on screen

**Do not** use real hateful content, a real account, or a real person's post at any point. For the live-recording shot, point the camera at a blank wall or a printed synthetic fixture and narrate over it — do **not** stage a re-enactment of harassment, which would mean creating the material rule §06 forbids.

---

## Shot list

| # | Time | Visual | Beat |
|---|---|---|---|
| 1 | 0:00–0:20 | Title card, then the capture screen | The problem |
| 2 | 0:20–0:35 | Intro dialog → **Continue** → tour dialog → **Show me around** → a popover or two → close | The walkthrough, and that it is skippable |
| 3 | 0:35–1:00 | Tap **Start recording**, capture a few seconds, stop | Video capture — the headline feature |
| 4 | 1:00–1:20 | Securing screen; fingerprint appears | Hashing + timestamp |
| 5 | 1:20–1:45 | Review screen: blurred preview, tap to reveal, length/sound, "What was said" | Trauma-informed design |
| 6 | 1:45–2:05 | Category dropdown, then OCR language selector on a still | Classification + multilingual OCR |
| 7 | 2:05–2:40 | **Send** screen: pick country/city, agencies appear with phone + web | The handover — and the honest disclaimer |
| 8 | 2:40–3:00 | Tick the certificate box, show the FRE/CEA citation | Court-ready output |
| 9 | 3:00–3:15 | Export screen, five download rows | The package |
| 10 | 3:15–3:45 | **Terminal.** `sha256sum` and `ots verify` | Independent verification — the payoff |
| 11 | 3:45–4:00 | Footer privacy text; close the tab | The privacy claim |

---

## Narration (read aloud; matches the transcript exactly)

> **[Shot 1 — 0:00]**
> Someone shouts abuse at a woman on a bus. Someone posts a threat about a mosque. By the time anyone reports it, the post is deleted — or the video is just a file on a phone that anyone could have edited.
> This is Evidence Vault. It turns what you saw into a record that still holds up weeks later, without handing your evidence to anyone.

> **[Shot 2 — 0:20]**
> There's a short walkthrough the first time you open it. You can skip it — nobody should have to sit through a product tour to report what just happened to them.

> **[Shot 3 — 0:35]**
> Most of what this documents is spoken, not written. So the main way in is video, with sound — because the words are usually the evidence. It's fingerprinted the moment you stop recording, before it's ever a file that could be edited.

> **[Shot 4 — 1:00]**
> That fingerprint is a SHA-256 hash. Change a single frame and it changes completely.
> Then the fingerprint — and only the fingerprint — goes to four independent OpenTimestamps calendar servers, which register it on a public blockchain ledger. No cryptocurrency changes hands. Your recording never goes anywhere.

> **[Shot 5 — 1:20]**
> The person using this just lived through it. So the recording stays blurred until they choose to look, and they never have to look again to finish. Every field is optional.

> **[Shot 6 — 1:45]**
> They choose the category themselves. We ship no AI classifier — the rules forbid sending hateful material to a third-party service, and the obvious model is text-only with no Arabic or Urdu support anyway.
> That multilingual capability went here instead: on-device text recognition in English, Arabic and Urdu, running in the browser.

> **[Shot 7 — 2:05]**
> Then the part most tools skip. Where does this actually go?
> No police force or court in the US or Canada accepts evidence through an automated submission — so we don't pretend to file one. Instead: tell it where you are, and it shows who takes these reports and *how*.
> That "how" matters. Most police services have no online hate-crime form at all. The NYPD tells you to call your precinct. Chicago publishes a phone number. So phone and web are shown side by side, and each one says what it will actually accept.

> **[Shot 8 — 2:40]**
> And for a lawyer or a court, it generates a certificate of authenticity — written to Federal Rules of Evidence 902, or the Canada Evidence Act, depending on where you are. Those rules let electronic records be authenticated by hash value instead of live testimony, which is exactly what this app already produces.

> **[Shot 9 — 3:00]**
> The export is five files: the report, the original recording, the proof, the certificate, and a plain-text cover letter you can paste straight into a reporting form.

> **[Shot 10 — 3:15]**
> Here's what matters most. I'm verifying with the *official* OpenTimestamps client — not our code.
> The fingerprint matches this exact file, and the file existed no later than that timestamp. Anyone can run that check, anywhere, and it keeps working even if this project disappears tomorrow.

> **[Shot 11 — 3:45]**
> No account. No database. No analytics. Closing the tab deletes everything, because there was never anywhere else for it to be.
> A timestamp proves *when* a file existed and that it hasn't changed — not that its contents are true. The report says exactly that on its own final page, so nobody downstream over-reads it.
> Evidence Vault. Open source, MIT licensed.

---

## Shot 10 in detail — the verification moment

The most persuasive thirty seconds in the video. Use a real terminal, not a slide.

```bash
ls
```

```bash
sha256sum evidence-a1b2c3d4.webm
```

```bash
ots verify evidence-a1b2c3d4.webm.ots
```

Cut between the `sha256sum` output and the same value printed in the PDF, so the match is *seen* rather than asserted.

> **If `ots verify` reports the attestation is still pending:** expected and normal for the first few hours, and better addressed on camera than hidden. Say: *"The ledger attestation is still pending — that confirms within a few hours. What's already proven is that four independent calendars accepted this fingerprint at this time."* Then run `ots info`, which prints the full proof tree and calendar URIs immediately.
>
> For a **fully confirmed** proof on camera, stamp a throwaway file early and record this shot last:
> ```bash
> npm run test:ots
> ```

## Shot 7 in detail — the handover

Do not rush this. It is the part no comparable tool does, and the disclaimer is a feature, not fine print. Make sure the line **"This app does not file anything for you"** is legible on screen while you say it.

Show **both** countries if time allows — switching from United States to Canada swaps the whole agency list *and* the cited evidence law, which demonstrates the depth in about four seconds.

## Accessibility of the video itself

- Submit `DEMO-CAPTIONS.vtt` with the upload, or paste `DEMO-TRANSCRIPT.txt` into the submission email. Rules §05 make this mandatory.
- Speak at a measured pace. Do not rely on on-screen text alone to carry meaning.
- Background music, if any, at least 25 dB below speech — or leave it out.
