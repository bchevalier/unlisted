#!/usr/bin/env tsx

import fs from 'node:fs/promises';
import path from 'node:path';
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

type BenchmarkDataset = {
  name: string;
  docs: BenchmarkDoc[];
  queries: BenchmarkQuery[];
};

type RankedResult = {
  docId: string;
  score: number;
};

type ModelEvaluation = {
  model: string;
  recallAt1: number;
  recallAtK: number;
  mrr: number;
  meanNdcgAtK: number;
  tokenUsage: number;
  estimatedCostUsd: number;
};

const PRICE_PER_MILLION_INPUT_TOKENS_USD: Record<string, number> = {
  'text-embedding-3-small': 0.02,
  'text-embedding-3-large': 0.13,
  'text-embedding-ada-002': 0.1,
};

const SYNTHETIC_DOCS: BenchmarkDoc[] = [
  { id: 'direct_inbox', text: 'Knokio Direct request inbox supports pending accepted declined and expired states with pagination.' },
  { id: 'email_completion', text: 'Inbound email requests with required fields trigger one-time completion links for structured data completion.' },
  { id: 'door_plan_paid', text: 'Direct door plans include FREE and PAID. Paid plans remove weekly volume caps for inbound reach.' },
  { id: 'stripe_billing', text: 'Stripe checkout and webhook flows synchronize subscription status and billing portal access in settings.' },
  { id: 'admin_tools', text: 'Admin tools include authentication, user management, abuse report review, and request event inspection.' },
  { id: 'reach_policies', text: 'Reach policy engine evaluates required tags, exclude tags, purpose keywords, and initiator types with trace diagnostics.' },
  { id: 'reach_webhooks', text: 'Reach supports per-actor multi-webhook fan-out, retry, health stats, and HMAC-signed delivery.' },
  { id: 'reach_safety', text: 'Reach safety includes actor blocklists, abuse reporting, pair cooldowns, and IP-level rate limiting.' },
  { id: 'reach_metrics', text: 'Reach pilot metrics include one-hop success, time-to-counterparty, path length, funnel conversion, and SLA compliance.' },
  { id: 'launch_docs', text: 'Launch readiness package contains onboarding copy, FAQ, privacy, terms, E2E checklist, and production enablement.' },
  { id: 'incident_response', text: 'Incident response playbook defines severity levels, mitigation runbooks, and post-mortem process.' },
  { id: 'observability', text: 'Structured logging, metrics instrumentation, and provider-agnostic error tracking support production observability.' },
  { id: 'embedding_strategy', text: 'Embedding strategy uses low-cost stage-one retrieval with optional rerank and provider failover.' },
  { id: 'reach_pilot_ops', text: 'Reach pilot operations include onboarding runbooks, operator handoff checklist, rollback plan, and external dependency matrix.' },
  { id: 'door_slug', text: 'Door slug generation includes reserved keyword protection and randomized collision suffixes to avoid enumeration.' },
];

const SYNTHETIC_QUERIES: BenchmarkQuery[] = [
  { id: 'q1', text: 'How are required-field email requests completed?', relevantDocIds: ['email_completion'] },
  { id: 'q2', text: 'Where is Stripe subscription syncing implemented?', relevantDocIds: ['stripe_billing'] },
  { id: 'q3', text: 'What hardening exists for Reach abuse and spam?', relevantDocIds: ['reach_safety'] },
  { id: 'q4', text: 'Which docs define launch readiness and production enablement?', relevantDocIds: ['launch_docs'] },
  { id: 'q5', text: 'What are Reach webhook reliability features?', relevantDocIds: ['reach_webhooks'] },
  { id: 'q6', text: 'Which metrics are used to evaluate Reach pilot performance?', relevantDocIds: ['reach_metrics'] },
  { id: 'q7', text: 'How does Knokio avoid predictable door slug enumeration?', relevantDocIds: ['door_slug'] },
  { id: 'q8', text: 'Which documents and scripts are used for pilot operator onboarding and rollback?', relevantDocIds: ['reach_pilot_ops'] },
];

const DEFAULT_REPO_ROOTS = ['docs', 'README.md', 'ROADMAP.md', 'features'];

const FILE_EXT_ALLOWLIST = new Set(['.md', '.txt', '.ts', '.tsx']);
const DIR_BLOCKLIST = new Set(['node_modules', '.next', '.git']);

