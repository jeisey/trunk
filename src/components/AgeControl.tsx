import { useId, useRef, useState } from 'react';
import type { Ability } from '../content/schema.ts';
import { AGE_STOPS, formatAge, nearestStopIndex, normalizeEnteredAge, type AgeUnit, type EnteredAge } from '../lib/age.ts';
import { ABILITY_LABEL } from '../lib/labels.ts';
import { NO_MOMENT, type MomentContext } from '../lib/timing.ts';

/** Tick labels at their real slider positions (the scale is non-uniform). */
const SCALE: [string, number][] = [
  ['1 wk', 0],
  ['1 yr', 21],
  ['2 yr', 33],
  ['3 yr', 45],
  ['4 yr', 57],
];

export interface ChildState {
  age: EnteredAge;
  notYet: Ability[];
}

const FED_AGO: { value: number; label: string }[] = [
  { value: 0, label: 'just now' },
  { value: 15, label: 'about 15 min ago' },
  { value: 30, label: 'about 30 min ago' },
  { value: 45, label: 'about 45 min ago' },
  { value: 60, label: 'an hour or more ago' },
];

const NAP_IN: { value: number | null; label: string }[] = [
  { value: null, label: 'right after this' },
  { value: 15, label: 'in about 15 min' },
  { value: 30, label: 'in about 30 min' },
  { value: 45, label: 'in about 45 min' },
  { value: 60, label: 'in about an hour' },
  { value: 90, label: 'in about 1½ hours' },
];

