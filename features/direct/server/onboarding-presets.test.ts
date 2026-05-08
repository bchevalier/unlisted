import { DoorPlan } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { getDirectPresetConfig } from './onboarding-presets';

describe('getDirectPresetConfig', () => {
  it('returns creator-oriented defaults for creator preset', () => {
    const preset = getDirectPresetConfig('CREATOR', DoorPlan.FREE);

    expect(preset.headline).toMatch(/Brand deals, collabs/);
    expect(preset.categories.map((item) => item.label)).toEqual([
      'Brand / Product Placement',
      'Collaboration',
      'Other',
    ]);
  });

  it('returns advisor-oriented defaults for advisor preset', () => {
    const preset = getDirectPresetConfig('ADVISOR', DoorPlan.FREE);

    expect(preset.headline).toMatch(/Advisory requests only/);
    expect(preset.categories.map((item) => item.label)).toEqual([
      'Advisory Request',
      'Speaking / Guesting',
      'Other',
    ]);
  });

  it('returns public-facing defaults for public-facing preset', () => {
    const preset = getDirectPresetConfig('PUBLIC_FACING', DoorPlan.FREE);

    expect(preset.headline).toMatch(/Serious opportunities only/);
    expect(preset.categories.map((item) => item.label)).toEqual([
      'Business Inquiry',
      'Media / Press',
      'Other',
    ]);
  });
});
