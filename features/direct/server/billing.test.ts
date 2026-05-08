import { describe, expect, it } from 'vitest';
import { hasPaidEntitlement } from './billing';

describe('hasPaidEntitlement', () => {
  it('returns true for active or trialing statuses', () => {
    expect(hasPaidEntitlement('ACTIVE')).toBe(true);
    expect(hasPaidEntitlement('TRIALING')).toBe(true);
    expect(hasPaidEntitlement('active')).toBe(true);
    expect(hasPaidEntitlement('trialing')).toBe(true);
  });

  it('returns false for missing or non-entitling statuses', () => {
    expect(hasPaidEntitlement(null)).toBe(false);
    expect(hasPaidEntitlement(undefined)).toBe(false);
    expect(hasPaidEntitlement('CANCELED')).toBe(false);
    expect(hasPaidEntitlement('PAST_DUE')).toBe(false);
    expect(hasPaidEntitlement('INCOMPLETE')).toBe(false);
  });
});
