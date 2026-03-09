import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Unit tests for email proxy parsing helpers.
// Re-implemented here to test in isolation (same as slug.test.ts pattern).
// Keep in sync with requests.ts production implementations.
// ---------------------------------------------------------------------------

function extractEmailAddress(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/<?([^<>\s]+@[^<>\s]+)>?/);
  return match?.[1]?.toLowerCase() ?? trimmed.toLowerCase();
}

function extractSenderName(raw: string): string | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/^\s*"?([^"<]+)"?\s*<[^>]+>\s*$/);
  const value = match?.[1]?.trim();
  return value && value.length > 0 ? value : null;
}

function extractAlias(rawTo: string): string {
  const email = extractEmailAddress(rawTo);
  const [localPart] = email.split('@');
  return localPart?.toLowerCase() ?? '';
}

function stripQuotedAndSignature(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^On .+wrote:$/i.test(trimmed)) break;
    if (/^From:\s.+<.+>$/i.test(trimmed)) break;
    if (trimmed.startsWith('>')) break;
    if (trimmed === '--' || trimmed === '-- ') break;
    if (/^Sent from my (iPhone|Android|Pixel)/i.test(trimmed)) break;

    result.push(line);
  }

  return result.join('\n').trim();
}

// ---------------------------------------------------------------------------
// extractEmailAddress
// ---------------------------------------------------------------------------

describe('extractEmailAddress', () => {
  it('extracts plain email address', () => {
    expect(extractEmailAddress('alice@example.com')).toBe('alice@example.com');
  });

  it('extracts email from angle brackets', () => {
    expect(extractEmailAddress('<alice@example.com>')).toBe('alice@example.com');
  });

  it('extracts email from "Name <email>" format', () => {
    expect(extractEmailAddress('Alice Doe <alice@example.com>')).toBe('alice@example.com');
  });

  it('extracts email from quoted name format', () => {
    expect(extractEmailAddress('"Alice Doe" <alice@example.com>')).toBe('alice@example.com');
  });

  it('lowercases the email', () => {
    expect(extractEmailAddress('Alice@Example.COM')).toBe('alice@example.com');
  });

  it('handles leading/trailing whitespace', () => {
    expect(extractEmailAddress('  alice@example.com  ')).toBe('alice@example.com');
  });

  it('handles edge case with no @ sign', () => {
    expect(extractEmailAddress('alice')).toBe('alice');
  });

  it('handles complex display names with special chars', () => {
    expect(extractEmailAddress('O\'Brien, Alice <alice@example.com>')).toBe('alice@example.com');
  });
});

// ---------------------------------------------------------------------------
// extractSenderName
// ---------------------------------------------------------------------------

