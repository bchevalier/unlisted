'use client'

import Link from 'next/link'
import React, { useMemo, useState } from 'react'
import styles from './direct-demo-flow.module.css'

type RequestField = {
  key: string
  label: string
  value: string
  required?: boolean
}

type DemoPreset = {
  id: string
  label: string
  shortLabel: string
  requestTitle: string
  requestType: string
  autoReply?: {
    subject: string
    body: string
  }
  fields: RequestField[]
}

type DemoCategory = {
  id: string
  label: string
  tagline: string
  payoffTitle: string
  payoffBullets: string[]
  presets: DemoPreset[]
}

type RequestCard = {
  key: string
  label: string
  value: string
  valid: boolean
  constraint: string
}

type RoutingState = {
  holdSelected: boolean
  timelineBranchActive: boolean
  standardSelected: boolean
  prioritySelected: boolean
}

const DEMO_DOOR_EMAILS: Record<string, string> = {
  creator: 'creator@knokio.io',
  advisor: 'advisor@knokio.io',
  founder: 'founder@knokio.io',
  agency: 'studio@knokio.io',
  'small-business': 'service@knokio.io',
  'public-figure': 'press@knokio.io',
}

const TIMELINE_PRIORITY_DAYS = 14
const DEMO_REFERENCE_DATE = '2026-04-13'

