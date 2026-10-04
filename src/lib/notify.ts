import { Resend } from 'resend';
import {
  CONTACT_FROM_EMAIL,
  CONTACT_TO_EMAIL,
  RESEND_API_KEY,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
} from 'astro:env/server';
import type { Enquiry } from './validation';

export type NotifyResult =
  | { delivered: true; channels: string[] }
  | { delivered: false; reason: 'not-configured' | 'all-failed' };

const emailConfigured = Boolean(RESEND_API_KEY && CONTACT_TO_EMAIL && CONTACT_FROM_EMAIL);
const telegramConfigured = Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const fields = (e: Enquiry): [string, string][] => [
  ['Name', e.name],
  ['Phone', e.phone],
  ['Email', e.email ?? '—'],
  ['Postcode', e.postcode],
  ['Vehicle', e.vehicle ?? '—'],
  ['Service', e.service ?? '—'],
  ['Preferred date', e.date ?? '—'],
  ['Message', e.message ?? '—'],
];

const subjectFor = (e: Enquiry) => `New enquiry — ${e.service ?? 'General enquiry'} — ${e.postcode}`;
const textFor = (e: Enquiry) => `${subjectFor(e)}\n\n${fields(e).map(([k, v]) => `${k}: ${v}`).join('\n')}`;

async function sendEmail(e: Enquiry): Promise<void> {
  const resend = new Resend(RESEND_API_KEY);
  const rows = fields(e)
    .map(([k, v]) => {
      const value = k === 'Phone' ? `<a href="tel:${escapeHtml(v.replace(/[^\d+]/g, ''))}">${escapeHtml(v)}</a>` : escapeHtml(v).replace(/\n/g, '<br>');
      return `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">${k}</td><td style="padding:4px 0">${value}</td></tr>`;
    })
    .join('');

  const { error } = await resend.emails.send({
    from: CONTACT_FROM_EMAIL!,
    to: CONTACT_TO_EMAIL!.split(',').map((address) => address.trim()),
    replyTo: e.email,
    subject: subjectFor(e),
    text: textFor(e),
    html: `<h2 style="font-family:sans-serif">${escapeHtml(subjectFor(e))}</h2><table style="font-family:sans-serif;font-size:15px">${rows}</table>`,
  });
  if (error) throw new Error(`Resend: ${error.name} ${error.message}`);
}

async function sendTelegram(e: Enquiry): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: textFor(e), disable_web_page_preview: true }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Telegram responded ${response.status}`);
}

/**
 * Deliver an enquiry to the business over every configured channel (email, Telegram push).
 * It counts as delivered if at least one channel succeeds. Errors are logged without any
 * customer details or secrets.
 */
export async function notifyEnquiry(enquiry: Enquiry): Promise<NotifyResult> {
  const attempts: { channel: string; run: () => Promise<void> }[] = [];
  if (emailConfigured) attempts.push({ channel: 'email', run: () => sendEmail(enquiry) });
  if (telegramConfigured) attempts.push({ channel: 'telegram', run: () => sendTelegram(enquiry) });

  if (attempts.length === 0) {
    // Local development with no accounts set up: show the enquiry in the terminal instead.
    if (import.meta.env.DEV) {
      console.info(`[contact] no delivery channel configured; enquiry logged locally:\n${textFor(enquiry)}`);
      return { delivered: true, channels: ['console'] };
    }
    console.error('[contact] no delivery channel configured; enquiry could not be delivered');
    return { delivered: false, reason: 'not-configured' };
  }

  const results = await Promise.allSettled(attempts.map((a) => a.run()));
  const channels: string[] = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') channels.push(attempts[i].channel);
    else console.error(`[contact] ${attempts[i].channel} delivery failed:`, result.reason instanceof Error ? result.reason.message : 'unknown error');
  });

  return channels.length > 0 ? { delivered: true, channels } : { delivered: false, reason: 'all-failed' };
}
