import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { validateReviewedRestore } from '../../scripts/managed-postgres-copy.js';
import type { MigrationManifest } from '../../scripts/managed-postgres-inventory.js';

const payload = {
  version: 1 as const,
  projectReference: 'project',
  source: { database: 'oasis_prod', serverVersion: '170006' },
  target: { database: 'postgres', serverVersion: '170006' },
  sourceGitCommit: 'a'.repeat(40),
  tables: [
    {
      schema: 'public',
      name: 'User',
      columns: [{ name: 'id', dataType: 'text', ordinal: 1 }],
      primaryKey: ['id'],
    },
  ],
  sequences: [],
  objects: [],
  extensions: [],
  migrations: [],
};
const manifest: MigrationManifest = {
  ...payload,
  artifactHash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
};
const entries = [
  '1; 1259 100 TABLE public User postgres',
  '2; 0 100 TABLE DATA public User postgres',
];
const options = {
  manifest,
  targetUrl: 'postgresql://postgres@db.project.supabase.co/postgres?sslmode=require',
  approvedArchiveEntries: entries,
};
describe('reviewed restore boundary', () => {
  it('accepts only approved archive lines that resolve to inventoried objects', () => {
    expect(() => {
      validateReviewedRestore(options, entries.join('\n'));
    }).not.toThrow();
    expect(() => {
      validateReviewedRestore(
        {
          ...options,
          approvedArchiveEntries: [...entries, '3; 1259 101 TABLE public Unknown postgres'],
        },
        [...entries, '3; 1259 101 TABLE public Unknown postgres'].join('\n'),
      );
    }).toThrow('manifest');
  });
  it('rejects changed manifest, wrong project, wrong database, and altered TOC lines', () => {
    expect(() => {
      validateReviewedRestore(
        { ...options, manifest: { ...manifest, sourceGitCommit: 'b'.repeat(40) } },
        entries.join('\n'),
      );
    }).toThrow('fingerprint');
    expect(() => {
      validateReviewedRestore(
        { ...options, targetUrl: options.targetUrl.replace('db.project', 'db.other') },
        entries.join('\n'),
      );
    }).toThrow('identity');
    expect(() => {
      validateReviewedRestore(
        { ...options, targetUrl: options.targetUrl.replace('/postgres?', '/oasis_prod?') },
        entries.join('\n'),
      );
    }).toThrow('identity');
    expect(() => {
      validateReviewedRestore(
        options,
        entries.join('\n').replace('100 TABLE public', '101 TABLE public'),
      );
    }).toThrow('archive');
  });
  it('rejects unreviewed archive additions even when not selected for restore', () => {
    expect(() => {
      validateReviewedRestore(
        options,
        [...entries, '3; 1259 101 TABLE public Unknown postgres'].join('\n'),
      );
    }).toThrow('unreviewed');
  });
  it('matches complete compound constraint identities longer than PostgreSQL name length', () => {
    const constraintName = `User_${'x'.repeat(50)}_pkey`;
    const object = {
      kind: 'constraint',
      schema: 'public',
      name: `"User":${constraintName}`,
      definition: 'PRIMARY KEY (id)',
      owner: '',
      acl: [],
    };
    const reviewedPayload = {
      ...payload,
      objects: [
        {
          ...object,
          fingerprint: createHash('sha256').update(JSON.stringify(object)).digest('hex'),
        },
      ],
    };
    const reviewedManifest = {
      ...reviewedPayload,
      artifactHash: createHash('sha256').update(JSON.stringify(reviewedPayload)).digest('hex'),
    };
    const approvedArchiveEntries = [
      ...entries,
      `3; 2606 101 CONSTRAINT public User ${constraintName} postgres`,
    ];
    expect(() => {
      validateReviewedRestore(
        { ...options, manifest: reviewedManifest, approvedArchiveEntries },
        approvedArchiveEntries.join('\n'),
      );
    }).not.toThrow();
  });
  it('requires all inventoried table data and rejects duplicate entries', () => {
    expect(() => {
      validateReviewedRestore(
        { ...options, approvedArchiveEntries: entries.slice(0, 1) },
        entries.slice(0, 1).join('\n'),
      );
    }).toThrow('table');
    expect(() => {
      validateReviewedRestore(
        {
          ...options,
          approvedArchiveEntries: [...entries, '1; 1259 100 TABLE public User postgres'],
        },
        entries.join('\n'),
      );
    }).toThrow('Duplicate');
  });
  it('permits an explicitly pinned loopback rehearsal identity only', () => {
    const rehearsal = { host: '127.0.0.1' as const, port: 55439, database: 'oasis_rehearsal' };
    const targetUrl = 'postgresql://postgres@127.0.0.1:55439/oasis_rehearsal?sslmode=require';
    expect(() => {
      validateReviewedRestore({ ...options, targetUrl, rehearsal }, entries.join('\n'));
    }).not.toThrow();
    expect(() => {
      validateReviewedRestore(
        { ...options, targetUrl: targetUrl.replace('55439', '55440'), rehearsal },
        entries.join('\n'),
      );
    }).toThrow('identity');
    expect(() => {
      validateReviewedRestore({ ...options, targetUrl }, entries.join('\n'));
    }).toThrow();
  });
});
