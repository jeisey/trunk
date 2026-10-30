import { useEffect, useRef, useState } from 'react';

export interface ToastState {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

/**
 * A short status message above the bottom nav. It waits while the pointer or
 * keyboard focus is on it, and stays longer when it offers an action.
 */
export function Toast({ toast, onDone }: { toast: ToastState | null; onDone: () => void }) {
  const [held, setHeld] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!toast || held) return;
    const t = setTimeout(onDone, toast.action ? 15000 : 5000);
    return () => clearTimeout(t);
  }, [toast, onDone, held]);
  useEffect(() => setHeld(false), [toast?.id]);
  return (
    <div role="status" aria-live="polite">
      {toast && (
        <div
          className="toast"
          ref={box}
          onPointerEnter={() => setHeld(true)}
          onPointerLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={(e) => {
            if (!box.current?.contains(e.relatedTarget as Node | null)) setHeld(false);
          }}
        >
          <span>{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action!.run();
                onDone();
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button type="button" aria-label="Dismiss" onClick={onDone}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