const CATEGORIES: DemoCategory[] = [
  {
    id: 'creator',
    label: 'Creator / Influencer',
    tagline: 'Filter sponsorship inbound before it becomes DM chaos.',
    payoffTitle: 'Why this setup works for creators',
    payoffBullets: [
      'Brand deals arrive with budget, deliverables, and timing attached.',
      'Incomplete collab asks get bounced back automatically.',
      'Premium access requests can be routed to a paid lane without exposing your personal inbox.',
    ],
    presets: [
      {
        id: 'creator-good',
        label: 'Brand collaboration proposal',
        shortLabel: 'Good request',
        requestTitle: 'Spring capsule launch sponsorship',
        requestType: 'Brand sponsorship',
        fields: [
          { key: 'brand', label: 'Brand / company', value: 'North Lane Studio', required: true },
          { key: 'budget', label: 'Campaign budget', value: '$3,500', required: true },
          { key: 'timeline', label: 'Campaign launch date', value: '2026-05-06', required: true },
          { key: 'brief', label: 'Deliverables', value: '2 reels + 3 story frames for our new spring capsule.', required: true },
          { key: 'platform', label: 'Primary platform', value: 'Instagram', required: true },
          { key: 'email', label: 'Email', value: 'amelia@northlane.studio', required: true },
        ],
      },
      {
        id: 'creator-incomplete',
        label: 'Podcast guest appearance',
        shortLabel: 'Needs info',
        requestTitle: 'Guest episode on creator growth systems',
        requestType: 'Podcast appearance',
        autoReply: {
          subject: 'Please add appearance fee before your request can be reviewed',
          body: 'Thanks for reaching out. This setup requires appearance fee and recording details before the request can be reviewed.',
        },
        fields: [
          { key: 'show', label: 'Show / channel', value: 'Build In Public FM', required: true },
          { key: 'budget', label: 'Appearance fee', value: '', required: true },
          { key: 'timeline', label: 'Recording date', value: '2026-04-28', required: true },
          { key: 'brief', label: 'Episode topic', value: 'Creator growth playbooks for multi-platform launches.', required: true },
          { key: 'audience', label: 'Audience size', value: '18k monthly listeners', required: true },
          { key: 'email', label: 'Email', value: 'mark@bip.fm', required: true },
        ],
      },
      {
        id: 'creator-paid',
        label: 'Paid advisory access request',
        shortLabel: 'Paid lane',
        requestTitle: '1:1 creator monetisation strategy session',
        requestType: 'Advisory call',
        fields: [
          { key: 'company', label: 'Company', value: 'Signal Talent', required: true },
          { key: 'budget', label: 'Session budget', value: '$500', required: true },
          { key: 'timeline', label: 'Preferred session date', value: '2026-04-20', required: true },
          { key: 'brief', label: 'Focus area', value: 'Monetisation strategy for a creator management roster.', required: true },
          { key: 'team-size', label: 'Roster size', value: '12 managed creators', required: true },
          { key: 'email', label: 'Email', value: 'jordan@signaltalent.io', required: true },
        ],
      },
    ],
  },
  {
    id: 'advisor',
    label: 'Advisor / Consultant',
    tagline: 'Turn vague outreach into scoped work or filter it out.',
    payoffTitle: 'Why this setup works for advisors',
    payoffBullets: [
      'Scope, budget, and timing arrive before a call is booked.',
      'Brain-picking requests get bounced back for more detail automatically.',
      'Paid strategy requests can be routed to a premium lane without extra admin.',
    ],
    presets: [
      {
        id: 'advisor-good',
        label: 'Strategy sprint request',
        shortLabel: 'Good request',
        requestTitle: 'Go-to-market strategy sprint',
        requestType: 'Strategy sprint',
        fields: [
          { key: 'company', label: 'Company', value: 'Hinter Labs', required: true },
          { key: 'budget', label: 'Sprint budget', value: '$4,000', required: true },
          { key: 'timeline', label: 'Kickoff date', value: '2026-05-20', required: true },
          { key: 'brief', label: 'Scope', value: '2-week GTM sprint for our B2B SaaS launch.', required: true },
          { key: 'team-size', label: 'Team size', value: '8 people', required: true },
          { key: 'decision-maker', label: 'Decision maker', value: 'Head of Growth', required: true },
          { key: 'email', label: 'Email', value: 'sara@hinterlabs.com', required: true },
        ],
      },
      {
        id: 'advisor-needs-info',
        label: 'Team workshop request',
        shortLabel: 'Needs info',
        requestTitle: 'Half-day positioning workshop',
        requestType: 'Workshop request',
        autoReply: {
          subject: 'Please add workshop agenda before your request can be reviewed',
          body: 'Thanks for reaching out. This setup requires an agenda and target outcome before the request can be reviewed.',
        },
        fields: [
          { key: 'company', label: 'Company', value: 'Independent founder', required: true },
          { key: 'budget', label: 'Workshop budget', value: '$500', required: true },
          { key: 'timeline', label: 'Workshop date', value: '2026-04-18', required: true },
          { key: 'participants', label: 'Participants', value: '6', required: true },
          { key: 'brief', label: 'Agenda', value: '', required: true },
          { key: 'email', label: 'Email', value: 'founder@example.com', required: true },
        ],
      },
    ],
  },
  {
    id: 'founder',
    label: 'Founder / Executive',
    tagline: 'Separate investor, press, and partnership inbound before it collides.',
    payoffTitle: 'Why this setup works for founders',
    payoffBullets: [
      'Investor, media, and partner requests stay separated and reviewable.',
      'Incomplete inbound is bounced back before it becomes executive triage.',
      'Private contact stays hidden until the request is worth attention.',
    ],
    presets: [
      {
        id: 'founder-press',
        label: 'Press interview request',
        shortLabel: 'Good request',
        requestTitle: 'Interview request for product launch feature',
        requestType: 'Press request',
        fields: [
          { key: 'outlet', label: 'Outlet / publication', value: 'Product Weekly', required: true },
          { key: 'timeline', label: 'Interview deadline', value: '2026-04-18', required: true },
          { key: 'topic', label: 'Angle', value: 'Launch interview focused on category strategy', required: true },
          { key: 'format', label: 'Format', value: 'Written Q&A', required: true },
          { key: 'email', label: 'Email', value: 'editor@productweekly.com', required: true },
        ],
      },
      {
        id: 'founder-partner',
        label: 'Enterprise partnership request',
        shortLabel: 'Needs info',
        requestTitle: 'Distribution partnership proposal',
        requestType: 'Enterprise partnership',
        autoReply: {
          subject: 'Please clarify the partnership scope',
          body: 'Thanks for reaching out. This setup requires an integration scope and expected outcome before review.',
        },
        fields: [
          { key: 'company', label: 'Company', value: 'GrowthBridge', required: true },
          { key: 'timeline', label: 'Launch date', value: '', required: true },
          { key: 'scope', label: 'Integration scope', value: '', required: true },
          { key: 'distribution', label: 'Distribution channel', value: 'Enterprise reseller network', required: true },
          { key: 'email', label: 'Email', value: 'maya@growthbridge.com', required: true },
        ],
      },
    ],
  },
  {
    id: 'agency',
    label: 'Agency / Studio',
    tagline: 'Stop briefs without budget from eating account-team time.',
    payoffTitle: 'Why this setup works for agencies',
    payoffBullets: [
      'Only scoped client inquiries reach the team inbox.',
      'Poor briefs get pushed back automatically instead of manually triaged.',
      'Paid discovery or strategy lanes can be introduced without extra tooling.',
    ],
    presets: [
      {
        id: 'agency-good',
        label: 'Website redesign brief',
        shortLabel: 'Good request',
        requestTitle: 'E-commerce redesign and CRO sprint',
        requestType: 'Client brief',
        fields: [
          { key: 'company', label: 'Company', value: 'Harbor Goods', required: true },
          { key: 'budget', label: 'Project budget', value: '$25,000', required: true },
          { key: 'timeline', label: 'Kickoff date', value: '2026-06-01', required: true },
          { key: 'brief', label: 'Project brief', value: 'Redesign storefront and improve conversion through checkout.', required: true },
          { key: 'pages', label: 'Page count', value: '14', required: true },
          { key: 'assets', label: 'Brand assets ready', value: 'Yes', required: true },
          { key: 'email', label: 'Email', value: 'ops@harborgoods.co', required: true },
        ],
      },
    ],
  },
  {
    id: 'small-business',
    label: 'Small business / Services',
    tagline: 'Do not lose good leads while filtering out bad-fit inbound during busy periods.',
    payoffTitle: 'Why this setup works for small businesses',
    payoffBullets: [
      'Good leads get an answer quickly, even when you are overloaded.',
      'Bad-fit or incomplete inquiries stop stealing time during crunch periods.',
      'Eligibility rules run before your team has to read the request manually.',
    ],
    presets: [
      {
        id: 'small-good',
        label: 'Qualified service inquiry',
        shortLabel: 'Good request',
        requestTitle: 'Bathroom renovation quote request',
        requestType: 'Renovation quote',
        fields: [
          { key: 'service', label: 'Service needed', value: 'Bathroom renovation', required: true },
          { key: 'budget', label: 'Budget', value: '$18,000', required: true },
          { key: 'timeline', label: 'Desired start date', value: '2026-04-22', required: true },
          { key: 'brief', label: 'Job scope', value: 'Full renovation for a family home bathroom.', required: true },
          { key: 'suburb', label: 'Suburb', value: 'Ponsonby', required: true },
          { key: 'email', label: 'Email', value: 'jane@oakstreet.nz', required: true },
        ],
      },
      {
        id: 'small-incomplete',
        label: 'Emergency callout request',
        shortLabel: 'Needs info',
        requestTitle: 'Urgent after-hours plumbing callout',
        requestType: 'Emergency callout',
        autoReply: {
          subject: 'Please add callout budget and problem details',
          body: 'Thanks for reaching out. This setup requires a callout budget and a clear description of the issue before review.',
        },
        fields: [
          { key: 'service', label: 'Service needed', value: 'After-hours plumbing', required: true },
          { key: 'budget', label: 'Callout budget', value: '', required: true },
          { key: 'timeline', label: 'Requested visit date', value: '2026-04-16', required: true },
          { key: 'brief', label: 'Problem details', value: '', required: true },
          { key: 'address', label: 'Service address', value: 'Grey Lynn', required: true },
          { key: 'email', label: 'Email', value: 'client@example.com', required: true },
        ],
      },
    ],
  },
  {
    id: 'public-figure',
    label: 'Public figure / Press-facing',
    tagline: 'Keep fan mail, media, and business inbound from colliding.',
    payoffTitle: 'Why this setup works for public figures',
    payoffBullets: [
      'Press and business requests stay visible while lower-signal outreach gets filtered.',
      'Your real contact details remain private until a request is worth engaging with.',
      'Premium appearances or advisory asks can route to a paid access lane.',
    ],
    presets: [
      {
        id: 'public-paid',
        label: 'Paid appearance request',
        shortLabel: 'Paid lane',
        requestTitle: 'Panel appearance request',
        requestType: 'Paid appearance request',
        fields: [
          { key: 'event', label: 'Event / org', value: 'Future Culture Summit', required: true },
          { key: 'budget', label: 'Appearance fee', value: '$2,000', required: true },
          { key: 'timeline', label: 'Event date', value: '2026-06-20', required: true },
          { key: 'brief', label: 'Appearance format', value: '45-minute panel on creator commerce and media brands.', required: true },
          { key: 'audience', label: 'Expected audience', value: '900 attendees', required: true },
          { key: 'travel', label: 'Travel included', value: 'Yes', required: true },
          { key: 'email', label: 'Email', value: 'events@futureculture.org', required: true },
        ],
      },
    ],
  },
]

