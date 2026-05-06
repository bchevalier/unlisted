import { promises as fs } from 'node:fs';
import path from 'node:path';

const OUTPUT_FILE = path.join(
  process.cwd(),
  'data',
  'reach-identities',
  'generated-1000-profiles.txt'
);
const PROFILE_COUNT = 1000;

const firstNames = [
  'Aarav',
  'Aisha',
  'Akira',
  'Amara',
  'Anika',
  'Arjun',
  'Camila',
  'Chen',
  'Dalia',
  'Diego',
  'Elena',
  'Fatima',
  'Hana',
  'Ilya',
  'Jonas',
  'Kai',
  'Leila',
  'Maya',
  'Nadia',
  'Noah',
  'Priya',
  'Rafi',
  'Sofia',
  'Tariq',
  'Yuna',
];

const lastNames = [
  'Anders',
  'Bennett',
  'Chen',
  'Costa',
  'Diallo',
  'Fernandez',
  'Garcia',
  'Haddad',
  'Ivanov',
  'Jensen',
  'Khan',
  'Kobayashi',
  'Lopez',
  'Mbeki',
  'Nguyen',
  'Okafor',
  'Patel',
  'Rossi',
  'Sato',
  'Silva',
  'Tan',
  'Volkov',
  'Williams',
  'Yamamoto',
  'Zhang',
];

const locations = [
  'Austin, TX',
  'Barcelona, Spain',
  'Berlin, Germany',
  'Lisbon, Portugal',
  'Mexico City, Mexico',
  'Melbourne, Australia',
  'Nairobi, Kenya',
  'New York, NY',
  'Porto, Portugal',
  'San Francisco, CA',
  'Seoul, South Korea',
  'Singapore',
  'Stockholm, Sweden',
  'Tallinn, Estonia',
  'Toronto, Canada',
  'Wellington, New Zealand',
];

