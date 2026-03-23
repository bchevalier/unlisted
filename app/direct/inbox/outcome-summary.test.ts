import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OutcomeSummary, summarizeInboxOutcomes } from './outcome-summary';

describe('summarizeInboxOutcomes', () => {
  it('groups requests into the four proof-of-value outcome buckets', () => {
    const summary = summarizeInboxOutcomes([
      { status: 'ACCEPTED' },
      { status: 'ACCEPTED' },
      { status: 'AUTO_REPLIED' },
      { status: 'AWAITING_COMPLETION' },
      { status: 'REJECTED' },
      { status: 'EXPIRED' },
      { status: 'ACCEPTED', paidAmountCents: 12000 },
    ]);

    expect(summary).toEqual({
      accepted: 3,
      autoReplied: 2,
      ignoredOrCapped: 2,
      paidIntent: 1,
    });
  });
});

describe('OutcomeSummary', () => {
  it('renders the inbox proof-of-value summary labels', () => {
    const html = renderToStaticMarkup(
      React.createElement(OutcomeSummary, {
        requests: [
          { status: 'ACCEPTED' },
          { status: 'AUTO_REPLIED' },
          { status: 'REJECTED' },
          { status: 'ACCEPTED', paidAmountCents: 5000 },
        ],
      })
    );

    expect(html).toContain('Accepted');
    expect(html).toContain('Auto-replied / needs more detail');
    expect(html).toContain('Ignored / capped');
    expect(html).toContain('Paid-intent filtered');
  });
});
