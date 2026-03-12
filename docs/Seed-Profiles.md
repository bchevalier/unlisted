# Seed Profiles (Direct + Reach MVP)

Knokio now supports deterministic seed profiles for CI, staging realism, and load sanity preparation.

## Profiles

| Profile | Direct users/doors | Direct requests | Direct events target | Reach actors | Reach policies | Reach contracts | Reach events target | Reach webhooks | Reach deliveries |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `ci` | 12 | 250 | 800 | 20 | 40 | 250 | 900 | 20 | 200 |
| `staging-lite` | 180 | 4,000 | 12,000 | 80 | 220 | 1,500 | 4,500 | 90 | 1,200 |
| `staging` | 250 | 12,000 | 42,000 | 120 | 420 | 5,000 | 15,000 | 220 | 4,000 |
| `load` | 500 | 25,000 | 70,000 | 180 | 700 | 8,000 | 24,000 | 400 | 7,000 |

## Commands

```bash
npm run seed:ci
npm run seed:staging-lite
npm run seed:staging
npm run seed:load
```

Or generic:

```bash
npm run seed:profile -- --profile ci
```

## Notes

- Seed data is profile-prefixed (`seed-ci-*`, `seed-staging-lite-*`, `seed-staging-*`, `seed-load-*`) for safe cleanup.
- Running a profile first removes prior data for that profile prefix, then reseeds deterministic test data.
- Script entrypoint: `scripts/seed-profiles.ts`.