function parseArgs() {
  const args = process.argv.slice(2);

  const getValue = (flag: string): string | undefined => {
    const index = args.findIndex((arg) => arg === flag);
    if (index === -1) return undefined;
    return args[index + 1];
  };

  const modelsArg = getValue('--models') ?? 'text-embedding-3-small,text-embedding-3-large';

  return {
    models: modelsArg.split(',').map((m) => m.trim()).filter(Boolean),
    maxEstimatedTokens: Number(getValue('--max-estimated-tokens') ?? 8000),
    topK: Number(getValue('--topk') ?? 3),
    json: args.includes('--json'),
    dataset: getValue('--dataset') ?? 'repo', // synthetic|repo
    repoRoots: (getValue('--repo-roots') ?? DEFAULT_REPO_ROOTS.join(','))
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    maxDocs: Number(getValue('--max-docs') ?? 24),
    maxQueries: Number(getValue('--max-queries') ?? 16),
    maxCharsPerDoc: Number(getValue('--max-chars-per-doc') ?? 900),
    includeDbRequests: args.includes('--include-db-requests'),
    maxDbRequests: Number(getValue('--max-db-requests') ?? 8),
    maxCharsPerRequest: Number(getValue('--max-chars-per-request') ?? 700),
  };
}

function estimateTokensFromChars(chars: number): number {
  return Math.ceil(chars / 4);
}

function normalizeText(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function makeRepoQuery(relPath: string, title: string): string {
  return `Where is ${title} defined and how should it be used in Knokio? (source: ${relPath})`;
}

function toTitle(relPath: string, content: string): string {
  const heading = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('#'));

  if (heading) {
    return heading.replace(/^#+\s*/, '').trim();
  }

  const base = path.basename(relPath, path.extname(relPath));
  return base.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function walkFiles(root: string): Promise<string[]> {
  const stat = await fs.stat(root).catch(() => null);
  if (!stat) return [];

  if (stat.isFile()) return [root];
  if (!stat.isDirectory()) return [];

  const out: string[] = [];
  const entries = await fs.readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (DIR_BLOCKLIST.has(entry.name)) continue;
    if (entry.name === 'migrations' && root.endsWith(path.join('prisma'))) continue;

    const child = path.join(root, entry.name);
    if (entry.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop
      const nested = await walkFiles(child);
      out.push(...nested);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!FILE_EXT_ALLOWLIST.has(path.extname(entry.name))) continue;

    out.push(child);
  }

  return out;
}

async function buildRepoDataset(options: {
  repoRoots: string[];
  maxDocs: number;
  maxQueries: number;
  maxCharsPerDoc: number;
}): Promise<BenchmarkDataset> {
  const files = new Set<string>();

  for (const root of options.repoRoots) {
    // eslint-disable-next-line no-await-in-loop
    const walked = await walkFiles(root);
    walked.forEach((file) => files.add(file));
  }

  const docs: BenchmarkDoc[] = [];
  const queries: BenchmarkQuery[] = [];

  for (const file of [...files].sort()) {
    if (docs.length >= options.maxDocs) break;

    // eslint-disable-next-line no-await-in-loop
    const raw = await fs.readFile(file, 'utf8').catch(() => '');
    const normalized = normalizeText(raw);
    if (!normalized) continue;

    const relPath = path.relative(process.cwd(), file);
    const title = toTitle(relPath, raw);
    const textBody = normalized.slice(0, options.maxCharsPerDoc);

    const docId = `repo:${relPath}`;
    docs.push({
      id: docId,
      text: `${title}. ${textBody}`,
    });

    if (queries.length < options.maxQueries) {
      queries.push({
        id: `q:${docId}`,
        text: makeRepoQuery(relPath, title),
        relevantDocIds: [docId],
      });
    }
  }

  return {
    name: 'repo',
    docs,
    queries,
  };
}

async function appendDbRequestDocs(
  dataset: BenchmarkDataset,
  options: { maxDbRequests: number; maxCharsPerRequest: number; maxQueries: number },
): Promise<BenchmarkDataset> {
  if (!process.env.DATABASE_URL?.trim()) return dataset;

  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const rows = await prisma.request.findMany({
      orderBy: { createdAt: 'desc' },
      take: options.maxDbRequests,
      select: {
        id: true,
        title: true,
        message: true,
      },
    });

    await prisma.$disconnect();

    for (const row of rows) {
      const title = normalizeText(row.title ?? 'request');
      const message = normalizeText(row.message ?? '');
      const text = `${title}. ${message}`.slice(0, options.maxCharsPerRequest);

      if (!text) continue;

      const docId = `request:${row.id}`;
      dataset.docs.push({ id: docId, text });

      if (dataset.queries.length < options.maxQueries) {
        dataset.queries.push({
          id: `q:${docId}`,
          text: `How should we process request "${title}"?`,
          relevantDocIds: [docId],
        });
      }
    }
  } catch {
    // DB requests are optional; ignore when schema/connection isn't available.
  }

  return dataset;
}

