import { Fragment, useRef, useState } from 'react';
import type { IndexedCatalog } from '../content/catalog.ts';
import { analyzePlan } from '../lib/layout.ts';
import type { Plan } from '../lib/plan.ts';
import { MAX_PLANS, type StoreStatus } from '../lib/storage.ts';
import { LIMITS } from '../lib/text.ts';
import { formatClock, parseHHMM } from '../lib/time.ts';
import { MoreMenu } from './MoreMenu.tsx';
import { kidsText, planTitle, routineSummary } from './planDisplay.ts';

function SavedItem({
  plan,
  c,
  full,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: {
  plan: Plan;
  c: IndexedCatalog;
  full: boolean;
  onOpen: () => void;
  onRename: (title: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');
  const item = useRef<HTMLLIElement>(null);
  const title = planTitle(plan);
  const start = parseHHMM(plan.start);
  const end = start + Math.max(plan.window, analyzePlan(plan, c).end);
  const routines = routineSummary(plan, c);
  const backToMenu = () => requestAnimationFrame(() => item.current?.querySelector<HTMLButtonElement>('.menu-button')?.focus());

  return (
    <li className="saved-item" ref={item} data-plan={plan.id}>
      {renaming ? (
        <form
          className="inline-fields rename"
          onSubmit={(e) => {
            e.preventDefault();
            onRename(draft);
            setRenaming(false);
            backToMenu();
          }}
        >
          <label>
            New name
            <input type="text" autoFocus maxLength={LIMITS.title} value={draft} placeholder={title} onChange={(e) => setDraft(e.target.value)} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary">
              Save name
            </button>
            <button
              type="button"
              onClick={() => {
                setRenaming(false);
                backToMenu();
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="saved-row">
          <div className="saved-main">
            <h2 className="saved-title">
              <a
                href="#/plan"
                onClick={(e) => {
                  e.preventDefault();
                  onOpen();
                }}
              >
                {title}
              </a>
            </h2>
            <p className="subtle">
              {kidsText(plan)} · {formatClock(start)}–{formatClock(end)} · {plan.segments.length} {plan.segments.length === 1 ? 'entry' : 'entries'}
            </p>
            {routines.length > 0 && <p className="saved-routines">{routines.slice(0, 3).join(' · ') + (routines.length > 3 ? ` · +${routines.length - 3} more` : '')}</p>}
          </div>
          <MoreMenu
            label={title}
            items={[
              {
                label: 'Rename',
                onSelect: () => {
                  setDraft(plan.title);
                  setRenaming(true);
                },
              },
              { label: 'Duplicate', onSelect: onDuplicate, disabled: full, description: full ? `You’ve reached ${MAX_PLANS} saved plans.` : undefined },
              { label: 'Delete', onSelect: onDelete, danger: true },
            ]}
          />
        </div>
      )}
    </li>
  );
}

function DeletedRow({ title, onUndo }: { title: string; onUndo: () => void }) {
  return (
    <li className="saved-item deleted-item">
      <p>Deleted “{title}”.</p>
      <button type="button" onClick={onUndo} aria-label={`Deleted “${title}”. Undo`}>
        Undo
      </button>
    </li>
  );
}

export function SavedView(props: {
  c: IndexedCatalog;
  plans: Plan[];
  status: StoreStatus;
  statusMessage?: string;
  onOpen: (plan: Plan) => void;
  onRename: (plan: Plan, title: string) => void;
  onDuplicate: (plan: Plan) => void;
  /** Deletes the plan; returns an undo for the inline "Deleted … · Undo" row (or null). */
  onDelete: (plan: Plan) => (() => boolean) | null;
  onImportFile: (text: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const full = props.plans.length >= MAX_PLANS;
  /** The plan just deleted, shown in its place with Undo (where focus already is). */
  const [deleted, setDeleted] = useState<{ plan: Plan; index: number; undo: () => boolean } | null>(null);

  const remove = (plan: Plan, index: number) => {
    const undo = props.onDelete(plan);
    if (!undo) return;
    setDeleted({ plan, index, undo });
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>('.deleted-item button')?.focus());
  };

  const undoDelete = () => {
    if (!deleted) return;
    const id = deleted.plan.id;
    if (deleted.undo()) {
      setDeleted(null);
      requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-plan="${id}"] .saved-title a`)?.focus());
    }
  };

  const items = props.plans.map((p, i) => ({ p, i }));

  return (
    <div className="page">
      <h1>Saved plans</h1>
      <p className="meter">
        Saved on this device · {props.plans.length}/{MAX_PLANS}
      </p>
      {props.status !== 'ok' && props.statusMessage && <p className="banner">{props.statusMessage}</p>}
      {props.plans.length === 0 && !deleted ? (
        <p className="empty">No saved plans yet. Make one on the Plan tab and tap Save.</p>
      ) : (
        <ul className="saved-list" ref={listRef}>
          {items.map(({ p, i }) => (
            <Fragment key={p.id}>
              {deleted && deleted.index === i && <DeletedRow title={planTitle(deleted.plan)} onUndo={undoDelete} />}
              <SavedItem
                plan={p}
                c={props.c}
                full={full}
                onOpen={() => props.onOpen(p)}
                onRename={(t) => props.onRename(p, t)}
                onDuplicate={() => props.onDuplicate(p)}
                onDelete={() => remove(p, i)}
              />
            </Fragment>
          ))}
          {deleted && deleted.index >= props.plans.length && <DeletedRow title={planTitle(deleted.plan)} onUndo={undoDelete} />}
        </ul>
      )}
      {full && <p className="tiny full-note">You’ve reached {MAX_PLANS} saved plans. Delete one to save or duplicate another.</p>}
      <div className="file-open">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            if (file.size > 20_000) return props.onImportFile('');
            props.onImportFile(await file.text());
          }}
        />
        <button type="button" className="quiet-button" onClick={() => fileRef.current?.click()}>
          Open a plan file (.json)
        </button>
      </div>
    </div>
  );
}
