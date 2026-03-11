#!/usr/bin/env tsx

import { generateEmbeddings } from '../lib/reach/embeddings';

type BenchmarkDoc = {
  id: string;
  text: string;
};

type BenchmarkQuery = {
  id: string;
  text: string;
  relevantDocIds: string[];
};

type RankedResult = {
  docId: string;
  score: number;
};

type ModelEvaluation = {
  model: string;
  recallAt1: number;
  recallAt3: number;
  mrr: number;
  meanNdcgAt3: number;
  tokenUsage: number;
  estimatedCostUsd: number;
};

const PRICE_PER_MILLION_INPUT_TOKENS_USD: Record<string, number> = {
  'text-embedding-3-small': 0.02,
  'text-embedding-3-large': 0.13,
  'text-embedding-ada-002': 0.1,
};

const BENCHMARK_DOCS: BenchmarkDoc[] = [
  {
    id: 'direct_inbox',
    text: 'Knokio Direct request inbox supports pending accepted declined and expired states with pagination.',
  },
  {
    id: 'email_completion',
    text: 'Inbound email requests with required fields trigger one-time completion links for structured data completion.',
  },
  {
    id: 'door_plan_paid',
    text: 'Direct door plans include FREE and PAID. Paid plans remove weekly volume caps for inbound reach.',
  },
  {
    id: 'stripe_billing',
    text: 'Stripe checkout and webhook flows synchronize subscription status and billing portal access in settings.',
  },
  {
    id: 'admin_tools',
    text: 'Admin tools include authentication, user management, abuse report review, and request event inspection.',
  },
  {
    id: 'reach_policies',
    text: 'Reach policy engine evaluates required tags, exclude tags, purpose keywords, and initiator types with trace diagnostics.',
  },
  {
    id: 'reach_webhooks',
    text: 'Reach supports per-actor multi-webhook fan-out, retry, health stats, and HMAC-signed delivery.',
  },
  {
    id: 'reach_safety',
    text: 'Reach safety includes actor blocklists, abuse reporting, pair cooldowns, and IP-level rate limiting.',
  },
  {
    id: 'reach_metrics',
    text: 'Reach pilot metrics include one-hop success, time-to-counterparty, path length, funnel conversion, and SLA compliance.',
  },
  {
    id: 'launch_docs',
    text: 'Launch readiness package contains onboarding copy, FAQ, privacy, terms, E2E checklist, and production enablement.',
  },
  {
    id: 'incident_response',
    text: 'Incident response playbook defines severity levels, mitigation runbooks, and post-mortem process.',
  },
  {
    id: 'observability',
    text: 'Structured logging, metrics instrumentation, and provider-agnostic error tracking support production observability.',
  },
  {
    id: 'embedding_strategy',
    text: 'Embedding strategy uses low-cost stage-one retrieval with optional rerank and provider failover.',
  },
  {
    id: 'reach_pilot_ops',
    text: 'Reach pilot operations include onboarding runbooks, operator handoff checklist, rollback plan, and external dependency matrix.',
  },
  {
    id: 'door_slug',
    text: 'Door slug generation includes reserved keyword protection and randomized collision suffixes to avoid enumeration.',
  },
];

const BENCHMARK_QUERIES: BenchmarkQuery[] = [
  {
    id: 'q1',
    text: 'How are required-field email requests completed?',
    relevantDocIds: ['email_completion'],
  },
  {
    id: 'q2',
    text: 'Where is Stripe subscription syncing implemented?',
    relevantDocIds: ['stripe_billing'],
  },
  {
    id: 'q3',
    text: 'What hardening exists for Reach abuse and spam?',
    relevantDocIds: ['reach_safety'],
  },
  {
    id: 'q4',
    text: 'Which docs define launch readiness and production enablement?',
    relevantDocIds: ['launch_docs'],
  },
  {
    id: 'q5',
    text: 'What are Reach webhook reliability features?',
    relevantDocIds: ['reach_webhooks'],
  },
  {
    id: 'q6',
    text: 'Which metrics are used to evaluate Reach pilot performance?',
    relevantDocIds: ['reach_metrics'],
  },
  {
    id: 'q7',
    text: 'How does Knokio avoid predictable door slug enumeration?',
    relevantDocIds: ['door_slug'],
  },
  {
    id: 'q8',
    text: 'Which documents and scripts are used for pilot operator onboarding and rollback?',
    relevantDocIds: ['reach_pilot_ops'],
  },
];

