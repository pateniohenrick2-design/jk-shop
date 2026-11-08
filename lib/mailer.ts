import { createTransport, type Transporter } from 'nodemailer';

// Sends email through your SMTP account (e.g. Gmail with an App Password).
//
// Env:
//   SMTP_HOST  e.g. smtp.gmail.com
//   SMTP_PORT  465 (SSL) or 587 (STARTTLS)
//   SMTP_USER  the login, e.g. jkshop@gmail.com
//   SMTP_PASS  the password / Gmail App Password
//   SMTP_FROM  optional, e.g. "JK Shop <jkshop@gmail.com>" (defaults to JK Shop <SMTP_USER>)
//   SMTP_REPLY_TO optional, where customer replies go, e.g. jkshopgamecredit@gmail.com
//
// Resend: SMTP_HOST=smtp.resend.com, SMTP_PORT=465, SMTP_USER=resend, SMTP_PASS=<re_ API key>,
//         SMTP_FROM="JK Shop <orders@your-verified-domain>"
//
// Never throws: a mail problem must not fail a customer's order.

let transporter: Transporter | null = null;

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  if (!transporter) {
    const port = Number(SMTP_PORT || 465);
    transporter = createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transporter;
}

export function mailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendMail(msg: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false; // not configured — silently skip
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || `"JK Shop" <${process.env.SMTP_USER}>`,
      // Customers' replies go here (e.g. your Gmail) even when sending from your domain via Resend
      ...(process.env.SMTP_REPLY_TO ? { replyTo: process.env.SMTP_REPLY_TO } : {}),
      ...msg,
    });
    return true;
  } catch (err) {
    console.error('[mail] failed to send to', msg.to, '-', (err as Error).message);
    return false;
  }
}
