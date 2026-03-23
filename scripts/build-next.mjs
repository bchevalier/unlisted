#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';

function hasBun() {
  const result = spawnSync('bun', ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

const useBun = hasBun() && process.env.PREFER_BUN !== '0';
const cmd = useBun ? 'bunx' : 'npx';
const args = useBun ? ['--bun', 'next', 'build'] : ['next', 'build'];

console.log(`Using ${useBun ? 'Bun' : 'Node/npm'} to build Next.js`);

const child = spawn(cmd, args, {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
