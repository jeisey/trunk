import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { IndexedCatalog } from '../content/catalog.ts';
import type { RoutineType } from '../content/schema.ts';
import { monthsToDays, toDays } from '../lib/age.ts';
import { analyzePlan, childLabel, type EntryAnalysis, type Gap, type PlanAnalysis, type Repair } from '../lib/layout.ts';
import { BREAK_LABEL, bounds, MAX_SEGMENTS, newId, resize, ROUTINE_BOUNDS, ROUTINE_LABEL, youngerFor, type Plan, type PlanSegment } from '../lib/plan.ts';
import { addEntry, addRoutine, applyRepair, clockProblem, duplicateEntry, moveEntry, offsetForClock, removeEntry, setAnchor, setLocked, setMinutes, updateEntry } from '../lib/planEdit.ts';
import { optionsForSlot, type SlotOption } from '../lib/planner.ts';
import { repairsForEntry } from '../lib/repairs.ts';
import { sequenceNote } from '../lib/sequence.ts';
import { cleanText, LIMITS } from '../lib/text.ts';
import { TIME_ISSUE_TEXT } from '../lib/timeRules.ts';
import type { ChildTiming } from '../lib/timing.ts';
import { formatMinutes, parseHHMM, toHHMM } from '../lib/time.ts';
import { CueDetails, CueLine } from './Cues.tsx';
import { activityHref, recipeHref } from './IdeaCards.tsx';
import { MoreMenu, type MenuItem } from './MoreMenu.tsx';
import { childGapText, clockAt, entryRoles, entrySafety, entryTitle, napAdultText, planRows, whoText } from './planDisplay.ts';

/** Floor (flat-surface) vs. held/supported tummy-time minutes in a plan, never merged. */
export function tummyTally(plan: Plan, c: IndexedCatalog): { flat: number; supported: number } {
  let flat = 0;
  let supported = 0;
  for (const seg of plan.segments) {
    const act =
      seg.kind === 'activity'
        ? c.activityById.get(seg.ref ?? '')
        : seg.kind === 'recipe'
          ? c.activityById.get(c.recipeById.get(seg.ref ?? '')?.younger.activity ?? '')
          : undefined;
    if (!act?.tummyTime) continue;
    if (act.tummyTime.flatSurface) flat += seg.minutes;
    else supported += seg.minutes;
  }
  return { flat, supported };
}

/** Quick length chips for a parent's estimate. None is pre-selected: Trunk never suggests a length. */
const ROUTINE_CHIPS: Record<RoutineType, number[]> = {
  nap: [20, 30, 45, 60, 90, 120],
  'milk-feed': [10, 15, 20, 30, 45],
  meal: [15, 20, 30, 45],
  snack: [5, 10, 15, 20],
};

const SETTLE_OPTIONS = [5, 10, 15, 20, 30];

type NapAdult = { settle?: number; holding?: boolean };

function napAdultValue(s: NapAdult): string {
  return s.holding ? 'holding' : s.settle !== undefined ? String(s.settle) : 'unknown';
}

function napAdultPatch(value: string): Partial<PlanSegment> {
  if (value === 'holding') return { holding: true, settle: undefined };
  if (value === 'unknown') return { holding: undefined, settle: undefined };
  return { holding: undefined, settle: Number(value) };
}

/**
 * "While Child 1 naps, you’re…": Not sure yet (the default; Trunk then leaves the other
 * child's time unplanned) / Free after settling about N min / Staying with them.
 */
