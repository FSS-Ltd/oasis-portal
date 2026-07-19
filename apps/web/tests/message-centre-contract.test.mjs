import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const webRoot = path.resolve(import.meta.dirname, '..');

function readWeb(relativePath) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

const messageCentreSource = readWeb('src/components/messages/message-centre.tsx');

test('admin message scope filters conversation queries to the active contact type', () => {
  assert.match(
    messageCentreSource,
    /const staffConversationKinds = \[\s*'Staffroom',\s*'StaffDirect',\s*\]/,
  );
  assert.match(messageCentreSource, /const parentConversationKinds = \['ParentStaff'\]/);
  assert.match(messageCentreSource, /kinds: \[\.\.\.conversationKinds\]/);
  assert.match(
    messageCentreSource,
    /conversationKind === 'ParentStaff' \? parentConversationKinds/,
  );
});

test('admin message scope changes clear stale conversation selection', () => {
  assert.match(messageCentreSource, /setSelectedOverrideId\(null\)/);
  assert.match(messageCentreSource, /resetConversationPages\(\)/);
  assert.match(
    messageCentreSource,
    /window\.history\.replaceState\(null, '', '\/admin\/messages'\)/,
  );
});