function fitDatasetToBudget(
  dataset: BenchmarkDataset,
  modelCount: number,
  maxEstimatedTokens: number,
): { dataset: BenchmarkDataset; estimatedTokensPerModel: number; estimatedTokensTotal: number } {
  const docs = [...dataset.docs];
  const queries = [...dataset.queries];

  const estimatePerModel = () =>
    estimateTokensFromChars(
      [...docs.map((d) => d.text), ...queries.map((q) => q.text)].join('').length,
    );

  let estimatedPerModel = estimatePerModel();
  let estimatedTotal = estimatedPerModel * modelCount;

  while (estimatedTotal > maxEstimatedTokens && docs.length > 3) {
    const removed = docs.pop();
    if (removed) {
      for (let i = queries.length - 1; i >= 0; i -= 1) {
        if (queries[i]?.relevantDocIds.includes(removed.id)) {
          queries.splice(i, 1);
        }
      }
    }

    estimatedPerModel = estimatePerModel();
    estimatedTotal = estimatedPerModel * modelCount;
  }

  if (estimatedTotal > maxEstimatedTokens) {
    throw new Error(
      `Unable to fit dataset into token budget. Current estimate ${estimatedTotal} > ${maxEstimatedTokens}.`,
    );
  }

  if (queries.length === 0 || docs.length === 0) {
    throw new Error('Dataset underflow after budget fit — increase max tokens or max docs.');
  }

  return {
    dataset: {
      name: dataset.name,
      docs,
      queries,
    },
    estimatedTokensPerModel: estimatedPerModel,
    estimatedTokensTotal: estimatedTotal,
  };
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
    .map((doc) => ({ docId: doc.id, score: cosineSimilarity(queryEmbedding, doc.embedding) }))
    .sort((a, b) => b.score - a.score);
}

function recallAtK(ranked: RankedResult[], relevantDocIds: string[], k: number): number {
  const top = ranked.slice(0, k).map((r) => r.docId);
  return relevantDocIds.some((docId) => top.includes(docId)) ? 1 : 0;
}

function reciprocalRank(ranked: RankedResult[], relevantDocIds: string[]): number {
  for (let i = 0; i < ranked.length; i += 1) {
    if (relevantDocIds.includes(ranked[i]?.docId ?? '')) return 1 / (i + 1);
  }
  return 0;
}

function dcgAtK(ranked: RankedResult[], relevantDocIds: string[], k: number): number {
  let dcg = 0;
  for (let i = 0; i < Math.min(k, ranked.length); i += 1) {
    const rel = relevantDocIds.includes(ranked[i]?.docId ?? '') ? 1 : 0;
    if (rel > 0) dcg += rel / Math.log2(i + 2);
  }
  return dcg;
}

function ndcgAtK(ranked: RankedResult[], relevantDocIds: string[], k: number): number {
  const dcg = dcgAtK(ranked, relevantDocIds, k);
  const ideal = relevantDocIds.map((id) => ({ docId: id, score: 1 }));
  const idcg = dcgAtK(ideal, relevantDocIds, k);
  if (idcg === 0) return 0;
  return dcg / idcg;
}

async function embedTexts(model: string, texts: string[]) {
  const result = await generateEmbeddings(
    { input: texts, model },
    { providerOrder: ['openai'] },
  );

  if (result.provider !== 'openai') {
    throw new Error(`Expected openai provider, got ${result.provider}`);
  }

  const usageTokens = result.usage?.inputTokens ?? result.usage?.totalTokens ?? 0;
  return { vectors: result.data.map((d) => d.embedding), usageTokens };
}

