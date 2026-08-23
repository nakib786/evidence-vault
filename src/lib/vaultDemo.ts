/**
 * Synthetic vault entries, for demonstrating the vault without any real evidence in it.
 *
 * Hackathon rule §06 bars creating or testing against real hateful content, so this app
 * has no real incidents to pre-populate a vault with — same reason `fixtures/` and
 * `scripts/make-fixtures.mjs` exist. These entries reuse those same three images, read the
 * exact placeholder text baked into each one back out as the transcript, and attach
 * clearly fabricated proof data spanning the three states a real record can be in
 * (confirmed, pending, none) so the vault has something to show on first look.
 *
 * Every entry this produces is flagged `isDemo: true`. Nothing here is submitted to a
 * real OpenTimestamps calendar, and `vaultStatus.ts` / the vault screens never present a
 * demo entry's status as if it were real.
 */
import { sha256Blob, toHex } from './hash';
import { emptyDetails, type EvidenceRecord } from './types';

interface DemoSeed {
  file: string;
  platform: string;
  note: string;
  category: string;
  severity: string;
  transcript: string;
  ageHours: number;
  proof: 'confirmed' | 'pending' | 'none';
}

const DEMO_CALENDARS = ['https://a.pool.opentimestamps.org', 'https://b.pool.opentimestamps.org'];

const SEEDS: DemoSeed[] = [
  {
    file: '/fixtures/synthetic-post-english.png',
    platform: 'a social media platform',
    note: 'Demo entry, included so the vault has something to show without needing real evidence.',
    category: 'dehumanising',
    severity: 'serious',
    transcript:
      'SYNTHETIC EXAMPLE — NOT REAL CONTENT.\n\n' +
      'This block stands in for a post containing dehumanising language directed at a religious ' +
      'community. The real wording is deliberately not reproduced anywhere in this project, in ' +
      'either the code or the test data.\n\n' +
      'It exists so the optical character recognition, the fingerprinting and the report export ' +
      'can be demonstrated end to end without creating or handling hateful material.',
    ageHours: 30,
    proof: 'confirmed',
  },
  {
    file: '/fixtures/synthetic-post-arabic.png',
    platform: 'a messaging app screenshot',
    note: '',
    category: 'targeted-harassment',
    severity: 'severe',
    transcript:
      'مثال تجريبي — ليس محتوى حقيقيًا.\n\n' +
      'هذا النص بديل يوضح كيفية قراءة النص العربي داخل التطبيق. لا يحتوي على أي عبارات مسيئة.\n\n' +
      'الهدف منه هو اختبار التعرف الضوئي على الحروف والتأكد من عمل التقرير باللغة العربية.',
    ageHours: 3,
    proof: 'pending',
  },
  {
    file: '/fixtures/synthetic-post-urdu.png',
    platform: '',
    note: '',
    category: '',
    severity: '',
    transcript:
      'نمونہ مثال — یہ حقیقی مواد نہیں ہے۔\n\n' +
      'یہ متن صرف اردو تحریر کی جانچ کے لیے ہے۔ اس میں کوئی نفرت انگیز بات شامل نہیں ہے۔\n\n' +
      'اس کا مقصد رپورٹ اور تحریر کی شناخت کو جانچنا ہے۔',
    ageHours: 0.2,
    proof: 'none',
  },
];

async function buildOne(seed: DemoSeed, index: number): Promise<{ record: EvidenceRecord; demoConfirmedHeight?: number }> {
  const res = await fetch(seed.file);
  if (!res.ok) throw new Error(`Could not load demo fixture ${seed.file}`);
  const blob = await res.blob();
  const digest = await sha256Blob(blob);
  const digestHex = toHex(digest);
  const capturedAt = new Date(Date.now() - seed.ageHours * 3_600_000).toISOString();

  const record: EvidenceRecord = {
    id: `demo-${index}`,
    blob,
    mimeType: blob.type || 'image/png',
    byteLength: blob.size,
    source: 'upload',
    kind: 'image',
    capturedAt,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    digest,
    digestHex,
    details: {
      ...emptyDetails(),
      platform: seed.platform,
      note: seed.note,
      category: seed.category,
      severity: seed.severity,
      transcript: seed.transcript,
    },
    proof:
      seed.proof === 'none'
        ? undefined
        : {
            // Not a real serialized .ots proof — never parsed as one. isDemo gates every
            // path that would try (see vaultStatus.ts and VaultRecordScreen.tsx).
            ots: new Uint8Array(0),
            calendars: DEMO_CALENDARS.map((calendar) => ({ calendar, ok: true })),
            pendingUris: seed.proof === 'pending' ? [DEMO_CALENDARS[0]] : [],
            submittedAt: capturedAt,
          },
  };

  return { record, demoConfirmedHeight: seed.proof === 'confirmed' ? 862_345 : undefined };
}

export async function buildDemoEntries(): Promise<{ record: EvidenceRecord; demoConfirmedHeight?: number }[]> {
  return Promise.all(SEEDS.map((seed, i) => buildOne(seed, i)));
}
