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
    body: 'builds applied AI workflows, evaluates LLM product quality, and helps teams turn rough automation ideas into reliable internal tools.',
  },
  {
    role: 'Cloud Security Architect',
    org: 'Northstar Security',
    tags: ['cloud-security', 'zero-trust', 'aws', 'incident-response', 'compliance'],
    body: 'advises companies on secure cloud architecture, incident readiness, identity boundaries, and pragmatic compliance programs.',
  },
  {
    role: 'Life Design Coach',
    org: 'Quiet Compass Studio',
    tags: ['life-design', 'habits', 'burnout', 'coaching', 'career-change'],
    body: 'helps founders and operators rebuild routines, recover from burnout, and make career decisions that match their values.',
  },
  {
    role: 'Expat Family Advisor',
    org: 'Landing Well Collective',
    tags: ['expat-family', 'relocation', 'schools', 'visa-planning', 'cross-cultural'],
    body: 'guides families through relocation decisions, school research, visa timelines, remote work logistics, and settling into a new country.',
  },
  {
    role: 'Solo Founder Operator',
    org: 'Tiny Durable Ventures',
    tags: ['solo-entrepreneur', 'bootstrapping', 'operations', 'pricing', 'micro-saas'],
    body: 'runs lean internet businesses and advises solo entrepreneurs on positioning, pricing, systems, and sustainable growth loops.',
  },
  {
    role: 'Creator Monetization Strategist',
    org: 'Studio North Media',
    tags: ['creator-economy', 'sponsorships', 'newsletter', 'youtube', 'audience'],
    body: 'helps creators package sponsorship inventory, improve audience trust, and build revenue beyond algorithm-dependent channels.',
  },
  {
    role: 'Remote Team Facilitator',
    org: 'Async Harbor',
    tags: ['remote-work', 'facilitation', 'async-ops', 'team-health', 'documentation'],
    body: 'works with distributed teams on meeting hygiene, async rituals, decision logs, and cross-time-zone collaboration patterns.',
  },
  {
    role: 'Personal Finance Mentor',
    org: 'Clear Ledger Life',
    tags: ['personal-finance', 'budgeting', 'investing-basics', 'family-finance', 'debt'],
    body: 'supports individuals and families with budgeting systems, debt payoff plans, investing basics, and calm financial decision-making.',
  },
  {
    role: 'Climate Tech Advisor',
    org: 'Carbon Current',
    tags: ['climate-tech', 'energy', 'carbon-accounting', 'hardware', 'policy'],
    body: 'connects climate founders with go-to-market strategy, carbon accounting basics, pilot customers, and hardware deployment partners.',
  },
  {
    role: 'Neurodivergent Work Coach',
    org: 'Better Focus Lab',
    tags: ['adhd', 'autism', 'workflows', 'executive-function', 'inclusive-work'],
    body: 'designs practical work systems for neurodivergent professionals, including planning rituals, low-friction accountability, and communication scripts.',
  },
  {
    role: 'Developer Relations Lead',
    org: 'API Field Notes',
    tags: ['developer-relations', 'apis', 'community', 'docs', 'events'],
    body: 'helps developer tool companies clarify messaging, improve docs, run useful technical events, and build credible community programs.',
  },
  {
    role: 'Healthspan Practitioner',
    org: 'Everyday Longevity',
    tags: ['healthspan', 'fitness', 'sleep', 'nutrition', 'behavior-change'],
    body: 'helps busy professionals improve sleep, strength, nutrition, and long-term health habits without extreme routines.',
  },
  {
    role: 'Immigration Systems Consultant',
    org: 'Nomad Paperwork',
    tags: ['immigration', 'digital-nomad', 'tax-residency', 'paperwork', 'relocation'],
    body: 'helps remote workers and entrepreneurs compare residency options, organize documents, and coordinate immigration timelines.',
  },
  {
    role: 'Sales Systems Consultant',
    org: 'Pipeline Mechanics',
    tags: ['sales-ops', 'crm', 'b2b-sales', 'lead-qualification', 'founder-sales'],
    body: 'designs practical sales pipelines, lead scoring, CRM hygiene, and founder-led sales routines for early B2B companies.',
  },
  {
    role: 'Education Technology Specialist',
    org: 'Learning Loop Works',
    tags: ['edtech', 'learning-design', 'schools', 'ai-tutoring', 'curriculum'],
    body: 'advises schools and startups on curriculum design, AI tutoring experiments, teacher workflows, and measurable learning outcomes.',
  },
  {
    role: 'Mindfulness Teacher',
    org: 'Steady Attention',
    tags: ['mindfulness', 'meditation', 'stress', 'leadership', 'emotional-regulation'],
    body: 'teaches practical mindfulness for teams and individuals, especially stress regulation, focused attention, and grounded leadership presence.',
  },
  {
    role: 'Marketplace Growth Expert',
    org: 'Two-Sided Growth',
    tags: ['marketplaces', 'growth', 'liquidity', 'trust-safety', 'supply-demand'],
    body: 'works with marketplaces on liquidity loops, trust mechanics, early supply acquisition, demand activation, and category expansion.',
  },
  {
    role: 'Community Builder',
    org: 'Gathering Stack',
    tags: ['community', 'membership', 'events', 'moderation', 'belonging'],
    body: 'builds high-trust communities, membership rituals, moderation systems, and event formats that make people come back.',
  },
  {
    role: 'Data Platform Engineer',
    org: 'Warehouse Guild',
    tags: ['data-engineering', 'analytics', 'warehousing', 'etl', 'governance'],
    body: 'helps teams build reliable data pipelines, analytics models, warehouse governance, and operational dashboards.',
  },
  {
    role: 'Family Travel Planner',
    org: 'Slow Route Families',
    tags: ['family-travel', 'worldschooling', 'remote-school', 'budget-travel', 'logistics'],
    body: 'plans long-stay family travel, worldschooling routes, kid-friendly logistics, budget tradeoffs, and remote work rhythms.',
  },
];

const modifiers = [
  'They are especially useful for requests that need a clear first step, realistic constraints, and an honest tradeoff discussion.',
  'They prefer specific requests with context, timing, budget, and the decision someone is trying to make.',
  'They often bridge technical, human, and operational concerns for people who need practical execution help.',
  'They can help evaluate options, identify hidden risks, and suggest a short path from idea to next action.',
  'They are a good match for focused advisory calls, lightweight audits, introductions, and structured planning sessions.',
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

function profileBlock(index) {
  const archetype = pick(archetypes, index, 7);
  const first = firstNames[index % firstNames.length];
  const last = lastNames[Math.floor(index / firstNames.length) % lastNames.length];
  const secondLast =
    lastNames[Math.floor(index / (firstNames.length * lastNames.length)) % lastNames.length];
  const location = pick(locations, index, 5);
  const modifier = pick(modifiers, index, 3);
  const specialty = pick(archetype.tags, index, 2);
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
    `${name} ${archetype.body} Their current focus is ${specialty}, especially for ${audience}. They are based in ${location}, work through ${organization}, and keep an active reference network across ${networkCity} and ${secondNetworkCity}. They recently handled ${recentProject} and prefer ${workingStyle}. They like requests that explain the audience, urgency, budget, constraints, and desired outcome. ${modifier}`,
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
