/**
 * Content sanitization for Reach contract payloads.
 *
 * Defense-in-depth: strips dangerous patterns from user-supplied text fields
 * (message, purpose) and structured data before persistence. Protects against
 * XSS injection, script injection, and excessively long payloads.
 *
 * This runs at the service layer (proposeContract) so all ingest paths
 * (API, webhook, etc.) are covered.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Max length for the `message` field. */
const MAX_MESSAGE_LENGTH = 5000;
/** Max length for the `purpose` field. */
const MAX_PURPOSE_LENGTH = 500;
/** Max total size for `structuredData` JSON (bytes). */
const MAX_STRUCTURED_DATA_BYTES = 32_768; // 32 KB
/** Max depth for nested structuredData objects. */
const MAX_STRUCTURED_DATA_DEPTH = 5;

// ---------------------------------------------------------------------------
// Patterns to strip
// ---------------------------------------------------------------------------

/** HTML tags including self-closing. */
const HTML_TAG_RE = /<\/?[a-z][a-z0-9]*\b[^>]*\/?>/gi;
/** Script-style event handlers: onclick, onerror, etc. */
const EVENT_HANDLER_RE = /\bon[a-z]+\s*=/gi;
/** javascript: / data: / vbscript: URIs. */
const DANGEROUS_URI_RE = /(?:javascript|data|vbscript)\s*:/gi;
/** Null bytes. */
const NULL_BYTE_RE = /\0/g;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SanitizedContractInput {
  purpose: string;
  message: string | null;
  structuredData: Record<string, unknown> | undefined;
}

/**
 * Sanitize contract input fields.
 * Returns cleaned values. Throws if structuredData exceeds size/depth limits.
 */
export function sanitizeContractInput(input: {
  purpose: string;
  message?: string | null;
  structuredData?: Record<string, unknown>;
}): SanitizedContractInput {
  const purpose = sanitizeText(input.purpose, MAX_PURPOSE_LENGTH);
  const message = input.message ? sanitizeText(input.message, MAX_MESSAGE_LENGTH) : null;

  let structuredData: Record<string, unknown> | undefined;
  if (input.structuredData !== undefined && input.structuredData !== null) {
    // Check serialized size.
    const serialized = JSON.stringify(input.structuredData);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_STRUCTURED_DATA_BYTES) {
      throw new SanitizeError(
        `structuredData exceeds maximum size of ${MAX_STRUCTURED_DATA_BYTES} bytes`,
        'STRUCTURED_DATA_TOO_LARGE',
      );
    }

    // Check depth and sanitize string values recursively.
    structuredData = sanitizeObject(input.structuredData, 0) as Record<string, unknown>;
  }

  return { purpose, message, structuredData };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip dangerous patterns from a text string and truncate to maxLen.
 */
function sanitizeText(text: string, maxLen: number): string {
  let clean = text;
  clean = clean.replace(NULL_BYTE_RE, '');
  clean = clean.replace(HTML_TAG_RE, '');
  clean = clean.replace(EVENT_HANDLER_RE, '');
  clean = clean.replace(DANGEROUS_URI_RE, '');
  // Collapse excessive whitespace (more than 3 consecutive newlines → 2).
  clean = clean.replace(/\n{4,}/g, '\n\n\n');
  // Truncate.
  if (clean.length > maxLen) {
    clean = clean.slice(0, maxLen);
  }
  return clean.trim();
}

/**
 * Recursively sanitize an object's string values and enforce depth limit.
 */
function sanitizeObject(obj: unknown, depth: number): unknown {
  if (depth > MAX_STRUCTURED_DATA_DEPTH) {
    throw new SanitizeError(
      `structuredData exceeds maximum nesting depth of ${MAX_STRUCTURED_DATA_DEPTH}`,
      'STRUCTURED_DATA_TOO_DEEP',
    );
  }

  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizeText(obj, MAX_MESSAGE_LENGTH);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize keys too (strip dangerous patterns).
      const cleanKey = sanitizeText(key, 200);
      result[cleanKey] = sanitizeObject(value, depth + 1);
    }
    return result;
  }

  // Drop unsupported types (functions, symbols, etc.).
  return undefined;
}

// ---------------------------------------------------------------------------
// Spam / suspicious content detection
// ---------------------------------------------------------------------------

/**
 * Patterns that indicate spam or phishing content.
 * Each pattern has a weight; if the total exceeds the threshold, the content
 * is flagged as suspicious.
 */
const SPAM_SIGNALS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  // Crypto / financial scams
  { pattern: /\b(?:crypto|bitcoin|btc|eth|nft|airdrop|token\s*sale)\b/gi, weight: 2, label: 'crypto_spam' },
  { pattern: /\b(?:guaranteed\s+returns?|double\s+your\s+money|risk[- ]free\s+investment)\b/gi, weight: 3, label: 'financial_scam' },
  // Phishing indicators
  { pattern: /\b(?:verify\s+your\s+account|confirm\s+your\s+identity|suspend(?:ed)?\s+account)\b/gi, weight: 3, label: 'phishing' },
  { pattern: /\b(?:click\s+(?:here|now|below)\s+(?:to|and)\s+(?:claim|verify|confirm|unlock))\b/gi, weight: 3, label: 'phishing_cta' },
  // URL spam (excessive links)
  { pattern: /https?:\/\/\S+/gi, weight: 0.5, label: 'url' },
  // All-caps yelling (more than 30 consecutive uppercase chars)
  { pattern: /[A-Z]{30,}/g, weight: 1, label: 'caps_yelling' },
  // Urgency pressure
  { pattern: /\b(?:act\s+now|limited\s+time|expires?\s+(?:soon|today)|urgent(?:ly)?|immediately)\b/gi, weight: 1, label: 'urgency' },
  // Contact outside platform
  { pattern: /\b(?:whatsapp|telegram|signal)\s*[:\-]?\s*\+?\d/gi, weight: 2, label: 'offplatform_contact' },
  // Email harvesting
  { pattern: /\b(?:send\s+(?:me|us)\s+(?:your|the)\s+(?:email|number|phone|address))\b/gi, weight: 1, label: 'data_harvesting' },
];

/** Threshold: if total score meets or exceeds this, content is suspicious. */
const SPAM_SCORE_THRESHOLD = Number(process.env.REACH_SPAM_SCORE_THRESHOLD ?? 6);

export interface SpamCheckResult {
  isSuspicious: boolean;
  score: number;
  threshold: number;
  signals: string[];
}

/**
 * Check text content for spam/abuse signals.
 * Returns a score-based result. Does NOT block — callers decide what to do
 * (e.g., flag for review, add audit metadata, reject).
 */
export function checkSpamSignals(text: string): SpamCheckResult {
  let score = 0;
  const signals: string[] = [];

  for (const { pattern, weight, label } of SPAM_SIGNALS) {
    // Reset lastIndex for global patterns.
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      const contribution = matches.length * weight;
      score += contribution;
      signals.push(label);
    }
  }

  return {
    isSuspicious: score >= SPAM_SCORE_THRESHOLD,
    score: Math.round(score * 10) / 10,
    threshold: SPAM_SCORE_THRESHOLD,
    signals,
  };
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class SanitizeError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = 'SanitizeError';
  }
}