/** "Just fed" and "Nap soon": independent toggles (both may be on), with optional rough timing. Held in memory only. */
function MomentControls({ label, moment, onChange }: { label: string; moment: MomentContext; onChange: (m: MomentContext) => void }) {
  const id = useId();
  return (
    <div className="moment">
      <div className="moment-row" role="group" aria-labelledby={`${id}-l`}>
        <span id={`${id}-l`} className="moment-label">
          <span className="visually-hidden">{label}, </span>Right now
        </span>
        <button type="button" className="toggle" aria-pressed={moment.fed} onClick={() => onChange(moment.fed ? { ...moment, fed: false, fedAgo: null } : { ...moment, fed: true })}>
          Just fed
        </button>
        <button type="button" className="toggle" aria-pressed={moment.nap} onClick={() => onChange(moment.nap ? { ...moment, nap: false, napIn: null } : { ...moment, nap: true })}>
          Nap soon
        </button>
      </div>
      {(moment.fed || moment.nap) && (
        <div className="moment-detail">
          {moment.fed && (
            <label>
              <span>Fed</span>
              <select aria-label={`${label}: fed how long ago`} value={String(moment.fedAgo ?? 0)} onChange={(e) => onChange({ ...moment, fedAgo: Number(e.target.value) || null })}>
                {FED_AGO.map((o) => (
                  <option key={o.value} value={String(o.value)}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {moment.nap && (
            <label>
              <span>Nap</span>
              <select aria-label={`${label}: nap how soon`} value={moment.napIn == null ? '' : String(moment.napIn)} onChange={(e) => onChange({ ...moment, napIn: e.target.value === '' ? null : Number(e.target.value) })}>
                {NAP_IN.map((o) => (
                  <option key={String(o.value)} value={o.value == null ? '' : String(o.value)}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  );
}

export function AgeControl(props: {
  label: string;
  child: ChildState;
  relevantAbilities: Ability[];
  onChange: (child: ChildState) => void;
  onRemove?: () => void;
  onAddSibling?: () => void;
  moment?: MomentContext;
  onMoment?: (m: MomentContext) => void;
}) {
  const { child, onChange } = props;
  const id = useId();
  const index = nearestStopIndex(child.age);
  const [typing, setTyping] = useState(false);
  const [readiness, setReadiness] = useState(false);
  const typeButton = useRef<HTMLButtonElement>(null);
  const [draftValue, setDraftValue] = useState(String(child.age.value));
  const [draftUnit, setDraftUnit] = useState<AgeUnit>(child.age.unit);
  const ageText = formatAge(child.age);

  const setIndex = (i: number) => {
    const clamped = Math.max(0, Math.min(AGE_STOPS.length - 1, i));
    onChange({ ...child, age: { ...AGE_STOPS[clamped] } });
  };

  const applyTyped = () => {
    const value = Number(draftValue);
    if (!Number.isFinite(value) || value <= 0) return;
    const next = normalizeEnteredAge({ value, unit: draftUnit });
    onChange({ ...child, age: next });
    setDraftValue(String(next.value));
    setDraftUnit(next.unit);
    setTyping(false);
    requestAnimationFrame(() => typeButton.current?.focus());
  };

  const toggleAbility = (a: Ability) => {
    const notYet = child.notYet.includes(a) ? child.notYet.filter((x) => x !== a) : [...child.notYet, a];
    onChange({ ...child, notYet });
  };

  return (
    <div className="child-card" role="group" aria-labelledby={`${id}-label`}>
      <div className="child-head">
        <span className="child-label" id={`${id}-label`}>
          {props.label}
        </span>
        <span className="child-age" aria-live="polite">
          {ageText}
        </span>
      </div>
      <div className="age-row">
        <button type="button" onClick={() => setIndex(index - 1)} disabled={index === 0} aria-label={`${props.label}: younger`}>
          −
        </button>
        <input
          type="range"
          min={0}
          max={AGE_STOPS.length - 1}
          step={1}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          aria-label={`${props.label} age`}
          aria-valuetext={ageText}
        />
        <button type="button" onClick={() => setIndex(index + 1)} disabled={index === AGE_STOPS.length - 1} aria-label={`${props.label}: older`}>
          +
        </button>
      </div>
      <div className="age-scale" aria-hidden="true">
        {SCALE.map(([text, i]) => (
          <span key={text} style={{ left: `${(i / (AGE_STOPS.length - 1)) * 100}%` }}>
            {text}
          </span>
        ))}
      </div>
      <div className="age-extra">
        <button
          ref={typeButton}
          type="button"
          className="quiet-button"
          aria-expanded={typing}
          onClick={() => {
            setDraftValue(String(child.age.value));
            setDraftUnit(child.age.unit);
            setTyping(!typing);
          }}
        >
          Type an age
        </button>
        {props.relevantAbilities.length > 0 && (
          <button type="button" className="quiet-button disclosure" aria-expanded={readiness} aria-controls={`${id}-ready`} onClick={() => setReadiness(!readiness)}>
            Readiness{child.notYet.length ? ` (${child.notYet.length})` : ''}
          </button>
        )}
        {props.onRemove && (
          <button type="button" className="quiet-button" onClick={props.onRemove} aria-label={`Remove ${props.label.toLowerCase()}`}>
            Remove
          </button>
        )}
        {props.onAddSibling && (
          <button type="button" className="quiet-button" onClick={props.onAddSibling}>
            + Second child
          </button>
        )}
      </div>
      {typing && (
        <form
          className="age-entry"
          onSubmit={(e) => {
            e.preventDefault();
            applyTyped();
          }}
        >
          <label>
            Age
            <input type="number" inputMode="numeric" min={1} max={60} value={draftValue} onChange={(e) => setDraftValue(e.target.value)} />
          </label>
          <label>
            Unit
            <select value={draftUnit} onChange={(e) => setDraftUnit(e.target.value as AgeUnit)}>
              <option value="w">weeks</option>
              <option value="m">months</option>
              <option value="y">years</option>
            </select>
          </label>
          <button type="submit">Set age</button>
          <p className="tiny" style={{ flexBasis: '100%', margin: 0 }}>
            1 week to 4 years 11 months.
          </p>
        </form>
      )}
      {readiness && props.relevantAbilities.length > 0 && (
        <div className="readiness" id={`${id}-ready`}>
          <p className="tiny">Mark anything your child isn’t doing yet to hide ideas that need it.</p>
          <div className="chips" role="group" aria-label={`${props.label}: not yet`}>
            {props.relevantAbilities.map((a) => (
              <label key={a} className="chip-toggle">
                <input type="checkbox" checked={child.notYet.includes(a)} onChange={() => toggleAbility(a)} />
                Not yet: {ABILITY_LABEL[a]}
              </label>
            ))}
          </div>
        </div>
      )}
      {props.onMoment && <MomentControls label={props.label} moment={props.moment ?? NO_MOMENT} onChange={props.onMoment} />}
    </div>
  );
}
