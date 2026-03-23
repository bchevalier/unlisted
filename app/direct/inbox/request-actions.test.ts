import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RequestActions } from './request-actions';

describe('RequestActions', () => {
  it('renders accept + decline controls for pending requests', () => {
    const html = renderToStaticMarkup(
      React.createElement(RequestActions, { requestId: 'req_1', status: 'PENDING' })
    );

    expect(html).toContain('Accept');
    expect(html).toContain('Decline');
    expect(html).not.toContain('Failed to update');
  });

  it('renders decline-only controls for awaiting-completion requests', () => {
    const html = renderToStaticMarkup(
      React.createElement(RequestActions, { requestId: 'req_2', status: 'AWAITING_COMPLETION' })
    );

    expect(html).not.toContain('Accept');
    expect(html).toContain('Decline');
  });

  it('renders nothing for non-actionable request states', () => {
    const html = renderToStaticMarkup(
      React.createElement(RequestActions, { requestId: 'req_3', status: 'ACCEPTED' })
    );

    expect(html).toBe('');
  });
});
