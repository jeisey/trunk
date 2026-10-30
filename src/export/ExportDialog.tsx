import { useEffect, useRef, useState } from 'react';
import type { IndexedCatalog } from '../content/catalog.ts';
import type { Plan } from '../lib/plan.ts';
import { FORMATS, renderPlanImages, type ExportFormat, type ExportOptions, type RenderedPage } from './render.ts';

export default function ExportDialog({ plan, c, onClose }: { plan: Plan; c: IndexedCatalog; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [format, setFormat] = useState<ExportFormat>('feed');
  const [opts, setOpts] = useState<ExportOptions>({ includeTitle: false, includeCustomText: false });
  const [pages, setPages] = useState<RenderedPage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  useEffect(() => {
    let live = true;
    let made: RenderedPage[] = [];
    setPages(null);
    setError(null);
    renderPlanImages(plan, c, format, opts)
      .then((p) => {
        made = p;
        if (live) setPages(p);
        else p.forEach((x) => URL.revokeObjectURL(x.url));
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : 'Images could not be created.'));
    return () => {
      live = false;
      made.forEach((x) => URL.revokeObjectURL(x.url));
    };
  }, [plan, c, format, opts]);

  const files = () => (pages ?? []).map((p) => new File([p.blob], `trunk-plan-${format}-${p.page}.png`, { type: 'image/png' }));
  const canShareFiles = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && pages !== null && navigator.canShare({ files: files() });

  const shareFiles = async () => {
    setShareNote(null);
    try {
      await navigator.share({ files: files(), title: 'A Trunk plan' });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setShareNote('Sharing didn’t work here. Use the download links instead.');
    }
  };

  const hasCustom = plan.segments.some((s) => s.kind === 'custom');

  return (
    <dialog ref={ref} aria-labelledby="export-title" onClose={onClose}>
      <div className="dialog-body">
        <div className="dialog-head">
          <h2 id="export-title">Save as image</h2>
          <button type="button" onClick={() => ref.current?.close()}>
            Close
          </button>
        </div>
        <fieldset className="segmented">
          <legend>Size</legend>
          <div className="segments">
            {(Object.keys(FORMATS) as ExportFormat[]).map((f) => (
              <label key={f}>
                <input type="radio" name="export-format" checked={format === f} onChange={() => setFormat(f)} />
                {FORMATS[f].label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="segmented" style={{ marginTop: 8 }}>
          <legend>Include (off by default)</legend>
          <label className="check">
            <input type="checkbox" checked={opts.includeTitle} disabled={!plan.title.trim()} onChange={(e) => setOpts({ ...opts, includeTitle: e.target.checked })} />
            Plan name
          </label>
          <label className="check">
            <input type="checkbox" checked={opts.includeCustomText} disabled={!hasCustom} onChange={(e) => setOpts({ ...opts, includeCustomText: e.target.checked })} />
            Text of your own entries
          </label>
        </fieldset>
        <p className="tiny">
          Preview below is exactly what will be saved: approximate ages, times, roles, and safety cues. No names, dates, or private notes. Links in images aren’t clickable.
        </p>
        {error && <p className="banner">{error}</p>}
        {!pages && !error && <p role="status">Drawing images…</p>}
        {pages && (
          <>
            <p role="status" className="subtle">
              {pages.length === 1 ? 'Fits on one image.' : `${pages.length} images, so the text stays readable.`}
            </p>
            <div className="export-pages">
              {pages.map((p) => (
                <figure key={p.url}>
                  <img src={p.url} alt={`Plan image ${p.page} of ${p.pages}, ${p.width} by ${p.height} pixels`} width={p.width} height={p.height} />
                  <a className="button" href={p.url} download={`trunk-plan-${format}-${p.page}.png`}>
                    Download {pages.length > 1 ? `${p.page} of ${p.pages}` : 'image'}
                  </a>
                </figure>
              ))}
            </div>
            {canShareFiles && (
              <div className="button-row" style={{ marginTop: 10 }}>
                <button type="button" className="primary" onClick={shareFiles}>
                  Share {pages.length > 1 ? 'images' : 'image'}…
                </button>
              </div>
            )}
            {shareNote && <p className="tiny">{shareNote}</p>}
          </>
        )}
      </div>
    </dialog>
  );
}
