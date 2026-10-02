import type { APIRoute } from 'astro';
import { notifyEnquiry } from '../../lib/notify';
import { rateLimit } from '../../lib/rate-limit';
import { turnstileEnabled, verifyTurnstile } from '../../lib/turnstile';
import { parseEnquiry } from '../../lib/validation';
import { site } from '../../data/site';

export const prerender = false;

const MAX_BODY_BYTES = 20_000;
const RATE_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 };
const callUs = `Please call us on ${site.phone} instead.`;

// Fetch (JSON) clients get status codes and messages; plain form posts get redirected back
// to the contact page so the form still works without JavaScript.
export const POST: APIRoute = async ({ request, redirect, clientAddress }) => {
  const wantsJson = request.headers.get('accept')?.includes('application/json') ?? false;

  const respond = (status: number, body: { ok: boolean; message?: string; fieldErrors?: Record<string, string[] | undefined> }, errorCode?: string) =>
    wantsJson
      ? Response.json(body, { status })
      : redirect(body.ok ? '/contact?sent=1' : `/contact?error=${errorCode ?? 'failed'}`, 303);

  // Only accept posts from our own pages.
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return new Response('Forbidden', { status: 403 });

  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return respond(413, { ok: false, message: 'That message is too long.' }, 'invalid');
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return respond(400, { ok: false, message: 'Something was wrong with that submission.' }, 'invalid');
  }

  // Honeypot: real visitors never see this field. Pretend it worked and send nothing.
  if (String(form.get('website') ?? '').trim() !== '') return respond(200, { ok: true });

  let ip = 'unknown';
  try {
    ip = clientAddress;
  } catch {
    // No client address available (e.g. some local setups); share one bucket.
  }

  const parsed = parseEnquiry(form);
  if (!parsed.ok) {
    return respond(422, { ok: false, message: 'Please check the highlighted fields.', fieldErrors: parsed.fieldErrors }, 'invalid');
  }

  // Only valid submissions count towards the limit, so fixing typos never locks anyone out.
  if (!rateLimit(ip, RATE_LIMIT.limit, RATE_LIMIT.windowMs)) {
    return respond(429, { ok: false, message: `You've sent a few enquiries already. Please try again later, or call us on ${site.phone}.` }, 'ratelimit');
  }

  // With Turnstile configured every submission needs a valid token. (It's skipped only when
  // no secret is set, which is local development.)
  if (turnstileEnabled) {
    const token = String(form.get('cf-turnstile-response') ?? '');
    if (!(await verifyTurnstile(token, ip === 'unknown' ? undefined : ip))) {
      return respond(400, { ok: false, message: `We couldn't verify you're human. Please try again, or call us on ${site.phone}.` }, 'verify');
    }
  } else if (!import.meta.env.DEV) {
    console.error('[contact] TURNSTILE_SECRET_KEY is not set; refusing submissions in production');
    return respond(503, { ok: false, message: `The enquiry form is temporarily unavailable. ${callUs}` });
  }

  const result = await notifyEnquiry(parsed.enquiry);
  if (!result.delivered) {
    return respond(502, { ok: false, message: `Sorry, we couldn't send your enquiry. ${callUs}` });
  }

  return respond(200, { ok: true });
};

// Anything else (e.g. someone opening /api/contact in the browser) goes to the form.
export const ALL: APIRoute = ({ redirect }) => redirect('/contact', 302);
