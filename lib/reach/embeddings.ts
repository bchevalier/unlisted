import { z } from 'zod';

export const EMBEDDING_PROVIDER_NAMES = ['openai', 'voyage', 'google'] as const;

export type EmbeddingProviderName = (typeof EMBEDDING_PROVIDER_NAMES)[number];

const DEFAULT_PROVIDER_ORDER: EmbeddingProviderName[] = ['openai', 'voyage', 'google'];
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_INPUT_ITEMS = 128;

const EmbeddingRequestSchema = z.object({
  input: z.union([
    z
      .string()
      .trim()
      .min(1, 'input must not be empty'),
    z
      .array(z.string().trim().min(1, 'input items must not be empty'))
      .min(1, 'input must contain at least one item')
      .max(MAX_INPUT_ITEMS, `input supports at most ${MAX_INPUT_ITEMS} items`),
  ]),
  model: z.string().trim().min(1).optional(),
  dimensions: z.number().int().positive().max(3072).optional(),
  timeoutMs: z.number().int().positive().max(60_000).optional(),
});

const OpenAIResponseSchema = z.object({
  model: z.string(),
  data: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      embedding: z.array(z.number()),
    }),
  ),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
    })
    .optional(),
});

const VoyageResponseSchema = z.object({
  model: z.string().optional(),
  data: z.array(
    z.object({
      index: z.number().int().nonnegative().optional(),
      embedding: z.array(z.number()),
    }),
  ),
  usage: z
    .object({
      total_tokens: z.number().optional(),
    })
    .optional(),
});

const GoogleResponseSchema = z.object({
  embeddings: z.array(
    z.object({
      values: z.array(z.number()),
    }),
  ),
});

export type EmbeddingRequestInput = z.input<typeof EmbeddingRequestSchema>;

export interface EmbeddingRecord {
  index: number;
  embedding: number[];
}

export interface EmbeddingUsage {
  inputTokens?: number;
  totalTokens?: number;
}

export interface EmbeddingProviderFailure {
  provider: EmbeddingProviderName;
  code: string;
  message: string;
  status?: number;
}

export interface EmbeddingResult {
  provider: EmbeddingProviderName;
  model: string;
  dimensions: number;
  data: EmbeddingRecord[];
  usage?: EmbeddingUsage;
  fallbackUsed: boolean;
  attemptedProviders: EmbeddingProviderName[];
}

interface NormalizedEmbeddingRequest {
  input: string[];
  model?: string;
  dimensions?: number;
  timeoutMs: number;
}

interface ProviderEmbedResult {
  provider: EmbeddingProviderName;
  model: string;
  data: EmbeddingRecord[];
  usage?: EmbeddingUsage;
}

interface EmbeddingProviderClient {
  name: EmbeddingProviderName;
  configured: () => boolean;
  embed: (request: NormalizedEmbeddingRequest) => Promise<ProviderEmbedResult>;
}

export class EmbeddingError extends Error {
  code: string;
  provider?: EmbeddingProviderName;
  status?: number;
  failures?: EmbeddingProviderFailure[];

  constructor(
    message: string,
    code = 'EMBEDDING_ERROR',
    options?: {
      provider?: EmbeddingProviderName;
      status?: number;
      failures?: EmbeddingProviderFailure[];
      cause?: unknown;
    },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = 'EmbeddingError';
    this.code = code;
    this.provider = options?.provider;
    this.status = options?.status;
    this.failures = options?.failures;
  }
}

function normalizeRequest(input: EmbeddingRequestInput): NormalizedEmbeddingRequest {
  const parsed = EmbeddingRequestSchema.parse(input);
  const items = Array.isArray(parsed.input) ? parsed.input : [parsed.input];

  return {
    input: items,
    model: parsed.model,
    dimensions: parsed.dimensions,
    timeoutMs: parsed.timeoutMs ?? Number(process.env.EMBEDDING_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  };
}

function parseProviderOrder(rawOrder?: string): EmbeddingProviderName[] {
  const raw = (rawOrder ?? process.env.EMBEDDING_PROVIDER_ORDER ?? '').trim();
  if (!raw) return [...DEFAULT_PROVIDER_ORDER];

  const parsed = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .filter((item): item is EmbeddingProviderName =>
      EMBEDDING_PROVIDER_NAMES.includes(item as EmbeddingProviderName),
    );

  return parsed.length > 0 ? parsed : [...DEFAULT_PROVIDER_ORDER];
}

function providerHttpError(provider: EmbeddingProviderName, status: number, payload: unknown) {
  const message = extractHttpErrorMessage(payload) ?? `${provider} embeddings request failed (${status})`;
  return new EmbeddingError(message, 'EMBEDDING_PROVIDER_HTTP_ERROR', {
    provider,
    status,
  });
}

function extractHttpErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;

  const asRecord = payload as Record<string, unknown>;

  const directMessage = asRecord.message;
  if (typeof directMessage === 'string' && directMessage.trim()) {
    return directMessage.trim();
  }

  const error = asRecord.error;
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  if (error && typeof error === 'object') {
    const nested = (error as Record<string, unknown>).message;
    if (typeof nested === 'string' && nested.trim()) {
      return nested.trim();
    }
  }

  return undefined;
}

