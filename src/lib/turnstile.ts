import { TURNSTILE_SECRET_KEY } from 'astro:env/server';

/** True when Turnstile is configured, so tokens must be checked. */
export const turnstileEnabled = Boolean(TURNSTILE_SECRET_KEY);

/** Verify a Cloudflare Turnstile token. Fails closed: any error or missing token is a failure. */
export async function verifyTurnstile(token: string | undefined, ip?: string): Promise<boolean> {
  if (!TURNSTILE_SECRET_KEY || !token) return false;

  try {
    const body = new URLSearchParams({ secret: TURNSTILE_SECRET_KEY, response: token });
    if (ip) body.set('remoteip', ip);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    });
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}
