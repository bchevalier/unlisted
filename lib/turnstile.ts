/**
 * Cloudflare Turnstile server-side verification.
 *
 * When TURNSTILE_SECRET_KEY is set, the public form endpoints require a valid
 * Turnstile response token. When unset, verification is silently skipped so
 * local dev / CI works without Cloudflare credentials.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileResult =
  | { ok: true }
  | { ok: false; error: string };

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null
): Promise<TurnstileResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // If Turnstile is not configured, skip verification (dev/CI)
  if (!secretKey) {
    return { ok: true };
  }

  if (!token || token.trim().length === 0) {
    return { ok: false, error: 'Bot verification required.' };
  }

  try {
    const body = new URLSearchParams({
      secret: secretKey,
      response: token
    });

    if (remoteIp) {
      body.set('remoteip', remoteIp);
    }

    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    if (!res.ok) {
      console.error('[turnstile] verification endpoint returned', res.status);
      // Fail open on network error to avoid blocking legitimate users
      return { ok: true };
    }

    const data = (await res.json()) as { success: boolean; 'error-codes'?: string[] };

    if (data.success) {
      return { ok: true };
    }

    console.warn('[turnstile] verification failed:', data['error-codes']);
    return { ok: false, error: 'Bot verification failed. Please try again.' };
  } catch (err) {
    console.error('[turnstile] verification error:', err);
    // Fail open on unexpected errors
    return { ok: true };
  }
}

/**
 * Returns the Turnstile site key if configured, or null.
 * Safe to expose to the client — it's a public key.
 */
export function getTurnstileSiteKey(): string | null {
  return process.env.TURNSTILE_SITE_KEY ?? null;
}
