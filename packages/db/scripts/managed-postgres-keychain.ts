import { spawn } from 'node:child_process';
import { randomBytes, timingSafeEqual } from 'node:crypto';

function validateService(service: string): void {
  if (!/^oasis\.managed-postgres-migration\.[A-Za-z0-9._-]{1,160}$/.test(service)) {
    throw new Error('Invalid migration Keychain service name');
  }
}

/** Never include security's command input or diagnostic output in errors or logs. */
async function security(args: string[], input = ''): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('security', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const output: Buffer[] = [];
    const fail = (): void => {
      reject(new Error('Keychain operation failed'));
    };
    child.stdout.on('data', (chunk: Buffer) => output.push(chunk));
    child.stderr.resume();
    child.once('error', fail);
    child.stdin.once('error', fail);
    child.once('close', (code) => {
      if (code === 0) resolve(Buffer.concat(output).toString('utf8'));
      else fail();
    });
    child.stdin.end(input);
  });
}

export async function readBackupKey(service: string): Promise<Buffer> {
  validateService(service);
  const value = (
    await security(['find-generic-password', '-a', 'oasis-migration', '-s', service, '-w'])
  ).trim();
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error('Invalid backup key in Keychain');
  return Buffer.from(value, 'hex');
}

export async function createBackupKey(service: string): Promise<Buffer> {
  validateService(service);
  const key = randomBytes(32);
  // security's interactive command language accepts hex without quoting. Its process
  // arguments contain no secret; the command and key are sent through private stdin.
  // Deliberately omit -U: an existing recovery key must never be overwritten.
  await security(
    ['-i'],
    `add-generic-password -a oasis-migration -s ${service} -w ${key.toString('hex')}\n`,
  );
  const recovered = await readBackupKey(service);
  if (!timingSafeEqual(key, recovered)) throw new Error('Backup key custody verification failed');
  return key;
}
