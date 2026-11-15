"use client";

import { useEffect, useState } from "react";
import { availabilityState } from "@/lib/categoryAvailability";

export type CategoryAvailabilityValue = {
  isActive: boolean;
  availableFrom: string | null; // ISO
  availableUntil: string | null; // ISO
};

// ISO ⇄ the value of <input type="datetime-local"> (in the admin's own timezone)
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

// Separate Date + Time boxes for one "YYYY-MM-DDTHH:MM" value. Picking a date with no time
// uses defaultTime (start of day for "opens", end of day for "closes").
function DateTimeField({
  label,
  value,
  onChange,
  defaultTime,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  defaultTime: string;
  disabled?: boolean;
}) {
  const [date, time] = value ? value.split("T") : ["", ""];
  return (
    <fieldset className="cat-avail-dt" disabled={disabled}>
      <legend>{label}</legend>
      <div className="cat-avail-dt-row">
        <label>
          <span>Date</span>
          <input
            type="date"
            className="field-input"
            value={date}
            onChange={(e) => onChange(e.target.value ? `${e.target.value}T${time || defaultTime}` : "")}
          />
        </label>
        <label>
          <span>Time</span>
          <input
            type="time"
            className="field-input"
            value={time}
            disabled={!date}
            onChange={(e) => date && onChange(`${date}T${e.target.value || defaultTime}`)}
          />
        </label>
      </div>
    </fieldset>
  );
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// On/off switch + "opens"/"closes" date-times for one category (e.g. Pre-Order Event).
// Customers only see the category while it's switched on AND inside the dates.
export default function CategoryAvailability({
  categoryId,
  value,
  onSaved,
}: {
  categoryId: string;
  value: CategoryAvailabilityValue;
  onSaved: (v: CategoryAvailabilityValue) => void;
}) {
  const [from, setFrom] = useState(toLocalInput(value.availableFrom));
  const [until, setUntil] = useState(toLocalInput(value.availableUntil));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Esc closes the modal
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  // Switching to another category resets the inputs
  useEffect(() => {
    setFrom(toLocalInput(value.availableFrom));
    setUntil(toLocalInput(value.availableUntil));
    setError(null);
    setSavedMsg(null);
  }, [categoryId, value.availableFrom, value.availableUntil]);

  async function save(next: CategoryAvailabilityValue) {
    if (next.availableFrom && next.availableUntil && new Date(next.availableUntil) <= new Date(next.availableFrom)) {
      setError("The closing time must be after the opening time.");
      return;
    }
    setBusy(true);
    setError(null);
    setSavedMsg(null);
    try {
      const res = await fetch(`/api/admin/categories/${categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not save. Please try again.");
      onSaved(next);
      setSavedMsg("Saved");
      setTimeout(() => setSavedMsg(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const state = availabilityState(value);
  const status =
    state === "disabled" ? "Hidden from customers (switched off)"
      : state === "upcoming" ? `Opens ${fmt(value.availableFrom!)}`
      : state === "closed" ? `Closed since ${fmt(value.availableUntil!)}`
      : value.availableUntil ? `Open now · closes ${fmt(value.availableUntil)}`
      : "Open now";

  const datesChanged =
    fromLocalInput(from) !== (value.availableFrom ? new Date(value.availableFrom).toISOString() : null) ||
    fromLocalInput(until) !== (value.availableUntil ? new Date(value.availableUntil).toISOString() : null);

  return (
    <>
      {/* Compact status button in the pricelist; the switch + dates live in a modal */}
      <button type="button" className={`cat-avail-chip cat-avail-chip-${state}`} onClick={() => setOpen(true)} title="Set when this event is available">
        <span className="cat-avail-dot" aria-hidden />
        <span><strong>{value.isActive ? "Enabled" : "Disabled"}</strong> · {status}</span>
        <span className="cat-avail-chip-edit">Manage</span>
      </button>

      {open && (
        <div className="qr-modal-overlay" onClick={() => !busy && setOpen(false)}>
          <div
            className="qr-modal cat-avail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cat-avail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cat-avail-modal-head">
              <h3 id="cat-avail-title">Category availability</h3>
              <button type="button" className="cat-avail-close" aria-label="Close" onClick={() => setOpen(false)} disabled={busy}>✕</button>
            </div>

            <div className={`cat-avail cat-avail-${state}`}>
              <div className="cat-avail-top">
                <button
                  type="button"
                  role="switch"
                  aria-checked={value.isActive}
                  className={`cat-avail-switch${value.isActive ? " on" : ""}`}
                  disabled={busy}
                  onClick={() => save({ ...value, isActive: !value.isActive })}
                >
                  <span className="cat-avail-knob" />
                </button>
                <div className="cat-avail-label">
                  <strong>{value.isActive ? "Enabled" : "Disabled"}</strong>
                  <span className={`cat-avail-status cat-avail-status-${state}`}>{status}</span>
                </div>
                {savedMsg && <span className="cat-avail-saved">✓ {savedMsg}</span>}
              </div>

              <div className="cat-avail-dates">
                <DateTimeField label="Opens on" value={from} onChange={setFrom} defaultTime="00:00" disabled={busy} />
                <DateTimeField label="Closes on (deadline)" value={until} onChange={setUntil} defaultTime="23:59" disabled={busy} />
              </div>
              <p className="field-hint" style={{ margin: 0 }}>
                Leave a date empty for no limit. Customers only see this category while it&apos;s enabled and between these times (in this computer&apos;s time zone).
              </p>
              {error && <p className="error-msg" style={{ margin: 0 }}>{error}</p>}
            </div>

            <div className="cat-avail-actions">
              {(value.availableFrom || value.availableUntil) && (
                <button
                  type="button"
                  className="pl-btn"
                  disabled={busy}
                  onClick={() => { setFrom(""); setUntil(""); save({ ...value, availableFrom: null, availableUntil: null }); }}
                >
                  Clear dates
                </button>
              )}
              <button type="button" className="pl-btn" onClick={() => setOpen(false)} disabled={busy}>Close</button>
              <button
                type="button"
                className="pl-btn pl-btn-primary"
                disabled={busy || !datesChanged}
                onClick={() => save({ ...value, availableFrom: fromLocalInput(from), availableUntil: fromLocalInput(until) })}
              >
                {busy ? "Saving…" : "Save dates"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
