import React from 'react';

type InboxRequestLike = {
  status: string;
  type?: string | null;
  paidAmountCents?: number | null;
};

export function getRequestStatusNarrative(status: string) {
  switch (status) {
    case 'ACCEPTED':
      return {
        label: 'Accepted into inbox',
        detail: 'Direct let this through because it had enough signal to earn inbox space.',
      };
    case 'AUTO_REPLIED':
      return {
        label: 'Auto-replied by Direct',
        detail: 'Direct handled the first response automatically so you did not have to.',
      };
    case 'AWAITING_COMPLETION':
      return {
        label: 'Waiting on more detail',
        detail: 'Direct asked for the missing context before this reaches your inbox.',
      };
    case 'REJECTED':
      return {
        label: 'Filtered out',
        detail: 'Direct kept this outside the inbox instead of turning it into manual work.',
      };
    case 'EXPIRED':
      return {
        label: 'Expired / capped out',
        detail: 'This did not earn inbox space before the door rules or timing closed it out.',
      };
    default:
      return {
        label: status,
        detail: 'Direct recorded this request and its current routing state.',
      };
  }
}

export function summarizeInboxOutcomes(requests: InboxRequestLike[]) {
  const accepted = requests.filter((request) => request.status === 'ACCEPTED').length;
  const autoReplied = requests.filter(
    (request) => request.status === 'AUTO_REPLIED' || request.status === 'AWAITING_COMPLETION'
  ).length;
  const ignoredOrCapped = requests.filter(
    (request) => request.status === 'REJECTED' || request.status === 'EXPIRED'
  ).length;
  const paidIntent = requests.filter((request) => (request.paidAmountCents ?? 0) > 0).length;

  return { accepted, autoReplied, ignoredOrCapped, paidIntent };
}

type OutcomeSummaryProps = {
  requests: InboxRequestLike[];
};

export function OutcomeSummary({ requests }: OutcomeSummaryProps) {
  const summary = summarizeInboxOutcomes(requests);

  return (
    <section className="inbox-outcome-summary" aria-label="Inbox outcome summary">
      <article>
        <p className="inbox-outcome-summary__label">Accepted</p>
        <strong>{summary.accepted}</strong>
        <span>High-signal requests that earned inbox space.</span>
      </article>
      <article>
        <p className="inbox-outcome-summary__label">Auto-replied / needs more detail</p>
        <strong>{summary.autoReplied}</strong>
        <span>Requests that got a system response before reaching you.</span>
      </article>
      <article>
        <p className="inbox-outcome-summary__label">Ignored / capped</p>
        <strong>{summary.ignoredOrCapped}</strong>
        <span>Requests that never turned into inbox clutter.</span>
      </article>
      <article>
        <p className="inbox-outcome-summary__label">Paid-intent filtered</p>
        <strong>{summary.paidIntent}</strong>
        <span>Requests that carried a paid signal before they reached you.</span>
      </article>
    </section>
  );
}