async function evaluateModel(model: string, topK: number, dataset: BenchmarkDataset): Promise<ModelEvaluation> {
  const docsEmbedded = await embedTexts(model, dataset.docs.map((d) => d.text));
  const queriesEmbedded = await embedTexts(model, dataset.queries.map((q) => q.text));

  const docs = dataset.docs.map((doc, index) => ({
    id: doc.id,
    embedding: docsEmbedded.vectors[index] ?? [],
  }));

  let recall1 = 0;
  let recallK = 0;
  let mrr = 0;
  let ndcgK = 0;

  dataset.queries.forEach((query, index) => {
    const queryEmbedding = queriesEmbedded.vectors[index] ?? [];
    const ranked = rankDocs(queryEmbedding, docs);

    recall1 += recallAtK(ranked, query.relevantDocIds, 1);
    recallK += recallAtK(ranked, query.relevantDocIds, topK);
    mrr += reciprocalRank(ranked, query.relevantDocIds);
    ndcgK += ndcgAtK(ranked, query.relevantDocIds, topK);
  });

  const queryCount = dataset.queries.length;
  const tokenUsage = docsEmbedded.usageTokens + queriesEmbedded.usageTokens;
  const pricePerMillion = PRICE_PER_MILLION_INPUT_TOKENS_USD[model] ?? 0;

  return {
    model,
    recallAt1: recall1 / queryCount,
    recallAtK: recallK / queryCount,
    mrr: mrr / queryCount,
    meanNdcgAtK: ndcgK / queryCount,
    tokenUsage,
    estimatedCostUsd: (tokenUsage / 1_000_000) * pricePerMillion,
  };
}

async function loadDataset(options: {
  dataset: string;
  repoRoots: string[];
  maxDocs: number;
  maxQueries: number;
  maxCharsPerDoc: number;
  includeDbRequests: boolean;
  maxDbRequests: number;
  maxCharsPerRequest: number;
}): Promise<BenchmarkDataset> {
  if (options.dataset === 'synthetic') {
    return {
      name: 'synthetic',
      docs: [...SYNTHETIC_DOCS],
      queries: [...SYNTHETIC_QUERIES],
    };
  }

  if (options.dataset !== 'repo') {
    throw new Error(`Unsupported dataset '${options.dataset}'. Use synthetic or repo.`);
  }

  let dataset = await buildRepoDataset({
    repoRoots: options.repoRoots,
    maxDocs: options.maxDocs,
    maxQueries: options.maxQueries,
    maxCharsPerDoc: options.maxCharsPerDoc,
  });

  if (options.includeDbRequests) {
    dataset = await appendDbRequestDocs(dataset, {
      maxDbRequests: options.maxDbRequests,
      maxCharsPerRequest: options.maxCharsPerRequest,
      maxQueries: options.maxQueries,
    });
  }

  return dataset;
}

async function main() {
  const args = parseArgs();

  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error('OPENAI_API_KEY is required for live embedding evaluation');
  }

  const loaded = await loadDataset({
    dataset: args.dataset,
    repoRoots: args.repoRoots,
    maxDocs: args.maxDocs,
    maxQueries: args.maxQueries,
    maxCharsPerDoc: args.maxCharsPerDoc,
    includeDbRequests: args.includeDbRequests,
    maxDbRequests: args.maxDbRequests,
    maxCharsPerRequest: args.maxCharsPerRequest,
  });

  const budgeted = fitDatasetToBudget(loaded, args.models.length, args.maxEstimatedTokens);
  const dataset = budgeted.dataset;

  const evaluations: ModelEvaluation[] = [];
  for (const model of args.models) {
    // Keep serial for deterministic, low-spend behavior.
    // eslint-disable-next-line no-await-in-loop
    evaluations.push(await evaluateModel(model, args.topK, dataset));
  }

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          dataset: dataset.name,
          docs: dataset.docs.length,
          queries: dataset.queries.length,
          estimatedTokensPerModel: budgeted.estimatedTokensPerModel,
          estimatedTokensTotal: budgeted.estimatedTokensTotal,
          results: evaluations,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log('\nEmbedding model A/B evaluation');
  console.log(`Dataset: ${dataset.name}`);
  console.log(`Docs: ${dataset.docs.length}, Queries: ${dataset.queries.length}`);
  console.log(
    `Estimated token cap check: ${budgeted.estimatedTokensTotal}/${args.maxEstimatedTokens} ` +
      `(per model ${budgeted.estimatedTokensPerModel})`,
  );

  for (const item of evaluations) {
    console.log(`\nModel: ${item.model}`);
    console.log(`  Recall@1:   ${(item.recallAt1 * 100).toFixed(1)}%`);
    console.log(`  Recall@${args.topK}:   ${(item.recallAtK * 100).toFixed(1)}%`);
    console.log(`  MRR:        ${item.mrr.toFixed(3)}`);
    console.log(`  nDCG@${args.topK}:    ${item.meanNdcgAtK.toFixed(3)}`);
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
