"use client";

import { useState } from "react";
import Link from "next/link";

export type EventPhase = { id: string; phaseName: string; startDate: string; endDate: string; price: number };
export type EventHeroInfo = { id: string; heroName: string; price: number; imageUrl: string | null; schedule: EventPhase[] };
export type EventInfo = { id: string; name: string; startDate: string; endDate: string; heroes: EventHeroInfo[] };

// Philippine "today" as YYYY-MM-DD, to match the dates set on the Events page
function todayPH() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}
function statusOf(e: EventInfo): "active" | "scheduled" | "expired" {
  const t = todayPH();
  if (t < e.startDate) return "scheduled";
  if (t > e.endDate) return "expired";
  return "active";
}
const STATUS_LABEL = { active: "Active", scheduled: "Scheduled", expired: "Ended" } as const;
const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
const peso = (n: number) => `₱${n.toLocaleString()}`;

// Read-only view of a category's events (e.g. Event Skin Gifting). Editing happens on the Events page.
export default function EventCategoryPanel({ categoryName, events }: { categoryName: string; events: EventInfo[] }) {
  const [showPast, setShowPast] = useState(false);
  const withStatus = events.map((e) => ({ e, status: statusOf(e) }));
  const current = withStatus
    .filter((x) => x.status !== "expired")
    .sort((a, b) => (a.status === b.status ? a.e.startDate.localeCompare(b.e.startDate) : a.status === "active" ? -1 : 1));
  const past = withStatus.filter((x) => x.status === "expired");
  const activeCount = current.filter((x) => x.status === "active").length;

  return (
    <>
      <div className="pl-toolbar">
        <div className="pl-title">
          <h2>{categoryName}</h2>
          <span>
            {activeCount} active · {current.length - activeCount} scheduled · {past.length} ended — customers only see active events
          </span>
        </div>
        <div className="pl-actions">
          <Link href="/admin/events" className="pl-btn pl-btn-primary">Manage in Events →</Link>
        </div>
      </div>

      {current.length === 0 && (
        <div className="pl-empty-box">
          No active or upcoming events. Add one on the <Link href="/admin/events" className="login-link">Events</Link> page.
        </div>
      )}

      <div className="ev-list">
        {current.map(({ e, status }) => <EventCard key={e.id} e={e} status={status} />)}
      </div>

      {past.length > 0 && (
        <>
          <button className="ev-past-toggle" onClick={() => setShowPast((s) => !s)}>
            {showPast ? "▾" : "▸"} Ended events ({past.length})
          </button>
          {showPast && <div className="ev-list">{past.map(({ e, status }) => <EventCard key={e.id} e={e} status={status} />)}</div>}
        </>
      )}
    </>
  );
}

function EventCard({ e, status }: { e: EventInfo; status: "active" | "scheduled" | "expired" }) {
  const prices = e.heroes.map((h) => h.price);
  return (
    <div className={`ev-card ${status === "expired" ? "ev-card-past" : ""}`}>
      <div className="ev-card-head">
        <div>
          <h3>{e.name}</h3>
          <span className="ev-dates">{fmt(e.startDate)} → {fmt(e.endDate)}</span>
        </div>
        <div className="ev-card-meta">
          {prices.length > 0 && (
            <span className="ev-price-range">
              {Math.min(...prices) === Math.max(...prices) ? peso(prices[0]) : `${peso(Math.min(...prices))} – ${peso(Math.max(...prices))}`}
            </span>
          )}
          <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>
        </div>
      </div>

      {e.heroes.length === 0 ? (
        <p className="field-hint" style={{ margin: 0 }}>No hero skins added yet.</p>
      ) : (
        <div className="pl-table-wrap">
          <table className="admin-table pl-table">
            <thead>
              <tr>
                <th style={{ width: 48 }}></th>
                <th>Hero skin</th>
                <th className="pl-num">Base price</th>
                <th>Delivery schedule</th>
              </tr>
            </thead>
            <tbody>
              {e.heroes.map((h) => (
                <tr key={h.id} className="pl-row">
                  <td>
                    {h.imageUrl
                      ? <img className="event-thumb" src={`/api/image-proxy?key=${encodeURIComponent(h.imageUrl)}`} alt="" />
                      : <div className="event-thumb" />}
                  </td>
                  <td className="pl-name">{h.heroName}</td>
                  <td className="pl-num pl-price">{peso(h.price)}</td>
                  <td>
                    {h.schedule.length === 0 ? (
                      <span className="pl-dash">—</span>
                    ) : (
                      <div className="ev-phases">
                        {h.schedule.map((s) => (
                          <span key={s.id} className="ev-phase" title={`${fmt(s.startDate)} – ${fmt(s.endDate)}`}>
                            {s.phaseName} <strong>{peso(s.price)}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
