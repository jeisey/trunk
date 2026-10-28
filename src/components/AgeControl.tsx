import { useId, useState } from 'react';
import type { Ability } from '../content/schema.ts';
import { AGE_STOPS, formatAge, nearestStopIndex, normalizeEnteredAge, type AgeUnit, type EnteredAge } from '../lib/age.ts';
import { ABILITY_LABEL } from '../lib/labels.ts';

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

export function AgeControl(props: {
  label: string;
  child: ChildState;
  relevantAbilities: Ability[];
  onChange: (child: ChildState) => void;
  onRemove?: () => void;
  onAddSibling?: () => void;
}) {
  const { child, onChange } = props;
  const id = useId();
  const index = nearestStopIndex(child.age);
  const [typing, setTyping] = useState(false);
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
        {props.onRemove && (
          <button type="button" className="quiet-button" onClick={props.onRemove}>
            Remove {props.label.toLowerCase()}
          </button>
        )}
        {props.onAddSibling && (
          <button type="button" className="quiet-button" onClick={props.onAddSibling}>
            + Add a second child
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
            1 week to 4 years 11 months. Born early? Many clinicians use corrected age (counted from the due date) for development questions—ask yours which to use.
          </p>
        </form>
      )}
      {props.relevantAbilities.length > 0 && (
        <details className="more">
          <summary>
            Readiness <span className="tiny">&nbsp;(optional{child.notYet.length ? `, ${child.notYet.length} set` : ''})</span>
          </summary>
          <p className="tiny" style={{ marginBottom: 6 }}>
            Age is only a starting point. Mark anything your child isn’t doing yet to hide ideas that need it.
          </p>
          <div className="chips" role="group" aria-label={`${props.label}: not yet`}>
            {props.relevantAbilities.map((a) => (
              <label key={a} className="chip-toggle">
                <input type="checkbox" checked={child.notYet.includes(a)} onChange={() => toggleAbility(a)} />
                Not yet: {ABILITY_LABEL[a]}
              </label>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
