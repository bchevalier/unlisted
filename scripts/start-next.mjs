#!/usr/bin/env node

import { spawn } from 'node:child_process';

const port = process.env.PORT ?? process.env.NEXT_PORT ?? '3333';
const host = process.env.HOST ?? process.env.NEXT_HOST ?? '0.0.0.0';

const child = spawn('npx', ['next', 'start', '-H', host, '-p', port], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