function parseArgs() {
  const args = process.argv.slice(2);

  const getValue = (flag: string): string | undefined => {
    const index = args.findIndex((arg) => arg === flag);
    if (index === -1) return undefined;
    return args[index + 1];
  };

  const modelsArg = getValue('--models') ?? 'text-embedding-3-small,text-embedding-3-large';
  const maxEstimatedTokens = Number(getValue('--max-estimated-tokens') ?? 6000);
  const topK = Number(getValue('--topk') ?? 3);
  const json = args.includes('--json');

  return {
    models: modelsArg.split(',').map((m) => m.trim()).filter(Boolean),
    maxEstimatedTokens,
    topK,
    json,
  };
}

function estimateTokensFromChars(chars: number): number {
  return Math.ceil(chars / 4);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function rankDocs(queryEmbedding: number[], docs: Array<{ id: string; embedding: number[] }>): RankedResult[] {
  return docs
    .map((doc) => ({
      docId: doc.id,
      score: cosineSimilarity(queryEmbedding, doc.embedding),
    }))
    .sort((a, b) => b.score - a.score);
}

function recallAtK(ranked: RankedResult[], relevantDocIds: string[], k: number): number {
  const top = ranked.slice(0, k).map((r) => r.docId);
  return relevantDocIds.some((docId) => top.includes(docId)) ? 1 : 0;
}

function reciprocalRank(ranked: RankedResult[], relevantDocIds: string[]): number {
  for (let i = 0; i < ranked.length; i += 1) {
    if (relevantDocIds.includes(ranked[i]?.docId ?? '')) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

function dcgAtK(ranked: RankedResult[], relevantDocIds: string[], k: number): number {
  let dcg = 0;
  for (let i = 0; i < Math.min(k, ranked.length); i += 1) {
    const rel = relevantDocIds.includes(ranked[i]?.docId ?? '') ? 1 : 0;
    if (rel > 0) {
      dcg += rel / Math.log2(i + 2);
    }
  }
  return dcg;
}

function ndcgAtK(ranked: RankedResult[], relevantDocIds: string[], k: number): number {
  const dcg = dcgAtK(ranked, relevantDocIds, k);
  const idealList = relevantDocIds.map((id) => ({ docId: id, score: 1 }));
  const idcg = dcgAtK(idealList, relevantDocIds, k);
  if (idcg === 0) return 0;
  return dcg / idcg;
}

async function embedTexts(model: string, texts: string[]) {
  const result = await generateEmbeddings(
    {
      input: texts,
      model,
    },
    { providerOrder: ['openai'] },
  );

  if (result.provider !== 'openai') {
    throw new Error(`Expected openai provider, got ${result.provider}`);
  }

  const usageTokens = result.usage?.inputTokens ?? result.usage?.totalTokens ?? 0;
  return { vectors: result.data.map((d) => d.embedding), usageTokens };
}

async function evaluateModel(model: string, topK: number): Promise<ModelEvaluation> {
  const docsText = BENCHMARK_DOCS.map((d) => d.text);
  const queriesText = BENCHMARK_QUERIES.map((q) => q.text);

  const docsEmbedded = await embedTexts(model, docsText);
  const queriesEmbedded = await embedTexts(model, queriesText);

  const docs = BENCHMARK_DOCS.map((doc, index) => ({
    id: doc.id,
    embedding: docsEmbedded.vectors[index] ?? [],
  }));

  let recall1 = 0;
  let recall3 = 0;
  let mrr = 0;
  let ndcg3 = 0;

  BENCHMARK_QUERIES.forEach((query, index) => {
    const queryEmbedding = queriesEmbedded.vectors[index] ?? [];
    const ranked = rankDocs(queryEmbedding, docs);

    recall1 += recallAtK(ranked, query.relevantDocIds, 1);
    recall3 += recallAtK(ranked, query.relevantDocIds, topK);
    mrr += reciprocalRank(ranked, query.relevantDocIds);
    ndcg3 += ndcgAtK(ranked, query.relevantDocIds, topK);
  });

  const queryCount = BENCHMARK_QUERIES.length;
  const tokenUsage = docsEmbedded.usageTokens + queriesEmbedded.usageTokens;
  const pricePerMillion = PRICE_PER_MILLION_INPUT_TOKENS_USD[model] ?? 0;

  return {
    model,
    recallAt1: recall1 / queryCount,
    recallAt3: recall3 / queryCount,
    mrr: mrr / queryCount,
    meanNdcgAt3: ndcg3 / queryCount,
    tokenUsage,
    estimatedCostUsd: (tokenUsage / 1_000_000) * pricePerMillion,
  };
}

async function main() {
  const { models, maxEstimatedTokens, topK, json } = parseArgs();

  const totalChars = [...BENCHMARK_DOCS.map((d) => d.text), ...BENCHMARK_QUERIES.map((q) => q.text)]
    .join('')
    .length;
  const estimatedTokensPerModel = estimateTokensFromChars(totalChars);
  const estimatedTokensTotal = estimatedTokensPerModel * models.length;

  if (estimatedTokensTotal > maxEstimatedTokens) {
    throw new Error(
      `Estimated token usage ${estimatedTokensTotal} exceeds cap ${maxEstimatedTokens}. ` +
        'Use --max-estimated-tokens <n> to override.',
    );
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error('OPENAI_API_KEY is required for live embedding evaluation');
  }

  const evaluations: ModelEvaluation[] = [];

  for (const model of models) {
    // Keep it serial to preserve predictable token/cost behavior.
    // eslint-disable-next-line no-await-in-loop
    const result = await evaluateModel(model, topK);
    evaluations.push(result);
  }

  if (json) {
    console.log(
      JSON.stringify(
        {
          benchmarkDocs: BENCHMARK_DOCS.length,
          benchmarkQueries: BENCHMARK_QUERIES.length,
          estimatedTokensPerModel,
          estimatedTokensTotal,
          results: evaluations,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log('\nEmbedding model A/B evaluation');
  console.log(`Docs: ${BENCHMARK_DOCS.length}, Queries: ${BENCHMARK_QUERIES.length}`);
  console.log(`Estimated token cap check: ${estimatedTokensTotal}/${maxEstimatedTokens}`);

  for (const item of evaluations) {
    console.log(`\nModel: ${item.model}`);
    console.log(`  Recall@1:   ${(item.recallAt1 * 100).toFixed(1)}%`);
    console.log(`  Recall@${topK}:   ${(item.recallAt3 * 100).toFixed(1)}%`);
    console.log(`  MRR:        ${item.mrr.toFixed(3)}`);
    console.log(`  nDCG@${topK}:    ${item.meanNdcgAt3.toFixed(3)}`);
    console.log(`  Tokens used: ${item.tokenUsage}`);
    console.log(`  Est. cost:   $${item.estimatedCostUsd.toFixed(6)}`);
  }

  const totalCost = evaluations.reduce((sum, item) => sum + item.estimatedCostUsd, 0);
  console.log(`\nTotal estimated spend: $${totalCost.toFixed(6)}`);
}

main().catch((error) => {
  console.error('\nEmbedding eval failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
