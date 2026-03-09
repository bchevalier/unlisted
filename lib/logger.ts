/**
 * Structured logger for Knokio.
 *
 * Outputs JSON-structured log lines in production, human-readable lines in dev.
 * All log entries include timestamp, level, component, and optional metadata.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   const log = logger('email-proxy');
 *   log.info('Inbound email processed', { alias: 'john', doorId: 'd_123' });
 *   log.error('Failed to send notification', { error: err, requestId: 'r_456' });
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogMeta = Record<string, unknown>;

interface LogEntry {
  ts: string;
  level: LogLevel;
  component: string;
  msg: string;
  [key: string]: unknown;
}

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function currentMinLevel(): LogLevel {
  const envLevel = (process.env.LOG_LEVEL ?? '').toLowerCase();
  if (envLevel in LOG_LEVEL_ORDER) return envLevel as LogLevel;
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[currentMinLevel()];
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack?.split('\n').slice(0, 5).join('\n'),
    };
  }
  return { raw: String(err) };
}

function formatMeta(meta?: LogMeta): LogMeta | undefined {
  if (!meta) return undefined;
  const cleaned: LogMeta = {};
  for (const [k, v] of Object.entries(meta)) {
    if (k === 'error' || k === 'err') {
      cleaned.error = serializeError(v);
    } else {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

function emit(entry: LogEntry): void {
  const consoleFn =
    entry.level === 'error'
      ? console.error
      : entry.level === 'warn'
        ? console.warn
        : entry.level === 'debug'
          ? console.debug
          : console.info;

  if (isProduction()) {
    consoleFn(JSON.stringify(entry));
  } else {
    const { ts, level, component, msg, ...rest } = entry;
    const metaStr = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
    consoleFn(`[${ts}] ${level.toUpperCase()} [${component}] ${msg}${metaStr}`);
  }
}

export interface Logger {
  debug(msg: string, meta?: LogMeta): void;
  info(msg: string, meta?: LogMeta): void;
  warn(msg: string, meta?: LogMeta): void;
  error(msg: string, meta?: LogMeta): void;
  child(subComponent: string): Logger;
}

export function logger(component: string): Logger {
  function log(level: LogLevel, msg: string, meta?: LogMeta): void {
    if (!shouldLog(level)) return;
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      component,
      msg,
      ...formatMeta(meta),
    };
    emit(entry);
  }

  return {
    debug: (msg, meta) => log('debug', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
    child: (sub) => logger(`${component}:${sub}`),
  };
}
