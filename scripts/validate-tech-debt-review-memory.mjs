import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const memoryPath = resolve(repositoryRoot, '.codex/tech-debt-review/memory.json');
const memory = JSON.parse(readFileSync(memoryPath, 'utf8'));
const reviewedFiles = Object.keys(memory.reviewedFiles ?? {});

const missingFiles = reviewedFiles.filter(
  (filePath) => !existsSync(resolve(repositoryRoot, filePath)),
);
const extensionCollisions = reviewedFiles
  .filter((filePath) => filePath.endsWith('.ts') && reviewedFiles.includes(`${filePath}x`))
  .map((filePath) => [filePath, `${filePath}x`]);

if (missingFiles.length > 0 || extensionCollisions.length > 0) {
  if (missingFiles.length > 0) {
    console.error(`Review memory contains ${missingFiles.length} nonexistent path(s):`);
    for (const filePath of missingFiles) {
      console.error(`- ${filePath}`);
    }
  }

  if (extensionCollisions.length > 0) {
    console.error(`Review memory contains ${extensionCollisions.length} .ts/.tsx collision(s):`);
    for (const [tsPath, tsxPath] of extensionCollisions) {
      console.error(`- ${tsPath} and ${tsxPath}`);
    }
  }

  process.exitCode = 1;
} else {
  console.log(`Tech-debt review memory is valid (${reviewedFiles.length} reviewed files).`);
}