async function fetchJson(
  provider: EmbeddingProviderName,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = text ? safeJsonParse(text) : {};

    if (!response.ok) {
      throw providerHttpError(provider, response.status, payload);
    }

    return payload;
  } catch (error) {
    if (error instanceof EmbeddingError) throw error;

    if (error instanceof Error && error.name === 'AbortError') {
      throw new EmbeddingError(`${provider} embeddings request timed out`, 'EMBEDDING_PROVIDER_TIMEOUT', {
        provider,
      });
    }

    throw new EmbeddingError(
      `${provider} embeddings request failed: ${error instanceof Error ? error.message : String(error)}`,
      'EMBEDDING_PROVIDER_REQUEST_FAILED',
      { provider, cause: error },
    );
  } finally {
    clearTimeout(timeout);
  }
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return { raw: value };
  }
}

function inferDimensions(data: EmbeddingRecord[]): number {
  if (data.length === 0) {
    throw new EmbeddingError('Embedding provider returned empty vectors', 'EMBEDDING_EMPTY_RESPONSE');
  }

  return data[0]?.embedding.length ?? 0;
}

function openAiClient(): EmbeddingProviderClient {
  return {
    name: 'openai',
    configured: () => Boolean(process.env.OPENAI_API_KEY?.trim()),
    embed: async (request) => {
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) {
        throw new EmbeddingError('OPENAI_API_KEY is not configured', 'EMBEDDING_PROVIDER_NOT_CONFIGURED', {
          provider: 'openai',
        });
      }

      const baseUrl = (process.env.EMBEDDINGS_OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
      const model = request.model ?? process.env.EMBEDDINGS_OPENAI_MODEL ?? 'text-embedding-3-small';

      const body: Record<string, unknown> = {
        model,
        input: request.input,
      };

      if (request.dimensions) {
        body.dimensions = request.dimensions;
      }

      const payload = await fetchJson(
        'openai',
        `${baseUrl}/embeddings`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
        request.timeoutMs,
      );

      let parsed: z.infer<typeof OpenAIResponseSchema>;
      try {
        parsed = OpenAIResponseSchema.parse(payload);
      } catch (error) {
        throw new EmbeddingError('Invalid OpenAI embeddings response shape', 'EMBEDDING_PROVIDER_BAD_RESPONSE', {
          provider: 'openai',
          cause: error,
        });
      }

      return {
        provider: 'openai',
        model: parsed.model,
        data: parsed.data,
        usage: {
          inputTokens: parsed.usage?.prompt_tokens,
          totalTokens: parsed.usage?.total_tokens,
        },
      };
    },
  };
}

function voyageClient(): EmbeddingProviderClient {
  return {
    name: 'voyage',
    configured: () => Boolean(process.env.VOYAGE_API_KEY?.trim()),
    embed: async (request) => {
      const apiKey = process.env.VOYAGE_API_KEY?.trim();
      if (!apiKey) {
        throw new EmbeddingError('VOYAGE_API_KEY is not configured', 'EMBEDDING_PROVIDER_NOT_CONFIGURED', {
          provider: 'voyage',
        });
      }

      const baseUrl = (process.env.EMBEDDINGS_VOYAGE_BASE_URL ?? 'https://api.voyageai.com/v1').replace(/\/+$/, '');
      const model = request.model ?? process.env.EMBEDDINGS_VOYAGE_MODEL ?? 'voyage-3-lite';

      const payload = await fetchJson(
        'voyage',
        `${baseUrl}/embeddings`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            input: request.input,
          }),
        },
        request.timeoutMs,
      );

      let parsed: z.infer<typeof VoyageResponseSchema>;
      try {
        parsed = VoyageResponseSchema.parse(payload);
      } catch (error) {
        throw new EmbeddingError('Invalid Voyage embeddings response shape', 'EMBEDDING_PROVIDER_BAD_RESPONSE', {
          provider: 'voyage',
          cause: error,
        });
      }

      return {
        provider: 'voyage',
        model: parsed.model ?? model,
        data: parsed.data.map((item, index) => ({
          index: item.index ?? index,
          embedding: item.embedding,
        })),
        usage: {
          totalTokens: parsed.usage?.total_tokens,
        },
      };
    },
  };
}

