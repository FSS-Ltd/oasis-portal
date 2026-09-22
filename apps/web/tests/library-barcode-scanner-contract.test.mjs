import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('apps/web/src/components/library/library-barcode-scanner.tsx', 'utf8');

test('the library scanner prioritises rear-camera book barcode formats', () => {
  for (const format of [
    'EAN_13',
    'EAN_8',
    'UPC_A',
    'UPC_E',
    'CODE_128',
    'CODE_39',
    'CODE_93',
    'CODABAR',
    'ITF',
  ]) {
    assert.match(source, new RegExp(`BarcodeFormat\\.${format}`));
  }

  assert.match(source, /facingMode: \{ ideal: 'environment' \}/);
  assert.match(source, /scannerControls\.stop\(\)/);
});
