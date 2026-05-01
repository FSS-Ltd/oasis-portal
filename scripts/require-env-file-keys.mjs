#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const index = trimmed.indexOf('=');
  if (index === -1) return null;

  const key = trimmed.slice(0, index).trim();
  let value = trimmed.slice(index + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return key ? [key, value] : null;
}

function loadEnvKeys(path) {
  const values = new Map();
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;

    const [key, value] = parsed;
    values.set(key, value);
  }

  return values;
}

function loadProcessEnvKeys() {
  return new Map(Object.entries(process.env));
}

const [source, ...requiredKeys] = process.argv.slice(2);
const readsProcessEnv = source === '--process-env';

if (!source || requiredKeys.length === 0) {
  console.error(
    'Usage: node scripts/require-env-file-keys.mjs <env-file|--process-env> <KEY> [...KEY]',
  );
  process.exit(2);
}

if (!readsProcessEnv && !existsSync(source)) {
  console.error(`Required env file not found: ${source}`);
  process.exit(1);
}

const values = readsProcessEnv ? loadProcessEnvKeys() : loadEnvKeys(source);
const missing = requiredKeys.filter((key) => !values.get(key));

if (missing.length > 0) {
  const label = readsProcessEnv ? 'process.env' : source;
  console.error(`Missing or empty required env vars in ${label}: ${missing.join(', ')}`);
  if (readsProcessEnv) {
    console.error('Add non-empty values in GitHub Actions secrets or the job environment.');
  } else {
    console.error('Add non-empty values in Vercel Project Settings > Environment Variables.');
    console.error(
      'If the keys exist but this still fails after `vercel pull`, check whether they are marked Sensitive. Vercel pulls Sensitive values as empty strings for local/CI prebuilt builds.',
    );
  }
  process.exit(1);
}

const label = readsProcessEnv ? 'process.env' : source;
console.log(`Verified ${requiredKeys.length} required env vars in ${label}.`);
