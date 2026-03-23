export const DIRECT_PRESET_VALUES = ['CREATOR', 'ADVISOR', 'PUBLIC_FACING'] as const;
export type DirectPresetValue = (typeof DIRECT_PRESET_VALUES)[number];

export type DirectPresetMetadata = {
  value: DirectPresetValue;
  label: string;
  copy: string;
  launch: string[];
  categories: string[];
};

export const DIRECT_PRESET_METADATA: readonly DirectPresetMetadata[] = [
  {
    value: 'CREATOR',
    label: 'Creator / influencer',
    copy: 'Start with brand deals, collabs, and serious inbound already structured.',
    launch: [
      'A private-by-default door for brand deals, collabs, and other serious inbound',
      'Structured categories with required context before requests touch your inbox',
      'A public @alias plus inbox caps so noise stays out from day one',
    ],
    categories: ['Brand / Product Placement', 'Collaboration', 'Other'],
  },
  {
    value: 'ADVISOR',
    label: 'Advisor / expert',
    copy: 'Start with advisory requests, speaking invites, and serious business access.',
    launch: [
      'An advisory-first door for expert access, speaking invites, and serious requests',
      'Required context fields so requests arrive with company, scope, and budget signal',
      'A protected intake lane that keeps your real inbox private from the start',
    ],
    categories: ['Advisory Request', 'Speaking / Guesting', 'Other'],
  },
  {
    value: 'PUBLIC_FACING',
    label: 'Public-facing professional',
    copy: 'Start with business inquiries, media requests, and structured serious outreach.',
    launch: [
      'A business-ready door for media, partnerships, and serious public-facing inbound',
      'Structured categories that separate press, business, and general requests immediately',
      'A public-facing alias with default limits so your contact surface stays controlled',
    ],
    categories: ['Business Inquiry', 'Media / Press', 'Other'],
  },
] as const;

export function getDirectPresetMetadata(preset: DirectPresetValue): DirectPresetMetadata {
  return DIRECT_PRESET_METADATA.find((item) => item.value === preset) ?? DIRECT_PRESET_METADATA[0];
}
