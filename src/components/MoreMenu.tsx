import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** Extra context for screen readers, e.g. why an item is disabled. */
  description?: string;
}

/**
 * A small menu button (WAI-ARIA menu button pattern): Enter/Space/ArrowDown
 * opens it on the first item, ArrowUp on the last; arrows, Home, and End move
 * between items; Escape closes it and returns focus to the button; Tab or a
 * click elsewhere closes it.
 */
export function MoreMenu({ label, items, text = 'More', spoken, className }: { label: string; items: MenuItem[]; text?: string; /** Spoken name when `text` is a symbol. */ spoken?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const pendingFocus = useRef<'first' | 'last' | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<CSSProperties | null>(null);

  // Keep the open menu inside the viewport: line it up with the button, then clamp it to the
  // screen edges, and open upward when there isn't room below (above the bottom nav).
  useLayoutEffect(() => {
    if (!open) {
      setPlace(null);
      return;
    }
    const m = menu.current;
    const b = button.current;
    const w = wrap.current;
    if (!m || !b || !w) return;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const margin = 8;
    const br = b.getBoundingClientRect();
    const wr = w.getBoundingClientRect();
    const width = Math.min(m.offsetWidth, vw - 2 * margin);
    const preferLeft = br.left + br.width / 2 < vw / 2;
    let left = preferLeft ? br.left : br.right - width;
    left = Math.max(margin, Math.min(left, vw - margin - width));
    const nav = document.querySelector('.bottom-nav');
    const floor = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().top : vh;
    const height = m.offsetHeight;
    const up = br.bottom + 4 + height > floor - margin && br.top - 4 - height > margin;
    setPlace({ left: left - wr.left, right: 'auto', ...(up ? { top: 'auto', bottom: `calc(100% + 4px)` } : {}) });
  }, [open]);

  const enabled = () => [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [])];

  // Focus an item once the menu has been placed (it is hidden until then).
  useEffect(() => {
    if (!open || !place || !pendingFocus.current) return;
    const list = enabled();
    const target = pendingFocus.current === 'last' ? list[list.length - 1] : list[0];
    target?.focus();
    pendingFocus.current = null;
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const close = (focusButton: boolean) => {
    setOpen(false);
    if (focusButton) requestAnimationFrame(() => button.current?.focus());
  };

  const onButtonKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      pendingFocus.current = e.key === 'ArrowUp' ? 'last' : 'first';
      setOpen(true);
    }
  };

  const onMenuKey = (e: KeyboardEvent) => {
    const list = enabled();
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      list[list.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrap} className={`menu-wrap${className ? ` ${className}` : ''}`}>
      <button
        ref={button}
        type="button"
        className="menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        aria-label={`${spoken ?? text}: ${label}`}
        onClick={() => {
          pendingFocus.current = 'first';
          setOpen((o) => !o);
        }}
        onKeyDown={onButtonKey}
      >
        {text}
        <span aria-hidden="true" className="menu-caret">
          ▾
        </span>
      </button>
      {open && (
        <ul ref={menu} id={`${id}-menu`} role="menu" aria-label={label} className="menu" style={place ?? { visibility: 'hidden' }} onKeyDown={onMenuKey}>
          {items.map((item) => (
            <li role="none" key={item.label}>
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={item.danger ? 'danger' : undefined}
                aria-disabled={item.disabled || undefined}
                aria-description={item.description}
                onClick={() => {
                  if (item.disabled) return;
                  setOpen(false);
                  item.onSelect();
                  // If the chosen action didn't move focus somewhere useful, return it to the button.
                  requestAnimationFrame(() => {
                    const active = document.activeElement;
                    if ((!active || active === document.body) && button.current?.isConnected) button.current.focus();
                  });
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
