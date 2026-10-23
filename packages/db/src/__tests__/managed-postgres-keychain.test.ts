import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createBackupKey, readBackupKey } from '../../scripts/managed-postgres-keychain.js';

let directory: string;
let previousPath: string | undefined;
const service = 'oasis.managed-postgres-migration.test';
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'oasis-keychain-test-'));
  previousPath = process.env.PATH;
  process.env.PATH = `${directory}:${previousPath ?? ''}`;
  await writeFile(
    join(directory, 'security'),
    `#!/usr/bin/env node
const fs=require('node:fs');
const root=${JSON.stringify(directory)};
fs.appendFileSync(root+'/argv',JSON.stringify(process.argv.slice(2))+'\\n');
if(process.argv[2]==='-i') {
let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{
const key=input.match(/-w ([a-f0-9]{64})/)[1];
try { fs.writeFileSync(root+'/key',key,{flag:'wx',mode:384}); } catch { /* duplicate */ }
});
} else { try { console.log(fs.readFileSync(root+'/key','utf8')); } catch { process.exitCode=1; } }
`,
  );
  await chmod(join(directory, 'security'), 0o700);
});
afterEach(async () => {
  process.env.PATH = previousPath;
  await rm(directory, { recursive: true, force: true });
});
it('keeps key out of argv and proves read-back custody', async () => {
  const key = await createBackupKey(service);
  expect(key.length).toBe(32);
  expect(await readBackupKey(service)).toEqual(key);
  expect(await readFile(join(directory, 'argv'), 'utf8')).not.toContain(key.toString('hex'));
});
it('refuses replacing an existing key', async () => {
  const key = await createBackupKey(service);
  await expect(createBackupKey(service)).rejects.toThrow('custody');
  expect(await readBackupKey(service)).toEqual(key);
});
it('rejects shell-like service names before spawning', async () => {
  await expect(createBackupKey(`${service}\nfind-generic-password`)).rejects.toThrow('service');
  await expect(readFile(join(directory, 'argv'))).rejects.toThrow();
});
it('does not disclose keychain diagnostics', async () => {
  await expect(readBackupKey(service)).rejects.toThrow('Keychain operation failed');
});
