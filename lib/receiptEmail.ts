import type { CustomerOrder } from '@/lib/customerOrders';

// Order receipt email — same details as the "My Orders" card (no status).
// Uses the same JK Shop look as the verification-code emails in supabase/email-templates/.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const peso = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });

export function renderReceipt(o: CustomerOrder, opts: { customerName?: string | null; siteUrl?: string | null }) {
  const name = opts.customerName?.trim();
  // Only link to a real public https site — localhost/http links are a strong spam signal
  const publicSite = opts.siteUrl && /^https:\/\//i.test(opts.siteUrl) && !/localhost|127\.0\.0\.1/i.test(opts.siteUrl);
  const trackUrl = publicSite ? `${opts.siteUrl!.replace(/\/$/, '')}/my-orders` : null;
  const priceLine = o.quantity > 1 ? `${o.quantity} × ${peso(o.unitPrice)}` : 'Total';

  const accountRows = o.account
    .map(
      (a) => `
                <tr>
                  <td style="padding:6px 0;font-size:12px;color:#6b7a6b;text-transform:uppercase;letter-spacing:0.4px;font-weight:700;width:40%;">${esc(a.label)}</td>
                  <td style="padding:6px 0;font-size:14px;color:#0f1a0f;font-weight:600;text-align:right;word-break:break-all;">${esc(a.value)}</td>
                </tr>`,
    )
    .join('');

  const subject = `Your JK Shop receipt — ${o.orderCode}`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#eef3ee;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Order ${esc(o.orderCode)} · ${esc(o.item)} · ${peso(o.totalPrice)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3ee;padding:32px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #dbe5db;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:#0a0f0a;padding:20px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td width="34" height="34" style="width:34px;height:34px;border:1px solid #f2f5f2;border-radius:8px;text-align:center;vertical-align:middle;color:#f2f5f2;font-size:11px;font-weight:900;">JK</td>
                <td style="padding-left:10px;color:#f2f5f2;font-size:17px;font-weight:800;letter-spacing:0.5px;">JK SHOP</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px;">
            <h1 style="margin:0 0 8px;font-size:21px;line-height:1.3;color:#0f1a0f;">Thank you for your order!</h1>
            <p style="margin:0 0 20px;font-size:14.5px;line-height:1.6;color:#3d4a3d;">${name ? `Hi ${esc(name)},<br>` : ''}We received your order and payment proof. Here's your receipt — keep your Order ID for reference.</p>

            <!-- Order card (same details as My Orders) -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dbe5db;border-radius:12px;">
              <tr>
                <td style="padding:16px 18px 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-family:'SFMono-Regular',Consolas,'Courier New',monospace;font-size:15px;font-weight:800;letter-spacing:0.5px;color:#0f1a0f;">
                        <span style="background:#f3f8f2;border:1px solid #cfe0cb;border-radius:6px;padding:4px 8px;">${esc(o.orderCode)}</span>
                      </td>
                      <td style="text-align:right;font-size:12px;color:#6b7a6b;white-space:nowrap;">${esc(when(o.createdAt))}</td>
                    </tr>
                  </table>
                  <p style="margin:14px 0 2px;font-size:18px;font-weight:800;color:#0f1a0f;">${esc(o.item)}${o.quantity > 1 ? ` <span style="color:#6b7a6b;font-weight:600;">× ${o.quantity}</span>` : ''}</p>
                  <p style="margin:0 0 14px;font-size:13px;color:#6b7a6b;">${esc(o.game)} · ${esc(o.category)}</p>
                </td>
              </tr>
              ${accountRows ? `<tr>
                <td style="padding:0 18px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6faf5;border-radius:10px;padding:6px 14px;">${accountRows}
                  </table>
                </td>
              </tr>` : ''}
              <tr>
                <td style="padding:14px 18px 16px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e3ebe3;">
                    <tr>
                      <td style="padding-top:12px;font-size:12.5px;color:#6b7a6b;">${esc(priceLine)}<br>Paid via ${esc(o.paymentMethod)}</td>
                      <td style="padding-top:12px;text-align:right;font-size:22px;font-weight:800;color:#0f1a0f;">${peso(o.totalPrice)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            ${trackUrl ? `<p style="margin:22px 0 0;text-align:center;">
              <a href="${esc(trackUrl)}" style="display:inline-block;background:#a9c9a0;color:#0a0f0a;text-decoration:none;font-weight:800;font-size:14px;padding:12px 22px;border-radius:10px;">View my orders</a>
            </p>` : ''}
            <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#6b7a6b;">We'll process your order as soon as possible. If anything is wrong with your details, message us on Facebook with your Order ID.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px 28px;">
            <div style="border-top:1px solid #e3ebe3;padding-top:16px;font-size:12px;line-height:1.6;color:#8a978a;">
              You're receiving this because an order was placed at JK Shop with this email.<br>
              JK Shop &middot; Fast &amp; secure game top-up
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body></html>`;

  const text = [
    'JK SHOP — Order receipt',
    '',
    name ? `Hi ${name},` : null,
    "We received your order and payment proof. Here's your receipt:",
    '',
    `Order ID: ${o.orderCode}`,
    `Date: ${when(o.createdAt)}`,
    `Item: ${o.item}${o.quantity > 1 ? ` × ${o.quantity}` : ''}`,
    `Game: ${o.game} · ${o.category}`,
    ...o.account.map((a) => `${a.label}: ${a.value}`),
    o.quantity > 1 ? `Price: ${o.quantity} × ${peso(o.unitPrice)}` : null,
    `Paid via: ${o.paymentMethod}`,
    `Total: ${peso(o.totalPrice)}`,
    '',
    trackUrl ? `View your orders: ${trackUrl}` : null,
    "We'll process your order as soon as possible. If anything is wrong with your details, message us on Facebook with your Order ID.",
  ]
    .filter((l) => l !== null)
    .join('\n');

  return { subject, html, text };
}
