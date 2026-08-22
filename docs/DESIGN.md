# Design direction

## Design principles (trauma-informed, per research)

The person using this tool is, by definition, in the middle of a bad moment — they just saw something targeting them or their community. Design decisions follow from that:

1. **Never trap the user.** Every flow must be exitable at any point with no lost progress and no guilt-trip retention messaging ("are you sure you want to leave?").
2. **Low cognitive load.** Stress and anxiety measurably impair information processing — short sentences, one decision per screen, no dense paragraphs.
3. **No re-exposure without consent.** Don't auto-preview the uploaded image full-size everywhere; let the user choose when to look at it again (e.g. blurred-by-default thumbnail, tap to reveal).
4. **Calm, not clinical.** Avoid alarm-red everywhere and siren-style UI — that mirrors the adrenaline state the user is already in rather than helping them regulate. Reserve high-saturation color strictly for actual status/urgency, not decoration.
5. **Humanize the copy.** Plain language, empathetic microcopy, no legalese in the primary flow (save precision for the generated PDF/report itself).

## Visual language

**Color:** Monochromatic/near-monochromatic base (slate/neutral gray-blue), in the vein of Notion/Linear-style calm dashboards — generous whitespace, restrained palette, color reserved for meaning (status, urgency, confirmation) not decoration. One accent color for primary actions; a separate, deliberately *not* alarm-red tone (e.g. amber) for anything flagged as sensitive/high-severity, so red stays reserved for true destructive actions only.

**Typography:** Sans-serif, accessible-first.
- Body: **Atkinson Hyperlegible** or **Lexend** — both explicitly designed for readability under cognitive load, which matches the trauma-informed brief better than a generic system font.
- Headings: one distinctive but restrained sans (e.g. **Manrope** or **DM Sans**) — don't compete with the body font.
- Avoid decorative/serif display faces — this is a trust product, not a marketing site.

**Layout:** Mobile-first (matches our actual usage pattern — most hate speech is seen in-app on phones). Generous whitespace, large tap targets, card-based sections with soft corners rather than dense tables.

## Screen flow (4 screens, from earlier planning)

1. **Capture** — two options, equally weighted: *record live* (opens the camera in-app, hashed the instant it's captured — stronger authenticity, see RESEARCH.md) or *upload existing* (faster if the moment's already passed). Minimal required fields either way (platform + optional context note)
2. **Process** — hashing + OpenTimestamps kicked off, OCR pre-fills what it can extract, user confirms/edits rather than typing from scratch
3. **Review** — evidence + hash + timestamp status shown clearly ("pending Bitcoin confirmation, independently verifiable"), image thumbnail blurred until tapped
4. **Export** — generates the PDF, downloads locally, done — no account, no dashboard to get lost in

## Accessibility (WCAG 2.2 AA — required, not optional)

This is a civic-safety tool; accessibility isn't a nice-to-have, it's core to who needs this to work. Minimum bar:
- Level **AA** conformance (the standard nearly every accessibility regulation — Section 508, EN 301 549 — actually requires)
- Full keyboard navigability, visible focus states
- Color is never the only signal (pair with icon/text label, especially for severity tags)
- Alt text on every icon-only control
- Captions/transcript on the demo video (also a hackathon submission requirement — see rules §05)
- Test with a screen reader before submission, not after

## Inspiration references (from research, not to copy directly — copyright applies)

- **Notion / Linear** — near-monochromatic dashboard restraint, calm information density
- **Nonprofit sites, 2026 trend direction** — warmer, less corporate palettes; "made by people who care" rather than sterile SaaS chrome. Balance this against the calm/clinical trauma-informed brief — warm but not busy.
- Don't reproduce any specific site's design wholesale; use these as a *feel* reference only.

## What NOT to do

- No gamification (streaks, points, leaderboards) — inappropriate register for this content
- No auto-playing previews of uploaded evidence
- No dark patterns around the "counter-speech" or "report" CTAs — this tool should never feel like it's nudging engagement
