import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('apps/web/src/components/library/library-workflow-client.tsx', 'utf8');

test('library cover uploads use the active Clerk session for Supabase Storage', () => {
  assert.match(source, /import \{ useSession \} from '@clerk\/nextjs';/);
  assert.match(source, /accessToken: async \(\) => session\?\.getToken\(\) \?\? null/);
  assert.match(source, /supabase\s*\.storage/);
  assert.match(source, /isCoverUploading/);
});
