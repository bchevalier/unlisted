import { describe, it, expect } from 'vitest';
import { sanitizeContractInput, SanitizeError, checkSpamSignals } from './sanitize';

describe('sanitizeContractInput', () => {
  it('passes through clean input unchanged', () => {
    const result = sanitizeContractInput({
      purpose: 'Partnership inquiry',
      message: 'Hello, I would like to discuss a collaboration.',
    });
    expect(result.purpose).toBe('Partnership inquiry');
    expect(result.message).toBe('Hello, I would like to discuss a collaboration.');
    expect(result.structuredData).toBeUndefined();
  });

  it('strips HTML tags from purpose and message', () => {
    const result = sanitizeContractInput({
      purpose: 'Hello <script>alert("xss")</script>',
      message: '<img src=x onerror=alert(1)> Check this out',
    });
    expect(result.purpose).toBe('Hello alert("xss")');
    expect(result.message).toBe('Check this out');
  });

  it('strips event handlers', () => {
    const result = sanitizeContractInput({
      purpose: 'Test onclick=steal() data',
      message: 'onerror = bad() stuff',
    });
    expect(result.purpose).not.toContain('onclick');
    expect(result.message).not.toContain('onerror');
  });

  it('strips dangerous URI schemes', () => {
    const result = sanitizeContractInput({
      purpose: 'Visit javascript:alert(1)',
      message: 'See data:text/html,<script>x</script>',
    });
    expect(result.purpose).not.toContain('javascript:');
    expect(result.message).not.toContain('data:');
  });

  it('strips null bytes', () => {
    const result = sanitizeContractInput({
      purpose: 'Clean\0Purpose',
      message: 'Clean\0Message',
    });
    expect(result.purpose).toBe('CleanPurpose');
    expect(result.message).toBe('CleanMessage');
  });

  it('truncates overly long purpose to 500 chars', () => {
    const longPurpose = 'a'.repeat(600);
    const result = sanitizeContractInput({ purpose: longPurpose });
    expect(result.purpose.length).toBeLessThanOrEqual(500);
  });

  it('truncates overly long message to 5000 chars', () => {
    const longMessage = 'b'.repeat(6000);
    const result = sanitizeContractInput({ purpose: 'ok', message: longMessage });
    expect(result.message!.length).toBeLessThanOrEqual(5000);
  });

  it('returns null message when input message is null', () => {
    const result = sanitizeContractInput({ purpose: 'test', message: null });
    expect(result.message).toBeNull();
  });

  it('returns null message when input message is undefined', () => {
    const result = sanitizeContractInput({ purpose: 'test' });
    expect(result.message).toBeNull();
  });

  it('sanitizes string values in structuredData', () => {
    const result = sanitizeContractInput({
      purpose: 'test',
      structuredData: {
        name: 'Alice',
        bio: '<script>steal()</script>Good person',
        nested: { url: 'javascript:alert(1)' },
      },
    });
    expect(result.structuredData).toBeDefined();
    expect((result.structuredData as Record<string, unknown>).bio).toBe(
      'steal()Good person',
    );
    expect(
      ((result.structuredData as Record<string, unknown>).nested as Record<string, unknown>).url,
    ).not.toContain('javascript:');
  });

  it('preserves non-string values in structuredData', () => {
    const result = sanitizeContractInput({
      purpose: 'test',
      structuredData: {
        count: 42,
        active: true,
        tags: ['a', 'b'],
      },
    });
    const sd = result.structuredData as Record<string, unknown>;
    expect(sd.count).toBe(42);
    expect(sd.active).toBe(true);
    expect(sd.tags).toEqual(['a', 'b']);
  });

  it('throws on oversized structuredData', () => {
    const huge = { data: 'x'.repeat(40_000) };
    expect(() =>
      sanitizeContractInput({ purpose: 'test', structuredData: huge }),
    ).toThrow(SanitizeError);
  });

  it('throws on deeply nested structuredData', () => {
    // Build a 7-level deep object
    let obj: Record<string, unknown> = { value: 'leaf' };
    for (let i = 0; i < 7; i++) {
      obj = { nested: obj };
    }
    expect(() =>
      sanitizeContractInput({ purpose: 'test', structuredData: obj }),
    ).toThrow(SanitizeError);
  });

  it('collapses excessive newlines', () => {
    const result = sanitizeContractInput({
      purpose: 'test',
      message: 'line1\n\n\n\n\n\nline2',
    });
    expect(result.message).toBe('line1\n\n\nline2');
  });
});

// ---------------------------------------------------------------------------
// checkSpamSignals
// ---------------------------------------------------------------------------

describe('checkSpamSignals', () => {
  it('returns not suspicious for clean content', () => {
    const result = checkSpamSignals('Hi, I would like to discuss a partnership for our upcoming project.');
    expect(result.isSuspicious).toBe(false);
    expect(result.score).toBe(0);
    expect(result.signals).toHaveLength(0);
  });

  it('flags crypto spam', () => {
    const result = checkSpamSignals('Invest in our new crypto token sale and get guaranteed returns on your bitcoin investment!');
    expect(result.isSuspicious).toBe(true);
    expect(result.signals).toContain('crypto_spam');
    expect(result.signals).toContain('financial_scam');
  });

  it('flags phishing content', () => {
    const result = checkSpamSignals('Your account has been suspended. Click here to verify your account and confirm your identity immediately.');
    expect(result.isSuspicious).toBe(true);
    expect(result.signals).toContain('phishing');
  });

  it('flags urgency pressure', () => {
    const result = checkSpamSignals('Act now! Limited time offer expires today! Guaranteed returns on risk-free investment!');
    expect(result.score).toBeGreaterThan(0);
    expect(result.signals).toContain('urgency');
  });

  it('flags off-platform contact attempts', () => {
    const result = checkSpamSignals('Contact me on whatsapp: +1234567890 for guaranteed returns');
    expect(result.signals).toContain('offplatform_contact');
    expect(result.signals).toContain('financial_scam');
  });

  it('returns score below threshold for mild signals', () => {
    const result = checkSpamSignals('Check out our website at https://example.com for more info');
    expect(result.isSuspicious).toBe(false);
    expect(result.score).toBeGreaterThan(0); // has a URL
    expect(result.signals).toContain('url');
  });

  it('accumulates scores from multiple signals', () => {
    const result = checkSpamSignals(
      'Act now! Buy crypto token sale! Guaranteed returns! Click here to verify your account! Contact whatsapp: +123',
    );
    expect(result.isSuspicious).toBe(true);
    expect(result.score).toBeGreaterThan(6);
    expect(result.signals.length).toBeGreaterThan(3);
  });

  it('handles empty string', () => {
    const result = checkSpamSignals('');
    expect(result.isSuspicious).toBe(false);
    expect(result.score).toBe(0);
  });

  it('includes threshold in result', () => {
    const result = checkSpamSignals('Normal message');
    expect(result.threshold).toBeGreaterThan(0);
  });
});
