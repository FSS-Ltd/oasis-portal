import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { complianceRouter } from '../routers/compliance.js';
import { authedProcedure, router } from '../trpc.js';

const lead: SessionUser = { id: 'lead', role: 'SafeguardingLead', tags: [], requires2fa: false };
const head: SessionUser = { id: 'head', role: 'Head', tags: [], requires2fa: false };
const pastor: SessionUser = { id: 'pastor', role: 'Pastor', tags: [], requires2fa: false };
const supervisor: SessionUser = {
  id: 'supervisor',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};

const validUpdate = {
  userId: 'parent-1',
  dob: '1987-01-02',
  dbsCertificateNumber: 'CERT-123',
  dbsApplicationReference: 'APP-123',
  dbsCompletedAt: '2026-01-01',
  dbsIssueDate: '2026-01-02',
  dbsApplicationType: 'Enhanced' as const,
  dbsStatus: 'RecordedCurrent' as const,
  firstAidCompletedAt: '2026-02-01',
  firstAidLevel: 'Level 3',
  safeguardingCompletedAt: '2026-03-01',
  safeguardingLevel: 'Level 2',
};

function makeDb() {
  const user = {
    findUnique: vi.fn().mockResolvedValue({ id: 'parent-1', role: 'Parent' }),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({ id: 'parent-1' }),
  };
  const adultCompliance = {
    upsert: vi.fn().mockResolvedValue({ userId: 'parent-1' }),
    findMany: vi.fn().mockResolvedValue([]),
  };
  const studentRegistrationProfile = {
    findMany: vi.fn().mockResolvedValue([]),
  };
  const auditLog = { create: vi.fn().mockResolvedValue(undefined) };
  const db = {
    user,
    adultCompliance,
    studentRegistrationProfile,
    auditLog,
    $enc: {
      encrypt: vi.fn((value: string) => `enc:${value}`),
      decrypt: vi.fn((value: string | null | undefined) => value?.replace(/^enc:/u, '') ?? null),
    },
  };
  return db;
}

type FakeDb = ReturnType<typeof makeDb>;

function makeCaller(session: SessionUser, db: FakeDb) {
  const ctx: AppContext = {
    db: db as unknown as AppContext['db'],
    user: session,
    accountAccessState: 'active',
    requestId: 'compliance-test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn(db as unknown as RlsTx),
  };
  return router({
    compliance: complianceRouter,
    privateCheck: authedProcedure.query(() => true),
  }).createCaller(ctx);
}

describe('compliance access and records', () => {
  it('limits the lead to compliance procedures and keeps two-factor checks', async () => {
    const db = makeDb();
    await expect(makeCaller(lead, db).compliance.peopleOptions()).resolves.toEqual([]);
    await expect(makeCaller(lead, db).privateCheck()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(makeCaller(supervisor, db).compliance.peopleOptions()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      makeCaller(supervisor, db).compliance.register({ page: 1, search: '' }),
    ).resolves.toHaveProperty('canEdit', false);
    await expect(makeCaller(supervisor, db).compliance.medTab()).resolves.toEqual([]);
    await expect(makeCaller(supervisor, db).compliance.update(validUpdate)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      makeCaller({ ...lead, requires2fa: true }, db).compliance.peopleOptions(),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it.each([head, pastor, lead])('encrypts and audits updates by $role', async (session) => {
    const db = makeDb();
    await makeCaller(session, db).compliance.update(validUpdate);
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'parent-1' },
      data: { dobEnc: 'enc:1987-01-02' },
    });
    expect(db.adultCompliance.upsert.mock.calls[0]?.[0]).toHaveProperty(
      'create.dbsCertificateNumberEnc',
      'enc:CERT-123',
    );
    expect(db.adultCompliance.upsert.mock.calls[0]?.[0]).toHaveProperty(
      'create.dbsApplicationReferenceEnc',
      'enc:APP-123',
    );
    expect(db.auditLog.create.mock.calls[0]?.[0]).toHaveProperty('data.action', 'Update');
    expect(db.auditLog.create.mock.calls[0]?.[0]).toHaveProperty('data.entity', 'AdultCompliance');
    expect(db.auditLog.create.mock.calls[0]?.[0]).toHaveProperty('data.entityId', 'parent-1');
  });

  it('rejects updates to accounts outside the exact register roles', async () => {
    const db = makeDb();
    db.user.findUnique.mockResolvedValue({ id: 'parent-1', role: 'Principal' });
    await expect(makeCaller(lead, db).compliance.update(validUpdate)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(db.adultCompliance.upsert).not.toHaveBeenCalled();
  });

  it('filters MedTab to active students with recorded medical text', async () => {
    const db = makeDb();
    db.studentRegistrationProfile.findMany.mockResolvedValue([
      {
        studentId: 'one',
        student: { fullNameEnc: 'enc:One', yearGroup: 'Year 4' },
        allergiesEnc: 'enc:Peanuts',
        medicalConditionsEnc: null,
        medicationAtCentreEnc: null,
      },
      {
        studentId: 'two',
        student: { fullNameEnc: 'enc:Two', yearGroup: 'Year 5' },
        allergiesEnc: 'enc:  ',
        medicalConditionsEnc: null,
        medicationAtCentreEnc: null,
      },
    ]);
    await expect(makeCaller(lead, db).compliance.medTab()).resolves.toEqual([
      {
        studentId: 'one',
        fullName: 'One',
        yearGroup: 'Year 4',
        allergies: 'Peanuts',
        medicalConditions: null,
        medicationAtCentre: null,
      },
    ]);
    expect(db.studentRegistrationProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { student: { active: true } } }),
    );
    expect(db.auditLog.create.mock.calls[0]?.[0]).toHaveProperty('data.action', 'ReadSensitive');
  });

  it('returns a not recorded DBS summary for an adult without a compliance record', async () => {
    const db = makeDb();
    db.user.findMany.mockResolvedValue([{ id: 'parent-1', adultCompliance: null }]);
    await expect(
      makeCaller(supervisor, db).compliance.badgeSummaries({ userIds: ['parent-1'] }),
    ).resolves.toEqual([
      {
        userId: 'parent-1',
        badges: { dbsStatus: 'NotRecorded', firstAidTrained: false, safeguardingTrained: false },
      },
    ]);
    expect(db.user.findMany.mock.calls[0]?.[0]).toHaveProperty('where.role.in', [
      'Supervisor',
      'Parent',
    ]);
  });

  it('pages across every matching account, including inactive adults', async () => {
    const db = makeDb();
    db.user.findMany.mockResolvedValue(
      Array.from({ length: 26 }, (_, index) => ({
        id: `adult-${String(index + 1)}`,
        role: index % 2 === 0 ? 'Supervisor' : 'Parent',
        active: index !== 25,
        fullNameEnc: `enc:Person ${String(index + 1).padStart(2, '0')}`,
        dobEnc: null,
      })),
    );
    const caller = makeCaller(lead, db);
    const first = await caller.compliance.register({ page: 1, search: '' });
    const second = await caller.compliance.register({ page: 2, search: '' });
    expect(first.total).toBe(26);
    expect(first.rows).toHaveLength(25);
    expect(second.rows).toHaveLength(1);
    expect(second.rows[0]).toHaveProperty('active', false);
  });
});
