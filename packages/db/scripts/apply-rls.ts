import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const rlsPath = join(here, '..', 'prisma', 'rls.sql');

export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i] ?? '';
    const next = sql[i + 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        current += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === '-' && next === '-') {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      current += char;
      if (next === "'") {
        current += next;
        i += 1;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      current += char;
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === ';' && !inSingleQuote && !inDoubleQuote) {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = '';
      continue;
    }

    current += char;
  }

  const trailing = current.trim();
  if (trailing) statements.push(trailing);
  return statements;
}

async function main() {
  const prisma = new PrismaClient();
  const sql = await readFile(rlsPath, 'utf8');
  const statements = splitSqlStatements(sql);

  try {
    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }
    console.warn(`Applied ${String(statements.length)} RLS statements from ${rlsPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
