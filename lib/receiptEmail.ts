import type { CustomerOrder } from '@/lib/customerOrders';

// Order receipt email — same details as the "My Orders" card (no status).
// Styled like the website: dark green background, green cards, light text, #a9c9a0 accent.

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
  // Email apps can only show images from a public address. Local tests (localhost) use the live site's copy.
  const logoBase = publicSite ? opts.siteUrl!.replace(/\/$/, '') : 'https://jkshopph.vercel.app';
  const logoUrl = `${logoBase}/logo/jkshop-logo.png`; // white JK SHOP logo (public/logo/jkshop-logo.png, 764×316), on the green header
  const priceLine = o.quantity > 1 ? `${o.quantity} × ${peso(o.unitPrice)}` : 'Total';

  const accountRows = o.account
    .map(
      (a) => `
                <tr>
                  <td style="padding:6px 0;font-size:12px;color:#9db89d;text-transform:uppercase;letter-spacing:0.4px;font-weight:700;width:40%;">${esc(a.label)}</td>
                  <td style="padding:6px 0;font-size:14px;color:#f2f5f2;font-weight:600;text-align:right;word-break:break-all;">${esc(a.value)}</td>
                </tr>`,
    )
    .join('');

  const subject = `Your JK Shop receipt — ${o.orderCode}`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Order ${esc(o.orderCode)} · ${esc(o.item)} · ${peso(o.totalPrice)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#141a14;border:1px solid #22301f;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:#1b2a1b;padding:20px 28px;border-bottom:2px solid #a9c9a0;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;">
                  <img src="${logoUrl}" width="102" height="42" alt="JK SHOP" style="display:block;width:102px;height:42px;border:0;outline:none;text-decoration:none;color:#f2f5f2;font-size:17px;font-weight:800;">
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px;">
            <h1 style="margin:0 0 8px;font-size:21px;line-height:1.3;color:#f2f5f2;">Thank you for your order!</h1>
            <p style="margin:0 0 20px;font-size:14.5px;line-height:1.6;color:#c7d3c7;">${name ? `Hi ${esc(name)},<br>` : ''}We received your order and payment proof. Here's your receipt — keep your Order ID for reference.</p>

            <!-- Order card (same details as My Orders) -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1b261b;border:1px solid #2c3b28;border-radius:12px;">
              <tr>
                <td style="padding:16px 18px 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-family:'SFMono-Regular',Consolas,'Courier New',monospace;font-size:15px;font-weight:800;letter-spacing:0.5px;color:#0a0f0a;">
                        <span style="background:#a9c9a0;border-radius:6px;padding:4px 8px;color:#0a0f0a;">${esc(o.orderCode)}</span>
                      </td>
                      <td style="text-align:right;font-size:12px;color:#9db89d;white-space:nowrap;">${esc(when(o.createdAt))}</td>
                    </tr>
                  </table>
                  <p style="margin:14px 0 2px;font-size:18px;font-weight:800;color:#f2f5f2;">${esc(o.item)}${o.quantity > 1 ? ` <span style="color:#9db89d;font-weight:600;">× ${o.quantity}</span>` : ''}</p>
                  <p style="margin:0 0 14px;font-size:13px;color:#9db89d;">${esc(o.game)} · ${esc(o.category)}</p>
                </td>
              </tr>
              ${accountRows ? `<tr>
                <td style="padding:0 18px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#22301f;border-radius:10px;padding:6px 14px;">${accountRows}
                  </table>
                </td>
              </tr>` : ''}
              <tr>
                <td style="padding:14px 18px 16px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #2c3b28;">
                    <tr>
                      <td style="padding-top:12px;font-size:12.5px;color:#9db89d;">${esc(priceLine)}<br>Paid via ${esc(o.paymentMethod)}</td>
                      <td style="padding-top:12px;text-align:right;font-size:22px;font-weight:800;color:#a9c9a0;">${peso(o.totalPrice)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            ${trackUrl ? `<p style="margin:22px 0 0;text-align:center;">
              <a href="${esc(trackUrl)}" style="display:inline-block;background:#a9c9a0;color:#0a0f0a;text-decoration:none;font-weight:800;font-size:14px;padding:12px 22px;border-radius:10px;">View my orders</a>
            </p>` : ''}
            <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#9db89d;">We'll process your order as soon as possible. If anything is wrong with your details, message us on Facebook with your Order ID.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px 28px;">
            <div style="border-top:1px solid #22301f;padding-top:16px;font-size:12px;line-height:1.6;color:#7f9a7f;">
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
