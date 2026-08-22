/**
 * Categories and severity levels the person reporting chooses from.
 *
 * This deliberately replaces an automated classifier. Two reasons:
 *
 *  1. Hackathon rule §06 forbids sending hateful material to a third-party AI service
 *     without explicit authorisation, so shipping a hosted classifier would mean either
 *     breaking that rule or uploading nothing useful.
 *  2. The available hosted safety classifiers do not cover Arabic or Urdu, which is a
 *     serious gap for this problem domain — an English-only model would quietly
 *     under-rate exactly the content this tool exists to document.
 *
 * The person who saw the content is a better classifier than an English-only model, and
 * having them choose keeps the whole app zero-egress. Categories are phrased as neutral
 * descriptions of *conduct*, so the taxonomy itself contains no hateful material.
 */

export interface TaxonomyOption {
  id: string;
  label: string;
  /** Shown under the label so the choice needs no outside knowledge. */
  hint: string;
}

export const CATEGORIES: TaxonomyOption[] = [
  {
    id: 'threat',
    label: 'Threat of violence',
    hint: 'States or implies intent to physically harm a person or place.',
  },
  {
    id: 'incitement',
    label: 'Incitement or call to action',
    hint: 'Urges others to harm, exclude, or take action against a group.',
  },
  {
    id: 'dehumanising',
    label: 'Dehumanising language',
    hint: 'Describes people as less than human, as vermin, disease, or invaders.',
  },
  {
    id: 'slur',
    label: 'Slur or degrading epithet',
    hint: 'Uses a term whose purpose is to demean a group.',
  },
  {
    id: 'targeted-harassment',
    label: 'Targeted harassment',
    hint: 'Sustained or coordinated abuse aimed at a specific person.',
  },
  {
    id: 'coded',
    label: 'Coded or indirect hostility',
    hint: 'Dog whistles, numeric codes, or in-group references that carry hostile meaning.',
  },
  {
    id: 'conspiracy',
    label: 'Conspiracy narrative',
    hint: 'Claims a group is secretly coordinating to harm or replace others.',
  },
  {
    id: 'discrimination',
    label: 'Discriminatory treatment',
    hint: 'Denial of service, employment, housing, or access based on identity.',
  },
  {
    id: 'property',
    label: 'Property damage or desecration',
    hint: 'Vandalism or defacement of a mosque, home, business, or grave.',
  },
  {
    id: 'other',
    label: 'Something else',
    hint: "Describe it in your own words — the note field is more useful than a wrong label.",
  },
];

export const SEVERITIES: TaxonomyOption[] = [
  {
    id: 'immediate-danger',
    label: 'Someone may be in immediate danger',
    hint: 'A credible, specific threat. Contact emergency services first.',
  },
  {
    id: 'severe',
    label: 'Severe',
    hint: 'Threatening or dehumanising, or aimed at an identifiable person.',
  },
  {
    id: 'serious',
    label: 'Serious',
    hint: 'Clearly hateful, but not a direct threat to a specific person.',
  },
  {
    id: 'concerning',
    label: 'Concerning',
    hint: 'Hostile or demeaning, or part of a pattern worth recording.',
  },
];

export const labelFor = (options: TaxonomyOption[], id: string): string =>
  options.find((o) => o.id === id)?.label ?? 'Not specified';

/** The one category that should surface a "get help now" prompt rather than a form. */
export const IMMEDIATE_DANGER = 'immediate-danger';
