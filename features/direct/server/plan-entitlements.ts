import { DoorPlan } from '@prisma/client';

export type DirectPlanEntitlements = {
  maxDoors: number;
  maxFormDoors: number;
  teamAccessAllowed: boolean;
};

/**
 * MVP entitlements for Knokio Direct.
 *
 * Important: current schema is still single-door-per-user for all plans.
 * These entitlements make the Free constraints explicit in code today, while also
 * documenting that team access is not part of the MVP contract.
 */
export function getDirectPlanEntitlements(plan: DoorPlan): DirectPlanEntitlements {
  if (plan === DoorPlan.FREE) {
    return {
      maxDoors: 1,
      maxFormDoors: 1,
      teamAccessAllowed: false,
    };
  }

  return {
    // Paid will likely expand later, but current MVP/schema remain solo-first.
    maxDoors: 1,
    maxFormDoors: 1,
    teamAccessAllowed: false,
  };
}
