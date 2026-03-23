import { describe, expect, it } from 'vitest';
import { directCanonicalScreenshotTargets } from './direct-canonical-screenshots.config.mjs';

describe('direct canonical screenshot targets', () => {
  it('covers the five required Direct review surfaces', () => {
    expect(directCanonicalScreenshotTargets).toHaveLength(5);
    expect(directCanonicalScreenshotTargets.map((target) => target.key)).toEqual([
      'direct-landing',
      'direct-signup-launch',
      'direct-public-door',
      'direct-settings',
      'direct-inbox',
    ]);
    expect(directCanonicalScreenshotTargets.map((target) => target.output)).toEqual([
      'direct-landing.png',
      'direct-signup-launch.png',
      'direct-public-door.png',
      'direct-settings.png',
      'direct-inbox-proof-of-value.png',
    ]);
  });
});
