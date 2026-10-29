import { useEffect, useMemo, useState } from 'react';
import type { IndexedCatalog } from '../content/catalog.ts';
import { formatAge } from '../lib/age.ts';
import { analyzePlan } from '../lib/layout.ts';
import type { Plan } from '../lib/plan.ts';
import { importPayload, ShareError, type ImportResult } from '../lib/share.ts';
import { formatMinutes } from '../lib/time.ts';
import { clockAt } from './planDisplay.ts';
import { PlanPreview } from './PlanPreview.tsx';

export function ImportedPlanPreview({ result, c }: { result: ImportResult; c: IndexedCatalog }) {
  const { plan, dropped, adjusted } = result;
  const changed = result.changed ?? [];
  const analysis = useMemo(() => analyzePlan(plan, c), [plan, c]);
  const end = Math.max(plan.window, analysis.end);
  return (
    <>
      <h2 className="shared-title">{plan.title}</h2>
      <p className="subtle">
        For {plan.kids.map((k, i) => `${plan.kids.length === 2 ? `Child ${i + 1}, ` : ''}about ${formatAge(k.age)}`).join(' and ')} · {clockAt(plan, 0)} to {clockAt(plan, end)} ({formatMinutes(analysis.busy)} planned) · {plan.settings.adults === 1 ? 'one adult' : 'two adults'} · estimated times
      </p>
      {(dropped.length > 0 || changed.length > 0 || adjusted > 0) && (
        <div className="banner" role="status">
          {dropped.length > 0 && (
            <>
              <p>Trunk left out {dropped.length} item(s) after checking them against today’s safety and age rules:</p>
              <ul className="bullets">
                {dropped.map((d, i) => (
                  <li key={i}>
                    {d.label}: {d.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
          {changed.length > 0 && (
            <ul className="bullets">
              {changed.map((d, i) => (
                <li key={i}>
                  {d.label}: {d.reason}
                </li>
              ))}
            </ul>
          )}
          {adjusted > 0 && <p>{adjusted} length(s) were adjusted to a realistic range.</p>}
        </div>
      )}
      <PlanPreview plan={plan} analysis={analysis} c={c} />
      {plan.notes && (
        <p className="panel sender-notes">
          <strong>Notes from the sender:</strong> {plan.notes}
        </p>
      )}
    </>
  );
}

export function SharedView({ payload, c, onSave, onOpen }: { payload: string; c: IndexedCatalog; onSave: (plan: Plan) => void; onOpen: (plan: Plan) => void }) {
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
