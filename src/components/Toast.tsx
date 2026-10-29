import { useEffect } from 'react';

export interface ToastState {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

export function Toast({ toast, onDone }: { toast: ToastState | null; onDone: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, toast.action ? 8000 : 4500);
    return () => clearTimeout(t);
  }, [toast, onDone]);
  return (
    <div role="status" aria-live="polite">
      {toast && (
        <div className="toast">
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
