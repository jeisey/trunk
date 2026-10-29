import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { IndexedCatalog } from '../content/catalog.ts';
import type { RoutineType } from '../content/schema.ts';
import { monthsToDays, toDays } from '../lib/age.ts';
import { analyzePlan, childLabel, type EntryAnalysis, type Gap, type PlanAnalysis, type Repair } from '../lib/layout.ts';
import { BREAK_LABEL, bounds, MAX_SEGMENTS, newId, resize, ROUTINE_BOUNDS, ROUTINE_LABEL, youngerFor, type Plan, type PlanSegment } from '../lib/plan.ts';
import { addEntry, addRoutine, applyRepair, duplicateEntry, moveEntry, offsetForClock, removeEntry, setAnchor, setLocked, setMinutes, updateEntry } from '../lib/planEdit.ts';
import { optionsForSlot, type SlotOption } from '../lib/planner.ts';
import { sequenceNote } from '../lib/sequence.ts';
import { cleanText, LIMITS } from '../lib/text.ts';
import { TIME_ISSUE_TEXT } from '../lib/timeRules.ts';
import type { ChildTiming } from '../lib/timing.ts';
import { formatMinutes, parseHHMM, toHHMM } from '../lib/time.ts';
import { CueDetails, CueLine } from './Cues.tsx';
import { activityHref, recipeHref } from './IdeaCards.tsx';
import { MoreMenu, type MenuItem } from './MoreMenu.tsx';
import { childGapText, clockAt, entryRoles, entryTitle, napAdultText, planRows, whoText } from './planDisplay.ts';

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

/** "While Child 1 naps, you’re…": Not sure (treated as busy) / Free after settling about N min / Staying with them. */
function NapAdultSelect({ hostChild, value, onChange }: { hostChild: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span>While {hostChild} naps, you’re…</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="unknown">Not sure (Trunk treats you as busy)</option>
        {SETTLE_OPTIONS.map((m) => (
          <option key={m} value={String(m)}>
            Free after settling about {m} min
          </option>
        ))}
        <option value="holding">Staying with them</option>
      </select>
    </label>
  );
}

