import { useEffect, useRef, useState } from 'react';
import type { IndexedCatalog } from '../content/catalog.ts';
import { formatAge } from '../lib/age.ts';
import type { Plan } from '../lib/plan.ts';
import { DEFAULT_SHARE_OPTIONS, encodePayload, MAX_LINK_LENGTH, shareUrl, toCompact, type ShareOptions } from '../lib/share.ts';
import { formatClock, parseHHMM } from '../lib/time.ts';
import { ENERGY_LABEL } from '../lib/filters.ts';
import { segmentTitle } from './PlanEditor.tsx';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function ShareDialog({ plan, c, onClose, onExport }: { plan: Plan; c: IndexedCatalog; onClose: () => void; onExport: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [opts, setOpts] = useState<ShareOptions>(DEFAULT_SHARE_OPTIONS);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  useEffect(() => {
    let live = true;
    setCopied(false);
    encodePayload(plan, opts).then((payload) => {
      if (live) setUrl(shareUrl(`${window.location.origin}${window.location.pathname}`, payload));
    });
    return () => {
      live = false;
    };
  }, [plan, opts]);

  const tooLong = url !== null && url.length > MAX_LINK_LENGTH;
  const hasCustom = plan.segments.some((s) => s.kind === 'custom');
  const compact = toCompact(plan, opts);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      const input = document.getElementById('share-url') as HTMLInputElement | null;
      input?.select();
    }
  };

  const nativeShare = async () => {
    if (!url) return;
    try {
      await navigator.share({ title: 'A Trunk plan', url });
    } catch {
      /* cancelled or not permitted */
    }
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify({ trunkPlan: 1, plan: compact }, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'trunk-plan.json');
  };

  return (
    <dialog ref={ref} aria-labelledby="share-title" onClose={onClose} onCancel={onClose}>
      <div className="dialog-body">
        <div className="dialog-head">
          <h2 id="share-title">Share this plan</h2>
          <button type="button" onClick={() => ref.current?.close()}>
            Close
          </button>
        </div>
        <p className="subtle">
          The whole plan is packed into the link—nothing is uploaded. <strong>Anyone with the link can read what’s in it;</strong> it isn’t encrypted.
        </p>
        <fieldset className="segmented" style={{ marginBottom: 8 }}>
          <legend>Also include (off by default)</legend>
          <label className="check">
            <input type="checkbox" checked={opts.includeTitle} onChange={(e) => setOpts({ ...opts, includeTitle: e.target.checked })} disabled={!plan.title.trim()} />
            Plan name{plan.title.trim() ? `: “${plan.title.trim()}”` : ' (none)'}
          </label>
          <label className="check">
            <input type="checkbox" checked={opts.includeCustomText} onChange={(e) => setOpts({ ...opts, includeCustomText: e.target.checked })} disabled={!hasCustom} />
            Text of your own entries
          </label>
          <label className="check">
            <input type="checkbox" checked={opts.includeNotes} onChange={(e) => setOpts({ ...opts, includeNotes: e.target.checked })} disabled={!plan.notes.trim()} />
            Private notes
          </label>
        </fieldset>
        <div className="preview-box" aria-live="polite">
          <strong>The link will contain:</strong>
          <ul className="bullets" style={{ marginTop: 4 }}>
            <li>{compact.t ? `Name: ${compact.t}` : 'Name: “Shared plan”'}</li>
            {plan.kids.map((k, i) => (
              <li key={i}>
                Child {i + 1}: about {formatAge(k.age)}
              </li>
            ))}
            <li>
              Starts {formatClock(parseHHMM(plan.start))}, {plan.window}-minute window
            </li>
            <li>
              Settings: {ENERGY_LABEL[plan.settings.energy]} · {plan.settings.place === 'any' ? 'anywhere' : plan.settings.place === 'indoors' ? 'inside' : 'outside'} · {plan.settings.adults === 1 ? 'one adult' : 'two adults'}
            </li>
          </ul>
          <ol>
            {plan.segments.map((s) => (
              <li key={s.id}>
                {s.kind === 'custom' && !opts.includeCustomText ? 'Your own activity' : segmentTitle(s, c)} · {s.minutes} min
              </li>
            ))}
          </ol>
          {compact.n && <p style={{ margin: '6px 0 0' }}>Notes: {compact.n}</p>}
          <p className="tiny" style={{ margin: '6px 0 0' }}>
            Ages are the whole weeks or months entered here. No names, birthdays, dates, readiness notes, or saved-plan list are included.
          </p>
        </div>
        {url === null ? (
          <p>Preparing link…</p>
        ) : tooLong ? (
          <div className="banner" role="status" style={{ marginTop: 12 }}>
            <p>This plan is too long for a reliable link ({url.length} characters; the limit is {MAX_LINK_LENGTH}). Share it as images or a plan file instead.</p>
            <div className="button-row">
              <button type="button" onClick={onExport}>
                Save as images
              </button>
              <button type="button" onClick={downloadJson}>
                Download plan file
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <label htmlFor="share-url" className="tiny">
              Link ({url.length} characters)
            </label>
            <input id="share-url" className="link-field" type="text" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
            <div className="button-row" style={{ marginTop: 8 }}>
              <button type="button" className="primary" onClick={copy}>
                {copied ? 'Copied' : 'Copy link'}
              </button>
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button type="button" onClick={nativeShare}>
                  Share…
                </button>
              )}
              <button type="button" onClick={downloadJson}>
                Download plan file
              </button>
            </div>
            <p className="tiny" style={{ marginTop: 8 }}>
              The person you send it to sees a preview and chooses whether to save it. Their copy is re-checked against Trunk’s current catalog and age and pairing rules; anything retired or unsuitable is left out.
            </p>
          </div>
        )}
      </div>
    </dialog>
  );
}
