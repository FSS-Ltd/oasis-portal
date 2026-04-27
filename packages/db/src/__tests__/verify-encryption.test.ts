import { describe, expect, it } from 'vitest';
import { findPlaintextFixtures } from '../../scripts/verify-encryption.js';

describe('findPlaintextFixtures', () => {
  it('passes when fixture PII appears only as ciphertext-like values', () => {
    const dump = `
      COPY public."User" ("fullNameEnc", "emailEnc") FROM stdin;
      v1:1:wrapped:iv:tag:data:tag:ciphertext
      enc-but-not-plaintext
      \\.
    `;

    expect(findPlaintextFixtures(dump)).toEqual([]);
  });

  it('fails when a deliberate plaintext fixture appears in dumped data', () => {
    const dump = `
      COPY public."Student" ("fullNameEnc", "dobEnc") FROM stdin;
      Jane Learner\t2014-02-03
      \\.
    `;

    expect(findPlaintextFixtures(dump)).toEqual([
      { fixture: 'Jane Learner', index: dump.indexOf('Jane Learner') },
      { fixture: '2014-02-03', index: dump.indexOf('2014-02-03') },
    ]);
  });
});
