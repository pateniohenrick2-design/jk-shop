// Configures Supabase Auth emails in one go:
//   • sends them through YOUR SMTP (same SMTP_* settings the shop uses for receipts)
//   • uses the JK Shop templates in supabase/email-templates/ (+ subjects)
//
// Usage (from the project folder):
//   node --env-file=.env scripts/supabase-auth-email.mjs
//
// Needs in .env:
//   SUPABASE_ACCESS_TOKEN  personal access token — supabase.com → Account → Access Tokens (starts with sbp_)
//   NEXT_PUBLIC_SUPABASE_URL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (optional)

import { readFileSync } from 'node:fs';

const env = process.env;
const missing = ['SUPABASE_ACCESS_TOKEN', 'NEXT_PUBLIC_SUPABASE_URL', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].filter((k) => !env[k]);
if (missing.length) {
  console.error('Missing in .env:', missing.join(', '));
  process.exit(1);
}

const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).host.split('.')[0];

// "JK Shop <jkshop@gmail.com>" → name + address
const from = env.SMTP_FROM || `JK Shop <${env.SMTP_USER}>`;
const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
const senderName = (m?.[1] || 'JK Shop').trim();
const senderEmail = (m?.[2] || env.SMTP_USER).trim();

const tpl = (f) => readFileSync(new URL(`../supabase/email-templates/${f}`, import.meta.url), 'utf8');

const config = {
  smtp_host: env.SMTP_HOST,
  smtp_port: String(env.SMTP_PORT || 465),
  smtp_user: env.SMTP_USER,
  smtp_pass: env.SMTP_PASS,
  smtp_admin_email: senderEmail,
  smtp_sender_name: senderName,

  mailer_subjects_confirmation: 'Verify your email for JK Shop',
  mailer_templates_confirmation_content: tpl('confirm-signup.html'),
  mailer_subjects_magic_link: 'Your JK Shop login code',
  mailer_templates_magic_link_content: tpl('magic-link.html'),
  mailer_subjects_recovery: 'Reset your JK Shop password',
  mailer_templates_recovery_content: tpl('reset-password.html'),
};

const api = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;
const headers = { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' };

const res = await fetch(api, { method: 'PATCH', headers, body: JSON.stringify(config) });
if (!res.ok) {
  console.error(`Supabase rejected the update (${res.status}):`, (await res.text()).slice(0, 500));
  process.exit(1);
}

// Read back and show what's set (never prints the password)
const now = await (await fetch(api, { headers })).json();
console.log('✔ Supabase Auth email settings updated for project', projectRef);
console.log('  SMTP:', `${now.smtp_host}:${now.smtp_port}`, 'as', now.smtp_user);
console.log('  From:', `${now.smtp_sender_name} <${now.smtp_admin_email}>`);
console.log('  Subjects:', [now.mailer_subjects_confirmation, now.mailer_subjects_magic_link, now.mailer_subjects_recovery].join(' | '));
console.log('  Templates contain the code:', ['confirmation', 'magic_link', 'recovery']
  .map((k) => `${k}=${String(now[`mailer_templates_${k}_content`] || '').includes('{{ .Token }}')}`).join(', '));
