'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';

// One box per digit. Supports typing, Backspace/Delete, ←/→, pasting the whole code
// (into any box), and phone autofill ("From Mail/Messages") which drops the full code in one box.
// `value` uses a space for an empty box in the middle, so clearing a box never shifts the others;
// strip non-digits (value.replace(/\D/g, '')) to get the code.
type Props = {
  length: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

export type OtpInputHandle = { focus: () => void };

const OtpInput = forwardRef<OtpInputHandle, Props>(function OtpInput(
  { length, value, onChange, onComplete, disabled, autoFocus },
  ref,
) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => (/\d/.test(value[i] ?? '') ? value[i] : ''));

  useImperativeHandle(ref, () => ({
    focus: () => {
      const firstEmpty = digits.findIndex((d) => !d);
      focusBox(firstEmpty === -1 ? length - 1 : firstEmpty);
    },
  }));

  function focusBox(i: number) {
    const el = boxes.current[Math.max(0, Math.min(i, length - 1))];
    el?.focus();
    el?.select();
  }

  function emit(arr: string[]) {
    onChange(arr.map((d) => d || ' ').join('').trimEnd());
    if (arr.every(Boolean)) onComplete?.(arr.join(''));
  }

  // Put one or more digits starting at box i (typing, paste or autofill)
  function fillFrom(i: number, text: string) {
    const incoming = text.replace(/\D/g, '');
    if (!incoming) return;
    const arr = digits.slice();
    const start = incoming.length >= length ? 0 : i; // a full code replaces everything
    let last = start;
    for (let k = 0; k < incoming.length && start + k < length; k++) {
      arr[start + k] = incoming[k];
      last = start + k;
    }
    emit(arr);
    focusBox(last + 1);
  }

  function clearBox(i: number) {
    const arr = digits.slice();
    arr[i] = '';
    emit(arr);
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i]) clearBox(i);
      else if (i > 0) { clearBox(i - 1); focusBox(i - 1); }
    } else if (e.key === 'Delete') {
      e.preventDefault();
      clearBox(i);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusBox(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusBox(i + 1);
    }
  }

  return (
    <div className="otp-boxes" role="group" aria-label={`${length}-digit verification code`}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { boxes.current[i] = el; }}
          className={`otp-box ${d ? 'filled' : ''}`}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1} of ${length}`}
          value={d}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            if (!v) return clearBox(i);
            // Typing over a selected digit gives 1 char; over an unselected one gives 2 — keep the new one
            fillFrom(i, v.length === 2 && d ? (v[0] === d ? v[1] : v[0]) : v);
          }}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => {
            e.preventDefault();
            fillFrom(i, e.clipboardData.getData('text'));
          }}
        />
      ))}
    </div>
  );
});

export default OtpInput;
