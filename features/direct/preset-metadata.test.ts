import { DoorPlan } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { getDirectPresetConfig } from './server/onboarding-presets';
import { DIRECT_PRESET_METADATA, getDirectPresetMetadata } from './preset-metadata';

describe('DIRECT_PRESET_METADATA', () => {
  it('defines the shared client-facing preset source of truth', () => {
    expect(DIRECT_PRESET_METADATA.map((item) => item.value)).toEqual([
      'CREATOR',
      'ADVISOR',
      'PUBLIC_FACING',
    ]);
  });

  it('returns the expected metadata for advisor onboarding', () => {
    expect(getDirectPresetMetadata('ADVISOR')).toMatchObject({
      label: 'Advisor / expert',
      categories: ['Advisory Request', 'Speaking / Guesting', 'Other'],
    });
  });

  it('keeps UI preset categories aligned with the server onboarding config', () => {
    for (const preset of DIRECT_PRESET_METADATA) {
      const serverConfig = getDirectPresetConfig(preset.value, DoorPlan.FREE);
      expect(preset.categories).toEqual(serverConfig.categories.map((category) => category.label));
    }
  });
});