const STEP_LABELS = [
  { tag: 'Step 1', title: 'Choose your setup' },
  { tag: 'Step 2', title: 'Selected request' },
  { tag: 'Step 3', title: 'Validate and route' },
] as const

function fieldOrNull(fields: RequestField[], key: string) {
  return fields.find((field) => field.key === key) ?? null
}

function isFilled(value: string) {
  return value.trim().length > 0
}

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function getDaysFromReference(value: string) {
  const target = parseIsoDate(value)
  const reference = parseIsoDate(DEMO_REFERENCE_DATE)
  if (!target || !reference) return null
  return Math.round((target.getTime() - reference.getTime()) / 86_400_000)
}

function getBudgetConstraint(presetId: string) {
  switch (presetId) {
    case 'creator-paid':
      return '≥ $500'
    case 'agency-good':
      return '≥ $5,000'
    case 'creator-good':
    case 'creator-incomplete':
    case 'small-good':
    case 'small-incomplete':
    case 'public-paid':
      return '≥ $1,000'
    case 'advisor-good':
    case 'advisor-needs-info':
      return '≥ $500'
    default:
      return '≥ $0'
  }
}

function getFieldConstraint(presetId: string, key: string) {
  if (key === 'budget') return getBudgetConstraint(presetId)
  if (key === 'timeline') return 'Date'
  return 'Required'
}