function RoutineForm({
  plan,
  routine,
  defaultClock,
  onAdd,
  onCancel,
}: {
  plan: Plan;
  routine: RoutineType;
  defaultClock: number;
  onAdd: (input: { who: 'c1' | 'c2' | 'both'; clock: number; minutes: number; settle?: number; holding?: boolean }) => void;
  onCancel: () => void;
}) {
  const two = plan.kids.length === 2;
  const food = routine === 'meal' || routine === 'snack';
  const eligible = plan.kids.map((k) => !food || toDays(k.age) >= monthsToDays(6));
  const whoOptions = (
    [
      ['c1', 'Child 1', eligible[0]],
      ['c2', 'Child 2', two && eligible[1]],
      ['both', 'Both', two && eligible[0] && eligible[1]],
    ] as const
  ).filter(([, , ok]) => ok);
  const [who, setWho] = useState<'c1' | 'c2' | 'both'>(whoOptions[0]?.[0] ?? 'c1');
  const [time, setTime] = useState(toHHMM(defaultClock));
  const [minutes, setMinutes] = useState<number | null>(null);
  const [adult, setAdult] = useState('unknown');
  const [error, setError] = useState(false);
  const { min, max } = ROUTINE_BOUNDS[routine];
  const name = ROUTINE_LABEL[routine];
  const step = (d: number) => setMinutes((m) => Math.max(min, Math.min(max, (m ?? (d > 0 ? min - 5 : min + 5)) + d)));

  return (
    <form
      className="panel add-panel"
      aria-label={`Add a ${name.toLowerCase()}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (minutes === null) {
          setError(true);
          return;
        }
        const patch = routine === 'nap' && two && who !== 'both' ? napAdultPatch(adult) : {};
        onAdd({ who, clock: parseHHMM(time), minutes, settle: patch.settle, holding: patch.holding });
      }}
    >
      <h3>Add a {name.toLowerCase()}</h3>
      {two && whoOptions.length > 1 && (
        <fieldset className="segmented">
          <legend>For</legend>
          <div className="segments">
            {whoOptions.map(([v, label]) => (
              <label key={v}>
                <input type="radio" name="routine-who" checked={who === v} onChange={() => setWho(v)} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {two && whoOptions.length === 1 && <p className="subtle">For {whoOptions[0][1]}. Meals and snacks are for children already eating solid foods.</p>}
      <label className="field">
        <span>Starts</span>
        <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} />
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
      {routine === 'nap' && two && who !== 'both' && <NapAdultSelect hostChild={who === 'c2' ? 'Child 2' : 'Child 1'} value={adult} onChange={setAdult} />}
      {error && (
        <p className="field-error" role="alert">
          Choose about how long first.
        </p>
      )}
      <div className="button-row">
        <button type="submit" className="primary">
          Add {name.toLowerCase()}
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
                <CueLine cue={o.timing?.cue ?? null} />
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
  const editorRef = useRef<HTMLDivElement>(null);
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

  const focusSoon = (selector: string, fallback?: string) =>
    requestAnimationFrame(() => {
      const root = listRef.current?.parentElement;
      const el = root?.querySelector<HTMLElement>(selector) ?? (fallback ? root?.querySelector<HTMLElement>(fallback) : null);
      el?.focus();
    });

  const move = (i: number, dir: -1 | 1) => {
    const seg = plan.segments[i];
    const next = moveEntry(plan, i, dir);
    if (next === plan) return;
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

  const repair = (r: Repair) => {
    if (r.kind === 'swap') {
      const seg = plan.segments[r.index];
      if (seg) setPanel({ type: 'swap', id: seg.id });
      return;
    }
    onChange(applyRepair(plan, r, c));
    announce(`${r.label}. Done.`);
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
    const timingConflict = e.conflicts.find((cf) => cf.kind === 'timing');
    const others = e.conflicts.filter((cf) => cf.kind !== 'timing');
    const safety = seg.kind === 'activity' ? c.activityById.get(seg.ref ?? '')?.safety[0]?.text : seg.kind === 'recipe' ? recipe?.safety[0]?.text : undefined;
    const lockable = seg.kind === 'activity' || seg.kind === 'recipe' || seg.kind === 'break';
    const canUp = seg.along ? plan.segments[i - 1]?.along === true : plan.segments.slice(0, i).some((s) => !s.along);
    const canDown = seg.along ? plan.segments[i + 1]?.along === true : plan.segments.slice(i + 1).some((s) => !s.along);
    const more: MenuItem[] = [
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
                const input = (ev.currentTarget.elements.namedItem('t') as HTMLInputElement).value;
                if (input) {
                  onChange(setAnchor(plan, i, offsetForClock(plan, parseHHMM(input)), c));
                  announce(`${title} now starts at ${clockAt(plan, offsetForClock(plan, parseHHMM(input)))}.`);
                }
                setEditingTime(null);
                focusSoon(`[data-seg="${seg.id}"] .time-button`, `[data-seg="${seg.id}"] .menu-button`);
              }}
            >
              <label>
                <span className="visually-hidden">{title} starts at</span>
                <input name="t" type="time" defaultValue={toHHMM(parseHHMM(plan.start) + e.item.start)} autoFocus />
              </label>
              <button type="submit">Set</button>
              <button type="button" onClick={() => setEditingTime(null)}>
                Cancel
              </button>
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
        {timingConflict && timingConflict.repairs.length > 0 && (
          <div className="button-row repairs">
            {timingConflict.repairs.map((r) => (
              <button key={r.label} type="button" onClick={() => repair(r)}>
                {r.label}
              </button>
            ))}
          </div>
        )}
        {note && <p className="seq-note">{note}</p>}
        {e.timeIssue && (
          <p className="safety-line" role="note">
            {TIME_ISSUE_TEXT[e.timeIssue]}
          </p>
        )}
        {safety && <p className="safety-line">{safety}</p>}
        {others.map((cf, k) => (
          <div key={k} className={`conflict ${cf.severity}`} role="note">
            <p>{cf.message}</p>
            {cf.repairs.length > 0 && (
              <div className="button-row">
                {cf.repairs.map((r) => (
                  <button key={r.label} type="button" onClick={() => repair(r)}>
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
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
          <button type="button" className="icon-button" data-move="-1" onClick={() => move(i, -1)} disabled={!canUp} aria-label={`Move earlier: ${title}`}>
            ↑
          </button>
          <button type="button" className="icon-button" data-move="1" onClick={() => move(i, 1)} disabled={!canDown} aria-label={`Move later: ${title}`}>
            ↓
          </button>
          <MoreMenu label={title} items={more} text="⋯" spoken="More" className="row-menu" />
        </div>
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

  const rows: ReactNode[] = (plan.segments.length ? planRows(plan, analysis) : []).map((row) => {
    if (row.kind === 'entry') return entryRow(row.entry);
    if (row.kind === 'gap') return gapRow(row.gap, `gap-${row.gap.who}-${row.gap.start}`);
    const hostIndex = row.host.item.index;
    const hs = row.host.item.segment;
    const other = childLabel(row.otherLane);
    return (
      <li key={`track-${hs.id}`} className="along-track" aria-label={`While ${childLabel(row.hostLane)} ${row.verb}: ${other}`}>
        <p className="track-head">
          While {childLabel(row.hostLane)} {row.verb} · {other}:
        </p>
        {row.items.length > 0 && <ol className="timeline nested">{row.items.map((t) => (t.kind === 'entry' ? entryRow(t.entry) : gapRow(t.gap, `cg-${hostIndex}-${t.gap.start}`)))}</ol>}
        <div className="add-along">
          <MoreMenu
            text={`+ Add for ${other}`}
            label={`alongside ${name(hs).toLowerCase()}`}
            items={[
              { label: 'Activity', onSelect: () => setPanel({ type: 'activity', host: hostIndex }), disabled: full },
              { label: 'Your own entry', onSelect: () => setPanel({ type: 'custom', host: hostIndex, who: row.otherLane }), disabled: full },
            ]}
          />
        </div>
        {panel?.type === 'activity' && panel.host === hostIndex && (
          <OptionList
            title={`Add for ${other} alongside the ${name(hs).toLowerCase()}`}
            options={options({ host: hostIndex })}
            pickLabel="Add"
            empty={`Nothing fits ${other} alongside this right now with one adult. You could set your settling time on the nap, or add your own entry.`}
            onPick={(o) => addSeg({ ...segFromOption(o, plan, c), who: row.otherLane }, hostIndex)}
            onCancel={() => setPanel(null)}
          />
        )}
        {panel?.type === 'custom' && panel.host === hostIndex && <CustomForm plan={plan} alongWho={row.otherLane} onAdd={(seg) => addSeg(seg, hostIndex)} onCancel={() => setPanel(null)} />}
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
            <p className="subtle">Lengthen the window above, or shorten or remove something.</p>
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
            const next = addRoutine(plan, { routine: panel.routine, ...input }, c);
            if (next === plan) return announce(`A plan can hold up to ${MAX_SEGMENTS} entries.`);
            onChange(next);
            setPanel(null);
            const added = next.segments.find((s) => !before.has(s.id));
            const who = two ? ` for ${input.who === 'both' ? 'both children' : childLabel(input.who)}` : '';
            announce(`Added a ${ROUTINE_LABEL[panel.routine].toLowerCase()}${who} at ${clockAt(next, offsetForClock(next, input.clock))}${added?.along ? ', alongside the other child’s routine' : ''}.`);
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
    <div className="plan-summary" aria-live="polite">
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
