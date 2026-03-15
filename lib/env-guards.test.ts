import { describe, it, expect } from 'vitest';
import { assertBioOverrideNotInProduction } from './env-guards';

describe('assertBioOverrideNotInProduction', () => {
  it('throws when NODE_ENV=production and override is true', () => {
    expect(() =>
      assertBioOverrideNotInProduction('production', 'true'),
    ).toThrow('SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE=true is forbidden in production');
  });

  it('does not throw in production when override is false', () => {
    expect(() =>
      assertBioOverrideNotInProduction('production', 'false'),
    ).not.toThrow();
  });

  it('does not throw in production when override is unset', () => {
    expect(() =>
      assertBioOverrideNotInProduction('production', undefined),
    ).not.toThrow();
  });

  it('does not throw in development when override is true', () => {
    expect(() =>
      assertBioOverrideNotInProduction('development', 'true'),
    ).not.toThrow();
  });

  it('does not throw in test when override is true', () => {
    expect(() =>
      assertBioOverrideNotInProduction('test', 'true'),
    ).not.toThrow();
  });
});
