const enableWebkit = process.env.PW_ENABLE_WEBKIT === 'true';

const projects = [
  {
    name: 'chromium',
    use: {
      browserName: 'chromium',
    },
  },
  {
    name: 'firefox',
    use: {
      browserName: 'firefox',
    },
  },
  ...(enableWebkit
    ? [
        {
          name: 'webkit',
          use: {
            browserName: 'webkit',
          },
        },
      ]
    : []),
];

const config = {
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'dot' : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3333',
    trace: 'on-first-retry',
  },
  projects,
};

export default config;
