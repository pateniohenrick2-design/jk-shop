// Sends a new order to the Google Sheet through an Apps Script web app
// (see scripts/google-apps-script/OrdersWebhook.gs for the sheet side + setup steps).
//
// Env:
//   GSHEET_WEBHOOK_URL    — the Apps Script "Web app" URL (ends in /exec)
//   GSHEET_WEBHOOK_SECRET — any long random string; must match SECRET in the script
//
// Never throws: a sheet outage must not block or fail a customer's order.

export type SheetOrder = {
  orderId: string; // internal database id
  orderCode: string; // human-readable, e.g. "DIA-1108001" — shown in the "Order ID" column
  createdAt: string; // ISO
  game: string;
  category: string;
  item: string; // e.g. "279 Diamonds"
  orderDetails: string; // e.g. "279 Diamonds – ₱273"
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  userId: string;
  serverId: string;
  ign: string;
  fields: Record<string, string>; // every account field as { label: value }
  paymentMethod: string;
  proofUrl: string;
  facebookName: string;
  email: string;
  eventName?: string; // Event Skin Gifting: the order goes to the tab named after this event
  heroName?: string;
  phaseName?: string;
};

// POSTs a payload to the Apps Script. Returns true if the script answered { ok: true }.
async function callSheet(payload: Record<string, unknown>, label: string): Promise<boolean> {
  const url = process.env.GSHEET_WEBHOOK_URL;
  const secret = process.env.GSHEET_WEBHOOK_SECRET;
  if (!url || !secret) return false; // not configured — silently skip

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Apps Script reads e.postData.contents
      body: JSON.stringify({ secret, ...payload }),
      redirect: 'follow', // Apps Script answers with a 302 to googleusercontent.com
      signal: controller.signal,
    });
    const text = await res.text();
    let ok = res.ok;
    try { ok = ok && JSON.parse(text).ok === true; } catch { ok = false; }
    if (!ok) console.error(`[gsheet] ${label} failed:`, res.status, text.slice(0, 300));
    return ok;
  } catch (err) {
    console.error(`[gsheet] ${label} failed to send:`, err);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function sendOrderToSheet(order: SheetOrder): Promise<void> {
  await callSheet({ order }, `order ${order.orderCode || order.orderId}`);
}

// Creates the event's own tab (copied from "Event Skin Gifting") if it doesn't exist yet.
export async function ensureEventSheet(eventName: string): Promise<void> {
  if (!eventName.trim()) return;
  await callSheet({ action: 'ensureEventTab', eventName }, `event tab "${eventName}"`);
}
