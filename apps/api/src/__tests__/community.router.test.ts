import { describe, expect, it, vi } from 'vitest';
import type { Role, SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { createCommunityRouter } from '../routers/community.js';
import { router } from '../trpc.js';

const headUser: SessionUser = {
  id: 'user_head',
  role: 'Head',
  tags: [],
  requires2fa: false,
};

const pastorUser: SessionUser = {
  id: 'user_pastor',
  role: 'Pastor',
  tags: [],
  requires2fa: false,
};

const supervisorUser: SessionUser = {
  id: 'user_supervisor',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};

const studentUser: SessionUser = {
  id: 'user_student_jamie',
  role: 'Student',
  tags: [],
  requires2fa: false,
};

const otherStudentUser: SessionUser = {
  id: 'user_student_lee',
  role: 'Student',
  tags: [],
  requires2fa: false,
};

const blockedStudentUser: SessionUser = {
  id: 'user_student_blocked',
  role: 'Student',
  tags: [],
  requires2fa: false,
};

interface StoredUser {
  id: string;
  role: Role;
  active: boolean;
  fullNameEnc: string;
  clerkId: string;
}

interface StoredStudent {
  id: string;
  userId: string | null;
  active: boolean;
  fullNameEnc: string;
  yearGroup: string;
}

interface StoredStudentPortalSettings {
  id: string;
  studentId: string;
  communityMessagingBlocked: boolean;
  communityMessagingBlockedReasonEnc: string | null;
  communityMessagingBlockedById: string | null;
  communityMessagingBlockedAt: Date | null;
}

interface StoredCommunityGroup {
  id: string;
  title: string;
  descriptionEnc: string | null;
  isCentral: boolean;
  isPublic: boolean;
  active: boolean;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredCommunityGroupMember {
  groupId: string;
  studentId: string;
  active: boolean;
  joinedAt: Date;
  updatedById: string | null;
  updatedAt: Date | null;
}

interface StoredCommunityMessage {
  id: string;
  groupId: string;
  senderStudentId: string;
  bodyEnc: string;
  deletedAt: Date | null;
  deletedById: string | null;
  createdAt: Date;
}

interface StoredCommunityMessageRead {
  messageId: string;
  studentId: string;
  readAt: Date;
}

interface FakeAuditCreateArgs {
  data: {
    userId: string;
    action: 'Create' | 'Update' | 'PermissionDenied';
    entity: string;
    entityId?: string | null;
    meta?: Record<string, unknown>;
  };
}

function encrypt(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : `enc:${value}`;
}

function decrypt(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.replace(/^enc:/u, '');
}

function makeUser(user: SessionUser, name: string): StoredUser {
  return {
    id: user.id,
    role: user.role,
    active: true,
    fullNameEnc: encrypt(name) ?? '',
    clerkId: `clerk_${user.id}`,
  };
}

function makeStudent(input: {
  id: string;
  userId: string | null;
  fullName: string;
  yearGroup?: string;
}): StoredStudent {
  return {
    id: input.id,
    userId: input.userId,
    active: true,
    fullNameEnc: encrypt(input.fullName) ?? '',
    yearGroup: input.yearGroup ?? 'Year 7',
  };
}

function makeGroup(input: Partial<StoredCommunityGroup> & Pick<StoredCommunityGroup, 'id'>) {
  return {
    title: 'Central Community',
    descriptionEnc: encrypt('A place for all students'),
    isCentral: true,
    isPublic: true,
    active: true,
    createdById: headUser.id,
    updatedById: null,
    createdAt: new Date('2026-06-12T08:00:00.000Z'),
    updatedAt: new Date('2026-06-12T08:00:00.000Z'),
    ...input,
  } satisfies StoredCommunityGroup;
}

function makeMembership(
  input: Pick<StoredCommunityGroupMember, 'groupId' | 'studentId'> &
    Partial<StoredCommunityGroupMember>,
) {
  return {
    active: true,
    joinedAt: new Date('2026-06-12T08:05:00.000Z'),
    updatedById: null,
    updatedAt: null,
    ...input,
  } satisfies StoredCommunityGroupMember;
}

function makeMessage(
  input: Pick<StoredCommunityMessage, 'id' | 'groupId' | 'senderStudentId'> &
    Partial<StoredCommunityMessage>,
) {
  return {
    bodyEnc: encrypt('Hello community') ?? '',
    deletedAt: null,
    deletedById: null,
    createdAt: new Date('2026-06-12T08:10:00.000Z'),
    ...input,
  } satisfies StoredCommunityMessage;
}

function makeRead(
  input: Pick<StoredCommunityMessageRead, 'messageId' | 'studentId'> &
    Partial<StoredCommunityMessageRead>,
) {
  return {
    readAt: new Date('2026-06-12T08:30:00.000Z'),
    ...input,
  } satisfies StoredCommunityMessageRead;
}

function makeSettings(
  studentId: string,
  overrides: Partial<StoredStudentPortalSettings> = {},
): StoredStudentPortalSettings {
  return {
    id: `settings_${studentId}`,
    studentId,
    communityMessagingBlocked: false,
    communityMessagingBlockedReasonEnc: null,
    communityMessagingBlockedById: null,
    communityMessagingBlockedAt: null,
    ...overrides,
  };
}

function makeFakeDb() {
  const users: StoredUser[] = [
    makeUser(headUser, 'Hannah Head'),
    makeUser(pastorUser, 'Peter Pastor'),
    makeUser(supervisorUser, 'Sam Supervisor'),
    makeUser(studentUser, 'Jamie Learner'),
    makeUser(otherStudentUser, 'Lee Learner'),
    makeUser(blockedStudentUser, 'Blocked Learner'),
  ];
  const students: StoredStudent[] = [
    makeStudent({ id: 'student_jamie', userId: studentUser.id, fullName: 'Jamie Learner' }),
    makeStudent({ id: 'student_lee', userId: otherStudentUser.id, fullName: 'Lee Learner' }),
    makeStudent({
      id: 'student_blocked',
      userId: blockedStudentUser.id,
      fullName: 'Blocked Learner',
    }),
    makeStudent({ id: 'student_unlinked', userId: null, fullName: 'Unlinked Learner' }),
  ];
  const settings = new Map<string, StoredStudentPortalSettings>([
    ['student_jamie', makeSettings('student_jamie')],
    ['student_lee', makeSettings('student_lee')],
    [
      'student_blocked',
      makeSettings('student_blocked', {
        communityMessagingBlocked: true,
        communityMessagingBlockedReasonEnc: encrypt('Cooling-off period'),
        communityMessagingBlockedById: headUser.id,
        communityMessagingBlockedAt: new Date('2026-06-12T08:00:00.000Z'),
      }),
    ],
  ]);
  const groups: StoredCommunityGroup[] = [
    makeGroup({ id: 'group_central' }),
    makeGroup({
      id: 'group_chess',
      title: 'Chess Club',
      descriptionEnc: encrypt('Chess study group'),
      isCentral: false,
    }),
    makeGroup({
      id: 'group_private',
      title: 'Private Group',
      descriptionEnc: encrypt('Invite only'),
      isCentral: false,
      isPublic: false,
    }),
  ];
  const memberships: StoredCommunityGroupMember[] = [
    makeMembership({ groupId: 'group_central', studentId: 'student_jamie' }),
    makeMembership({ groupId: 'group_chess', studentId: 'student_jamie' }),
    makeMembership({ groupId: 'group_central', studentId: 'student_lee' }),
    makeMembership({ groupId: 'group_central', studentId: 'student_blocked' }),
  ];
  const messages: StoredCommunityMessage[] = [
    makeMessage({
      id: 'message_lee_1',
      groupId: 'group_central',
      senderStudentId: 'student_lee',
      bodyEnc: encrypt('Good morning') ?? '',
    }),
    makeMessage({
      id: 'message_jamie_1',
      groupId: 'group_central',
      senderStudentId: 'student_jamie',
      bodyEnc: encrypt('Morning') ?? '',
      createdAt: new Date('2026-06-12T08:12:00.000Z'),
    }),
  ];
  const reads: StoredCommunityMessageRead[] = [
    makeRead({ messageId: 'message_jamie_1', studentId: 'student_lee' }),
  ];
  const auditCreate = vi.fn((args: FakeAuditCreateArgs) => Promise.resolve(args));

  const userFor = (userId: string | null) =>
    userId ? (users.find((user) => user.id === userId) ?? null) : null;
  const studentFor = (studentId: string) => {
    const student = students.find((row) => row.id === studentId);
    if (!student) throw new Error(`student not found: ${studentId}`);
    return student;
  };
  const groupMembers = (groupId: string) =>
    memberships.filter((row) => row.groupId === groupId && row.active);
  const groupMessages = (groupId: string) =>
    messages.filter((row) => row.groupId === groupId && row.deletedAt === null);
  const readsForMessage = (messageId: string) => reads.filter((row) => row.messageId === messageId);
  const groupPayload = (group: StoredCommunityGroup) => ({
    ...group,
    members: groupMembers(group.id).map((member) => ({
      ...member,
      student: {
        ...studentFor(member.studentId),
        user: userFor(studentFor(member.studentId).userId),
        portalSettings: settings.get(member.studentId) ?? null,
      },
    })),
    messages: groupMessages(group.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((message) => ({
        ...message,
        senderStudent: {
          ...studentFor(message.senderStudentId),
          user: userFor(studentFor(message.senderStudentId).userId),
        },
        reads: readsForMessage(message.id),
      })),
    _count: {
      members: groupMembers(group.id).length,
      messages: groupMessages(group.id).length,
    },
  });
  const studentPayload = (student: StoredStudent) => ({
    ...student,
    user: userFor(student.userId),
    portalSettings: settings.get(student.id) ?? null,
  });

  return {
    $enc: { encrypt, decrypt },
    auditLog: { create: auditCreate },
    user: {
      findMany: vi.fn(({ where }: { where?: { active?: boolean; role?: { in: Role[] } } } = {}) =>
        Promise.resolve(
          users.filter(
            (user) =>
              (where?.active === undefined || user.active === where.active) &&
              (!where?.role?.in || where.role.in.includes(user.role)),
          ),
        ),
      ),
    },
    student: {
      findFirst: vi.fn(({ where }: { where: { userId?: string; active?: boolean; id?: string } }) =>
        Promise.resolve(
          (() => {
            const student =
              students.find(
                (row) =>
                  (where.userId === undefined || row.userId === where.userId) &&
                  (where.id === undefined || row.id === where.id) &&
                  (where.active === undefined || row.active === where.active),
              ) ?? null;
            return student ? studentPayload(student) : null;
          })(),
        ),
      ),
      findMany: vi.fn(({ where }: { where?: { active?: boolean; userId?: { not: null } } } = {}) =>
        Promise.resolve(
          students
            .filter(
              (student) =>
                (where?.active === undefined || student.active === where.active) &&
                (!where?.userId || student.userId !== null),
            )
            .map((student) => studentPayload(student)),
        ),
      ),
    },
    studentPortalSettings: {
      upsert: vi.fn(
        ({
          where,
          create,
          update,
        }: {
          where: { studentId: string };
          create: Partial<StoredStudentPortalSettings> & { studentId: string };
          update: Partial<StoredStudentPortalSettings>;
        }) => {
          const existing = settings.get(where.studentId);
          const next = existing
            ? { ...existing, ...update }
            : makeSettings(create.studentId, create);
          settings.set(where.studentId, next);
          return Promise.resolve(next);
        },
      ),
    },
    communityGroup: {
      findFirst: vi.fn(({ where }: { where: Partial<StoredCommunityGroup> }) =>
        Promise.resolve(
          groups.find((group) =>
            Object.entries(where).every(
              ([key, value]) => group[key as keyof StoredCommunityGroup] === value,
            ),
          ) ?? null,
        ),
      ),
      findMany: vi.fn(() =>
        Promise.resolve(
          groups
            .slice()
            .sort((a, b) => {
              if (a.isCentral !== b.isCentral) return a.isCentral ? -1 : 1;
              return b.updatedAt.getTime() - a.updatedAt.getTime();
            })
            .map(groupPayload),
        ),
      ),
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const group = groups.find((row) => row.id === where.id);
        return Promise.resolve(group ? groupPayload(group) : null);
      }),
      create: vi.fn(
        ({
          data,
        }: {
          data: Pick<StoredCommunityGroup, 'title' | 'isPublic' | 'active'> &
            Partial<StoredCommunityGroup>;
        }) => {
          const group = makeGroup({
            id: `group_${String(groups.length + 1)}`,
            createdAt: new Date('2026-06-12T09:00:00.000Z'),
            updatedAt: new Date('2026-06-12T09:00:00.000Z'),
            ...data,
          });
          groups.push(group);
          return Promise.resolve(groupPayload(group));
        },
      ),
      update: vi.fn(
        ({ where, data }: { where: { id: string }; data: Partial<StoredCommunityGroup> }) => {
          const index = groups.findIndex((group) => group.id === where.id);
          if (index === -1) throw new Error('group not found');
          const currentGroup = groups[index];
          if (!currentGroup) throw new Error('group not found');
          const updatedGroup = { ...currentGroup, ...data };
          groups[index] = updatedGroup;
          return Promise.resolve(groupPayload(updatedGroup));
        },
      ),
    },
    communityGroupMember: {
      findUnique: vi.fn(
        ({ where }: { where: { groupId_studentId: { groupId: string; studentId: string } } }) =>
          Promise.resolve(
            memberships.find(
              (member) =>
                member.groupId === where.groupId_studentId.groupId &&
                member.studentId === where.groupId_studentId.studentId,
            ) ?? null,
          ),
      ),
      upsert: vi.fn(
        ({
          where,
          create,
          update,
        }: {
          where: { groupId_studentId: { groupId: string; studentId: string } };
          create: Pick<StoredCommunityGroupMember, 'groupId' | 'studentId'> &
            Partial<StoredCommunityGroupMember>;
          update: Partial<StoredCommunityGroupMember>;
        }) => {
          const existing = memberships.find(
            (member) =>
              member.groupId === where.groupId_studentId.groupId &&
              member.studentId === where.groupId_studentId.studentId,
          );
          if (existing) {
            Object.assign(existing, update);
            return Promise.resolve(existing);
          }
          const member = makeMembership(create);
          memberships.push(member);
          return Promise.resolve(member);
        },
      ),
      createMany: vi.fn(
        ({
          data,
          skipDuplicates,
        }: {
          data: Array<Pick<StoredCommunityGroupMember, 'groupId' | 'studentId'>>;
          skipDuplicates: boolean;
        }) => {
          let count = 0;
          for (const row of data) {
            const existing = memberships.some(
              (member) => member.groupId === row.groupId && member.studentId === row.studentId,
            );
            if (existing && skipDuplicates) continue;
            memberships.push(makeMembership(row));
            count += 1;
          }
          return Promise.resolve({ count });
        },
      ),
    },
    communityMessage: {
      create: vi.fn(
        ({
          data,
        }: {
          data: Pick<StoredCommunityMessage, 'groupId' | 'senderStudentId' | 'bodyEnc'>;
        }) => {
          const message = makeMessage({
            id: `message_${String(messages.length + 1)}`,
            createdAt: new Date('2026-06-12T09:05:00.000Z'),
            ...data,
          });
          messages.push(message);
          return Promise.resolve({
            ...message,
            senderStudent: {
              ...studentFor(message.senderStudentId),
              user: userFor(studentFor(message.senderStudentId).userId),
            },
            reads: readsForMessage(message.id),
          });
        },
      ),
      findMany: vi.fn(({ where }: { where: { groupId: string; deletedAt?: null } }) =>
        Promise.resolve(
          groupMessages(where.groupId)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map((message) => ({
              ...message,
              senderStudent: {
                ...studentFor(message.senderStudentId),
                user: userFor(studentFor(message.senderStudentId).userId),
              },
              reads: readsForMessage(message.id),
            })),
        ),
      ),
    },
    communityMessageRead: {
      createMany: vi.fn(
        ({
          data,
          skipDuplicates,
        }: {
          data: Array<Pick<StoredCommunityMessageRead, 'messageId' | 'studentId'>>;
          skipDuplicates: boolean;
        }) => {
          let count = 0;
          for (const row of data) {
            const existing = reads.some(
              (read) => read.messageId === row.messageId && read.studentId === row.studentId,
            );
            if (existing && skipDuplicates) continue;
            reads.push(makeRead(row));
            count += 1;
          }
          return Promise.resolve({ count });
        },
      ),
    },
    users,
    students,
    settings,
    groups,
    memberships,
    messages,
    reads,
  };
}

function makeCtx(user: SessionUser | null, db: ReturnType<typeof makeFakeDb>): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_community_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn({} as RlsTx),
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db = makeFakeDb()) {
  const appRouter = router({ community: createCommunityRouter() });
  return { caller: appRouter.createCaller(makeCtx(user, db)), db };
}

