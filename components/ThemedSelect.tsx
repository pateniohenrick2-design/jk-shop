'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

type Option = { value: string; label: string; disabled?: boolean };

// Dropdown drawn by the site itself (dark green theme) instead of the phone's/browser's system picker.
// The list floats above everything (fixed position), so it's never cut off inside tables or modals,
// and opens upward when there isn't room below.
// Keyboard: Enter/Space/↓ opens, ↑/↓ moves, Enter picks, Esc closes. Tap outside closes.
export default function ThemedSelect({
  value,
  options,
  placeholder = 'Select…',
  onChange,
  className = '',
  disabled = false,
  ariaLabel,
  size = 'md',
}: {
  value: string;
  options: Option[];
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();
  const selected = options.find((o) => o.value === value);

  // Place the list under (or above) the button
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const place = () => {
      const r = btnRef.current!.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const width = Math.max(r.width, 180);
      const left = Math.min(r.left, window.innerWidth - width - 8);
      if (below >= 220 || below >= above) setPos({ top: r.bottom + 6, left, width, maxHeight: Math.min(340, below) });
      else setPos({ bottom: window.innerHeight - r.top + 6, left, width, maxHeight: Math.min(340, above) });
    };
    place();
    // Page scroll / resize: close (the button moved)
    const close = (e: Event) => { if (!listRef.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [open]);

  // Close on outside tap
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Start on the selected option and keep the focused one in view
  useEffect(() => {
    if (open) setFocusIdx(Math.max(0, options.findIndex((o) => o.value === value)));
    else setPos(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${focusIdx}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, focusIdx, pos]);

  function pick(o: Option) {
    if (o.disabled) return;
    if (o.value !== value) onChange(o.value);
    setOpen(false);
    btnRef.current?.focus();
  }

  function move(dir: 1 | -1) {
    setFocusIdx((i) => {
      let n = i;
      for (let k = 0; k < options.length; k++) {
        n = Math.min(options.length - 1, Math.max(0, n + dir));
        if (!options[n]?.disabled) return n;
      }
      return i;
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (options[focusIdx]) pick(options[focusIdx]); }
    else if (e.key === 'Tab') setOpen(false);
  }

  return (
    <div ref={wrapRef} className={`tsel tsel-${size} ${open ? 'open' : ''} ${selected ? 'has-value' : ''} ${disabled ? 'disabled' : ''} ${className}`}>
      <button
        ref={btnRef}
        type="button"
        className="tsel-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
      >
        <span className="tsel-label">{selected ? selected.label : placeholder}</span>
        <svg className="tsel-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && pos && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          className="tsel-list"
          aria-label={ariaLabel ?? placeholder}
          style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              data-idx={i}
              role="option"
              aria-selected={o.value === value}
              aria-disabled={o.disabled || undefined}
              className={`tsel-opt${o.value === value ? ' selected' : ''}${i === focusIdx ? ' focused' : ''}${o.disabled ? ' disabled' : ''}`}
              onPointerEnter={() => !o.disabled && setFocusIdx(i)}
              onClick={() => pick(o)}
            >
              <span>{o.label}</span>
              {o.value === value && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
