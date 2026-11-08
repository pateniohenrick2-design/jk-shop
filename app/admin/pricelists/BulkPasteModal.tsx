"use client";

import { useMemo, useState } from "react";
import { parsePricelist, normalizeName, type ParsedRow } from "@/lib/parsePricelist";

type Item = {
  id: string;
  name: string;
  price: number;
  originalPrice: number | null;
  status: "available" | "sold_out";
  notes: string | null;
  sortOrder: number;
};

type Change = { row: ParsedRow; kind: "new" | "update" | "same"; existing?: Item; diffs: string[] };

const peso = (n: number | null | undefined) => (n == null ? "—" : `₱${n.toLocaleString()}`);

const EXAMPLE = `Name\tPrice\tOriginal Price\tNotes
Weekly Diamond Pass\t114
11 Diamonds\t11
56 Diamonds\t55\t60\tSale`;

export default function BulkPasteModal({
  categoryId,
  categoryName,
  items,
  onClose,
  onApplied,
}: {
  categoryId: string;
  categoryName: string;
  items: Item[];
  onClose: () => void;
  onApplied: (items: Item[], summary: string) => void;
}) {
  const [text, setText] = useState("");
  const [reorder, setReorder] = useState(true);
  const [markMissing, setMarkMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parsePricelist(text), [text]);

  const { changes, missing } = useMemo(() => {
    const byName = new Map(items.map((it) => [normalizeName(it.name), it]));
    const matched = new Set<string>();
    const changes: Change[] = parsed.rows.map((row) => {
      const ex = byName.get(normalizeName(row.name));
      if (!ex) return { row, kind: "new", diffs: [] };
      matched.add(ex.id);
      const diffs: string[] = [];
      if (ex.price !== row.price) diffs.push(`${peso(ex.price)} → ${peso(row.price)}`);
      if (row.originalPrice !== undefined && (ex.originalPrice ?? null) !== row.originalPrice)
        diffs.push(`orig ${peso(ex.originalPrice)} → ${peso(row.originalPrice)}`);
      if (row.status !== undefined && ex.status !== row.status)
        diffs.push(row.status === "sold_out" ? "→ Sold out" : "→ Available");
      if (row.notes !== undefined && (ex.notes ?? null) !== (row.notes ?? null)) diffs.push("notes changed");
      return { row, kind: diffs.length ? "update" : "same", existing: ex, diffs };
    });
    return { changes, missing: items.filter((it) => !matched.has(it.id)) };
  }, [parsed.rows, items]);

  const counts = {
    new: changes.filter((c) => c.kind === "new").length,
    update: changes.filter((c) => c.kind === "update").length,
    same: changes.filter((c) => c.kind === "same").length,
  };
  const willMarkSoldOut = markMissing ? missing.filter((m) => m.status !== "sold_out").length : 0;
  const nothingToDo = counts.new + counts.update + willMarkSoldOut === 0 && !(reorder && parsed.rows.length > 0);

  async function apply() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/items/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          rows: parsed.rows.map(({ line, ...r }) => r),
          reorder,
          markMissingSoldOut: markMissing,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Import failed.");
      const parts = [
        data.created && `${data.created} added`,
        data.updated && `${data.updated} updated`,
        data.markedSoldOut && `${data.markedSoldOut} marked sold out`,
      ].filter(Boolean);
      onApplied(data.items, parts.length ? parts.join(", ") : "No changes");
    } catch (e: any) {
      setError(e.message || "Import failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="qr-modal-overlay" onClick={onClose}>
      <div className="qr-modal bulk-modal" onClick={(e) => e.stopPropagation()}>
        <button className="qr-modal-close" onClick={onClose} aria-label="Close">✕</button>
        <h3>Bulk Paste — {categoryName}</h3>
        <p className="field-hint bulk-help">
          Copy the rows from Google Sheets (select the cells → Ctrl+C) and paste below. Columns in order:{" "}
          <strong>Name, Price</strong>, then optional <strong>Original Price, Status, Notes</strong>. A header row is
          fine. Items are matched by name: existing ones are updated, new names are added.
        </p>

        <textarea
          className="field-input bulk-textarea"
          placeholder={EXAMPLE}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          spellCheck={false}
        />

        {parsed.errors.length > 0 && (
          <div className="bulk-errors">
            {parsed.errors.slice(0, 8).map((e, i) => <div key={i}>⚠ {e}</div>)}
            {parsed.errors.length > 8 && <div>…and {parsed.errors.length - 8} more</div>}
          </div>
        )}

        {parsed.rows.length > 0 && (
          <>
            <div className="bulk-summary">
              <span className="bulk-chip bulk-new">{counts.new} new</span>
              <span className="bulk-chip bulk-update">{counts.update} updated</span>
              <span className="bulk-chip">{counts.same} unchanged</span>
              {missing.length > 0 && <span className="bulk-chip">{missing.length} not in paste</span>}
              <span className="bulk-cols">Columns read: {parsed.columns.join(", ")}</span>
            </div>
            <div className="bulk-preview">
              <table className="admin-table">
                <thead>
                  <tr><th></th><th>Name</th><th>Price</th><th>Change</th></tr>
                </thead>
                <tbody>
                  {changes.map((c) => (
                    <tr key={c.row.line} className={`bulk-row-${c.kind}`}>
                      <td><span className={`bulk-dot bulk-dot-${c.kind}`} title={c.kind} /></td>
                      <td>{c.row.name}</td>
                      <td>{peso(c.row.price)}</td>
                      <td className="field-hint" style={{ margin: 0 }}>
                        {c.kind === "new" ? "New item" : c.kind === "same" ? "No change" : c.diffs.join(" · ")}
                      </td>
                    </tr>
                  ))}
                  {markMissing && missing.map((m) => (
                    <tr key={m.id} className="bulk-row-missing">
                      <td><span className="bulk-dot bulk-dot-missing" /></td>
                      <td>{m.name}</td>
                      <td>{peso(m.price)}</td>
                      <td className="field-hint" style={{ margin: 0 }}>
                        {m.status === "sold_out" ? "Already sold out" : "Not in paste → Sold out"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bulk-options">
              <label><input type="checkbox" checked={reorder} onChange={(e) => setReorder(e.target.checked)} /> Sort items in the same order as my paste</label>
              {missing.length > 0 && (
                <label>
                  <input type="checkbox" checked={markMissing} onChange={(e) => setMarkMissing(e.target.checked)} />{" "}
                  Mark the {missing.length} item{missing.length > 1 ? "s" : ""} not in my paste as Sold Out
                </label>
              )}
            </div>
          </>
        )}

        {error && <p className="error-msg">{error}</p>}

        <div className="bulk-actions">
          <button className="event-secondary-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="submit-btn" style={{ width: "auto", padding: "12px 24px" }} disabled={saving || parsed.rows.length === 0 || nothingToDo} onClick={apply}>
            {saving ? "Applying..." : `Apply ${parsed.rows.length} row${parsed.rows.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
