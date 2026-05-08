#!/usr/bin/env node

import os from 'node:os';
import process from 'node:process';
import { execSync, spawn } from 'node:child_process';

function isPrivateIpv4(address) {
  return (
    address.startsWith('192.168.') ||
    address.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  );
}

function resolveLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      candidates.push(entry.address);
    }
  }

  return candidates.find(isPrivateIpv4) ?? candidates[0] ?? '127.0.0.1';
}

function cleanupStaleDevProcesses() {
  const cwd = process.cwd();
  const currentPid = process.pid;
  const output = execSync('ps -ax -o pid= -o command=', { encoding: 'utf8' });

  const targets = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const firstSpace = line.indexOf(' ');
      if (firstSpace === -1) return null;
      return {
        pid: Number(line.slice(0, firstSpace).trim()),
        command: line.slice(firstSpace + 1),
      };
    })
    .filter((entry) => entry && Number.isFinite(entry.pid))
    .filter((entry) => entry.pid !== currentPid)
    .filter((entry) => entry.command.includes(cwd))
    .filter(
      (entry) =>
        entry.command.includes('scripts/dev-network.mjs') ||
        entry.command.includes('scripts/dev-supervise-next.mjs') ||
        entry.command.includes('next dev')
    );

  for (const target of targets) {
    try {
      process.kill(target.pid, 'SIGTERM');
      console.log(`- Stopped stale dev process ${target.pid}`);
    } catch {
      // Ignore races.
    }
  }
}

const port = process.env.NEXT_PORT ?? process.env.PORT ?? '3333';
const host = process.env.NEXT_HOST ?? '0.0.0.0';
const lanIp = resolveLanIp();
const localUrl = `http://localhost:${port}`;
const lanUrl = `http://${lanIp}:${port}`;

cleanupStaleDevProcesses();
await new Promise((resolve) => setTimeout(resolve, 700));

const env = {
  ...process.env,
  PORT: port,
  NEXT_PORT: port,
  NEXT_HOST: host,
  APP_URL: process.env.APP_URL_OVERRIDE ?? lanUrl,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL_OVERRIDE ?? lanUrl,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? lanUrl,
};

console.log('');
console.log('Knokio local dev');
console.log(`- Local:   ${localUrl}`);
console.log(`- Network: ${lanUrl}`);
console.log(`- API:     ${lanUrl}/api/*`);
console.log('- APP_URL and NEXTAUTH_URL are overridden for this run so LAN testing stays same-origin.');
console.log('');

const child = spawn('node', ['scripts/dev-supervise-next.mjs'], {
  stdio: 'inherit',
  env,
});

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