const archetypes = [
  {
    role: 'AI Product Engineer',
    org: 'Signal Loom Labs',
    tags: ['ai', 'product-engineering', 'llms', 'prototyping', 'saas'],
    body: 'build applied AI workflows, evaluate LLM product quality, and turn rough automation ideas into reliable internal tools.',
  },
  {
    role: 'Cloud Security Architect',
    org: 'Northstar Security',
    tags: ['cloud-security', 'zero-trust', 'aws', 'incident-response', 'compliance'],
    body: 'advise companies on secure cloud architecture, incident readiness, identity boundaries, and pragmatic compliance programs.',
  },
  {
    role: 'Life Design Coach',
    org: 'Quiet Compass Studio',
    tags: ['life-design', 'habits', 'burnout', 'coaching', 'career-change'],
    body: 'help founders and operators rebuild routines, recover from burnout, and make career decisions that match their values.',
  },
  {
    role: 'Expat Family Advisor',
    org: 'Landing Well Collective',
    tags: ['expat-family', 'relocation', 'schools', 'visa-planning', 'cross-cultural'],
    body: 'guide families through relocation decisions, school research, visa timelines, remote work logistics, and settling into a new country.',
  },
  {
    role: 'Solo Founder Operator',
    org: 'Tiny Durable Ventures',
    tags: ['solo-entrepreneur', 'bootstrapping', 'operations', 'pricing', 'micro-saas'],
    body: 'run lean internet businesses and advise solo entrepreneurs on positioning, pricing, systems, and sustainable growth loops.',
  },
  {
    role: 'Creator Monetization Strategist',
    org: 'Studio North Media',
    tags: ['creator-economy', 'sponsorships', 'newsletter', 'youtube', 'audience'],
    body: 'help creators package sponsorship inventory, improve audience trust, and build revenue beyond algorithm-dependent channels.',
  },
  {
    role: 'Remote Team Facilitator',
    org: 'Async Harbor',
    tags: ['remote-work', 'facilitation', 'async-ops', 'team-health', 'documentation'],
    body: 'work with distributed teams on meeting hygiene, async rituals, decision logs, and cross-time-zone collaboration patterns.',
  },
  {
    role: 'Personal Finance Mentor',
    org: 'Clear Ledger Life',
    tags: ['personal-finance', 'budgeting', 'investing-basics', 'family-finance', 'debt'],
    body: 'support individuals and families with budgeting systems, debt payoff plans, investing basics, and calm financial decision-making.',
  },
  {
    role: 'Climate Tech Advisor',
    org: 'Carbon Current',
    tags: ['climate-tech', 'energy', 'carbon-accounting', 'hardware', 'policy'],
    body: 'connect climate founders with go-to-market strategy, carbon accounting basics, pilot customers, and hardware deployment partners.',
  },
  {
    role: 'Neurodivergent Work Coach',
    org: 'Better Focus Lab',
    tags: ['adhd', 'autism', 'workflows', 'executive-function', 'inclusive-work'],
    body: 'design practical work systems for neurodivergent professionals, including planning rituals, low-friction accountability, and communication scripts.',
  },
  {
    role: 'Developer Relations Lead',
    org: 'API Field Notes',
    tags: ['developer-relations', 'apis', 'community', 'docs', 'events'],
    body: 'help developer tool companies clarify messaging, improve docs, run useful technical events, and build credible community programs.',
  },
  {
    role: 'Healthspan Practitioner',
    org: 'Everyday Longevity',
    tags: ['healthspan', 'fitness', 'sleep', 'nutrition', 'behavior-change'],
    body: 'help busy professionals improve sleep, strength, nutrition, and long-term health habits without extreme routines.',
  },
  {
    role: 'Immigration Systems Consultant',
    org: 'Nomad Paperwork',
    tags: ['immigration', 'digital-nomad', 'tax-residency', 'paperwork', 'relocation'],
    body: 'help remote workers and entrepreneurs compare residency options, organize documents, and coordinate immigration timelines.',
  },
  {
    role: 'Sales Systems Consultant',
    org: 'Pipeline Mechanics',
    tags: ['sales-ops', 'crm', 'b2b-sales', 'lead-qualification', 'founder-sales'],
    body: 'design practical sales pipelines, lead scoring, CRM hygiene, and founder-led sales routines for early B2B companies.',
  },
  {
    role: 'Education Technology Specialist',
    org: 'Learning Loop Works',
    tags: ['edtech', 'learning-design', 'schools', 'ai-tutoring', 'curriculum'],
    body: 'advise schools and startups on curriculum design, AI tutoring experiments, teacher workflows, and measurable learning outcomes.',
  },
  {
    role: 'Mindfulness Teacher',
    org: 'Steady Attention',
    tags: ['mindfulness', 'meditation', 'stress', 'leadership', 'emotional-regulation'],
    body: 'teach practical mindfulness for teams and individuals, especially stress regulation, focused attention, and grounded leadership presence.',
  },
  {
    role: 'Marketplace Growth Expert',
    org: 'Two-Sided Growth',
    tags: ['marketplaces', 'growth', 'liquidity', 'trust-safety', 'supply-demand'],
    body: 'work with marketplaces on liquidity loops, trust mechanics, early supply acquisition, demand activation, and category expansion.',
  },
  {
    role: 'Community Builder',
    org: 'Gathering Stack',
    tags: ['community', 'membership', 'events', 'moderation', 'belonging'],
    body: 'build high-trust communities, membership rituals, moderation systems, and event formats that make people come back.',
  },
  {
    role: 'Data Platform Engineer',
    org: 'Warehouse Guild',
    tags: ['data-engineering', 'analytics', 'warehousing', 'etl', 'governance'],
    body: 'help teams build reliable data pipelines, analytics models, warehouse governance, and operational dashboards.',
  },
  {
    role: 'Family Travel Planner',
    org: 'Slow Route Families',
    tags: ['family-travel', 'worldschooling', 'remote-school', 'budget-travel', 'logistics'],
    body: 'plan long-stay family travel, worldschooling routes, kid-friendly logistics, budget tradeoffs, and remote work rhythms.',
  },
];

const modifiers = [
  'I am especially useful when a request needs a clear first step, realistic constraints, and an honest tradeoff discussion.',
  'I prefer specific requests with context, timing, budget, and the decision someone is trying to make.',
  'I often bridge technical, human, and operational concerns for people who need practical execution help.',
  'I can help evaluate options, identify hidden risks, and suggest a short path from idea to next action.',
  'I am a good match for focused advisory calls, lightweight audits, introductions, and structured planning sessions.',
];

const recentProjects = [
  'a first-principles audit',
  'a cross-border launch plan',
  'a founder operating system',
  'a family relocation map',
  'a high-trust community reset',
  'an AI workflow rollout',
  'a pricing and packaging sprint',
  'a documentation cleanup',
  'a school transition plan',
  'a sales pipeline rebuild',
  'a wellness habit redesign',
  'a remote team ritual overhaul',
];

