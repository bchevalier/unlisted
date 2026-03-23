import { DoorPlan } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { getDirectPlanEntitlements } from './plan-entitlements';

describe('getDirectPlanEntitlements', () => {
  it('makes Free explicitly solo-only with one door and one form surface', () => {
    expect(getDirectPlanEntitlements(DoorPlan.FREE)).toEqual({
      maxDoors: 1,
      maxFormDoors: 1,
      teamAccessAllowed: false,
    });
  });

  it('keeps the current Paid MVP solo-only until multi-door/team support is implemented', () => {
    expect(getDirectPlanEntitlements(DoorPlan.PAID)).toEqual({
      maxDoors: 1,
      maxFormDoors: 1,
      teamAccessAllowed: false,
    });
  });
});