function NapAdultSelect({ hostChild, value, onChange, hint }: { hostChild: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const id = useId();
  const showHint = Boolean(hint) && value === 'unknown';
  return (
    <div className="field-group">
      <label className="field">
        <span>While {hostChild} naps, you’re…</span>
        <select value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={showHint ? id : undefined}>
          <option value="unknown">Not sure yet</option>
          {SETTLE_OPTIONS.map((m) => (
            <option key={m} value={String(m)}>
              Free after settling about {m} min
            </option>
          ))}
          <option value="holding">Staying with them</option>
        </select>
      </label>
      {showHint && (
        <p className="hint" id={id}>
          {hint}
        </p>
      )}
    </div>
  );
}

interface RoutineInputUI {
  routine: RoutineType;
  who: 'c1' | 'c2' | 'both';
  clock: number;
  minutes: number;
  settle?: number;
  holding?: boolean;
}

/**
 * Add a routine block, or change one (`edit`): type, child, time, and length.
 * Nothing is pre-selected when adding; Trunk never suggests a length.
 */
function RoutineForm({
  plan,
  routine: initialRoutine,
  defaultClock,
  edit,
  onAdd,
  onCancel,
}: {
  plan: Plan;
  routine: RoutineType;
  defaultClock: number;
  /** Changing an existing block: its segment, and why its child is fixed (it runs alongside, or has entries alongside it). */
  edit?: { seg: PlanSegment; whoLocked: false | 'along' | 'host' };
  onAdd: (input: RoutineInputUI) => void;
  onCancel: () => void;
}) {
  const two = plan.kids.length === 2;
  const [routine, setRoutine] = useState<RoutineType>(initialRoutine);
  const food = routine === 'meal' || routine === 'snack';
  const eligible = plan.kids.map((k) => !food || toDays(k.age) >= monthsToDays(6));
  const anyEligible = plan.kids.some((k) => toDays(k.age) >= monthsToDays(6));
  const whoOptions = (
    [
      ['c1', 'Child 1', eligible[0]],
      ['c2', 'Child 2', two && eligible[1]],
      ['both', 'Both', two && eligible[0] && eligible[1]],
    ] as const
  ).filter(([, , ok]) => ok);
  const [who, setWho] = useState<'c1' | 'c2' | 'both'>(edit?.seg.who ?? whoOptions[0]?.[0] ?? 'c1');
  const effectiveWho = edit?.whoLocked || whoOptions.some(([v]) => v === who) ? who : (whoOptions[0]?.[0] ?? who);
  const [time, setTime] = useState(toHHMM(defaultClock));
  const [minutes, setMinutes] = useState<number | null>(edit ? edit.seg.minutes : null);
  const [adult, setAdult] = useState(edit ? napAdultValue(edit.seg) : 'unknown');
  const [error, setError] = useState(false);
  const [timeError, setTimeError] = useState<string | null>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const { min, max } = ROUTINE_BOUNDS[routine];
  const name = ROUTINE_LABEL[routine];
  const step = (d: number) => {
    setError(false);
    setMinutes((m) => Math.max(min, Math.min(max, (m ?? (d > 0 ? min - 5 : min + 5)) + d)));
  };
  const otherChild = effectiveWho === 'c2' ? 'Child 1' : 'Child 2';
  const whoLabel = effectiveWho === 'both' ? 'Both' : childLabel(effectiveWho);
  const types: RoutineType[] = ['nap', 'milk-feed', ...(anyEligible && (!edit?.whoLocked || eligible[who === 'c2' ? 1 : 0]) ? (['meal', 'snack'] as const) : [])];

  return (
    <form
      className="panel add-panel"
      aria-label={edit ? `Change this ${ROUTINE_LABEL[initialRoutine].toLowerCase()}` : `Add a ${name.toLowerCase()}`}
      onSubmit={(e) => {
        e.preventDefault();
        // A time before the plan starts is refused (never wrapped to tomorrow); the form stays open.
        const problem = clockProblem(plan, parseHHMM(time));
        if (problem) {
          setTimeError(problem);
          timeRef.current?.focus();
          return;
        }
        if (minutes === null) {
          setError(true);
          return;
        }
        const patch = routine === 'nap' && two && effectiveWho !== 'both' ? napAdultPatch(adult) : {};
        onAdd({ routine, who: effectiveWho, clock: parseHHMM(time), minutes: Math.max(min, Math.min(max, minutes)), settle: patch.settle, holding: patch.holding });
      }}
    >
      <h3>{edit ? `Change this ${ROUTINE_LABEL[initialRoutine].toLowerCase()}` : `Add a ${name.toLowerCase()}`}</h3>
      {edit && (
        <fieldset className="segmented">
          <legend>What</legend>
          <div className="segments">
            {types.map((t) => (
              <label key={t}>
                <input type="radio" name="routine-type" checked={routine === t} onChange={() => setRoutine(t)} />
                {ROUTINE_LABEL[t]}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {two && edit?.whoLocked && (
        <p className="subtle">
          For {whoLabel}. {edit.whoLocked === 'along' ? 'It runs alongside the other child’s routine' : `${otherChild}’s plans run alongside it`}, so the child stays the same.
        </p>
      )}
      {two && !edit?.whoLocked && whoOptions.length > 1 && (
        <fieldset className="segmented">
          <legend>For</legend>
          <div className="segments">
            {whoOptions.map(([v, label]) => (
              <label key={v}>
                <input type="radio" name="routine-who" checked={effectiveWho === v} onChange={() => setWho(v)} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {two && !edit?.whoLocked && whoOptions.length === 1 && <p className="subtle">For {whoOptions[0][1]}. Meals and snacks are for children already eating solid foods.</p>}
      <label className="field">
        <span>Starts</span>
        <input
          ref={timeRef}
          type="time"
          value={time}
          aria-invalid={timeError ? true : undefined}
          aria-describedby={timeError ? `routine-time-error` : undefined}
          onChange={(e) => {
            if (!e.target.value) return;
            setTime(e.target.value);
            setTimeError(null);
          }}
        />
        {timeError && (
          <span className="field-error" id="routine-time-error" role="alert">
            {timeError}
          </span>
        )}
      </label>
      <fieldset className="segmented">
        <legend>About how long? (your estimate)</legend>
        <div className="chips">
          {ROUTINE_CHIPS[routine].map((m) => (
            <label key={m} className="chip-toggle">
              <input
                type="radio"
                name="routine-minutes"
                checked={minutes === m}
                onChange={() => {
                  setMinutes(m);
                  setError(false);
                }}
              />
              {formatMinutes(m)}
            </label>
          ))}
        </div>
        <div className="stepper" role="group" aria-label="Adjust the length">
          <button type="button" onClick={() => step(-5)} aria-label="5 minutes shorter">
            −
          </button>
          <output aria-live="polite">{minutes === null ? 'Not set' : formatMinutes(minutes)}</output>
          <button type="button" onClick={() => step(5)} aria-label="5 minutes longer">
            +
          </button>
        </div>
      </fieldset>
      {routine === 'nap' && two && effectiveWho !== 'both' && (
        <NapAdultSelect hostChild={effectiveWho === 'c2' ? 'Child 2' : 'Child 1'} value={adult} onChange={setAdult} hint={`Trunk won’t plan ${otherChild}’s time during the nap until you set a settling time.`} />
      )}
      {error && (
        <p className="field-error" role="alert">
          Choose about how long first.
        </p>
      )}
      <div className="button-row">
        <button type="submit" className="primary">
          {edit ? 'Save changes' : `Add ${name.toLowerCase()}`}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function CustomForm({ plan, alongWho, onAdd, onCancel }: { plan: Plan; alongWho?: 'c1' | 'c2'; onAdd: (seg: PlanSegment) => void; onCancel: () => void }) {
  const [text, setText] = useState('');
  const [minutes, setMins] = useState(15);
  const [who, setWho] = useState<'both' | 'c1' | 'c2'>(alongWho ?? 'both');
  return (
    <form
      className="panel add-panel"
      aria-label="Add your own entry"
      onSubmit={(e) => {
        e.preventDefault();
        const label = cleanText(text, LIMITS.custom);
        if (!label) return;
        const m = Math.max(1, Math.min(120, Math.round(minutes) || 15));
        onAdd({ id: newId('c'), kind: 'custom', minutes: m, label, who: plan.kids.length === 2 ? (alongWho ?? who) : 'c1' });
      }}
    >
      <h3>{alongWho ? `Add your own entry for ${childLabel(alongWho)}` : 'Add your own entry'}</h3>
      <p className="tiny">Your words, your call. Trunk doesn’t attach sources or safety checks to your own entries.</p>
      <div className="inline-fields">
        <label className="grow">
          What
          <input type="text" maxLength={LIMITS.custom} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Library story time" required />
        </label>
        <label>
          Minutes
          <input type="number" min={1} max={120} value={minutes} onChange={(e) => setMins(Number(e.target.value))} />
        </label>
        {plan.kids.length === 2 && !alongWho && (
          <label>
            For
            <select value={who} onChange={(e) => setWho(e.target.value as 'both' | 'c1' | 'c2')}>
              <option value="both">Both</option>
              <option value="c1">Child 1</option>
              <option value="c2">Child 2</option>
            </select>
          </label>
        )}
      </div>
      <div className="button-row">
        <button type="submit" className="primary">
          Add
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function OptionList({ title, options, onPick, onCancel, empty, pickLabel }: { title: string; options: SlotOption[]; onPick: (o: SlotOption) => void; onCancel: () => void; empty: string; pickLabel: string }) {
  return (
    <div className="panel add-panel" role="group" aria-label={title}>
      <h3>{title}</h3>
      {options.length === 0 ? (
        <p>{empty}</p>
      ) : (
        <ul className="option-list">
          {options.map((o) => (
            <li key={`${o.kind}:${o.id}:${o.who ?? ''}`}>
              <span className="option-text">
                <strong>{o.title}</strong>
                <span className="tiny">
                  {o.minutes} min{o.who ? ` · ${childLabel(o.who)}` : ''}
                </span>
                <CueLine cue={o.timing?.cue ?? null} prefix={o.kind === 'recipe' && o.timing?.cue ? childLabel(o.timing.cue.finding.child === 1 ? 1 : 0) : undefined} />
              </span>
              <button type="button" onClick={() => onPick(o)} aria-label={`${pickLabel}: ${o.title}`}>
                {pickLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="button-row">
        <button type="button" onClick={onCancel}>
          Close
        </button>
      </div>
    </div>
  );
}

type Panel =
  | { type: 'activity'; host?: number }
  | { type: 'custom'; host?: number; who?: 'c1' | 'c2' }
  | { type: 'routine'; routine: RoutineType }
  | { type: 'swap'; id: string }
  | { type: 'edit-routine'; id: string }
  | null;

function segFromOption(o: SlotOption, plan: Plan, c: IndexedCatalog): PlanSegment {
  const seg: PlanSegment = { id: newId(o.kind === 'recipe' ? 'r' : 'a'), kind: o.kind, ref: o.id, minutes: o.minutes };
  if (o.kind === 'recipe') seg.younger = youngerFor(o.id, plan, c);
  else if (plan.kids.length === 2) seg.who = o.who ?? 'c1';
  return seg;
}

export function PlanEditor({
  plan,
  c,
  extra,
  seed,
  onChange,
  announce,
  footer,
}: {
  plan: Plan;
  c: IndexedCatalog;
  /** Momentary context the plan was made with (React state only). */
  extra?: ChildTiming[];
  seed: number;
  onChange: (plan: Plan) => void;
  announce: (text: string) => void;
  /** Extra controls rendered next to "Add block" (for example "Fill around these blocks"). */
  footer?: ReactNode;
}) {
  const analysis = useMemo(() => analyzePlan(plan, c, extra), [plan, c, extra]);
  const [panel, setPanel] = useState<Panel>(null);
  const [editingTime, setEditingTime] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  /** A short note under one row's tools (for example why it can't move). */
  const [rowNote, setRowNote] = useState<{ id: string; text: string } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  // A row note belongs to the plan as it was; any change clears it.
  useEffect(() => setRowNote(null), [plan]);
  // Opening a form or option list moves focus into it (its first field or button).
  useEffect(() => {
    if (!panel) return;
    const frame = requestAnimationFrame(() => {
      const box = editorRef.current?.querySelector<HTMLElement>('.add-panel');
      box?.querySelector<HTMLElement>('input:not([type="radio"]), input[type="radio"]:checked, select, textarea, .option-list button, button')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [panel]);
  const optionSeed = useRef(seed);
  const listRef = useRef<HTMLOListElement>(null);
  const addRef = useRef<HTMLDivElement>(null);
  const two = plan.kids.length === 2;
  const tally = tummyTally(plan, c);
  const full = plan.segments.length >= MAX_SEGMENTS;
  const anyOver6m = plan.kids.some((k) => toDays(k.age) >= monthsToDays(6));
  const name = (seg: PlanSegment) => entryTitle(seg, c);
  const isGroupStartOf = (seg: PlanSegment) => !seg.along;

  // Move focus once the edited plan has rendered. The control that was used is often
  // gone by then, so look for the target for a few frames rather than only the next one.
  const focusSoon = (selector: string, fallback?: string, tries = 5) =>
    requestAnimationFrame(() => {
      const root = listRef.current?.parentElement;
      const el = root?.querySelector<HTMLElement>(selector) ?? (tries <= 1 && fallback ? root?.querySelector<HTMLElement>(fallback) : null);
      if (el) el.focus();
      else if (tries > 1) focusSoon(selector, fallback, tries - 1);
    });

  const move = (i: number, dir: -1 | 1) => {
    const seg = plan.segments[i];
    const next = moveEntry(plan, i, dir);
    if (next === plan) {
      // Two entries with set times keep their time order.
      const text = 'Both have set times. Change a time to reorder them.';
      setRowNote({ id: seg.id, text });
      announce(text);
      return;
    }
    setRowNote(null);
    onChange(next);
    announce(`Moved ${name(seg)} ${dir < 0 ? 'earlier' : 'later'}.`);
    focusSoon(`[data-seg="${seg.id}"] [data-move="${dir}"]:not(:disabled)`, `[data-seg="${seg.id}"] [data-move]:not(:disabled)`);
  };

  const remove = (i: number) => {
    const seg = plan.segments[i];
    const after = plan.segments[i + 1]?.id ?? plan.segments[i - 1]?.id;
    onChange(removeEntry(plan, i));
    announce(`Removed ${name(seg)}.`);
    focusSoon(after ? `[data-seg="${after}"] .seg-title-text` : '.add-block .menu-button', '.add-block .menu-button');
  };

  const sizeBy = (i: number, dir: 1 | -1) => {
    const seg = plan.segments[i];
    const next = resize(seg, dir, c);
    if (next === seg) {
      const { min, max } = bounds(seg, c);
      announce(dir > 0 ? `${name(seg)} is already at its maximum of ${max} minutes.` : `${name(seg)} is at its minimum of ${min} minutes.`);
      return;
    }
    onChange(setMinutes(plan, i, next.minutes, c));
    announce(`${name(seg)}: ${next.minutes} minutes.`);
  };

  // Repairs per entry, from the shared helper: de-duplicated, and only ones that leave
  // fewer hard conflicts and create none.
  const repairsByIndex = useMemo(() => new Map(analysis.entries.map((e) => [e.item.index, e.conflicts.length ? repairsForEntry(plan, e.conflicts, c) : []])), [plan, analysis, c]);

  const repair = (r: Repair) => {
    const target = plan.segments[r.index];
    if (r.kind === 'swap') {
      if (target) setPanel({ type: 'swap', id: target.id });
      return;
    }
    const neighbour = plan.segments[r.index + 1]?.id ?? plan.segments[r.index - 1]?.id;
    onChange(applyRepair(plan, r, c));
    announce(`${r.label}. Done.`);
    // Focus stays with the entry that was fixed, or the next one if it was removed.
    const first = r.kind === 'remove' ? neighbour : target?.id;
    focusSoon(first ? `[data-seg="${first}"] .seg-title-text` : '.add-block .menu-button', neighbour ? `[data-seg="${neighbour}"] .seg-title-text` : '.add-block .menu-button');
  };

  const addSeg = (seg: PlanSegment, host?: number) => {
    if (full) return announce(`A plan can hold up to ${MAX_SEGMENTS} entries.`);
    onChange(addEntry(plan, seg, host === undefined ? {} : { host }));
    setPanel(null);
    announce(`Added ${name(seg)}${host !== undefined ? ` alongside ${name(plan.segments[host])}` : ''}.`);
    focusSoon(`[data-seg="${seg.id}"] .seg-title-text`);
  };

  const swapTo = (i: number, o: SlotOption) => {
    const old = plan.segments[i];
    const fresh = segFromOption(o, plan, c);
    const patch: Partial<PlanSegment> = { kind: fresh.kind, ref: fresh.ref, minutes: fresh.minutes, younger: fresh.younger, who: fresh.who ?? (fresh.kind === 'recipe' ? undefined : old.who) };
    onChange(updateEntry(plan, i, patch));
    setPanel(null);
    announce(`Swapped in ${o.title}.`);
    focusSoon(`[data-seg="${old.id}"] .seg-title-text`);
  };

  const options = (opts: { replace?: number; host?: number }) => optionsForSlot(c, plan, opts, optionSeed.current).slice(0, 8);

  // "Extend to N min": the plan's end rounded up to 5 minutes, within the longest window a plan can have.
  const extendTo = Math.min(720, Math.max(10, Math.ceil(analysis.end / 5) * 5));

  // "Right after what's planned" for new routine blocks.
  const nextClock = parseHHMM(plan.start) + analysis.end;

  const addMenu: MenuItem[] = [
    { label: 'Activity', onSelect: () => setPanel({ type: 'activity' }) },
    { label: 'Nap', onSelect: () => setPanel({ type: 'routine', routine: 'nap' }) },
    { label: 'Milk feed', onSelect: () => setPanel({ type: 'routine', routine: 'milk-feed' }) },
    ...(anyOver6m
      ? [
          { label: 'Meal', onSelect: () => setPanel({ type: 'routine', routine: 'meal' }) },
          { label: 'Snack', onSelect: () => setPanel({ type: 'routine', routine: 'snack' }) },
        ]
      : []),
    {
      label: 'Break',
      onSelect: () => addSeg({ id: newId('b'), kind: 'break', minutes: 10, label: BREAK_LABEL }),
    },
    { label: 'Your own entry', onSelect: () => setPanel({ type: 'custom' }) },
  ].map((m) => ({ ...m, disabled: full }));

  // ---- Rows ----
  const entryRow = (e: EntryAnalysis) => {
    const i = e.item.index;
    const seg = e.item.segment;
    const title = name(seg);
    const href = seg.kind === 'activity' ? activityHref(seg.ref ?? '') : seg.kind === 'recipe' ? recipeHref(seg.ref ?? '') : null;
    const recipe = seg.kind === 'recipe' ? c.recipeById.get(seg.ref ?? '') : undefined;
    const who = whoText(seg, plan.kids.length);
    const { min, max } = bounds(seg, c);
    const anchored = seg.at !== undefined;
    const timeText = `${clockAt(plan, e.item.start)}–${clockAt(plan, e.item.end)}`;
    const note = sequenceNote(plan, analysis, i, c);
    const napSelect = seg.kind === 'routine' && seg.routine === 'nap' && two && seg.who !== 'both' && isGroupStartOf(seg);
    // The nap's "you" line is the select below, in the editor.
    const roles = napSelect ? [] : entryRoles(plan, c, e);
    // Overlaps are listed on both entries involved; each shows once per row.
    const others = e.conflicts.filter((cf, k, all) => cf.kind !== 'timing' && all.indexOf(cf) === k);
    const fixes = repairsByIndex.get(i) ?? [];
    const safety = entrySafety(seg, c);
    const lockable = seg.kind === 'activity' || seg.kind === 'recipe' || seg.kind === 'break';
    const canUp = seg.along ? plan.segments[i - 1]?.along === true : plan.segments.slice(0, i).some((s) => !s.along);
    const canDown = seg.along ? plan.segments[i + 1]?.along === true : plan.segments.slice(i + 1).some((s) => !s.along);
    const more: MenuItem[] = [
      ...(seg.kind === 'routine' && seg.routine ? [{ label: `Change ${ROUTINE_LABEL[seg.routine].toLowerCase()}…`, onSelect: () => setPanel({ type: 'edit-routine', id: seg.id }) }] : []),
      { label: anchored ? 'Change time' : 'Set a time', onSelect: () => setEditingTime(seg.id) },
      ...(seg.kind === 'activity' || seg.kind === 'recipe' ? [{ label: 'Swap…', onSelect: () => setPanel({ type: 'swap', id: seg.id }) }] : []),
      ...(lockable && !seg.along ? [{ label: seg.locked ? 'Stop keeping' : 'Keep when filling', onSelect: () => { onChange(setLocked(plan, i, !seg.locked, c)); announce(seg.locked ? `${title} will be refilled.` : `${title} is kept at ${clockAt(plan, e.item.start)}.`); } }] : []),
      ...(anchored && seg.kind !== 'routine' && !seg.along ? [{ label: 'Let it flow (no set time)', onSelect: () => { onChange(setAnchor(plan, i, undefined, c)); announce(`${title} now follows the entry before it.`); } }] : []),
      { label: 'Duplicate', onSelect: () => { onChange(duplicateEntry(plan, i, c)); announce(`Duplicated ${title}.`); }, disabled: full },
      { label: 'Remove', onSelect: () => remove(i), danger: true },
    ];
    return (
      <li key={seg.id} data-seg={seg.id} className={`seg seg-${seg.kind}${seg.along ? ' along' : ''}${others.some((cf) => cf.severity === 'conflict') ? ' problem' : ''}`}>
        <div className="seg-time">
          {editingTime === seg.id ? (
            <form
              className="time-edit"
              onSubmit={(ev) => {
                ev.preventDefault();
                const field = ev.currentTarget.elements.namedItem('t') as HTMLInputElement;
                if (field.value) {
                  const clock = parseHHMM(field.value);
                  const problem = clockProblem(plan, clock);
                  if (problem) {
                    setTimeError(problem);
                    field.focus();
                    return;
                  }
                  onChange(setAnchor(plan, i, offsetForClock(plan, clock), c));
                  announce(`${title} now starts at ${clockAt(plan, offsetForClock(plan, clock))}.`);
                }
                setEditingTime(null);
                setTimeError(null);
                focusSoon(`[data-seg="${seg.id}"] .time-button`, `[data-seg="${seg.id}"] .menu-button`);
              }}
            >
              <label>
                <span className="visually-hidden">{title} starts at</span>
                <input
                  name="t"
                  type="time"
                  defaultValue={toHHMM(parseHHMM(plan.start) + e.item.start)}
                  autoFocus
                  aria-invalid={timeError ? true : undefined}
                  aria-describedby={timeError ? `time-error-${seg.id}` : undefined}
                  onChange={() => setTimeError(null)}
                />
              </label>
              <button type="submit">Set</button>
              <button
                type="button"
                onClick={() => {
                  setEditingTime(null);
                  setTimeError(null);
                }}
              >
                Cancel
              </button>
              {timeError && (
                <span className="field-error" id={`time-error-${seg.id}`} role="alert">
                  {timeError}
                </span>
              )}
            </form>
          ) : anchored ? (
            <button type="button" className="time-button" onClick={() => setEditingTime(seg.id)} aria-label={`${timeText}, change the time of ${title}`}>
              {timeText}
              <span aria-hidden="true" className="edit-mark">
                ✎
              </span>
            </button>
          ) : (
            <span>{timeText}</span>
          )}
          <span className="seg-len">
            {seg.minutes} min{e.item.setup + e.item.cleanup > 0 ? ` + ${e.item.setup + e.item.cleanup} setup/tidy` : ''}
          </span>
        </div>
        <p className="seg-title">
          {href && !e.item.missing ? (
            <a className="seg-title-text" href={href}>
              {title}
            </a>
          ) : (
            <span className="seg-title-text" tabIndex={-1}>
              {title}
            </span>
          )}
          {who && !seg.along && <span className="who-chip">{who}</span>}
          {recipe && <span className="tag sky">{recipe.mode === 'together' ? 'Together' : 'Side by side'}</span>}
          {seg.kind === 'custom' && <span className="tag">Your entry</span>}
          {seg.kind === 'routine' && <span className="tag">Your estimate</span>}
          {seg.locked && <span className="tag">Kept</span>}
        </p>
        {roles.length > 0 && (
          <ul className="tracks">
            {roles.map((r) => (
              <li key={r.who}>
                <span className="who">{r.who}:</span> {r.text}
              </li>
            ))}
          </ul>
        )}
        {napSelect && (
          <NapAdultSelect hostChild={childLabel(seg.who === 'c2' ? 'c2' : 'c1')} value={napAdultValue(seg)} onChange={(v) => { onChange(updateEntry(plan, i, napAdultPatch(v))); announce(napAdultText({ ...seg, ...napAdultPatch(v) } as PlanSegment)); }} />
        )}
        {e.timing.cue && <CueDetails cue={e.timing.cue} c={c} prefix={two && seg.kind === 'recipe' ? childLabel(e.timing.cue.finding.child === 1 ? 1 : 0) : undefined} />}
        {note && <p className="seq-note">{note}</p>}
        {e.timeIssue && (
          <p className="safety-line" role="note">
            {TIME_ISSUE_TEXT[e.timeIssue]}
          </p>
        )}
        {safety.map((t) => (
          <p key={t} className="safety-line">
            {t}
          </p>
        ))}
        {others.map((cf, k) => (
          <p key={k} className={`conflict ${cf.severity}`} role="note">
            {cf.message}
          </p>
        ))}
        {fixes.length > 0 && (
          <div className="button-row repairs">
            {fixes.map((r) => (
              <button key={`${r.kind}-${r.index}-${r.label}`} type="button" onClick={() => repair(r)}>
                {r.label}
              </button>
            ))}
          </div>
        )}
        <div className="seg-tools">
          <span className="resize" role="group" aria-label={`Length of ${title}`}>
            <button type="button" onClick={() => sizeBy(i, -1)} aria-label={`Shorter: ${title}`} disabled={seg.minutes <= min}>
              −
            </button>
            <output aria-live="off">{seg.minutes} min</output>
            <button type="button" onClick={() => sizeBy(i, 1)} aria-label={`Longer: ${title}`} disabled={seg.minutes >= max}>
              +
            </button>
          </span>
          <span className="tool-group">
            <button type="button" className="icon-button" data-move="-1" onClick={() => move(i, -1)} disabled={!canUp} aria-label={`Move earlier: ${title}`}>
              ↑
            </button>
            <button type="button" className="icon-button" data-move="1" onClick={() => move(i, 1)} disabled={!canDown} aria-label={`Move later: ${title}`}>
              ↓
            </button>
            <MoreMenu label={title} items={more} text="⋯" spoken="More" className="row-menu" />
          </span>
        </div>
        {rowNote?.id === seg.id && <p className="row-note">{rowNote.text}</p>}
        {panel?.type === 'edit-routine' && panel.id === seg.id && seg.routine && (
          <RoutineForm
            plan={plan}
            routine={seg.routine}
            defaultClock={parseHHMM(plan.start) + e.item.start}
            edit={{ seg, whoLocked: seg.along ? 'along' : plan.segments[i + 1]?.along ? 'host' : false }}
            onCancel={() => {
              setPanel(null);
              focusSoon(`[data-seg="${seg.id}"] .menu-button`);
            }}
            onAdd={(input) => {
              let next = updateEntry(plan, i, {
                routine: input.routine,
                who: two ? input.who : 'c1',
                minutes: input.minutes,
                settle: input.routine === 'nap' ? input.settle : undefined,
                holding: input.routine === 'nap' && input.holding ? true : undefined,
              });
              const at = offsetForClock(next, input.clock);
              if (at !== seg.at) next = setAnchor(next, next.segments.findIndex((x) => x.id === seg.id), at, c);
              onChange(next);
              setPanel(null);
              announce(`${ROUTINE_LABEL[input.routine]}${two ? ` for ${input.who === 'both' ? 'both children' : childLabel(input.who)}` : ''} at ${clockAt(next, at)}, ${formatMinutes(input.minutes)}.`);
              focusSoon(`[data-seg="${seg.id}"] .seg-title-text`);
            }}
          />
        )}
        {panel?.type === 'swap' && panel.id === seg.id && (
          <OptionList
            title={`Swap ${title} for…`}
            options={options({ replace: i })}
            pickLabel="Use this"
            empty="Nothing else fits this spot with your current choices."
            onPick={(o) => swapTo(i, o)}
            onCancel={() => setPanel(null)}
          />
        )}
      </li>
    );
  };

  const gapRow = (g: Gap, key: string) => {
    const minutes = g.end - g.start;
    if (g.who === 'all') {
      return (
        <li key={key} className="seg open">
          <div className="seg-time">
            <span>
              {clockAt(plan, g.start)}–{clockAt(plan, g.end)}
            </span>
          </div>
          <p className="seg-title">Open time · {formatMinutes(minutes)}</p>
          <p className="subtle">Unscheduled. Rest, free play, or whatever comes up.</p>
        </li>
      );
    }
    return (
      <li key={key} className={`seg gap-child adult-${g.adult ?? 'busy'}`}>
        <div className="seg-time">
          <span>
            {clockAt(plan, g.start)}–{clockAt(plan, g.end)}
          </span>
          <span className="seg-len">{formatMinutes(minutes)}</span>
        </div>
        <p className="gap-text">{childGapText(g, plan)}</p>
      </li>
    );
  };

  /** Why nothing can be added alongside a routine right now, in the parent's terms. */
  const emptyAlongText = (hostIndex: number, other: string) => {
    const gaps = analysis.gaps.filter((g) => g.host === hostIndex && g.who !== 'all');
    const host = plan.segments[hostIndex];
    if (gaps.some((g) => g.adult === 'unknown')) return `Set your settling time on the nap to plan ${other}’s time during it, or add your own entry.`;
    if (gaps.reduce((m, g) => m + g.end - g.start, 0) < 2) return `There’s no unplanned time left for ${other} during this ${(host?.routine ? ROUTINE_LABEL[host.routine] : 'routine').toLowerCase()}.`;
    if (gaps.every((g) => g.adult === 'undivided')) return `With one adult, ${other}’s time during a meal or snack stays unplanned: it needs your full attention.`;
    return `Nothing in Trunk fits ${other} alongside this with one adult right now. You could add your own entry.`;
  };

  const rows: ReactNode[] = (plan.segments.length ? planRows(plan, analysis) : []).map((row) => {
    if (row.kind === 'entry') return entryRow(row.entry);
    if (row.kind === 'gap') return gapRow(row.gap, `gap-${row.gap.who}-${row.gap.start}`);
    const hostIndex = row.host.item.index;
    const hs = row.host.item.segment;
    const other = childLabel(row.otherLane);
    return (
      <li key={`track-${hs.id}-${row.continued ? (row.items[0]?.kind === 'entry' ? row.items[0].entry.item.segment.id : row.items[0]?.gap.start) : 'first'}`} className="along-track" aria-label={`While ${childLabel(row.hostLane)} ${row.verb}: ${other}${row.continued ? ' (continued)' : ''}`}>
        <p className="track-head">
          While {childLabel(row.hostLane)} {row.verb} · {other}{row.continued ? ' (continued)' : ''}:
        </p>
        {row.items.length > 0 && <ol className="timeline nested">{row.items.map((t) => (t.kind === 'entry' ? entryRow(t.entry) : gapRow(t.gap, `cg-${hostIndex}-${t.gap.start}`)))}</ol>}
        {row.last && <div className="add-along">
          <MoreMenu
            text={`+ Add for ${other}`}
            label={`alongside ${name(hs).toLowerCase()}`}
            items={[
              { label: 'Activity', onSelect: () => setPanel({ type: 'activity', host: hostIndex }), disabled: full },
              { label: 'Your own entry', onSelect: () => setPanel({ type: 'custom', host: hostIndex, who: row.otherLane }), disabled: full },
            ]}
          />
        </div>}
        {row.last && panel?.type === 'activity' && panel.host === hostIndex && (
          <OptionList
            title={`Add for ${other} alongside the ${name(hs).toLowerCase()}`}
            options={options({ host: hostIndex })}
            pickLabel="Add"
            empty={emptyAlongText(hostIndex, other)}
            onPick={(o) => addSeg({ ...segFromOption(o, plan, c), who: row.otherLane }, hostIndex)}
            onCancel={() => setPanel(null)}
          />
        )}
        {row.last && panel?.type === 'custom' && panel.host === hostIndex && <CustomForm plan={plan} alongWho={row.otherLane} onAdd={(seg) => addSeg(seg, hostIndex)} onCancel={() => setPanel(null)} />}
      </li>
    );
  });

  return (
    <div className="plan-editor" ref={editorRef}>
      <Summary plan={plan} analysis={analysis} />
      {(tally.flat > 0 || tally.supported > 0) && (
        <p className="tummy-tally note-box">
          <strong>Tummy time planned:</strong> up to {tally.flat} min of floor tummy time on a flat surface
          {tally.supported > 0 ? `, and ${tally.supported} min held or supported (not counted as flat-surface time)` : ''}. Count only the minutes your baby is actually on their tummy, awake and watched.
        </p>
      )}
      <ol className="timeline" ref={listRef} aria-label="Plan timeline">
        {plan.segments.length === 0 && <li className="empty">This plan is empty. Add an activity, a nap or feed, a break, or your own entry.</li>}
        {rows}
        {analysis.overrun > 0 && (
          <li className="seg overrun" role="note">
            <p className="seg-title">Runs {formatMinutes(analysis.overrun)} past your window</p>
            <div className="overrun-row">
              <button
                type="button"
                onClick={() => {
                  onChange({ ...plan, window: extendTo, updatedAt: new Date().toISOString() });
                  announce(`The plan now covers ${extendTo} minutes.`);
                  focusSoon('.plan-summary');
                }}
              >
                Extend to {extendTo} min
              </button>
              <span className="subtle">or shorten or remove something.</span>
            </div>
          </li>
        )}
      </ol>

      <div className="add-row" ref={addRef}>
        <div className="add-block">
          <MoreMenu text="+ Add block" label="to the plan" items={addMenu} />
        </div>
        {footer}
      </div>
      {full && <p className="tiny">A plan can hold up to {MAX_SEGMENTS} entries.</p>}

      {panel?.type === 'activity' && panel.host === undefined && (
        <OptionList
          title="Add an activity"
          options={options({})}
          pickLabel="Add"
          empty="Nothing else fits your current choices. Try changing energy or place above."
          onPick={(o) => addSeg(segFromOption(o, plan, c))}
          onCancel={() => setPanel(null)}
        />
      )}
      {panel?.type === 'custom' && panel.host === undefined && <CustomForm plan={plan} onAdd={(seg) => addSeg(seg)} onCancel={() => setPanel(null)} />}
      {panel?.type === 'routine' && (
        <RoutineForm
          key={panel.routine}
          plan={plan}
          routine={panel.routine}
          defaultClock={nextClock}
          onCancel={() => setPanel(null)}
          onAdd={(input) => {
            const before = new Set(plan.segments.map((s) => s.id));
            const next = addRoutine(plan, input, c);
            if (next === plan) return announce(`A plan can hold up to ${MAX_SEGMENTS} entries.`);
            onChange(next);
            setPanel(null);
            const added = next.segments.find((s) => !before.has(s.id));
            const who = two ? ` for ${input.who === 'both' ? 'both children' : childLabel(input.who)}` : '';
            announce(`Added a ${ROUTINE_LABEL[input.routine].toLowerCase()}${who} at ${clockAt(next, offsetForClock(next, input.clock))}${added?.along ? ', alongside the other child’s routine' : ''}.`);
            if (added) focusSoon(`[data-seg="${added.id}"] .seg-title-text`);
          }}
        />
      )}
    </div>
  );
}

function Summary({ plan, analysis }: { plan: Plan; analysis: PlanAnalysis }) {
  const endOffset = Math.max(analysis.end, 0);
  return (
    <div className="plan-summary" tabIndex={-1}>
      <span>
        <strong>{clockAt(plan, 0)}</strong> to <strong>{clockAt(plan, Math.max(endOffset, plan.window))}</strong>
      </span>
      <span>
        {formatMinutes(analysis.busy)} planned of {formatMinutes(plan.window)}
      </span>
      {analysis.open > 0 && <span>{formatMinutes(analysis.open)} open</span>}
      {analysis.overrun > 0 && <span className="warn">Runs {formatMinutes(analysis.overrun)} past your window</span>}
      <span className="estimate">Estimated times</span>
    </div>
  );
}