const workingStyles = [
  'fast diagnostic calls',
  'written advisory memos',
  'small-group workshops',
  'two-week implementation sprints',
  'structured office hours',
  'async reviews with annotated notes',
  'lightweight roadmaps',
  'hands-on setup sessions',
];

const audiences = [
  'early-stage founders',
  'relocating families',
  'creator-led businesses',
  'technical operators',
  'remote leadership teams',
  'independent consultants',
  'school administrators',
  'immigrant entrepreneurs',
  'health-conscious executives',
  'bootstrapped SaaS teams',
];

function pick(list, index, stride = 1) {
  return list[(index * stride) % list.length];
}

function humanizeTag(tag) {
  const overrides = {
    adhd: 'ADHD',
    ai: 'AI',
    'ai-tutoring': 'AI tutoring',
    apis: 'APIs',
    aws: 'AWS',
    crm: 'CRM',
    etl: 'ETL',
    llms: 'LLMs',
    saas: 'SaaS',
  };

  return overrides[tag] ?? tag.replace(/-/g, ' ');
}

function buildFirstPersonBody({
  archetype,
  name,
  organization,
  location,
  specialty,
  recentProject,
  workingStyle,
  audience,
  networkCity,
  secondNetworkCity,
  modifier,
  index,
}) {
  const locationLine = `I am based in ${location}, work through ${organization}, and keep an active reference network across ${networkCity} and ${secondNetworkCity}.`;
  const recentLine = `Recently, I handled ${recentProject}; I usually work through ${workingStyle}.`;
  const requestLine =
    'The best requests tell me the audience, urgency, budget, constraints, and desired outcome.';
  const intro = `I ${archetype.body} My current focus is ${specialty}, especially for ${audience}.`;
  const context = {
    intro,
    locationLine,
    recentLine,
    requestLine,
    modifier,
    name,
    organization,
    location,
    specialty,
    recentProject,
    workingStyle,
    audience,
    networkCity,
    secondNetworkCity,
    index,
  };

  const voices = {
    'AI Product Engineer': ({
      intro,
      locationLine,
      recentProject,
      workingStyle,
      requestLine,
      modifier,
    }) =>
      `${intro} ${locationLine} I like to separate the demo from the durable system: what needs a prototype, what needs evaluation, and what should not be automated yet. I recently handled ${recentProject}. My preferred format is ${workingStyle}; we leave with a test plan, a workflow map, and a measurable next build. ${requestLine} ${modifier}`,

    'Cloud Security Architect': ({
      intro,
      locationLine,
      recentProject,
      workingStyle,
      requestLine,
      modifier,
    }) =>
      `${intro} ${locationLine} I think in boundaries, failure modes, audit trails, and recovery paths before I talk about tools. I recently handled ${recentProject}. My preferred format is ${workingStyle}; bring enough architecture context to identify the highest-risk assumption fast. ${requestLine} ${modifier}`,

    'Life Design Coach': ({
      intro,
      locationLine,
      recentProject,
      workingStyle,
      requestLine,
      modifier,
    }) =>
      `${intro} ${locationLine} My style is reflective but practical: I listen for the pattern underneath the calendar, the obligations, and the exhaustion. I recently handled ${recentProject}. My preferred format is ${workingStyle}; the work should translate insight into one humane commitment. ${requestLine} ${modifier}`,

    'Expat Family Advisor': ({
      intro,
      locationLine,
      recentProject,
      workingStyle,
      requestLine,
      modifier,
    }) =>
      `${intro} ${locationLine} I work best when the move is treated as a family operating system: school fit, paperwork, budget, routines, and emotional load all matter. I recently handled ${recentProject}. My preferred format is ${workingStyle}; we should end with a dated checklist. ${requestLine} ${modifier}`,

    'Solo Founder Operator': ({
      intro,
      locationLine,
      recentProject,
      workingStyle,
      requestLine,
      modifier,
    }) =>
      `${intro} ${locationLine} I am direct about tradeoffs because solo founders do not have spare cycles for decorative strategy. I recently handled ${recentProject}. My preferred format is ${workingStyle}; I focus on positioning, pricing, distribution, and the next operational constraint. ${requestLine} ${modifier}`,

    'Creator Monetization Strategist': ({
      intro,
      locationLine,
      recentProject,
      workingStyle,
      requestLine,
      modifier,
    }) =>
      `${intro} ${locationLine} I care about revenue that does not damage audience trust, so I look at offer shape, sponsor fit, cadence, and the promises a creator can keep. I recently handled ${recentProject}. My preferred format is ${workingStyle}; real numbers and audience context make the advice sharper. ${requestLine} ${modifier}`,

    'Remote Team Facilitator': ({
      intro,
      locationLine,
      recentProject,
      workingStyle,
      requestLine,
      modifier,
    }) =>
      `${intro} ${locationLine} I tend to look for the missing agreement: who decides, where decisions live, what needs a meeting, and what can be async. I recently handled ${recentProject}. My preferred format is ${workingStyle}; vague collaboration pain should become operating rules. ${requestLine} ${modifier}`,

    'Personal Finance Mentor': ({
      intro,
      locationLine,
      recentProject,
      workingStyle,
      requestLine,
      modifier,
    }) =>
      `${intro} ${locationLine} I keep money conversations calm, specific, and shame-free; the goal is a system someone will actually use next month. I recently handled ${recentProject}. My preferred format is ${workingStyle}; we compare choices against risk, cash flow, and family constraints. ${requestLine} ${modifier}`,

    'Climate Tech Advisor': ({
      intro,
      locationLine,
      recentProject,
      workingStyle,
      requestLine,
      modifier,
    }) =>
      `${intro} ${locationLine} I am useful when the climate ambition is real but the route to pilots, buyers, partners, or policy proof is still fuzzy. I recently handled ${recentProject}. My preferred format is ${workingStyle}; technical claims need to connect to market and deployment realities. ${requestLine} ${modifier}`,

    'Neurodivergent Work Coach': ({
      intro,
      locationLine,
      recentProject,
      workingStyle,
      requestLine,
      modifier,
    }) =>
      `${intro} ${locationLine} I design around energy, friction, memory, sensory load, and communication defaults instead of forcing people into generic productivity systems. I recently handled ${recentProject}. My preferred format is ${workingStyle}; we should produce scripts, rituals, and accountability loops. ${requestLine} ${modifier}`,

    'Developer Relations Lead': ({
      intro,
      locationLine,
      recentProject,
      workingStyle,
      requestLine,
      modifier,
    }) =>
      `${intro} ${locationLine} I look for the gap between what the product can do and what developers can understand, trust, and repeat. I recently handled ${recentProject}. My preferred format is ${workingStyle}; examples, docs, launch moments, and community feedback keep the work grounded. ${requestLine} ${modifier}`,

    'Healthspan Practitioner': ({
      intro,
      locationLine,
      recentProject,
      workingStyle,
      requestLine,
      modifier,
    }) =>
      `${intro} ${locationLine} My tone is steady and evidence-minded; I would rather build a boring routine that survives travel and stress than chase an extreme reset. I recently handled ${recentProject}. My preferred format is ${workingStyle}; clear baselines and one or two habit changes at a time are enough. ${requestLine} ${modifier}`,

    'Immigration Systems Consultant': ({
      intro,
      locationLine,
      recentProject,
      workingStyle,
      requestLine,
      modifier,
    }) =>
      `${intro} ${locationLine} I turn confusing paperwork into a sequence: eligibility, documents, deadlines, tax exposure, and backup routes. I recently handled ${recentProject}. My preferred format is ${workingStyle}; every assumption should be marked as confirmed, pending, or risky. ${requestLine} ${modifier}`,

    'Sales Systems Consultant': ({
      intro,
      locationLine,
      recentProject,
      workingStyle,
      requestLine,
      modifier,
    }) =>
      `${intro} ${locationLine} I am pipeline-minded: define the buyer, qualify the lead, tighten the next step, and keep the CRM honest enough to manage reality. I recently handled ${recentProject}. My preferred format is ${workingStyle}; the work should expose conversion leaks and create a repeatable sales motion. ${requestLine} ${modifier}`,

    'Education Technology Specialist': ({
      intro,
      locationLine,
      recentProject,
      workingStyle,
      requestLine,
      modifier,
    }) =>
      `${intro} ${locationLine} I start with learning outcomes, teacher workload, and evidence before the technology gets a vote. I recently handled ${recentProject}. My preferred format is ${workingStyle}; curriculum choices should be testable in real classrooms. ${requestLine} ${modifier}`,

    'Mindfulness Teacher': ({
      intro,
      locationLine,
      recentProject,
      workingStyle,
      requestLine,
      modifier,
    }) =>
      `${intro} ${locationLine} I work in a grounded, low-drama way: notice the nervous system, name the pressure, choose the next practice, and make it small enough to repeat. I recently handled ${recentProject}. My preferred format is ${workingStyle}; attention training needs to connect to daily behavior. ${requestLine} ${modifier}`,

    'Marketplace Growth Expert': ({
      intro,
      locationLine,
      recentProject,
      workingStyle,
      requestLine,
      modifier,
    }) =>
      `${intro} ${locationLine} I think in liquidity, trust, density, and incentives; if one side of the market is weak, I want to know which loop is broken. I recently handled ${recentProject}. My preferred format is ${workingStyle}; supply, demand, conversion, and safety data should be on the table. ${requestLine} ${modifier}`,

    'Community Builder': ({
      intro,
      locationLine,
      recentProject,
      workingStyle,
      requestLine,
      modifier,
    }) =>
      `${intro} ${locationLine} I pay attention to belonging, moderation, invitations, host energy, and the rituals that make participation feel worth returning to. I recently handled ${recentProject}. My preferred format is ${workingStyle}; community intention should become repeatable formats. ${requestLine} ${modifier}`,

    'Data Platform Engineer': ({
      intro,
      locationLine,
      recentProject,
      workingStyle,
      requestLine,
      modifier,
    }) =>
      `${intro} ${locationLine} I care about lineage, freshness, ownership, cost, and whether the dashboard can be trusted when a decision is on the line. I recently handled ${recentProject}. My preferred format is ${workingStyle}; we map sources, models, consumers, and failure points. ${requestLine} ${modifier}`,

    'Family Travel Planner': ({
      intro,
      locationLine,
      recentProject,
      workingStyle,
      requestLine,
      modifier,
    }) =>
      `${intro} ${locationLine} I plan for real family texture: tired children, work calls, visa dates, grocery runs, school rhythm, and the budget after the pretty itinerary. I recently handled ${recentProject}. My preferred format is ${workingStyle}; the dream route has to become a livable plan. ${requestLine} ${modifier}`,
  };

  const voice = voices[archetype.role];
  if (voice) return voice(context);

  return `${intro} ${locationLine} ${recentLine} ${requestLine} ${modifier}`;
}

