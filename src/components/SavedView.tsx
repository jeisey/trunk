import { useRef, useState } from 'react';
import { formatAge } from '../lib/age.ts';
import type { Plan } from '../lib/plan.ts';
import { MAX_PLANS, type StoreStatus } from '../lib/storage.ts';
import { LIMITS } from '../lib/text.ts';
import { formatClock, parseHHMM } from '../lib/time.ts';

export function SavedView(props: {
  plans: Plan[];
  status: StoreStatus;
  statusMessage?: string;
  onOpen: (plan: Plan) => void;
  onRename: (plan: Plan, title: string) => void;
  onDuplicate: (plan: Plan) => void;
  onDelete: (plan: Plan) => void;
  onImportFile: (text: string) => void;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const full = props.plans.length >= MAX_PLANS;

  return (
    <div className="page">
      <h1>Saved plans</h1>
      <p className="meter">
        {props.plans.length} of {MAX_PLANS} saved in this browser.
      </p>
      {props.statusMessage && <p className={`banner${props.status === 'ok' ? ' info' : ''}`}>{props.statusMessage}</p>}
      <p className="tiny">
        Plans are stored only in this browser on this device. Clearing site data or using private browsing can remove them. There are no accounts and no syncing; use a share link or image to move a plan elsewhere.
      </p>
      {props.plans.length === 0 ? (
        <p className="empty">No saved plans yet. Make one on the Plan tab and tap Save.</p>
      ) : (
        <ul className="saved-list">
          {props.plans.map((p) => (
            <li key={p.id} className="saved-item">
              {renaming === p.id ? (
                <form
                  className="inline-fields"
                  onSubmit={(e) => {
                    e.preventDefault();
                    props.onRename(p, draft);
                    setRenaming(null);
                  }}
                >
                  <label style={{ flex: '1 1 200px' }}>
                    New name
                    <input type="text" autoFocus maxLength={LIMITS.title} value={draft} onChange={(e) => setDraft(e.target.value)} />
                  </label>
                  <button type="submit" className="primary">
                    Save name
                  </button>
                  <button type="button" onClick={() => setRenaming(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <h3>{p.title || 'Untitled plan'}</h3>
              )}
              <p className="subtle" style={{ marginBottom: 8 }}>
                {p.kids.map((k) => formatAge(k.age)).join(' + ')} · starts {formatClock(parseHHMM(p.start))} · {p.segments.length} entries
              </p>
              <div className="button-row">
                <button type="button" className="primary" onClick={() => props.onOpen(p)}>
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRenaming(p.id);
                    setDraft(p.title);
                  }}
                >
                  Rename
                </button>
                <button type="button" onClick={() => props.onDuplicate(p)} disabled={full} aria-describedby={full ? 'full-note' : undefined}>
                  Duplicate
                </button>
                <button type="button" className="danger" onClick={() => props.onDelete(p)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {full && (
        <p id="full-note" className="tiny" style={{ marginTop: 8 }}>
          You’ve reached {MAX_PLANS} saved plans. Delete one to save or duplicate another.
        </p>
      )}
      <div style={{ marginTop: 18 }}>
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
