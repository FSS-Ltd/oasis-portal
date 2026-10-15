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
const technicalSupport: SessionUser = {
  id: 'tech-support',
  role: 'TechnicalSupport',
  tags: [],
  requires2fa: false,
};
const activitiesLead: SessionUser = {
  id: 'activities-lead',
  role: 'ClubsLead',
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
    findUnique: vi.fn().mockResolvedValue({ id: 'parent-1', role: 'Parent', active: true }),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({ id: 'parent-1' }),
  };
  const adultCompliance = {
    findUnique: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue({ userId: 'parent-1' }),
    findMany: vi.fn().mockResolvedValue([]),
  };
  const student = { update: vi.fn().mockResolvedValue({ id: 'student-1' }) };
  const studentRegistrationProfile = {
    findMany: vi.fn().mockResolvedValue([]),
  };
  const auditLog = { create: vi.fn().mockResolvedValue(undefined) };
  const db = {
    user,
    adultCompliance,
    student,
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
  it('lets a tagged activities lead edit records and revokes access with the tag', async () => {
    const db = makeDb();
    const tagged = { ...activitiesLead, tags: ['compliance-admin'] };
    await expect(makeCaller(tagged, db).compliance.update(validUpdate)).resolves.toEqual({
      userId: 'parent-1',
    });
    await expect(
      makeCaller(activitiesLead, db).compliance.update(validUpdate),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
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
    await expect(
      makeCaller(technicalSupport, db).compliance.register({ page: 1, search: '' }),
    ).resolves.toHaveProperty('canEdit', false);
    await expect(makeCaller(technicalSupport, db).compliance.medTab()).resolves.toEqual([]);
    await expect(
      makeCaller(activitiesLead, db).compliance.register({ page: 1, search: '' }),
    ).resolves.toHaveProperty('canEdit', false);
    await expect(makeCaller(activitiesLead, db).compliance.medTab()).resolves.toEqual([]);
    await expect(
      makeCaller(activitiesLead, db).compliance.update(validUpdate),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      makeCaller(technicalSupport, db).compliance.update(validUpdate),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
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

  it('rejects updates to activities leads without another role', async () => {
    const db = makeDb();
    db.user.findUnique.mockResolvedValue({ id: 'parent-1', role: 'ClubsLead', active: true });
    await expect(makeCaller(lead, db).compliance.update(validUpdate)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(db.adultCompliance.upsert).not.toHaveBeenCalled();
  });

  it('rejects an under-18 date of birth on update', async () => {
    const db = makeDb();
    await expect(
      makeCaller(lead, db).compliance.update({ ...validUpdate, dob: '2020-01-01' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.adultCompliance.upsert).not.toHaveBeenCalled();
  });

  it('updates a confirmed adult student date of birth in both records', async () => {
    const db = makeDb();
    db.user.findUnique.mockResolvedValue({
      id: 'student-1',
      role: 'Student',
      active: true,
      dobEnc: null,
      studentProfile: { dobEnc: 'enc:1987-01-02' },
    });
    await makeCaller(lead, db).compliance.update({ ...validUpdate, userId: 'student-1' });
    expect(db.student.update).toHaveBeenCalledWith({
      where: { userId: 'student-1' },
      data: { dobEnc: 'enc:1987-01-02' },
    });
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
        medicalConditionsEnc: 'enc: N/A ',
        medicationAtCentreEnc: 'enc:none',
      },
      {
        studentId: 'three',
        student: { fullNameEnc: 'enc:Three', yearGroup: 'Year 6' },
        allergiesEnc: 'enc:Not Recorded',
        medicalConditionsEnc: 'enc:Asthma',
        medicationAtCentreEnc: 'enc:n/a',
      },
      {
        studentId: 'four',
        student: { fullNameEnc: 'enc:Four', yearGroup: 'Year 5' },
        allergiesEnc: 'enc: HEALTHY ',
        medicalConditionsEnc: 'enc:Not Recorded',
        medicationAtCentreEnc: null,
      },
      {
        studentId: 'five',
        student: { fullNameEnc: 'enc:Five', yearGroup: 'Year 6' },
        allergiesEnc: 'enc:Healthy',
        medicalConditionsEnc: 'enc:Asthma',
        medicationAtCentreEnc: null,
      },
    ]);
    await expect(makeCaller(lead, db).compliance.medTab()).resolves.toEqual([
      {
        studentId: 'five',
        fullName: 'Five',
        yearGroup: 'Year 6',
        allergies: null,
        medicalConditions: 'Asthma',
        medicationAtCentre: null,
      },
      {
        studentId: 'one',
        fullName: 'One',
        yearGroup: 'Year 4',
        allergies: 'Peanuts',
        medicalConditions: null,
        medicationAtCentre: null,
      },
      {
        studentId: 'three',
        fullName: 'Three',
        yearGroup: 'Year 6',
        allergies: null,
        medicalConditions: 'Asthma',
        medicationAtCentre: null,
      },
    ]);
    expect(db.studentRegistrationProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { student: { active: true } } }),
    );
    expect(db.auditLog.create.mock.calls[0]?.[0]).toHaveProperty('data.action', 'ReadSensitive');
  });

  it('limits the DBS register to active accounts', async () => {
    const db = makeDb();
    db.user.findMany.mockResolvedValue([
      { id: 'active', role: 'Supervisor', active: true, fullNameEnc: 'enc:Active' },
    ]);

    await expect(
      makeCaller(lead, db).compliance.register({ page: 1, search: '' }),
    ).resolves.toMatchObject({
      total: 1,
      rows: [{ id: 'active' }],
    });
    expect(db.user.findMany.mock.calls[0]?.[0]).toHaveProperty('where.active', true);
    expect(db.user.findMany.mock.calls[0]?.[0]).not.toHaveProperty('where.OR');
  });

  it('limits compliance editor options to active accounts', async () => {
    const db = makeDb();
    db.user.findMany.mockResolvedValue([
      {
        id: 'active-parent',
        role: 'Parent',
        active: true,
        fullNameEnc: 'enc:Active Parent',
        dobEnc: 'enc:1987-01-02',
      },
    ]);

    await expect(makeCaller(lead, db).compliance.peopleOptions()).resolves.toMatchObject([
      { id: 'active-parent', active: true, fullName: 'Active Parent' },
    ]);
    expect(db.user.findMany.mock.calls[0]?.[0]).toHaveProperty('where.active', true);
  });

  it('hides inactive accounts from record lookup and updates', async () => {
    const db = makeDb();
    db.user.findUnique.mockResolvedValue({
      id: 'parent-1',
      role: 'Parent',
      active: false,
      dobEnc: 'enc:1987-01-02',
      studentProfile: null,
    });
    const caller = makeCaller(lead, db);

    await expect(caller.compliance.person({ userId: 'parent-1' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(caller.compliance.update(validUpdate)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(db.adultCompliance.findUnique).not.toHaveBeenCalled();
    expect(db.adultCompliance.upsert).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('returns a not recorded DBS summary for an adult without a compliance record', async () => {
    const db = makeDb();
    db.user.findMany.mockResolvedValue([
      { id: 'parent-1', role: 'Parent', dobEnc: 'enc:1987-01-02', adultCompliance: null },
    ]);
    await expect(
      makeCaller(supervisor, db).compliance.badgeSummaries({ userIds: ['parent-1'] }),
    ).resolves.toEqual([
      {
        userId: 'parent-1',
        badges: { dbsStatus: 'NotRecorded', firstAidTrained: false, safeguardingTrained: false },
      },
    ]);
    expect(db.user.findMany.mock.calls[0]?.[0]).toHaveProperty(
      'where.role.in',
      expect.arrayContaining(['Pastor', 'TechnicalSupport', 'Supervisor', 'Parent']),
    );
  });

  it('shows badges for adult student accounts but not minors or activities leads only', async () => {
    const db = makeDb();
    db.user.findMany.mockResolvedValue([
      {
        id: 'adult-student',
        role: 'Student',
        dobEnc: null,
        studentProfile: { dobEnc: 'enc:2000-01-01' },
        adultCompliance: null,
      },
      {
        id: 'minor',
        role: 'Student',
        dobEnc: null,
        studentProfile: { dobEnc: 'enc:2012-01-01' },
        adultCompliance: null,
      },
      { id: 'activities-lead', role: 'ClubsLead', dobEnc: null, adultCompliance: null },
    ]);
    const badges = await makeCaller(supervisor, db).compliance.allBadgeSummaries();
    expect(badges.map((row) => row.userId)).toEqual(['adult-student']);
  });

  it('includes adult staff across roles and excludes confirmed minors from the register', async () => {
    const db = makeDb();
    db.user.findMany.mockResolvedValue([
      {
        id: 'pastor',
        role: 'Pastor',
        active: true,
        fullNameEnc: 'enc:Pastor',
        dobEnc: 'enc:1980-01-01',
      },
      {
        id: 'support',
        role: 'TechnicalSupport',
        active: true,
        fullNameEnc: 'enc:Support',
        dobEnc: null,
      },
      {
        id: 'minor',
        role: 'Supervisor',
        active: true,
        fullNameEnc: 'enc:Minor',
        dobEnc: 'enc:2010-01-01',
      },
      {
        id: 'adult-student',
        role: 'Student',
        active: true,
        fullNameEnc: 'enc:Adult Student',
        dobEnc: null,
        studentProfile: { dobEnc: 'enc:2000-01-01' },
      },
      {
        id: 'young-student',
        role: 'Student',
        active: true,
        fullNameEnc: 'enc:Young Student',
        dobEnc: null,
        studentProfile: { dobEnc: 'enc:2012-01-01' },
      },
    ]);
    const result = await makeCaller(lead, db).compliance.register({ page: 1, search: '' });
    expect(result.rows.map((row) => row.id)).toEqual(['adult-student', 'pastor', 'support']);
    expect(result.total).toBe(3);
  });

  it('paginates active adults ten at a time', async () => {
    const db = makeDb();
    db.user.findMany.mockResolvedValue(
      Array.from({ length: 21 }, (_, index) => ({
        id: `adult-${String(index + 1)}`,
        role: index % 2 === 0 ? 'Supervisor' : 'Parent',
        active: true,
        fullNameEnc: `enc:Person ${String(index + 1).padStart(2, '0')}`,
        dobEnc: null,
      })),
    );
    const caller = makeCaller(lead, db);
    const first = await caller.compliance.register({ page: 1, search: '' });
    const second = await caller.compliance.register({ page: 2, search: '' });
    const third = await caller.compliance.register({ page: 3, search: '' });
    expect(first.total).toBe(21);
    expect(first.pageSize).toBe(10);
    expect(first.rows).toHaveLength(10);
    expect(second.rows).toHaveLength(10);
    expect(third.rows).toHaveLength(1);
    expect([...first.rows, ...second.rows, ...third.rows].every((row) => row.active)).toBe(true);
    expect(db.user.findMany.mock.calls[0]?.[0]).toHaveProperty('where.active', true);
  });
});