describe('community student access', () => {
  it('lists active central and joined groups for a student with moderation state', async () => {
    const { caller } = makeCaller(studentUser);

    await expect(caller.community.listStudentGroups()).resolves.toMatchObject({
      currentStudentId: 'student_jamie',
      communityMessagingBlocked: false,
      groups: [
        { id: 'group_central', title: 'Central Community', joined: true, isCentral: true },
        { id: 'group_chess', title: 'Chess Club', joined: true, isCentral: false },
      ],
    });
  });

  it('denies message reads when the student is not an active group member', async () => {
    const { caller } = makeCaller(otherStudentUser);

    await expect(
      caller.community.listGroupMessages({ groupId: 'group_chess' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('allows a student to join an active public group', async () => {
    const { caller, db } = makeCaller(otherStudentUser);

    await expect(caller.community.joinGroup({ groupId: 'group_chess' })).resolves.toMatchObject({
      id: 'group_chess',
      joined: true,
    });

    expect(db.memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ groupId: 'group_chess', studentId: 'student_lee', active: true }),
      ]),
    );
  });

  it('blocks student sending when messaging is disabled for that child', async () => {
    const { caller } = makeCaller(blockedStudentUser);

    await expect(
      caller.community.sendMessage({ groupId: 'group_central', body: 'Can I post?' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('stores text messages only and rejects unknown attachment input keys', async () => {
    const { caller, db } = makeCaller(studentUser);
    // Deliberately bypass the generated input type to prove runtime strict validation rejects attachments.
    const sendUnknownInput = caller.community.sendMessage as unknown as (input: {
      groupId: string;
      body: string;
      imageUrl: string;
    }) => Promise<unknown>;

    await expect(
      sendUnknownInput({
        groupId: 'group_central',
        body: 'Text only',
        imageUrl: 'https://example.test/not-allowed.png',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(db.messages).toHaveLength(2);
  });

  it('marks unread messages from other students as read when the group is opened', async () => {
    const { caller, db } = makeCaller(studentUser);

    const result = await caller.community.listGroupMessages({ groupId: 'group_central' });

    expect(result.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'message_lee_1',
          body: 'Good morning',
          readByCurrentStudent: true,
        }),
      ]),
    );
    expect(db.reads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ messageId: 'message_lee_1', studentId: 'student_jamie' }),
      ]),
    );
  });
});

describe('community admin moderation', () => {
  it('allows full admins to create and update groups', async () => {
    const { caller, db } = makeCaller(pastorUser);

    const created = await caller.community.createGroup({
      title: 'Book Club',
      description: 'Weekly reading discussion',
      isPublic: true,
      active: true,
    });
    expect(created).toMatchObject({ title: 'Book Club', isPublic: true, active: true });

    await expect(
      caller.community.updateGroup({
        groupId: created.id,
        title: 'Book Club Updated',
        description: 'Updated description',
        isPublic: false,
        active: false,
      }),
    ).resolves.toMatchObject({ title: 'Book Club Updated', isPublic: false, active: false });

    const auditActions = db.auditLog.create.mock.calls.map(([args]) => args.data);
    expect(auditActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'Create', entity: 'CommunityGroup' }),
      ]),
    );
  });

  it('allows full admins to disable and re-enable student messaging with a reason', async () => {
    const { caller, db } = makeCaller(headUser);

    await expect(
      caller.community.setStudentMessagingBlocked({
        studentId: 'student_jamie',
        blocked: true,
        reason: 'Pastoral follow-up',
      }),
    ).resolves.toMatchObject({
      studentId: 'student_jamie',
      communityMessagingBlocked: true,
      communityMessagingBlockedReason: 'Pastoral follow-up',
    });

    expect(db.settings.get('student_jamie')).toMatchObject({
      communityMessagingBlocked: true,
      communityMessagingBlockedReasonEnc: encrypt('Pastoral follow-up'),
      communityMessagingBlockedById: headUser.id,
    });

    await expect(
      caller.community.setStudentMessagingBlocked({
        studentId: 'student_jamie',
        blocked: false,
        reason: '',
      }),
    ).resolves.toMatchObject({
      studentId: 'student_jamie',
      communityMessagingBlocked: false,
      communityMessagingBlockedReason: null,
    });
  });

  it('denies community moderation to non-full-admin staff', async () => {
    const { caller } = makeCaller(supervisorUser);

    await expect(caller.community.listAdminGroups()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
