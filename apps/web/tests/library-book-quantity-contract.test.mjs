import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('apps/web/src/components/library/library-workflow-client.tsx', 'utf8');

test('adding a book records its quantity and clears the completed form', () => {
  assert.match(source, /const \[quantity, setQuantity\] = useState\(1\)/);
  assert.match(source, /<span className="field__label">Quantity<\/span>/);
  assert.match(source, /createBook\.mutate\(\{ barcode, title, author, cover, quantity \}\)/);
  assert.match(source, /setBarcode\(''\);[\s\S]*setTitle\(''\);[\s\S]*setAuthor\(''\);[\s\S]*setQuantity\(1\);[\s\S]*setCover\(null\);/);
});
