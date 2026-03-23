import fs from 'node:fs';
import path from 'node:path';

function resolvePath(input, fallback) {
  const value = input || fallback;
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}

const defaultFile = resolvePath(process.env.DIRECT_DEMO_DEFAULT_FILE, 'data/direct-demo-default.json');
const stateFile = resolvePath(process.env.DIRECT_DEMO_STATE_FILE, 'data/direct-demo-state.json');

const payload = JSON.parse(fs.readFileSync(defaultFile, 'utf8'));
fs.mkdirSync(path.dirname(stateFile), { recursive: true });
fs.writeFileSync(stateFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

const requests = Array.isArray(payload.requests) ? payload.requests : [];
const statuses = requests.map((request) => request.status).join(', ');

console.log(`Reset Direct demo state -> ${stateFile}`);
console.log(`Door: ${payload.slug ?? 'unknown'} (${payload.plan ?? 'unknown'})`);
console.log(`Requests: ${requests.length}`);
console.log(`Statuses: ${statuses}`);
