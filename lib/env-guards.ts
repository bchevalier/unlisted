/**
 * Startup environment guards.
 *
 * Pure assertion functions that can be tested without triggering the full
 * env schema parse (which requires real env vars). Called from `lib/env.ts`
 * at boot time.
 */

/**
 * Prevents production from booting with the bio-override dev backdoor enabled.
 * Throws a fatal error so the process exits before serving any traffic.
 */
export function assertBioOverrideNotInProduction(
  nodeEnv: string | undefined,
  bioOverride: string | undefined,
): void {
  if (nodeEnv === 'production' && bioOverride === 'true') {
    throw new Error(
      'FATAL: SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE=true is forbidden in production. ' +
      'Remove or set to false before deploying.',
    );
  }
}
