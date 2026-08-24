/**
 * Where a report can actually go, by jurisdiction.
 *
 * A word on what this is and is not. There is **no API** — public, private, or otherwise —
 * for submitting evidence to police forces or courts in any of the countries below. Any
 * tool with a "send to police" button either opens a web form for you or is lying. Filing
 * a false or fabricated police report is itself an offence, and a tool that left someone
 * *believing* they had filed a report when they had not would be actively dangerous.
 *
 * So this module does the useful, truthful thing instead: it routes the person to the
 * correct channel for where they are, tells them what that channel actually accepts, and
 * hands them a package built to be accepted when they get there.
 *
 * A finding worth stating plainly, because it shaped the design: **most police services
 * have no online hate-crime form at all.** The NYPD directs people to call their precinct;
 * Chicago publishes a phone line for its hate crimes unit. Presenting a web link as the
 * default channel would send people down a path that mostly does not exist, so each entry
 * records its real channels and the UI shows phone and web with equal weight.
 *
 * US/CA links were verified on 2026-08-22; GB/AU on 2026-08-23. Public-sector sites
 * reorganise often, so each entry points at a stable root rather than a deep link whose
 * slug will rot, and the UI tells the user to confirm details on the agency's own site.
 *
 * Only four countries are hand-curated so far — this is a hackathon build under a hard
 * deadline, and city-level detail (a real hate-crime unit's real phone number) takes real
 * verification per city, which does not scale to "every country" in the time available.
 * Fabricating a plausible-looking phone number for a police department we haven't actually
 * checked would be worse than not listing one at all, so `intl` — the entry for everyone
 * else — deliberately stays generic rather than inventing specifics. Extending this to more
 * countries the same careful way is the obvious next step.
 */

export type ChannelKind = 'emergency' | 'phone' | 'online' | 'inPerson';

export interface Channel {
  kind: ChannelKind;
  label: string;
  /** A URL for `online`, a dialable string for `phone`/`emergency`, prose for `inPerson`. */
  value: string;
}

export interface Agency {
  id: string;
  name: string;
  /** What this body will actually do with a report. */
  role: string;
  channels: Channel[];
  /** Anything the person should know before choosing this route. */
  note?: string;
}

export interface Region {
  id: string;
  name: string;
  agencies: Agency[];
}

export interface Country {
  /** ISO 3166-1 alpha-2, lowercased (e.g. 'us', 'gb') — this is what lets an IP-derived country
   *  code from `functions/api/approx-location.ts` match an entry here without a lookup table. */
  id: string;
  name: string;
  /** Bodies that accept reports from anywhere in the country. */
  national: Agency[];
  regions: Region[];
  /** Community organisations that track incidents and can often help directly. */
  community: Agency[];
  /** The evidence-law hook the certificate is written against. */
  evidenceLaw: {
    citation: string;
    summary: string;
  };
}

const EMERGENCY_US: Channel = {
  kind: 'emergency',
  label: 'Emergency — someone is in danger right now',
  value: '911',
};
const EMERGENCY_CA: Channel = { ...EMERGENCY_US };
const EMERGENCY_UK: Channel = { ...EMERGENCY_US, value: '999' };
const EMERGENCY_AU: Channel = { ...EMERGENCY_US, value: '000' };

/**
 * A minimal, honest region entry for a country under the catch-all `intl` entry below — one
 * this app hasn't hand-verified specific police/community agencies for. Only the national
 * emergency number is stated (cross-checked against multiple sources, not just one), because
 * that's a stable, well-documented fact; everything else is a pointer to search rather than
 * an invented agency name or phone number, for the reason the module doc comment above gives.
 */
function genericCountryRegion(id: string, countryName: string, emergencyNumber: string): Region {
  return {
    id,
    name: countryName,
    agencies: [
      {
        id: `${id}-generic`,
        name: 'Your local police service',
        role: 'The right first contact almost everywhere for something that may be criminal.',
        channels: [{ kind: 'emergency', label: 'Emergency — someone is in danger right now', value: emergencyNumber }],
        note:
          `This app doesn't have local police contacts hand-verified for ${countryName} yet — try ` +
          `searching "${countryName} hate crime reporting" or "${countryName} police non-emergency ` +
          'number", and check for a national Muslim civil-rights or community organisation near you.',
      },
    ],
  };
}

