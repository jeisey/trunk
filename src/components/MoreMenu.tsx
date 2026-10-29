import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

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
export function MoreMenu({ label, items, text = 'More', className }: { label: string; items: MenuItem[]; text?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const pendingFocus = useRef<'first' | 'last' | null>(null);

  const enabled = () => [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [])];

  useEffect(() => {
    if (!open) return;
    const list = enabled();
    const target = pendingFocus.current === 'last' ? list[list.length - 1] : list[0];
    target?.focus();
    pendingFocus.current = null;
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
    <div className={`menu-wrap${className ? ` ${className}` : ''}`}>
      <button
        ref={button}
        type="button"
        className="menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        aria-label={`${text}: ${label}`}
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
        <ul ref={menu} id={`${id}-menu`} role="menu" aria-label={label} className="menu" onKeyDown={onMenuKey}>
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
