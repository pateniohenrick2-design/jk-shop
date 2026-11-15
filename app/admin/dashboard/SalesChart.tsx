'use client';

import { useState } from 'react';

export type SalesPoint = { key: string; label: string; sales: number; orders: number };

const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;
const pesoTick = (n: number) => (n >= 10000 ? `₱${(n / 1000).toLocaleString('en-PH', { maximumFractionDigits: 1 })}K` : `₱${n.toLocaleString('en-PH')}`);

// Clean axis ticks: 0 and ~4 round steps (1 / 2 / 2.5 / 5 × 10ⁿ) that cover the max
function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const ticks: number[] = [];
  for (let v = 0; v < max + step; v += step) ticks.push(v);
  return ticks;
}

// Single-series column chart (sales per day/hour). Hover or keyboard focus shows the exact numbers;
// "Show as table" lists every value without hovering.
export default function SalesChart({ points, unit }: { points: SalesPoint[]; unit: 'day' | 'hour' }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...points.map((p) => p.sales));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  // Show at most ~8 x labels so they never collide
  const every = Math.max(1, Math.ceil(points.length / 8));
  const hovered = active !== null ? points[active] : null;

  return (
    <div className="dash-chart">
      <div className="dash-chart-plot" onPointerLeave={() => setActive(null)}>
        <div className="dash-chart-grid" aria-hidden>
          {ticks.map((t) => (
            <div key={t} className="dash-chart-gridline" style={{ bottom: `${(t / top) * 100}%` }}>
              <span>{pesoTick(t)}</span>
            </div>
          ))}
        </div>
        <div className="dash-chart-cols" role="list" aria-label={`Sales per ${unit}`}>
          {points.map((p, i) => (
            <button
              key={p.key}
              type="button"
              role="listitem"
              className={`dash-col${active === i ? ' active' : ''}`}
              aria-label={`${p.label}: ${peso(p.sales)} from ${p.orders} order${p.orders === 1 ? '' : 's'}`}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <span className="dash-col-bar" style={{ height: `${(p.sales / top) * 100}%` }} />
            </button>
          ))}
        </div>
        {hovered && active !== null && (
          <div
            className="dash-tooltip"
            style={{ left: `${((active + 0.5) / points.length) * 100}%` }}
            role="status"
          >
            <strong>{peso(hovered.sales)}</strong>
            <span>{hovered.orders} order{hovered.orders === 1 ? '' : 's'}</span>
            <span className="dash-tooltip-label">{hovered.label}</span>
          </div>
        )}
      </div>
      <div className="dash-chart-x" aria-hidden>
        {points.map((p, i) => (
          <span key={p.key}>{i % every === 0 ? p.label : ''}</span>
        ))}
      </div>

      <details className="dash-table-toggle">
        <summary>Show as table</summary>
        <table className="admin-table dash-mini-table">
          <thead><tr><th>{unit === 'hour' ? 'Hour' : 'Date'}</th><th className="num">Orders</th><th className="num">Sales</th></tr></thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.key}><td>{p.label}</td><td className="num">{p.orders}</td><td className="num">{peso(p.sales)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
