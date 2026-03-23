import React from 'react';
import Link from 'next/link';

type WalkthroughStep = 'signup' | 'door' | 'inbox' | 'settings';

type DirectWalkthroughBannerProps = {
  currentStep?: WalkthroughStep;
  doorSlug?: string;
  useDemoFixture?: boolean;
};

export function DirectWalkthroughBanner({
  currentStep,
  doorSlug = 'john',
  useDemoFixture = true,
}: DirectWalkthroughBannerProps) {
  const inboxHref = `/direct/inbox?slug=${doorSlug}${useDemoFixture ? '&fixture=demo' : ''}`;
  const settingsHref = `/direct/settings?slug=${doorSlug}${useDemoFixture ? '&fixture=demo' : ''}`;

  const steps: Array<{ key: WalkthroughStep; label: string; href: string; detail: string }> = [
    {
      key: 'signup',
      label: 'Signup',
      href: '/direct/signup',
      detail: 'Create the keeper account and launch the first door.',
    },
    {
      key: 'door',
      label: 'Public door',
      href: `/u/${doorSlug}`,
      detail: 'See the structured requester-facing entry point.',
    },
    {
      key: 'inbox',
      label: 'Inbox',
      href: inboxHref,
      detail: 'Review what Direct accepted, auto-replied, or filtered.',
    },
    {
      key: 'settings',
      label: 'Settings',
      href: settingsHref,
      detail: 'Adjust rules, caps, reveals, and billing-aware guardrails.',
    },
  ];

  return (
    <section
      className="direct-walkthrough-banner direct-surface-card"
      aria-label="Direct walkthrough banner"
    >
      <p className="direct-surface-eyebrow">Reviewer walkthrough</p>
      <h2>Signup → public door → inbox → settings</h2>
      <p>
        Follow the same loop a first-time reviewer should understand: create the door, inspect the
        public intake surface, verify the inbox outcome, then confirm the control surface.
      </p>
      <div className="direct-walkthrough-steps">
        {steps.map((step, index) => {
          const isCurrent = currentStep === step.key;
          return (
            <article key={step.key} className="direct-walkthrough-step">
              <p className="direct-walkthrough-step-index">Step {index + 1}</p>
              <p className="direct-walkthrough-step-title">
                <Link href={step.href}>{step.label}</Link>
                {isCurrent ? ' · You are here' : ''}
              </p>
              <p className="direct-walkthrough-step-detail">{step.detail}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
