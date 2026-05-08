export const directCanonicalScreenshotTargets = [
  {
    key: 'direct-landing',
    label: 'Direct landing',
    path: '/direct',
    output: 'direct-landing.png',
    waitForText: 'Signup → public door → inbox → settings',
  },
  {
    key: 'direct-signup-launch',
    label: 'Signup launch state',
    path: '/direct/signup?fixture=launch',
    output: 'direct-signup-launch.png',
    waitForText: 'Your first Direct door is ready to launch',
  },
  {
    key: 'direct-public-door',
    label: 'Public door',
    path: '/u/john?fixture=demo',
    output: 'direct-public-door.png',
    waitForText: 'Requests here are structured before they reach a private inbox.',
  },
  {
    key: 'direct-settings',
    label: 'Settings',
    path: '/direct/settings?slug=john&fixture=demo',
    output: 'direct-settings.png',
    waitForText: 'Plan guardrails',
  },
  {
    key: 'direct-inbox',
    label: 'Inbox proof of value',
    path: '/direct/inbox?slug=john&fixture=demo',
    output: 'direct-inbox-proof-of-value.png',
    waitForText: 'Paid-intent filtered',
  },
];
