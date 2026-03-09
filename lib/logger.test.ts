import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('emits structured JSON in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LOG_LEVEL', 'info');
    const log = logger('test-component');

    log.info('hello world', { key: 'value' });

    expect(console.info).toHaveBeenCalledOnce();
    const output = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.level).toBe('info');
    expect(parsed.component).toBe('test-component');
    expect(parsed.msg).toBe('hello world');
    expect(parsed.key).toBe('value');
    expect(parsed.ts).toBeDefined();
  });

  it('emits human-readable in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('LOG_LEVEL', 'debug');
    const log = logger('dev-comp');

    log.debug('test message');

    expect(console.debug).toHaveBeenCalledOnce();
    const output = (console.debug as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(output).toContain('DEBUG');
    expect(output).toContain('[dev-comp]');
    expect(output).toContain('test message');
  });

  it('respects log level filtering', () => {
    vi.stubEnv('LOG_LEVEL', 'warn');
    const log = logger('filter-test');

    log.debug('should not appear');
    log.info('should not appear');
    log.warn('should appear');
    log.error('should appear');

    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledOnce();
  });

  it('serializes Error objects in meta', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LOG_LEVEL', 'error');
    const log = logger('error-test');

    const err = new Error('test error');
    log.error('something failed', { error: err });

    const output = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.error.name).toBe('Error');
    expect(parsed.error.message).toBe('test error');
    expect(parsed.error.stack).toBeDefined();
  });

  it('creates child loggers with compound component names', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LOG_LEVEL', 'info');
    const parent = logger('parent');
    const child = parent.child('child');

    child.info('child message');

    const output = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.component).toBe('parent:child');
  });
});
