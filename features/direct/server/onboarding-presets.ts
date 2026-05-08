import { CategoryFieldType, DoorPlan } from '@prisma/client';
import { DIRECT_PRESET_VALUES, type DirectPresetValue } from '../preset-metadata';

export const DIRECT_ONBOARDING_PRESETS = DIRECT_PRESET_VALUES;
export type DirectOnboardingPreset = DirectPresetValue;

export type CategorySeed = {
  key: string;
  label: string;
  description: string;
  sortOrder: number;
  fields: Array<{
    key: string;
    label: string;
    type: CategoryFieldType;
    required: boolean;
    sortOrder: number;
    placeholder?: string;
  }>;
};

export type DirectPresetConfig = {
  headline: string;
  categories: CategorySeed[];
};

export function getDirectPresetConfig(preset: DirectOnboardingPreset, plan: DoorPlan): DirectPresetConfig {
  const paid = plan === DoorPlan.PAID;

  switch (preset) {
    case 'ADVISOR':
      return {
        headline: paid
          ? 'Advisory access by request. Send complete context for priority review.'
          : 'Advisory requests only. Send context before this reaches my inbox.',
        categories: [
          {
            key: 'advisory',
            label: 'Advisory Request',
            description: 'Paid advisory calls, retained help, or expert access',
            sortOrder: 1,
            fields: [
              { key: 'company', label: 'Company', type: CategoryFieldType.TEXT, required: true, sortOrder: 1 },
              { key: 'context', label: 'What do you need help with?', type: CategoryFieldType.TEXTAREA, required: true, sortOrder: 2 },
              { key: 'budget', label: 'Budget', type: CategoryFieldType.NUMBER, required: !paid, sortOrder: 3 },
            ],
          },
          {
            key: 'speaking',
            label: 'Speaking / Guesting',
            description: 'Podcast, event, workshop, or audience invite',
            sortOrder: 2,
            fields: [
              { key: 'audience', label: 'Audience', type: CategoryFieldType.TEXT, required: true, sortOrder: 1 },
              { key: 'timeline', label: 'Timeline', type: CategoryFieldType.TEXT, required: false, sortOrder: 2 },
            ],
          },
          { key: 'other', label: 'Other', description: 'Other serious business inbound', sortOrder: 3, fields: [] },
        ],
      };
    case 'PUBLIC_FACING':
      return {
        headline: paid
          ? 'Serious opportunities only. Structured requests get priority review.'
          : 'Serious opportunities only. Structured requests get inbox space.',
        categories: [
          {
            key: 'business',
            label: 'Business Inquiry',
            description: 'Partnerships, sponsorships, and commercial opportunities',
            sortOrder: 1,
            fields: [
              { key: 'company', label: 'Company', type: CategoryFieldType.TEXT, required: true, sortOrder: 1 },
              { key: 'brief', label: 'Brief', type: CategoryFieldType.TEXTAREA, required: true, sortOrder: 2 },
              { key: 'budget', label: 'Budget', type: CategoryFieldType.NUMBER, required: false, sortOrder: 3 },
            ],
          },
          {
            key: 'media',
            label: 'Media / Press',
            description: 'Interview, media request, or public appearance',
            sortOrder: 2,
            fields: [
              { key: 'outlet', label: 'Outlet / publication', type: CategoryFieldType.TEXT, required: true, sortOrder: 1 },
              { key: 'deadline', label: 'Deadline', type: CategoryFieldType.TEXT, required: false, sortOrder: 2 },
            ],
          },
          { key: 'other', label: 'Other', description: 'General inbound that still needs structure', sortOrder: 3, fields: [] },
        ],
      };
    case 'CREATOR':
    default:
      return {
        headline: paid
          ? 'Brand and partnership requests only. Send complete details for priority review.'
          : 'Brand deals, collabs, and serious requests only. Noise stays out.',
        categories: [
          {
            key: 'brand',
            label: 'Brand / Product Placement',
            description: 'Sponsored posts, partnerships, or product placement requests',
            sortOrder: 1,
            fields: [
              { key: 'brand', label: 'Brand', type: CategoryFieldType.TEXT, required: true, sortOrder: 1 },
              { key: 'brief', label: 'Campaign brief', type: CategoryFieldType.TEXTAREA, required: true, sortOrder: 2 },
              { key: 'budget', label: 'Budget', type: CategoryFieldType.NUMBER, required: false, sortOrder: 3 },
            ],
          },
          {
            key: 'collab',
            label: 'Collaboration',
            description: 'Creator partnerships and project collaborations',
            sortOrder: 2,
            fields: [
              { key: 'project', label: 'Project / concept', type: CategoryFieldType.TEXT, required: true, sortOrder: 1 },
              { key: 'timeline', label: 'Timeline', type: CategoryFieldType.TEXT, required: false, sortOrder: 2 },
            ],
          },
          { key: 'other', label: 'Other', description: 'Other serious inbound', sortOrder: 3, fields: [] },
        ],
      };
  }
}
