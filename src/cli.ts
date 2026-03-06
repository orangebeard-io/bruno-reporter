#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { reportBrunoResults } from './reporter';
import type { BrunoResults } from './types';

function main(): void {
  const args = process.argv.slice(2);
  let resultFile: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-f' && args[i + 1]) {
      resultFile = args[++i];
    }
  }

  if (!resultFile) {
    console.error('Usage: bruno-to-orangebeard -f <result-file.json>');
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), resultFile);

  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(absolutePath, 'utf8');
  const results: BrunoResults = JSON.parse(raw);

  reportBrunoResults(results);
}

try {
  main();
} catch (err: unknown) {
  console.error('Failed to report Bruno results to Orangebeard:');
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
}
