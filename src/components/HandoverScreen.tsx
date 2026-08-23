/**
 * Screen 4 — where this actually goes.
 *
 * The honest framing matters here. No police service or court in the US or Canada exposes
 * an API for submitting evidence, so this screen does not pretend to file anything. It
 * routes the person to the right channel for where they are, says what that channel will
 * actually accept, and offers to generate the certificate that makes the package usable
 * later. Nothing on this screen sends anything anywhere.
 */
import { useId } from 'react';
import { Button, Callout, Card, Field, inputClass } from './ui';
import { COUNTRIES, COURT_GUIDANCE, findCountry, findRegion, type Agency, type Channel } from '../lib/jurisdictions';
import { IMMEDIATE_DANGER } from '../lib/taxonomy';
import type { EvidenceRecord, HandoverChoice } from '../lib/types';

interface Props {
  items: EvidenceRecord[];
  choice: HandoverChoice;
  onChange: (choice: HandoverChoice) => void;
  onContinue: () => void;
  onBack: () => void;
}

export default function HandoverScreen({ items, choice, onChange, onContinue, onBack }: Props) {
  const ids = useId();
  const id = (n: string) => `${ids}-${n}`;

  const country = choice.countryId ? findCountry(choice.countryId) : undefined;
  const region = country && choice.regionId ? findRegion(country, choice.regionId) : undefined;
  const anyImmediateDanger = items.some((r) => r.details.severity === IMMEDIATE_DANGER);

  const set = <K extends keyof HandoverChoice>(key: K, value: HandoverChoice[K]): void =>
    onChange({ ...choice, [key]: value });

  const toggleAgency = (agencyId: string): void => {
    const next = choice.selectedAgencyIds.includes(agencyId)
      ? choice.selectedAgencyIds.filter((a) => a !== agencyId)
      : [...choice.selectedAgencyIds, agencyId];
    set('selectedAgencyIds', next);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold text-ink">Where this can go</h1>
        <p className="text-ink-muted">
          Choose where you are and we’ll show you who takes these reports, and how they take them.
        </p>
      </div>

      {anyImmediateDanger ? (
        <Callout tone="danger" title="If someone is in danger right now, call emergency services first">
          Dial <strong>911</strong>. This app does not contact anyone on your behalf, and nobody is
          alerted that you made this record.
        </Callout>
      ) : null}

      <Callout tone="info" title="This app does not file anything for you">
        No police service or court in the United States or Canada accepts evidence through an
        automated submission. Everything below is a route you take yourself — we make sure you take
        the right one, with a package that will be accepted when you get there.
      </Callout>

      {/* ---- Jurisdiction ---- */}
      <Card className="space-y-5" data-tour="jurisdiction">
        <Field label="Country" htmlFor={id('country')}>
          <select
            id={id('country')}
            className={inputClass}
            value={choice.countryId}
            onChange={(e) => onChange({ ...choice, countryId: e.target.value, regionId: '', selectedAgencyIds: [] })}
          >
            <option value="">Choose…</option>
            {COUNTRIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        {country ? (
          <Field label="Where are you?" htmlFor={id('region')}>
            <select
              id={id('region')}
              className={inputClass}
              value={choice.regionId}
              onChange={(e) => set('regionId', e.target.value)}
            >
              <option value="">Choose…</option>
              {country.regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </Card>

      {/* ---- Agencies ---- */}
      {country ? (
        <div className="space-y-4" data-tour="agencies">
          {region ? (
            <AgencyGroup
              title="Local police"
              blurb="Local police hold jurisdiction over most offences. A hate crime report should almost always reach them, even if you also report elsewhere."
              agencies={region.agencies}
              selected={choice.selectedAgencyIds}
              onToggle={toggleAgency}
            />
          ) : null}

          <AgencyGroup
            title={country.id === 'us' ? 'Federal' : 'National'}
            blurb="These bodies coordinate, investigate the most serious cases, and record incidents in national statistics."
            agencies={country.national}
            selected={choice.selectedAgencyIds}
            onToggle={toggleAgency}
          />

          <AgencyGroup
            title="Community organisations"
            blurb="Often the most useful first call. They can advise on whether to involve police, and they aggregate incidents to show patterns a single report cannot."
            agencies={country.community}
            selected={choice.selectedAgencyIds}
            onToggle={toggleAgency}
          />
        </div>
      ) : null}

      {/* ---- Courts ---- */}
      {country ? (
        <Card className="space-y-3">
          <h2 className="font-display text-lg font-bold text-ink">{COURT_GUIDANCE.heading}</h2>
          <p className="text-sm text-ink-muted">{COURT_GUIDANCE.body}</p>
          <ul className="space-y-2 text-sm text-ink-muted">
            {COURT_GUIDANCE.points.map((point) => (
              <li key={point} className="flex gap-2">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* ---- Certificate ---- */}
      {country ? (
        <Card className="space-y-5" data-tour="certificate">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">Certificate of authenticity</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {items.length > 1
                ? `A signed statement, one per item (${items.length} in this package), that each ` +
                  'file is unaltered and its fingerprint is what it says it is.'
                : 'A signed statement that the file is unaltered and the fingerprint is what it says it is.'}{' '}
              Written to the structure of <strong>{country.evidenceLaw.citation}</strong>, so a
              lawyer can adopt it rather than start from scratch.
            </p>
            <p className="mt-2 text-sm text-ink-muted">{country.evidenceLaw.summary}</p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line-strong p-4">
            <input
              type="checkbox"
              className="mt-1 size-5 shrink-0 accent-[var(--color-accent)]"
              checked={choice.includeCertificate}
              onChange={(e) => set('includeCertificate', e.target.checked)}
            />
            <span>
              <span className="block font-display text-sm font-semibold text-ink">
                {items.length > 1
                  ? 'Include a certificate for each item with my export'
                  : 'Include a certificate with my export'}
              </span>
              <span className="mt-1 block text-sm text-ink-muted">
                {items.length > 1
                  ? 'You print each one, sign it by hand, and keep it with that item’s other files.'
                  : 'You print it, sign it by hand, and keep it with the other files.'}
              </span>
            </span>
          </label>

          {choice.includeCertificate ? (
            <>
              <Callout tone="caution" title="This one document names you">
                Everything else in this export is anonymous. A certificate only carries weight if
                someone stands behind it, so it needs your name — and whoever you give it to will
                see it. Leave the fields blank to print it and fill them in by hand instead.
              </Callout>

              <Field
                label="Your full name"
                htmlFor={id('declarant')}
                optional
                hint="Printed on the certificate. Leave blank to write it in by hand."
              >
                <input
                  id={id('declarant')}
                  className={inputClass}
                  value={choice.declarantName}
                  onChange={(e) => set('declarantName', e.target.value)}
                  autoComplete="off"
                />
              </Field>

              <Field
                label="Contact"
                htmlFor={id('contact')}
                optional
                hint="An email address or phone number, so whoever receives this can reach you."
              >
                <input
                  id={id('contact')}
                  className={inputClass}
                  value={choice.declarantContact}
                  onChange={(e) => set('declarantContact', e.target.value)}
                  autoComplete="off"
                />
              </Field>
            </>
          ) : null}
        </Card>
      ) : null}

      <div className="space-y-2">
        <Button block onClick={onContinue}>
          {country ? 'Create my files' : 'Skip this and create my files'}
        </Button>
        <Button variant="quiet" block onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

function AgencyGroup({
  title,
  blurb,
  agencies,
  selected,
  onToggle,
}: {
  title: string;
  blurb: string;
  agencies: Agency[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (agencies.length === 0) return null;
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
        <p className="mt-1 text-sm text-ink-muted">{blurb}</p>
      </div>

      {agencies.map((agency) => (
        <div key={agency.id} className="rounded-xl border border-line bg-sunken/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-base font-bold text-ink">{agency.name}</h3>
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-ink-muted">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-accent)]"
                checked={selected.includes(agency.id)}
                onChange={() => onToggle(agency.id)}
              />
              Planning to contact
            </label>
          </div>
          <p className="mt-1.5 text-sm text-ink-muted">{agency.role}</p>

          <ul className="mt-3 space-y-1.5">
            {agency.channels.map((channel) => (
              <li key={channel.label + channel.value}>
                <ChannelRow channel={channel} />
              </li>
            ))}
          </ul>

          {agency.note ? <p className="mt-3 text-xs text-ink-subtle">{agency.note}</p> : null}
        </div>
      ))}
    </Card>
  );
}

function ChannelRow({ channel }: { channel: Channel }) {
  const badge = {
    emergency: { text: 'Emergency', class: 'bg-danger-soft text-danger' },
    phone: { text: 'Phone', class: 'bg-accent-soft text-accent' },
    online: { text: 'Online', class: 'bg-accent-soft text-accent' },
    inPerson: { text: 'In person', class: 'bg-sunken text-ink-muted' },
  }[channel.kind];

  const body =
    channel.kind === 'online' ? (
      <a
        href={channel.value}
        target="_blank"
        rel="noreferrer noopener"
        className="font-medium text-accent underline underline-offset-2 hover:text-accent-hover"
      >
        {channel.label}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    ) : channel.kind === 'inPerson' ? (
      <a
        href={channel.value}
        target="_blank"
        rel="noreferrer noopener"
        className="font-medium text-accent underline underline-offset-2 hover:text-accent-hover"
      >
        {channel.label}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    ) : (
      <span className="text-ink">
        {channel.label}:{' '}
        <a
          href={`tel:${channel.value.replace(/[^0-9+]/g, '')}`}
          className="font-semibold text-accent underline underline-offset-2"
        >
          {channel.value}
        </a>
      </span>
    );

  return (
    <div className="flex flex-wrap items-baseline gap-2 text-sm">
      <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${badge.class}`}>
        {badge.text}
      </span>
      {body}
    </div>
  );
}