function profileBlock(index) {
  const archetype = pick(archetypes, index, 7);
  const first = firstNames[index % firstNames.length];
  const last = lastNames[Math.floor(index / firstNames.length) % lastNames.length];
  const secondLast =
    lastNames[Math.floor(index / (firstNames.length * lastNames.length)) % lastNames.length];
  const location = pick(locations, index, 5);
  const modifier = pick(modifiers, index, 3);
  const specialty = humanizeTag(pick(archetype.tags, index, 2));
  const recentProject = pick(recentProjects, index, 5);
  const workingStyle = pick(workingStyles, index, 7);
  const audience = pick(audiences, index, 11);
  const networkCity = pick(locations, index + 3, 7);
  const secondNetworkCity = pick(locations, index + 5, 9);
  const name = `${first} ${last}-${secondLast}`;
  const orgSuffix = String((index % 97) + 1).padStart(2, '0');
  const organization = `${archetype.org} ${orgSuffix}/${String(index + 1).padStart(4, '0')}`;
  const tags = [
    ...new Set([
      ...archetype.tags,
      location.split(',')[0].toLowerCase().replace(/\s+/g, '-'),
      audience.toLowerCase().replace(/\s+/g, '-'),
    ]),
  ];

  return [
    `Name: ${name}`,
    `Role: ${archetype.role}`,
    `Organization: ${organization}`,
    `Location: ${location}`,
    `Tags: ${tags.join(', ')}`,
    '',
    buildFirstPersonBody({
      archetype,
      name,
      organization,
      location,
      specialty,
      recentProject,
      workingStyle,
      audience,
      networkCity,
      secondNetworkCity,
      modifier,
      index,
    }),
  ].join('\n');
}

async function main() {
  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  const content = Array.from({ length: PROFILE_COUNT }, (_, index) => profileBlock(index)).join(
    '\n---\n'
  );
  await fs.writeFile(OUTPUT_FILE, `${content}\n`, 'utf8');
  console.log(`Generated ${PROFILE_COUNT} Reach demo profiles at ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
