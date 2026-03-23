#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';

const host = process.env.NEXT_HOST ?? '0.0.0.0';
const port = process.env.NEXT_PORT ?? '3333';
const baseDelayMs = Number(process.env.NEXT_RESTART_DELAY_MS ?? '2000');
const maxDelayMs = Number(process.env.NEXT_RESTART_MAX_DELAY_MS ?? '10000');
const useTurbopack = process.env.NEXT_TURBOPACK !== '0';

let child = null;
let stopping = false;
let restartAttempt = 0;
let restartTimer = null;

function hasBun() {
  const result = spawnSync('bun', ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

function ts() {
  return new Date().toISOString();
}

function log(message) {
  console.log(`[next-supervisor ${ts()}] ${message}`);
}

function clearRestartTimer() {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
}

function scheduleRestart() {
  clearRestartTimer();
  const delay = Math.min(baseDelayMs + Math.max(restartAttempt - 1, 0) * 1000, maxDelayMs);
  log(`restarting Next dev in ${delay}ms`);
  restartTimer = setTimeout(startChild, delay);
}

function startChild() {
  if (stopping) return;

  restartAttempt += 1;

  const useBun = hasBun() && process.env.PREFER_BUN !== '0';
  const cmd = useBun ? 'bunx' : 'npx';
  const args = useBun
    ? ['--bun', 'next', 'dev', ...(useTurbopack ? ['--turbopack'] : []), '-H', host, '-p', port]
    : ['next', 'dev', ...(useTurbopack ? ['--turbopack'] : []), '-H', host, '-p', port];

  log(`starting Next dev on ${host}:${port} (attempt ${restartAttempt}, runtime=${useBun ? 'bun' : 'node'}, turbopack=${useTurbopack})`);

  child = spawn(cmd, args, {
    stdio: 'inherit',
    env: process.env,
  });

  child.once('error', (error) => {
    log(`child process error: ${error.message}`);
  });

  child.once('exit', (code, signal) => {
    const exitCode = code ?? 'null';
    const exitSignal = signal ?? 'none';
    log(`Next dev exited (code=${exitCode}, signal=${exitSignal})`);

    child = null;

    if (stopping) {
      process.exit(typeof code === 'number' ? code : 0);
    }

    scheduleRestart();
  });
}

function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  clearRestartTimer();

  log(`received ${signal}, shutting down supervisor`);

  if (!child || child.killed) {
    process.exit(0);
    return;
  }

  child.kill('SIGTERM');

  setTimeout(() => {
    if (child && !child.killed) {
      log('child did not exit after SIGTERM, sending SIGKILL');
      child.kill('SIGKILL');
    }
  }, 5000).unref();
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => shutdown(signal));
}

startChild();