function buildRoutingState(preset: DemoPreset, valid: boolean): RoutingState {
  if (!valid) {
    return {
      holdSelected: true,
      timelineBranchActive: false,
      standardSelected: false,
      prioritySelected: false,
    }
  }

  const timelineField = fieldOrNull(preset.fields, 'timeline')
  const daysFromReference = timelineField ? getDaysFromReference(timelineField.value) : null
  const prioritySelected = daysFromReference !== null && daysFromReference <= TIMELINE_PRIORITY_DAYS

  return {
    holdSelected: false,
    timelineBranchActive: true,
    standardSelected: !prioritySelected,
    prioritySelected,
  }
}

function requestCardsFromPreset(preset: DemoPreset) {
  const cards = [
    {
      key: 'request-title',
      label: 'Request',
      value: preset.requestTitle,
      required: true,
    },
    ...preset.fields.filter((field) => field.key !== 'email'),
  ]

  return cards.map((field) => ({
    key: field.key,
    label: field.label,
    value: field.value,
    valid: !field.required || isFilled(field.value),
    constraint: getFieldConstraint(preset.id, field.key),
  })) satisfies RequestCard[]
}

function StepHeader({ tag, title }: { tag?: string; title: string }) {
  return (
    <div className={styles.stepHeader}>
      {tag ? <span className={styles.stepTag}>{tag}</span> : null}
      <h2>{title}</h2>
    </div>
  )
}

function ArrowDivider() {
  return (
    <div className={styles.arrowDivider} aria-hidden="true">
      <span>↓</span>
    </div>
  )
}