export const COUNTRIES: Country[] = [
  {
    id: 'us',
    name: 'United States',
    evidenceLaw: {
      citation: 'Federal Rules of Evidence 902(13) and 902(14)',
      summary:
        'Since December 2017, records generated by an electronic process, and copies of data ' +
        'identified by a reliable digital process such as a hash value, can be self-authenticated ' +
        'by written certification instead of live witness testimony. The certificate this app ' +
        'produces is written to that structure.',
    },
    national: [
      {
        id: 'fbi-tips',
        name: 'FBI — Federal Bureau of Investigation',
        role:
          'The primary federal route for hate crimes. Investigates offences motivated by bias ' +
          'against race, religion, national origin, sexual orientation, gender, gender identity ' +
          'or disability.',
        channels: [
          EMERGENCY_US,
          { kind: 'online', label: 'Submit a tip online', value: 'https://tips.fbi.gov/' },
          { kind: 'phone', label: '1-800-CALL-FBI', value: '1-800-225-5324' },
          {
            kind: 'inPerson',
            label: 'Find your local field office',
            value: 'https://www.fbi.gov/contact-us/field-offices',
          },
        ],
      },
      {
        id: 'doj-civil-rights',
        name: 'U.S. Department of Justice — Civil Rights Division',
        role:
          'Takes reports of civil rights violations, including incidents that may not meet the ' +
          'threshold of a crime. Useful when the conduct is discriminatory but not obviously ' +
          'criminal.',
        channels: [
          { kind: 'online', label: 'Report a civil rights violation', value: 'https://civilrights.justice.gov/' },
          { kind: 'online', label: 'DOJ hate crimes guidance', value: 'https://www.justice.gov/hatecrimes/report-a-hate-crime' },
        ],
        note: 'This is the right route for discrimination in housing, employment, education or public services.',
      },
    ],
    regions: [
      {
        id: 'us-ny',
        name: 'New York City',
        agencies: [
          {
            id: 'nypd',
            name: 'New York City Police Department',
            role: 'Local police. Has a dedicated Hate Crime Task Force.',
            channels: [
              EMERGENCY_US,
              { kind: 'phone', label: 'Non-emergency — NYC 311', value: '311' },
              { kind: 'online', label: 'NYPD hate crimes information', value: 'https://www.nyc.gov/site/nypd/index.page' },
            ],
            note: 'The NYPD asks that hate crimes be reported like any other crime — 911 if urgent, otherwise your local precinct. There is no general online form.',
          },
        ],
      },
      {
        id: 'us-il',
        name: 'Chicago',
        agencies: [
          {
            id: 'chicago-pd',
            name: 'Chicago Police Department',
            role: 'Local police. Operates a Hate Crimes Team.',
            channels: [
              EMERGENCY_US,
              { kind: 'phone', label: 'Hate Crimes Team', value: '(312) 745-5011' },
              { kind: 'phone', label: 'Non-emergency — 311', value: '311' },
              { kind: 'online', label: 'Hate crimes information', value: 'https://www.chicagopolice.org/equity/hatecrimes/' },
            ],
          },
        ],
      },
      {
        id: 'us-ca-la',
        name: 'Los Angeles',
        agencies: [
          {
            id: 'lapd',
            name: 'Los Angeles Police Department',
            role: 'Local police.',
            channels: [
              EMERGENCY_US,
              { kind: 'phone', label: 'Non-emergency', value: '1-877-275-5273' },
              { kind: 'online', label: 'LAPD website', value: 'https://www.lapdonline.org/' },
            ],
          },
        ],
      },
      {
        id: 'us-ca-sf',
        name: 'San Francisco',
        agencies: [
          {
            id: 'sfpd',
            name: 'San Francisco Police Department',
            role: 'Local police.',
            channels: [
              EMERGENCY_US,
              { kind: 'online', label: 'File a police report', value: 'https://www.sanfranciscopolice.org/' },
            ],
          },
        ],
      },
      {
        id: 'us-dc',
        name: 'Washington, DC',
        agencies: [
          {
            id: 'dc-mpd',
            name: 'Metropolitan Police Department',
            role: 'Local police. Has a Special Liaison Branch covering bias-motivated crime.',
            channels: [
              EMERGENCY_US,
              { kind: 'online', label: 'MPD website', value: 'https://mpdc.dc.gov/' },
            ],
          },
        ],
      },
      {
        id: 'us-ma',
        name: 'Boston',
        agencies: [
          {
            id: 'boston-pd',
            name: 'Boston Police Department',
            role: 'Local police.',
            channels: [
              EMERGENCY_US,
              { kind: 'online', label: 'Boston Police', value: 'https://www.boston.gov/departments/police' },
            ],
          },
        ],
      },
      {
        id: 'us-other',
        name: 'Somewhere else in the US',
        agencies: [
          {
            id: 'us-local-generic',
            name: 'Your local police department',
            role:
              'Every hate crime report should reach local police, who hold jurisdiction over most ' +
              'offences. Federal agencies coordinate but rarely act alone.',
            channels: [
              EMERGENCY_US,
              { kind: 'phone', label: 'Non-emergency — try 311, or the number on your police department’s site', value: '311' },
            ],
            note: 'Search for your city or county police department’s non-emergency line. Ask specifically for the officer or unit that handles bias-motivated incidents.',
          },
        ],
      },
    ],
    community: [
      {
        id: 'cair',
        name: 'CAIR — Council on American-Islamic Relations',
        role:
          'The largest American Muslim civil rights organisation. Takes incident reports, provides ' +
          'legal support, and aggregates cases to establish patterns a single report cannot show.',
        channels: [{ kind: 'online', label: 'Report an incident', value: 'https://www.cair.com/report/' }],
        note: 'Often the most useful first call — they can advise on whether and how to involve police.',
      },
    ],
  },
  {
    id: 'ca',
    name: 'Canada',
    evidenceLaw: {
      citation: 'Canada Evidence Act, sections 31.1–31.3',
      summary:
        'Section 31.1 places the burden of authenticating an electronic document on the party ' +
        'presenting it. Section 31.2 satisfies the best evidence rule on proof of the integrity of ' +
        'the electronic documents system, and section 31.3 provides a route to proving that ' +
        'integrity. The certificate this app produces is written to support that showing.',
    },
    national: [
      {
        id: 'rcmp',
        name: 'RCMP — Royal Canadian Mounted Police',
        role:
          'Federal police, and the local police service in much of the country. Its online crime ' +
          'reporting service explicitly accepts Hate Motivated Incidents.',
        channels: [
          EMERGENCY_CA,
          { kind: 'online', label: 'Online Crime Reporting', value: 'https://ocre-sielc.rcmp-grc.gc.ca/en' },
          { kind: 'online', label: 'Hate crimes and incidents', value: 'https://rcmp.ca/en/hate-crimes-and-incidents' },
        ],
        note: 'Online reporting covers non-emergency incidents only, and is not available in every detachment area.',
      },
    ],
    regions: [
      {
        id: 'ca-on-toronto',
        name: 'Toronto',
        agencies: [
          {
            id: 'tps',
            name: 'Toronto Police Service',
            role: 'Local police. Operates a Hate Crime Unit.',
            channels: [
              EMERGENCY_CA,
              { kind: 'phone', label: 'Non-emergency', value: '416-808-2222' },
              { kind: 'online', label: 'Online reporting', value: 'https://www.tps.ca/services/online-reporting/' },
              { kind: 'online', label: 'Hate-motivated crime', value: 'https://www.tps.ca/hate-motivated-crime/' },
              { kind: 'online', label: 'Report anonymously — Crime Stoppers', value: 'https://www.222tips.com/' },
            ],
          },
        ],
      },
      {
        id: 'ca-bc-vancouver',
        name: 'Vancouver',
        agencies: [
          {
            id: 'vpd',
            name: 'Vancouver Police Department',
            role: 'Local police, with published guidance on hate crime.',
            channels: [
              EMERGENCY_CA,
              { kind: 'phone', label: 'Non-emergency', value: '604-717-3321' },
              { kind: 'online', label: 'Report a hate crime', value: 'https://vpd.ca/report-a-crime/report-a-hate-crime/' },
              { kind: 'phone', label: 'Anonymous — BC Crime Stoppers', value: '1-800-222-8477' },
            ],
          },
        ],
      },
      {
        id: 'ca-ab-calgary',
        name: 'Calgary',
        agencies: [
          {
            id: 'cps',
            name: 'Calgary Police Service',
            role: 'Local police.',
            channels: [
              EMERGENCY_CA,
              { kind: 'online', label: 'Calgary Police Service', value: 'https://www.calgarypolice.ca/' },
            ],
          },
        ],
      },
      {
        id: 'ca-qc-montreal',
        name: 'Montréal',
        agencies: [
          {
            id: 'spvm',
            name: 'SPVM — Service de police de la Ville de Montréal',
            role: 'Local police, with a unit dedicated to hate-motivated incidents.',
            channels: [
              EMERGENCY_CA,
              { kind: 'online', label: 'SPVM', value: 'https://spvm.qc.ca/en' },
            ],
          },
        ],
      },
      {
        id: 'ca-on-ottawa',
        name: 'Ottawa',
        agencies: [
          {
            id: 'ops',
            name: 'Ottawa Police Service',
            role: 'Local police, with a Hate and Bias Crime Unit.',
            channels: [
              EMERGENCY_CA,
              { kind: 'online', label: 'Ottawa Police Service', value: 'https://www.ottawapolice.ca/' },
            ],
          },
        ],
      },
      {
        id: 'ca-ab-edmonton',
        name: 'Edmonton',
        agencies: [
          {
            id: 'eps',
            name: 'Edmonton Police Service',
            role: 'Local police.',
            channels: [
              EMERGENCY_CA,
              { kind: 'online', label: 'Edmonton Police Service', value: 'https://www.edmontonpolice.ca/' },
            ],
          },
        ],
      },
      {
        id: 'ca-on-peel',
        name: 'Peel Region (Mississauga, Brampton)',
        agencies: [
          {
            id: 'peel',
            name: 'Peel Regional Police',
            role: 'Local police.',
            channels: [
              EMERGENCY_CA,
              { kind: 'online', label: 'Peel Regional Police', value: 'https://www.peelpolice.ca/' },
            ],
          },
        ],
      },
      {
        id: 'ca-other',
        name: 'Somewhere else in Canada',
        agencies: [
          {
            id: 'ca-local-generic',
            name: 'Your local police service',
            role:
              'Municipal or regional police where one exists, otherwise the RCMP detachment ' +
              'serving your area.',
            channels: [
              EMERGENCY_CA,
              { kind: 'online', label: 'RCMP online crime reporting', value: 'https://ocre-sielc.rcmp-grc.gc.ca/en' },
            ],
            note: 'Ask whether the service has a hate crime unit or a designated hate crime coordinator — many do.',
          },
        ],
      },
    ],
    community: [
      {
        id: 'nccm',
        name: 'NCCM — National Council of Canadian Muslims',
        role:
          'Independent advocacy organisation. Takes incident reports, offers legal referrals and ' +
          'support, and tracks incidents nationally.',
        channels: [{ kind: 'online', label: 'Report an incident', value: 'https://www.nccm.ca/report/' }],
        note: 'They can advise on whether to involve police and what to expect if you do.',
      },
    ],
  },
  {
    id: 'gb',
    name: 'United Kingdom',
    evidenceLaw: {
      citation: 'Civil Evidence Act 1995 / Criminal Justice Act 2003, and the common-law presumption of proper functioning',
      summary:
        'England, Wales and Northern Ireland have no single statute mirroring the US’s hash-based ' +
        'self-authentication rule. Courts instead rely on the common-law presumption that a computer ' +
        'system was working correctly at the relevant time (following the repeal of PACE 1984 s.69), ' +
        'assessed under the ordinary rules for documentary evidence — the Civil Evidence Act 1995 in ' +
        'civil proceedings, the Criminal Justice Act 2003 in criminal ones. This certificate sets out ' +
        'the technical facts a solicitor needs to make that case. Scotland follows its own, separate ' +
        'rules of evidence.',
    },
    national: [
      {
        id: 'true-vision',
        name: 'True Vision — police online hate crime reporting',
        role:
          'A police-funded reporting site covering forces across England, Wales and Northern ' +
          'Ireland. An online report is routed to the right local force automatically.',
        channels: [
          EMERGENCY_UK,
          { kind: 'online', label: 'Report a hate crime online', value: 'https://www.report-it.org.uk/' },
          { kind: 'phone', label: 'Non-emergency — 101', value: '101' },
        ],
        note: 'Scotland is policed separately, by Police Scotland, rather than through True Vision.',
      },
    ],
    regions: [
      {
        id: 'gb-other',
        name: 'Anywhere in the UK',
        agencies: [
          {
            id: 'gb-local-generic',
            name: 'Your local police force',
            role:
              'Every police force in the UK records hate crime, and most have a dedicated ' +
              'community safety or hate crime unit.',
            channels: [EMERGENCY_UK, { kind: 'phone', label: 'Non-emergency — 101', value: '101' }],
            note: 'True Vision, above, is usually the fastest route — it routes your report to the right force for you.',
          },
        ],
      },
    ],
    community: [
      {
        id: 'tell-mama',
        name: 'Tell MAMA — Measuring Anti-Muslim Attacks',
        role:
          'The UK’s dedicated service for supporting victims of anti-Muslim hate and recording ' +
          'incidents nationally.',
        channels: [
          { kind: 'online', label: 'Submit a report', value: 'https://tellmamauk.org/submit-a-report/' },
          { kind: 'phone', label: 'Tell MAMA helpline', value: '0800 456 1226' },
        ],
        note: 'Often the most useful first call — they can advise on whether and how to involve police.',
      },
    ],
  },
  {
    id: 'au',
    name: 'Australia',
    evidenceLaw: {
      citation: 'Evidence Act 1995 (Cth), section 146',
      summary:
        'Section 146 creates a presumption that a device of a kind that, if properly used, ordinarily ' +
        'produces a particular output was producing accurate output at the relevant time — the ' +
        'closest Australian equivalent to the US’s hash-based self-authentication rule, though not ' +
        'identical to it. Most states and territories have adopted equivalent provisions under the ' +
        'uniform Evidence Acts. This certificate sets out the technical facts a lawyer needs to rely ' +
        'on that presumption.',
    },
    national: [
      {
        id: 'afp-hate-crime',
        name: 'Australian Federal Police — National Security Investigations',
        role:
          'Investigates threats of violence and hatred motivated by faith, including Islamophobia, ' +
          'where it rises to a Commonwealth offence.',
        channels: [
          EMERGENCY_AU,
          { kind: 'phone', label: 'Police Assistance Line (non-emergency)', value: '131 444' },
          { kind: 'online', label: 'Report a crime to the AFP', value: 'https://www.afp.gov.au/report-crime' },
          { kind: 'phone', label: 'National Security Hotline (24 hr)', value: '1800 123 400' },
        ],
      },
    ],
    regions: [
      {
        id: 'au-other',
        name: 'Anywhere in Australia',
        agencies: [
          {
            id: 'au-local-generic',
            name: 'Your state or territory police',
            role:
              'Policing is state-based in Australia; most state and territory police services have ' +
              'their own hate crime or community engagement contacts.',
            channels: [EMERGENCY_AU, { kind: 'phone', label: 'Police Assistance Line (non-emergency)', value: '131 444' }],
            note: 'Search for your state or territory police service’s own hate crime reporting page for the most direct route.',
          },
        ],
      },
    ],
    community: [
      {
        id: 'islamophobia-register-au',
        name: 'Islamophobia Register Australia',
        role:
          'An independent, university-partnered register that records and analyses Islamophobic ' +
          'incidents nationally.',
        channels: [
          { kind: 'online', label: 'Report an incident', value: 'https://islamophobia.com.au/report-an-incident/' },
        ],
        note: 'Can connect you to free legal advice or culturally sensitive mental health support.',
      },
    ],
  },
  {
    id: 'intl',
    name: 'Somewhere else',
    evidenceLaw: {
      citation: 'Varies by country',
      summary:
        'This app only has reporting routes hand-verified for the US, Canada, the UK and Australia ' +
        'so far. Rules for authenticating electronic evidence differ by country, so a local lawyer ' +
        'should review this certificate before it is relied on anywhere else — but the report, the ' +
        'fingerprint and the timestamp proof underneath it are not tied to any one country’s law, ' +
        'and work the same wherever this ends up.',
    },
    national: [
      {
        id: 'intl-generic',
        name: 'Your local police service',
        role: 'The right first contact almost everywhere for something that may be criminal.',
        channels: [
          {
            kind: 'phone',
            label: 'Try 112 if you don’t know your own country’s number — works in the EU and as a mobile backup in many other places, but is not universal',
            value: '112',
          },
        ],
        note:
          'There is no single emergency number that works worldwide (911, 999, 000, 100, 110 and ' +
          '119 are all in use elsewhere) — check your own country’s official number. For a next ' +
          'step beyond the emergency line, search for your country’s police non-emergency contact, ' +
          'or a local Muslim civil-rights or community organisation.',
      },
    ],
    // Just the national emergency number per country, cross-checked against more than one
    // source — see `genericCountryRegion` above for why nothing more specific is invented.
    regions: [
      genericCountryRegion('intl-ie', 'Ireland', '112'),
      genericCountryRegion('intl-fr', 'France', '112'),
      genericCountryRegion('intl-de', 'Germany', '112'),
      genericCountryRegion('intl-nl', 'Netherlands', '112'),
      genericCountryRegion('intl-be', 'Belgium', '112'),
      genericCountryRegion('intl-es', 'Spain', '112'),
      genericCountryRegion('intl-it', 'Italy', '112'),
      genericCountryRegion('intl-pt', 'Portugal', '112'),
      genericCountryRegion('intl-se', 'Sweden', '112'),
      genericCountryRegion('intl-no', 'Norway', '112'),
      genericCountryRegion('intl-dk', 'Denmark', '112'),
      genericCountryRegion('intl-fi', 'Finland', '112'),
      genericCountryRegion('intl-ch', 'Switzerland', '112'),
      genericCountryRegion('intl-at', 'Austria', '112'),
      genericCountryRegion('intl-pl', 'Poland', '112'),
      genericCountryRegion('intl-tr', 'Turkey', '112'),
      genericCountryRegion('intl-gr', 'Greece', '112'),
      genericCountryRegion('intl-in', 'India', '112'),
      genericCountryRegion('intl-pk', 'Pakistan', '15'),
      genericCountryRegion('intl-bd', 'Bangladesh', '999'),
      genericCountryRegion('intl-idn', 'Indonesia', '112'),
      genericCountryRegion('intl-my', 'Malaysia', '999'),
      genericCountryRegion('intl-sg', 'Singapore', '999'),
      genericCountryRegion('intl-ae', 'United Arab Emirates', '999'),
      genericCountryRegion('intl-sa', 'Saudi Arabia', '999'),
      genericCountryRegion('intl-qa', 'Qatar', '999'),
      genericCountryRegion('intl-kw', 'Kuwait', '112'),
      genericCountryRegion('intl-za', 'South Africa', '10 111'),
      genericCountryRegion('intl-ng', 'Nigeria', '112'),
      genericCountryRegion('intl-ke', 'Kenya', '999'),
      genericCountryRegion('intl-nz', 'New Zealand', '111'),
      genericCountryRegion('intl-jp', 'Japan', '110'),
      genericCountryRegion('intl-kr', 'South Korea', '112'),
      genericCountryRegion('intl-ph', 'Philippines', '911'),
      genericCountryRegion('intl-br', 'Brazil', '190'),
      genericCountryRegion('intl-mx', 'Mexico', '911'),
    ],
    community: [],
  },
];

export const findCountry = (id: string): Country | undefined => COUNTRIES.find((c) => c.id === id);
export const findRegion = (country: Country, id: string): Region | undefined =>
  country.regions.find((r) => r.id === id);

/**
 * What to tell someone who asks about going to court.
 *
 * Courts do not accept evidence from the public directly — evidence enters through a case
 * that already exists, filed by a party or their counsel. Pretending otherwise would waste
 * the time of someone who is already having a hard week.
 */
export const COURT_GUIDANCE = {
  heading: 'What about the courts?',
  body:
    'Courts do not accept evidence from the public. Material reaches a court through a case ' +
    'that already exists — brought by a prosecutor, or by you and your lawyer in a civil claim. ' +
    'What you can do now is make sure the evidence is in a state a court would accept later.',
  points: [
    'Keep the original file and its proof together, unmodified. Editing the file, even by ' +
      're-saving it, breaks the match and the proof can no longer be checked.',
    'The certificate this app produces is written to the structure courts use for ' +
      'self-authenticating electronic records, so a lawyer can adopt it rather than start over.',
    'If you consult a lawyer, give them the whole package — report, original file, proof file ' +
      'and certificate. It is far easier to work from than a screenshot in a text message.',
  ],
};
