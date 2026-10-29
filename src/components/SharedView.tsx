import { useEffect, useState } from 'react';
import type { IndexedCatalog } from '../content/catalog.ts';
import { formatAge } from '../lib/age.ts';
import type { Plan } from '../lib/plan.ts';
import { timeline } from '../lib/layout.ts';
import { importPayload, ShareError, type ImportResult } from '../lib/share.ts';
import { formatClock, formatMinutes, parseHHMM } from '../lib/time.ts';
import { segmentTimeIssue, segmentTitle, Tracks } from './PlanEditor.tsx';
import { TIME_ISSUE_TEXT } from '../lib/timeRules.ts';

export function ImportedPlanPreview({ result, c }: { result: ImportResult; c: IndexedCatalog }) {
  const { plan, dropped, adjusted } = result;
  const items = timeline(plan, c);
  const used = items.reduce((s, t) => s + t.wall, 0);
  const start = parseHHMM(plan.start);
  return (
    <>
      <h2 style={{ marginTop: 8 }}>{plan.title}</h2>
      <p className="subtle">
        For {plan.kids.map((k) => `about ${formatAge(k.age)}`).join(' and ')} · {formatClock(start)} to {formatClock(start + used)} ({formatMinutes(used)}) · planned for {plan.settings.adults === 1 ? 'one adult' : 'two adults'}
      </p>
      {(dropped.length > 0 || adjusted > 0) && (
        <div className="banner" role="status">
          {dropped.length > 0 && (
            <>
              <p style={{ marginBottom: 4 }}>Trunk left out {dropped.length} item(s) after checking them against today’s safety and age rules:</p>
              <ul className="bullets">
                {dropped.map((d, i) => (
                  <li key={i}>
                    {d.label}: {d.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
          {adjusted > 0 && <p style={{ margin: '4px 0 0' }}>{adjusted} length(s) were adjusted to a realistic range.</p>}
        </div>
      )}
      <ol className="timeline">
        {items.map((t) => (
          <li key={t.segment.id} className={`seg${t.segment.kind === 'break' ? ' break' : ''}`}>
            <div className="seg-time">
              {formatClock(t.start)}–{formatClock(t.end)} · {t.segment.minutes} min
            </div>
            <p className="seg-title">{segmentTitle(t.segment, c)}</p>
            <Tracks seg={t.segment} plan={plan} c={c} />
            {(() => {
              const issue = segmentTimeIssue(t, plan, c);
              return issue ? <p className="safety-line">{TIME_ISSUE_TEXT[issue]}</p> : null;
            })()}
          </li>
        ))}
      </ol>
      {plan.notes && (
        <p className="panel" style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>
          <strong>Notes from the sender:</strong> {plan.notes}
        </p>
      )}
    </>
  );
}

export function SharedView({
  payload,
  c,
  onSave,
  onOpen,
}: {
  payload: string;
  c: IndexedCatalog;
  onSave: (plan: Plan) => void;
  onOpen: (plan: Plan) => void;
}) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; result: ImportResult }>({ status: 'loading' });

  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    importPayload(payload, c)
      .then((result) => live && setState({ status: 'ok', result }))
      .catch((e: unknown) => live && setState({ status: 'error', message: e instanceof ShareError ? e.message : 'This link couldn’t be opened.' }));
    return () => {
      live = false;
    };
  }, [payload, c]);

  return (
    <div className="page">
      <h1>A shared plan</h1>
      {state.status === 'loading' && <p role="status">Opening the plan…</p>}
      {state.status === 'error' && (
        <div className="empty" role="alert">
          <p>{state.message}</p>
          <a className="button" href="#/">
            Find something to do instead
          </a>
        </div>
      )}
      {state.status === 'ok' && (
        <>
          <p className="banner info">
            Someone shared this plan with you. It hasn’t been saved. Check that it suits your {state.result.plan.kids.length > 1 ? 'children' : 'child'} today.
          </p>
          <ImportedPlanPreview result={state.result} c={c} />
          <div className="plan-actions">
            <button type="button" className="primary" onClick={() => onSave(state.result.plan)}>
              Save to my plans
            </button>
            <button type="button" onClick={() => onOpen(state.result.plan)}>
              Open in planner
            </button>
          </div>
          <p className="tiny">Saving adds a new plan; it never replaces one you already have.</p>
        </>
      )}
    </div>
  );
}