export function DirectDemoFlow() {
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id)
  const category = useMemo(() => CATEGORIES.find((item) => item.id === categoryId) ?? CATEGORIES[0], [categoryId])
  const [presetId, setPresetId] = useState(category.presets[0].id)
  const [processed, setProcessed] = useState(false)

  const preset = useMemo(() => category.presets.find((item) => item.id === presetId) ?? category.presets[0], [category, presetId])
  const requestCards = useMemo(() => requestCardsFromPreset(preset), [preset])
  const requestIsValid = requestCards.every((field) => field.valid)
  const routingState = useMemo(() => buildRoutingState(preset, requestIsValid), [preset, requestIsValid])

  const changeCategory = (nextCategoryId: string) => {
    const nextCategory = CATEGORIES.find((item) => item.id === nextCategoryId) ?? CATEGORIES[0]
    setCategoryId(nextCategory.id)
    setPresetId(nextCategory.presets[0].id)
    setProcessed(false)
  }

  const changePreset = (nextPresetId: string) => {
    setPresetId(nextPresetId)
    setProcessed(false)
  }

  const processRequest = () => {
    setProcessed(false)
    window.requestAnimationFrame(() => {
      setProcessed(true)
    })
  }

  return (
    <div className={styles.page}>
      <section className={styles.heroCard}>
        <p className={styles.eyebrow}>Live Direct demo</p>
        <h1>Watch one request travel through the Knokio access layer.</h1>
        <p className={styles.heroCopy}>
          Choose a business type, pick a sample request, and see how Direct validates it, routes it, and decides what reaches you.
        </p>
      </section>

      <ArrowDivider />

      <section className={styles.stepCard}>
        <StepHeader tag={STEP_LABELS[0].tag} title={STEP_LABELS[0].title} />
        <p className={styles.stepLead}>Choose the business type, then select the sample request you want to process.</p>

        <div className={styles.controlStack}>
          <div className={styles.controlGroup}>
            <label className={styles.groupLabel} htmlFor="business-type-select">
              Business type
            </label>
            <select
              id="business-type-select"
              className={styles.selectInput}
              value={category.id}
              onChange={(event) => changeCategory(event.target.value)}
            >
              {CATEGORIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <p className={styles.controlHint}>{category.tagline}</p>
          </div>

          <div className={styles.controlGroup}>
            <p className={styles.groupLabel}>Sample request</p>
            <div className={styles.presetPicker}>
              {category.presets.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === preset.id ? `${styles.presetCard} ${styles.presetActive}` : styles.presetCard}
                  onClick={() => changePreset(item.id)}
                >
                  <strong>{item.label}</strong>
                  <span className={styles.presetType}>{item.requestType}</span>
                  <span className={styles.presetBadge}>{item.shortLabel}</span>
                </button>
              ))}
            </div>
            <p className={styles.controlHint}>These are example request categories. Keepers customize their own fields and rules.</p>
          </div>
        </div>
      </section>

      <ArrowDivider />

      <section className={styles.stepCard}>
        <StepHeader tag={STEP_LABELS[1].tag} title={STEP_LABELS[1].title} />
        <p className={styles.stepLead}>Review the request exactly as Direct receives it before validation runs.</p>

        <article className={styles.requestFrame}>
          <div className={styles.requestEnvelope}>
            <div className={styles.envelopeRow}>
              <span>From</span>
              <strong>{fieldOrNull(preset.fields, 'email')?.value || 'Missing'}</strong>
            </div>
            <div className={styles.envelopeRow}>
              <span>To</span>
              <strong>{DEMO_DOOR_EMAILS[category.id]}</strong>
            </div>
            <div className={styles.envelopeRow}>
              <span>Subject</span>
              <strong>{preset.requestType}</strong>
            </div>
          </div>

          <div className={styles.requestFieldList}>
            {requestCards.map((field, index) => {
              const badgeClass = processed
                ? field.valid
                  ? `${styles.constraintBadge} ${styles.constraintBadgeValid}`
                  : `${styles.constraintBadge} ${styles.constraintBadgeInvalid}`
                : `${styles.constraintBadge} ${styles.constraintBadgePending}`

              return (
                <div
                  key={field.key}
                  className={[
                    styles.requestFieldCard,
                    processed ? styles.requestFieldCardEvaluated : '',
                    processed && field.valid ? styles.requestFieldCardValid : '',
                    processed && !field.valid ? styles.requestFieldCardInvalid : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ ['--field-index' as string]: index } as React.CSSProperties}
                >
                  <span className={styles.requestFieldLabel}>{field.label}</span>
                  <strong className={styles.requestFieldValue}>{field.value || 'Missing'}</strong>
                  <span className={badgeClass}>
                    <span aria-hidden="true">{processed ? (field.valid ? '✓' : '✕') : '•'}</span>
                    {field.constraint}
                  </span>
                </div>
              )
            })}
          </div>
        </article>

        <div className={styles.centerCtaRow}>
          <button type="button" className={styles.processButton} onClick={processRequest}>
            Process Request
          </button>
        </div>
      </section>

      {processed ? (
        <>
          <ArrowDivider />

          <section className={styles.stepCard}>
            <StepHeader tag={STEP_LABELS[2].tag} title={STEP_LABELS[2].title} />
            <p className={styles.stepLead}>Validated requests route by timeline urgency.</p>

            <div className={styles.validationRouteCard}>
              <div className={requestIsValid ? `${styles.validationBar} ${styles.validationBarValid}` : `${styles.validationBar} ${styles.validationBarInvalid}`}>
                <span className={styles.validationIcon} aria-hidden="true">
                  {requestIsValid ? '✓' : '✕'}
                </span>
                <span>{requestIsValid ? 'All required fields present' : 'Required fields missing'}</span>
              </div>

              <div className={styles.routingFlow}>
                <div className={styles.flowBranch}>
                  <div className={routingState.holdSelected ? `${styles.flowArrow} ${styles.flowArrowActive}` : `${styles.flowArrow} ${styles.flowArrowMuted}`}>↓</div>
                  <article className={routingState.holdSelected ? `${styles.flowNode} ${styles.flowNodeActive}` : `${styles.flowNode} ${styles.flowNodeMuted}`}>
                    <h3>Hold</h3>
                    <p>Blocked client-side · no charge</p>
                  </article>

                  {preset.autoReply ? (
                    <>
                      <div className={!requestIsValid ? `${styles.flowArrow} ${styles.flowArrowActive}` : `${styles.flowArrow} ${styles.flowArrowMuted}`}>↓</div>
                      <article className={!requestIsValid ? `${styles.flowNode} ${styles.flowNodeActive}` : `${styles.flowNode} ${styles.flowNodeMuted}`}>
                        <h3>Automatic reply</h3>
                        <p>Not sent · blocked client-side · no charge</p>
                      </article>
                    </>
                  ) : null}
                </div>

                <div className={styles.flowBranchWide}>
                  <div className={routingState.timelineBranchActive ? `${styles.flowArrow} ${styles.flowArrowActive}` : `${styles.flowArrow} ${styles.flowArrowMuted}`}>↓</div>
                  <article className={routingState.timelineBranchActive ? `${styles.flowNode} ${styles.flowNodeActive}` : `${styles.flowNode} ${styles.flowNodeMuted}`}>
                    <h3>Timeline ≤ {TIMELINE_PRIORITY_DAYS} days?</h3>
                    <p>From today</p>
                  </article>

                  <div className={styles.flowSplit}>
                    <div className={styles.flowSplitBranch}>
                      <div className={routingState.standardSelected ? `${styles.flowArrow} ${styles.flowArrowActive}` : `${styles.flowArrow} ${styles.flowArrowMuted}`}>↙</div>
                      <article className={routingState.standardSelected ? `${styles.flowNode} ${styles.flowNodeActive}` : `${styles.flowNode} ${styles.flowNodeMuted}`}>
                        <h3>Standard inbox</h3>
                        <p>{'>'} {TIMELINE_PRIORITY_DAYS} days</p>
                      </article>
                    </div>

                    <div className={styles.flowSplitBranch}>
                      <div className={routingState.prioritySelected ? `${styles.flowArrow} ${styles.flowArrowActive}` : `${styles.flowArrow} ${styles.flowArrowMuted}`}>↘</div>
                      <article className={routingState.prioritySelected ? `${styles.flowNode} ${styles.flowNodeActive}` : `${styles.flowNode} ${styles.flowNodeMuted}`}>
                        <h3>Priority inbox</h3>
                        <p>≤ {TIMELINE_PRIORITY_DAYS} days</p>
                      </article>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <ArrowDivider />

          <section className={styles.stepCard}>
            <StepHeader title={category.payoffTitle} />
            <div className={styles.payoffCard}>
              <ul>
                {category.payoffBullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              <div className={styles.centerCtaRow}>
                <Link className={styles.primaryLink} href="/direct/signup">
                  Create your Direct page
                </Link>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}

export default DirectDemoFlow
