#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve(process.cwd(), 'KNOKIO_DIRECT_MVP_TODO_8_PLUS.md');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let currentSection = 'General';
for (const line of lines) {
  if (line.startsWith('## ')) {
    currentSection = line.replace(/^##\s+/, '').trim();
    continue;
  }

  const match = line.match(/^- \[ \] (.+)$/);
  if (match) {
    const item = match[1].trim();
    console.log(`${currentSection} :: ${item}`);
    process.exit(0);
  }
}

console.log('COMPLETE');