describe('extractSenderName', () => {
  it('extracts name from "Name <email>" format', () => {
    expect(extractSenderName('Alice Doe <alice@example.com>')).toBe('Alice Doe');
  });

  it('extracts name from quoted "Name" <email> format', () => {
    expect(extractSenderName('"Alice Doe" <alice@example.com>')).toBe('Alice Doe');
  });

  it('returns null for bare email address', () => {
    expect(extractSenderName('alice@example.com')).toBeNull();
  });

  it('returns null for angle-bracket-only email', () => {
    expect(extractSenderName('<alice@example.com>')).toBeNull();
  });

  it('trims whitespace from extracted name', () => {
    expect(extractSenderName('  Alice Doe  <alice@example.com>')).toBe('Alice Doe');
  });

  it('returns null when name part is empty', () => {
    expect(extractSenderName('" " <alice@example.com>')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractAlias
// ---------------------------------------------------------------------------

describe('extractAlias', () => {
  it('extracts local part from plain email', () => {
    expect(extractAlias('john@knokio.io')).toBe('john');
  });

  it('extracts alias from angle-bracket format', () => {
    expect(extractAlias('<john@knokio.io>')).toBe('john');
  });

  it('extracts alias from display name format', () => {
    expect(extractAlias('John Doe <john@knokio.io>')).toBe('john');
  });

  it('lowercases the alias', () => {
    expect(extractAlias('John@Knokio.IO')).toBe('john');
  });

  it('handles plus-addressing', () => {
    expect(extractAlias('john+tag@knokio.io')).toBe('john+tag');
  });

  it('handles dots in alias', () => {
    expect(extractAlias('john.doe@knokio.io')).toBe('john.doe');
  });
});

// ---------------------------------------------------------------------------
// stripQuotedAndSignature
// ---------------------------------------------------------------------------

describe('stripQuotedAndSignature', () => {
  it('returns full text when no quotes or signatures', () => {
    expect(stripQuotedAndSignature('Hello, this is my message.')).toBe('Hello, this is my message.');
  });

  it('strips "On ... wrote:" quoted replies', () => {
    const input = [
      'Thanks for getting back.',
      '',
      'On Mon, Jan 1, 2026, Alice wrote:',
      '> Original message here',
    ].join('\n');
    expect(stripQuotedAndSignature(input)).toBe('Thanks for getting back.');
  });

  it('strips "From: ..." forwarded headers', () => {
    const input = [
      'My new content.',
      '',
      'From: Alice Doe <alice@example.com>',
      'Sent: Monday',
    ].join('\n');
    expect(stripQuotedAndSignature(input)).toBe('My new content.');
  });

  it('strips lines starting with ">"', () => {
    const input = [
      'My reply.',
      '> quoted line',
      '> another quoted line',
    ].join('\n');
    expect(stripQuotedAndSignature(input)).toBe('My reply.');
  });

  it('strips signature delimiter "--"', () => {
    const input = [
      'Body of the email.',
      '',
      '--',
      'Alice Doe',
      'CEO, Acme Corp',
    ].join('\n');
    expect(stripQuotedAndSignature(input)).toBe('Body of the email.');
  });

  it('strips signature delimiter "-- " (with trailing space)', () => {
    const input = [
      'Body text.',
      '',
      '-- ',
      'Signature line',
    ].join('\n');
    expect(stripQuotedAndSignature(input)).toBe('Body text.');
  });

  it('strips "Sent from my iPhone"', () => {
    const input = [
      'Quick reply from phone.',
      '',
      'Sent from my iPhone',
    ].join('\n');
    expect(stripQuotedAndSignature(input)).toBe('Quick reply from phone.');
  });

  it('strips "Sent from my Android"', () => {
    const input = [
      'Quick reply.',
      '',
      'Sent from my Android',
    ].join('\n');
    expect(stripQuotedAndSignature(input)).toBe('Quick reply.');
  });

  it('strips "Sent from my Pixel"', () => {
    const input = [
      'Quick reply.',
      '',
      'Sent from my Pixel',
    ].join('\n');
    expect(stripQuotedAndSignature(input)).toBe('Quick reply.');
  });

  it('handles Windows-style line endings (CRLF)', () => {
    const input = 'Line one.\r\nLine two.\r\n\r\n-- \r\nSignature';
    expect(stripQuotedAndSignature(input)).toBe('Line one.\nLine two.');
  });

  it('returns empty string when entire body is quoted', () => {
    const input = '> Quoted line\n> Another';
    expect(stripQuotedAndSignature(input)).toBe('');
  });

  it('preserves multi-line original content before quote', () => {
    const input = [
      'First paragraph.',
      '',
      'Second paragraph.',
      '',
      'On Tue, Feb 2 wrote:',
      '> old',
    ].join('\n');
    expect(stripQuotedAndSignature(input)).toBe(
      'First paragraph.\n\nSecond paragraph.'
    );
  });

  it('stops at the first matching pattern', () => {
    const input = [
      'Body.',
      '> quote first',
      '--',
      'Sent from my iPhone',
    ].join('\n');
    // Should stop at the ">" line, not later patterns
    expect(stripQuotedAndSignature(input)).toBe('Body.');
  });
});