function googleClient(): EmbeddingProviderClient {
  return {
    name: 'google',
    configured: () => Boolean(process.env.GOOGLE_API_KEY?.trim()),
    embed: async (request) => {
      const apiKey = process.env.GOOGLE_API_KEY?.trim();
      if (!apiKey) {
        throw new EmbeddingError('GOOGLE_API_KEY is not configured', 'EMBEDDING_PROVIDER_NOT_CONFIGURED', {
          provider: 'google',
        });
      }

      const model = request.model ?? process.env.EMBEDDINGS_GOOGLE_MODEL ?? 'text-embedding-004';
      const version = process.env.EMBEDDINGS_GOOGLE_API_VERSION ?? 'v1beta';
      const baseUrl = (process.env.EMBEDDINGS_GOOGLE_BASE_URL ?? 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
      const endpoint = `${baseUrl}/${version}/models/${model}:batchEmbedContents?key=${encodeURIComponent(apiKey)}`;

      const payload = await fetchJson(
        'google',
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: request.input.map((text) => ({
              model: `models/${model}`,
              content: {
                parts: [{ text }],
              },
            })),
          }),
        },
        request.timeoutMs,
      );

      let parsed: z.infer<typeof GoogleResponseSchema>;
      try {
        parsed = GoogleResponseSchema.parse(payload);
      } catch (error) {
        throw new EmbeddingError('Invalid Google embeddings response shape', 'EMBEDDING_PROVIDER_BAD_RESPONSE', {
          provider: 'google',
          cause: error,
        });
      }

      return {
        provider: 'google',
        model,
        data: parsed.embeddings.map((item, index) => ({
          index,
          embedding: item.values,
        })),
      };
    },
  };
}

function providerClients(): Record<EmbeddingProviderName, EmbeddingProviderClient> {
  return {
    openai: openAiClient(),
    voyage: voyageClient(),
    google: googleClient(),
  };
}

export function resolveEmbeddingProviderOrder(rawOrder?: string): EmbeddingProviderName[] {
  return parseProviderOrder(rawOrder);
}

export function configuredEmbeddingProviders(rawOrder?: string): EmbeddingProviderName[] {
  const order = parseProviderOrder(rawOrder);
  const clients = providerClients();

  return order.filter((provider) => clients[provider].configured());
}

export async function generateEmbeddings(
  input: EmbeddingRequestInput,
  options?: { providerOrder?: EmbeddingProviderName[] },
): Promise<EmbeddingResult> {
  const request = normalizeRequest(input);
  const order = options?.providerOrder?.length
    ? options.providerOrder
    : parseProviderOrder();

  const clients = providerClients();
  const configured = order.filter((provider) => clients[provider]?.configured());

  if (configured.length === 0) {
    throw new EmbeddingError(
      'No embedding provider is configured. Set OPENAI_API_KEY, VOYAGE_API_KEY, or GOOGLE_API_KEY.',
      'EMBEDDING_NO_PROVIDER_CONFIGURED',
    );
  }

  const failures: EmbeddingProviderFailure[] = [];

  for (const providerName of configured) {
    try {
      const providerResult = await clients[providerName].embed(request);
      const dimensions = inferDimensions(providerResult.data);

      return {
        ...providerResult,
        dimensions,
        fallbackUsed: providerName !== configured[0],
        attemptedProviders: configured,
      };
    } catch (error) {
      if (error instanceof EmbeddingError) {
        failures.push({
          provider: providerName,
          code: error.code,
          message: error.message,
          status: error.status,
        });
      } else {
        failures.push({
          provider: providerName,
          code: 'EMBEDDING_PROVIDER_UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  throw new EmbeddingError('All configured embedding providers failed', 'EMBEDDING_ALL_PROVIDERS_FAILED', {
    failures,
  });
}
