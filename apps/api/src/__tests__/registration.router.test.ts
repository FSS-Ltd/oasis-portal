import { describe, expect, it, vi } from 'vitest';
import type { ParentInitialRegistrationInput, SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { registrationRouter } from '../routers/registration.js';
import { router } from '../trpc.js';

const parentUser: SessionUser = { id: 'u_parent', role: 'Parent', tags: [], requires2fa: false };
const otherParentUser: SessionUser = {
  id: 'u_other_parent',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};
const headUser: SessionUser = { id: 'u_head', role: 'Head', tags: [], requires2fa: false };
const studentUser: SessionUser = { id: 'u_student', role: 'Student', tags: [], requires2fa: false };

function encrypt(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : `enc:${value}`;
}

function decrypt(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.replace(/^enc:/u, '');
}

function blindIndex(value: string): string {
  return `bidx:${value.trim().toLowerCase()}`;
}

function validConsent(initials = 'JF') {
  return { granted: true, initials };
}

function validStudent(name: string): ParentInitialRegistrationInput['students'][number] {
  return {
    fullName: name,
    preferredName: name.split(' ')[0] ?? name,
    dob: new Date('2016-03-04T00:00:00.000Z'),
    gender: 'Female',
    yearGroup: 'Year 5',
    startDate: new Date('2026-04-27T00:00:00.000Z'),
    homeLanguage: 'English',
    studentNotes: 'Routine notes',
    allergies: 'N/A',
    medicalConditions: 'N/A',
    medicationAtCentre: 'N/A',
    dietaryRestrictions: 'N/A',
    learningSupport: 'N/A',
    interestsStrengths: 'Reading',
    settlingComfortNotes: 'Quiet transitions',
    additionalInfo: 'N/A',
    consents: {
      Contact: validConsent(),
      EmergencyMedical: validConsent(),
      LocalActivities: validConsent(),
      PhotoVideo: validConsent(),
      Accuracy: validConsent(),
    },
  };
}

function validPayload(): ParentInitialRegistrationInput {
  return {
    homeAddress: '12 Oasis Road, London',
    guardianContacts: [
      {
        fullName: 'Parent One',
        relationship: 'Mother',
        primaryPhone: '07123456789',
        secondaryPhone: '',
        email: 'parent@example.com',
        workPhone: '',
        address: '',
      },
    ],
    emergencyContacts: [
      {
        fullName: 'Emergency One',
        relationship: 'Aunt',
        primaryPhone: '07987654321',
        secondaryPhone: '',
        email: '',
        canPickUp: true,
      },
    ],
    pickupContacts: [
      {
        fullName: 'Pickup One',
        relationship: 'Uncle',
        phone: '07000000000',
        idPasswordNote: 'Blue card',
      },
    ],
    students: [validStudent('Jane Learner'), validStudent('John Learner')],
    agreement: {
      guardianName: 'Parent One',
      agreementDate: new Date('2026-04-27T00:00:00.000Z'),
    },
  };
}

function validSharedPayload() {
  const payload = validPayload();
  return {
    homeAddress: payload.homeAddress,
    guardianContacts: payload.guardianContacts,
    emergencyContacts: payload.emergencyContacts,
    pickupContacts: payload.pickupContacts,
    agreement: payload.agreement,
  };
}

function validSiblingPayload(name = 'New Sibling') {
  return {
    ...validSharedPayload(),
    student: validStudent(name),
  };
}

function makeFakeDb() {
  const users: Array<{
    id: string;
    role: SessionUser['role'];
    active: boolean;
    emailBidx?: string | undefined;
    childRegistrationPromptStatus: string;
    childRegistrationPromptAnsweredAt: Date | null;
  }> = [
    {
      id: parentUser.id,
      role: parentUser.role,
      active: true,
      emailBidx: blindIndex('parent@example.com'),
      childRegistrationPromptStatus: 'Unanswered',
      childRegistrationPromptAnsweredAt: null,
    },
    {
      id: otherParentUser.id,
      role: otherParentUser.role,
      active: true,
      emailBidx: blindIndex('other-parent@example.com'),
      childRegistrationPromptStatus: 'Unanswered',
      childRegistrationPromptAnsweredAt: null,
    },
    {
      id: headUser.id,
      role: headUser.role,
      active: true,
      emailBidx: undefined,
      childRegistrationPromptStatus: 'Unanswered',
      childRegistrationPromptAnsweredAt: null,
    },
    {
      id: studentUser.id,
      role: studentUser.role,
      active: true,
      emailBidx: undefined,
      childRegistrationPromptStatus: 'Unanswered',
      childRegistrationPromptAnsweredAt: null,
    },
  ];
  const registrations: Array<Record<string, unknown>> = [];
  const guardianContacts: Array<Record<string, unknown>> = [];
  const emergencyContacts: Array<Record<string, unknown>> = [];
  const pickupContacts: Array<Record<string, unknown>> = [];
  const students: Array<Record<string, unknown>> = [];
  const guardians: Array<Record<string, unknown>> = [];
  const profiles: Array<Record<string, unknown>> = [];
  const consents: Array<Record<string, unknown>> = [];
  const studentRegistrationCodes: Array<Record<string, unknown>> = [];
  const studentSelfRegistrations: Array<Record<string, unknown>> = [];
  const studentParentLinkRequests: Array<Record<string, unknown>> = [];
  const userInvitations: Array<Record<string, unknown>> = [];

  function buildRegistrationRow(registration: Record<string, unknown>) {
    return {
      ...registration,
      guardianContacts: guardianContacts.filter(
        (contact) => contact.registrationId === registration.id,
      ),
      emergencyContacts: emergencyContacts.filter(
        (contact) => contact.registrationId === registration.id,
      ),
      pickupContacts: pickupContacts.filter(
        (contact) => contact.registrationId === registration.id,
      ),
      studentProfiles: profiles
        .filter((profile) => profile.registrationId === registration.id)
        .map((profile) => ({
          ...profile,
          consents: consents.filter((consent) => consent.profileId === profile.id),
          student: students.find((student) => student.id === profile.studentId),
        })),
    };
  }

  function replaceRegistrationRows(
    rows: Array<Record<string, unknown>>,
    registrationId: unknown,
    createRows: Array<Record<string, unknown>>,
    idPrefix: string,
  ) {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      if (rows[index]?.registrationId === registrationId) rows.splice(index, 1);
    }
    for (const row of createRows) {
      rows.push({
        id: `${idPrefix}_${String(rows.length + 1)}`,
        registrationId,
        ...row,
      });
    }
  }

  function buildStudentSelfRegistrationRow(registration: Record<string, unknown>) {
    return {
      ...registration,
      registrationCode: studentRegistrationCodes.find(
        (code) => code.id === registration.registrationCodeId,
      ),
      invitation:
        userInvitations.find(
          (invitation) => invitation.studentSelfRegistrationId === registration.id,
        ) ?? null,
      parentLinkRequests: studentParentLinkRequests.filter(
        (request) => request.studentSelfRegistrationId === registration.id,
      ),
    };
  }

  function buildParentLinkRequestRow(request: Record<string, unknown>) {
    const registration = studentSelfRegistrations.find(
      (candidate) => candidate.id === request.studentSelfRegistrationId,
    );
    const student = students.find((candidate) => candidate.id === request.studentId);
    if (!registration) throw new Error('self registration not found for link request');
    return {
      ...request,
      studentSelfRegistration: registration,
      student: student ?? null,
    };
  }

  const db = {
    $enc: {
      encrypt: vi.fn(encrypt),
      decrypt: vi.fn(decrypt),
      blindIndex: vi.fn(blindIndex),
    },
    $transaction: vi.fn(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)),
    auditLog: {
      create: vi.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: `audit_${String(data.entityId ?? data.entity)}`, ...data }),
      ),
    },
    user: {
      findUnique: vi.fn(({ where }: { where: { id?: string; emailBidx?: string } }) =>
        Promise.resolve(
          users.find(
            (user) =>
              (where.id !== undefined && user.id === where.id) ||
              (where.emailBidx !== undefined && user.emailBidx === where.emailBidx),
          ) ?? null,
        ),
      ),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const user = users.find((candidate) => candidate.id === where.id);
        if (!user) return Promise.resolve(null);
        Object.assign(user, data);
        return Promise.resolve(user);
      }),
    },
    parentRegistration: {
      findUnique: vi.fn(({ where }: { where: { parentUserId: string } }) =>
        Promise.resolve(
          (() => {
            const registration = registrations.find(
              (candidate) =>
                candidate.parentUserId === where.parentUserId ||
                candidate.id === where.parentUserId,
            );
            return registration ? buildRegistrationRow(registration) : null;
          })(),
        ),
      ),
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        const registration = {
          id: `reg_${String(registrations.length + 1)}`,
          submittedAt: new Date('2026-04-27T10:00:00.000Z'),
          createdAt: new Date('2026-04-27T10:00:00.000Z'),
          updatedAt: new Date('2026-04-27T10:00:00.000Z'),
          ...data,
        };
        registrations.push(registration);

        const guardianCreate = data.guardianContacts as { create: Array<Record<string, unknown>> };
        for (const contact of guardianCreate.create) {
          guardianContacts.push({
            id: `guardian_contact_${String(guardianContacts.length + 1)}`,
            registrationId: registration.id,
            ...contact,
          });
        }
        const emergencyCreate = data.emergencyContacts as {
          create: Array<Record<string, unknown>>;
        };
        for (const contact of emergencyCreate.create) {
          emergencyContacts.push({
            id: `emergency_contact_${String(emergencyContacts.length + 1)}`,
            registrationId: registration.id,
            ...contact,
          });
        }
        const pickupCreate = data.pickupContacts as { create: Array<Record<string, unknown>> };
        for (const contact of pickupCreate.create) {
          pickupContacts.push({
            id: `pickup_contact_${String(pickupContacts.length + 1)}`,
            registrationId: registration.id,
            ...contact,
          });
        }

        return Promise.resolve({ id: registration.id });
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const registration = registrations.find((candidate) => candidate.id === where.id);
        if (!registration) return Promise.reject(new Error('registration not found'));
        Object.assign(registration, {
          homeAddressEnc: data.homeAddressEnc,
          agreementNameEnc: data.agreementNameEnc,
          agreementDate: data.agreementDate,
        });

        const guardianCreate = data.guardianContacts as { create: Array<Record<string, unknown>> };
        replaceRegistrationRows(
          guardianContacts,
          registration.id,
          guardianCreate.create,
          'guardian_contact',
        );
        const emergencyCreate = data.emergencyContacts as {
          create: Array<Record<string, unknown>>;
        };
        replaceRegistrationRows(
          emergencyContacts,
          registration.id,
          emergencyCreate.create,
          'emergency_contact',
        );
        const pickupCreate = data.pickupContacts as { create: Array<Record<string, unknown>> };
        replaceRegistrationRows(
          pickupContacts,
          registration.id,
          pickupCreate.create,
          'pickup_contact',
        );

        return Promise.resolve({ id: registration.id });
      }),
    },
    guardian: {
      count: vi.fn(({ where }: { where: { userId: string } }) =>
        Promise.resolve(guardians.filter((guardian) => guardian.userId === where.userId).length),
      ),
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        const guardian = { id: `guardian_${String(guardians.length + 1)}`, ...data };
        guardians.push(guardian);
        return Promise.resolve({ id: guardian.id });
      }),
      createMany: vi.fn(
        ({ data }: { data: Array<Record<string, unknown>>; skipDuplicates: true }) => {
          let count = 0;
          for (const row of data) {
            const duplicate = guardians.some(
              (guardian) => guardian.userId === row.userId && guardian.studentId === row.studentId,
            );
            if (duplicate) continue;
            guardians.push({ id: `guardian_${String(guardians.length + 1)}`, ...row });
            count += 1;
          }
          return Promise.resolve({ count });
        },
      ),
    },
    student: {
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        const student = {
          id: `student_${String(students.length + 1)}`,
          userId: null,
          addressEnc: null,
          createdAt: new Date('2026-04-27T10:00:00.000Z'),
          updatedAt: new Date('2026-04-27T10:00:00.000Z'),
          ...data,
        };
        students.push(student);
        return Promise.resolve({ id: student.id });
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const student = students.find((candidate) => candidate.id === where.id);
        if (!student) return Promise.reject(new Error('student not found'));
        Object.assign(student, data);
        return Promise.resolve({ id: student.id });
      }),
    },
    studentRegistrationCode: {
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        if (studentRegistrationCodes.some((code) => code.codeBidx === data.codeBidx)) {
          return Promise.reject(new Error('duplicate registration code'));
        }
        const code = {
          id: `student_code_${String(studentRegistrationCodes.length + 1)}`,
          active: true,
          usedCount: 0,
          createdAt: new Date('2026-04-27T10:00:00.000Z'),
          updatedAt: new Date('2026-04-27T10:00:00.000Z'),
          ...data,
        };
        studentRegistrationCodes.push(code);
        return Promise.resolve(code);
      }),
      findMany: vi.fn(() => Promise.resolve([...studentRegistrationCodes].reverse())),
      findUnique: vi.fn(({ where }: { where: { codeBidx: string } }) =>
        Promise.resolve(
          studentRegistrationCodes.find((code) => code.codeBidx === where.codeBidx) ?? null,
        ),
      ),
      updateMany: vi.fn(
        ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const code = studentRegistrationCodes.find((candidate) => candidate.id === where.id);
          if (!code) return Promise.resolve({ count: 0 });
          if (
            typeof data.usedCount === 'object' &&
            data.usedCount !== null &&
            'increment' in data.usedCount
          ) {
            code.usedCount = Number(code.usedCount ?? 0) + Number(data.usedCount.increment);
          } else {
            Object.assign(code, data);
          }
          return Promise.resolve({ count: 1 });
        },
      ),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const code = studentRegistrationCodes.find((candidate) => candidate.id === where.id);
        if (!code) return Promise.reject(new Error('code not found'));
        if (
          typeof data.usedCount === 'object' &&
          data.usedCount !== null &&
          'increment' in data.usedCount
        ) {
          code.usedCount = Number(code.usedCount ?? 0) + Number(data.usedCount.increment);
        } else {
          Object.assign(code, data);
        }
        return Promise.resolve({ id: code.id });
      }),
    },
    studentSelfRegistration: {
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        const activeDuplicate = studentSelfRegistrations.find(
          (registration) =>
            registration.emailBidx === data.emailBidx &&
            ['Pending', 'AwaitingConsent', 'Activated'].includes(String(registration.status)),
        );
        if (activeDuplicate) return Promise.reject(new Error('duplicate self registration'));
        const registration = {
          id: `self_reg_${String(studentSelfRegistrations.length + 1)}`,
          status: 'Pending',
          parentConsentConfirmedAt: null,
          approvedById: null,
          approvedAt: null,
          declinedById: null,
          declinedAt: null,
          declineReasonEnc: null,
          activationEmailSentAt: null,
          activationEmailMessageId: null,
          studentId: null,
          createdAt: new Date('2026-04-27T10:00:00.000Z'),
          updatedAt: new Date('2026-04-27T10:00:00.000Z'),
          ...data,
        };
        studentSelfRegistrations.push(registration);
        const parentLinkCreate = data.parentLinkRequests as
          | { create?: Array<Record<string, unknown>> }
          | undefined;
        for (const request of parentLinkCreate?.create ?? []) {
          studentParentLinkRequests.push({
            id: `parent_link_${String(studentParentLinkRequests.length + 1)}`,
            studentSelfRegistrationId: registration.id,
            studentId: null,
            status: 'Pending',
            confirmedAt: null,
            rejectedAt: null,
            invitedAt: null,
            createdAt: new Date('2026-04-27T10:00:00.000Z'),
            updatedAt: new Date('2026-04-27T10:00:00.000Z'),
            targetUserId:
              typeof request.targetUser === 'object' &&
              request.targetUser !== null &&
              'connect' in request.targetUser &&
              typeof request.targetUser.connect === 'object' &&
              request.targetUser.connect !== null &&
              'id' in request.targetUser.connect
                ? request.targetUser.connect.id
                : null,
            ...request,
            targetUser: undefined,
          });
        }
        return Promise.resolve(registration);
      }),
      findFirst: vi.fn(({ where }: { where: { emailBidx: string; status?: { in: string[] } } }) =>
        Promise.resolve(
          studentSelfRegistrations.find(
            (registration) =>
              registration.emailBidx === where.emailBidx &&
              (!where.status || where.status.in.includes(String(registration.status))),
          ) ?? null,
        ),
      ),
      findMany: vi.fn(() =>
        Promise.resolve(
          [...studentSelfRegistrations].reverse().map(buildStudentSelfRegistrationRow),
        ),
      ),
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const registration = studentSelfRegistrations.find(
          (candidate) => candidate.id === where.id,
        );
        return Promise.resolve(registration ? buildStudentSelfRegistrationRow(registration) : null);
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const registration = studentSelfRegistrations.find(
          (candidate) => candidate.id === where.id,
        );
        if (!registration) return Promise.reject(new Error('self registration not found'));
        const invitationUpdate = data.invitation as
          | { update?: Record<string, unknown> }
          | undefined;
        if (invitationUpdate?.update) {
          const invitation = userInvitations.find(
            (candidate) => candidate.studentSelfRegistrationId === registration.id,
          );
          if (invitation) Object.assign(invitation, invitationUpdate.update);
        }
        const next = { ...data };
        delete next.invitation;
        Object.assign(registration, next);
        return Promise.resolve(buildStudentSelfRegistrationRow(registration));
      }),
    },
    userInvitation: {
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        const invitation = {
          id: `invite_${String(userInvitations.length + 1)}`,
          acceptedUserId: null,
          acceptedAt: null,
          createdAt: new Date('2026-04-27T10:00:00.000Z'),
          updatedAt: new Date('2026-04-27T10:00:00.000Z'),
          ...data,
        };
        userInvitations.push(invitation);
        return Promise.resolve(invitation);
      }),
      findFirst: vi.fn(({ where }: { where: { emailBidx: string; status: string } }) =>
        Promise.resolve(
          userInvitations.find(
            (invitation) =>
              invitation.emailBidx === where.emailBidx && invitation.status === where.status,
          ) ?? null,
        ),
      ),
      update: vi.fn(
        ({
          where,
          data,
        }: {
          where: { studentSelfRegistrationId?: string; id?: string };
          data: Record<string, unknown>;
        }) => {
          const invitation = userInvitations.find(
            (candidate) =>
              (where.id !== undefined && candidate.id === where.id) ||
              (where.studentSelfRegistrationId !== undefined &&
                candidate.studentSelfRegistrationId === where.studentSelfRegistrationId),
          );
          if (!invitation) return Promise.reject(new Error('invitation not found'));
          Object.assign(invitation, data);
          return Promise.resolve({ id: invitation.id });
        },
      ),
    },
    studentParentLinkRequest: {
      findMany: vi.fn(
        ({
          where,
        }: {
          where?: {
            targetUserId?: string | { not: null };
            status?: string;
            studentSelfRegistrationId?: string;
            studentId?: string | null;
            existingAccount?: boolean;
          };
        }) =>
          Promise.resolve(
            studentParentLinkRequests
              .filter((request) => {
                if (where?.targetUserId !== undefined) {
                  if (typeof where.targetUserId === 'object' && 'not' in where.targetUserId) {
                    if (request.targetUserId === where.targetUserId.not) return false;
                  } else if (request.targetUserId !== where.targetUserId) {
                    return false;
                  }
                }
                if (where?.status !== undefined && request.status !== where.status) return false;
                if (
                  where?.studentSelfRegistrationId !== undefined &&
                  request.studentSelfRegistrationId !== where.studentSelfRegistrationId
                ) {
                  return false;
                }
                if (where?.studentId !== undefined && request.studentId !== where.studentId) {
                  return false;
                }
                if (
                  where?.existingAccount !== undefined &&
                  request.existingAccount !== where.existingAccount
                ) {
                  return false;
                }
                return true;
              })
              .map(buildParentLinkRequestRow),
          ),
      ),
      findFirst: vi.fn(
        ({ where }: { where: { id?: string; targetUserId?: string; status?: string } }) =>
          Promise.resolve(
            (() => {
              const request = studentParentLinkRequests.find(
                (candidate) =>
                  (where.id === undefined || candidate.id === where.id) &&
                  (where.targetUserId === undefined ||
                    candidate.targetUserId === where.targetUserId) &&
                  (where.status === undefined || candidate.status === where.status),
              );
              return request ? buildParentLinkRequestRow(request) : null;
            })(),
          ),
      ),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const request = studentParentLinkRequests.find((candidate) => candidate.id === where.id);
        if (!request) return Promise.reject(new Error('parent link request not found'));
        const next = { ...data };
        if (
          typeof data.student === 'object' &&
          data.student !== null &&
          'connect' in data.student &&
          typeof data.student.connect === 'object' &&
          data.student.connect !== null &&
          'id' in data.student.connect
        ) {
          next.studentId = data.student.connect.id;
        }
        delete next.student;
        Object.assign(request, next);
        return Promise.resolve(buildParentLinkRequestRow(request));
      }),
      updateMany: vi.fn(
        ({
          where,
          data,
        }: {
          where: { studentSelfRegistrationId?: string; id?: { in: string[] }; status?: string };
          data: Record<string, unknown>;
        }) => {
          let count = 0;
          for (const request of studentParentLinkRequests) {
            if (
              where.studentSelfRegistrationId !== undefined &&
              request.studentSelfRegistrationId !== where.studentSelfRegistrationId
            ) {
              continue;
            }
            if (where.id?.in && !where.id.in.includes(String(request.id))) continue;
            if (where.status !== undefined && request.status !== where.status) continue;
            Object.assign(request, data);
            count += 1;
          }
          return Promise.resolve({ count });
        },
      ),
    },
    studentRegistrationProfile: {
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        const profile = {
          id: `profile_${String(profiles.length + 1)}`,
          createdAt: new Date('2026-04-27T10:00:00.000Z'),
          updatedAt: new Date('2026-04-27T10:00:00.000Z'),
          ...data,
        };
        profiles.push(profile);
        const consentCreate = data.consents as { create: Array<Record<string, unknown>> };
        for (const consent of consentCreate.create) {
          consents.push({
            id: `consent_${String(consents.length + 1)}`,
            profileId: profile.id,
            ...consent,
          });
        }
        return Promise.resolve({ id: profile.id });
      }),
      update: vi.fn(
        ({ where, data }: { where: { studentId: string }; data: Record<string, unknown> }) => {
          const profile = profiles.find((candidate) => candidate.studentId === where.studentId);
          if (!profile) return Promise.reject(new Error('profile not found'));
          Object.assign(profile, data);
          return Promise.resolve({ id: profile.id });
        },
      ),
      findUnique: vi.fn(({ where }: { where: { studentId: string } }) => {
        const profile = profiles.find((candidate) => candidate.studentId === where.studentId);
        if (!profile) return Promise.resolve(null);
        const registration = registrations.find(
          (candidate) => candidate.id === profile.registrationId,
        );
        const student = students.find((candidate) => candidate.id === profile.studentId);
        if (!registration || !student) return Promise.resolve(null);

        return Promise.resolve({
          ...profile,
          student,
          consents: consents.filter((consent) => consent.profileId === profile.id),
          registration: {
            ...registration,
            guardianContacts: guardianContacts.filter(
              (contact) => contact.registrationId === registration.id,
            ),
            emergencyContacts: emergencyContacts.filter(
              (contact) => contact.registrationId === registration.id,
            ),
            pickupContacts: pickupContacts.filter(
              (contact) => contact.registrationId === registration.id,
            ),
            studentProfiles: profiles
              .filter((candidate) => candidate.registrationId === registration.id)
              .map((candidate) => ({
                student: students.find((row) => row.id === candidate.studentId),
              })),
          },
        });
      }),
    },
    studentRegistrationConsent: {
      upsert: vi.fn(
        ({
          where,
          update,
          create,
        }: {
          where: { profileId_consentType: { profileId: string; consentType: string } };
          update: Record<string, unknown>;
          create: Record<string, unknown>;
        }) => {
          const existing = consents.find(
            (consent) =>
              consent.profileId === where.profileId_consentType.profileId &&
              consent.consentType === where.profileId_consentType.consentType,
          );
          if (existing) {
            Object.assign(existing, update);
            return Promise.resolve({ id: existing.id });
          }
          const consent = { id: `consent_${String(consents.length + 1)}`, ...create };
          consents.push(consent);
          return Promise.resolve({ id: consent.id });
        },
      ),
    },
  };

  return {
    db,
    users,
    registrations,
    guardianContacts,
    emergencyContacts,
    pickupContacts,
    students,
    guardians,
    profiles,
    consents,
    studentRegistrationCodes,
    studentSelfRegistrations,
    studentParentLinkRequests,
    userInvitations,
  };
}

function makeCtx(user: SessionUser | null, db: ReturnType<typeof makeFakeDb>['db']): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn({} as RlsTx),
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db: ReturnType<typeof makeFakeDb>['db']) {
  const appRouter = router({ registration: registrationRouter });
  return appRouter.createCaller(makeCtx(user, db));
}

describe('registration.submitInitial', () => {
  it('creates one shared registration, active siblings, guardian links, encrypted data, and audits', async () => {
    const store = makeFakeDb();
    const caller = makeCaller(parentUser, store.db);

    await expect(caller.registration.submitInitial(validPayload())).resolves.toEqual({
      registrationId: 'reg_1',
      studentIds: ['student_1', 'student_2'],
    });

    expect(store.registrations).toHaveLength(1);
    expect(store.guardianContacts).toHaveLength(1);
    expect(store.emergencyContacts).toHaveLength(1);
    expect(store.pickupContacts).toHaveLength(1);
    expect(store.students).toHaveLength(2);
    expect(store.guardians).toEqual([
      { id: 'guardian_1', userId: parentUser.id, studentId: 'student_1' },
      { id: 'guardian_2', userId: parentUser.id, studentId: 'student_2' },
    ]);
    expect(store.students[0]).toMatchObject({
      active: true,
      fullNameEnc: 'enc:Jane Learner',
      nameBidx: 'bidx:jane learner',
      dobEnc: 'enc:2016-03-04',
      addressEnc: null,
    });
    expect(store.profiles).toHaveLength(2);
    expect(store.consents).toHaveLength(10);
    expect(store.db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: parentUser.id,
        action: 'Create',
        entity: 'ParentRegistration',
        entityId: 'reg_1',
        meta: {
          studentIds: ['student_1', 'student_2'],
          source: 'registration.submitInitial',
        },
      },
    });
  });

  it('rejects adult non-parent users until they confirm they have children at Oasis', async () => {
    const store = makeFakeDb();
    await expect(
      makeCaller(headUser, store.db).registration.submitInitial(validPayload()),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(store.db.parentRegistration.create).not.toHaveBeenCalled();
  });

  it('allows adult non-parent users to answer yes and submit registration', async () => {
    const store = makeFakeDb();
    const caller = makeCaller(headUser, store.db);

    await expect(
      caller.registration.answerChildRegistrationPrompt({ hasChildren: true }),
    ).resolves.toEqual({
      childRegistrationPromptStatus: 'HasChildren',
      updated: true,
    });
    await expect(caller.registration.submitInitial(validPayload())).resolves.toEqual({
      registrationId: 'reg_1',
      studentIds: ['student_1', 'student_2'],
    });
    expect(store.guardians).toEqual([
      { id: 'guardian_1', userId: headUser.id, studentId: 'student_1' },
      { id: 'guardian_2', userId: headUser.id, studentId: 'student_2' },
    ]);
  });

  it('stores a no-children answer without allowing the prompt to be overwritten', async () => {
    const store = makeFakeDb();
    const caller = makeCaller(headUser, store.db);

    await expect(
      caller.registration.answerChildRegistrationPrompt({ hasChildren: false }),
    ).resolves.toEqual({
      childRegistrationPromptStatus: 'NoChildren',
      updated: true,
    });
    await expect(
      caller.registration.answerChildRegistrationPrompt({ hasChildren: true }),
    ).resolves.toEqual({
      childRegistrationPromptStatus: 'NoChildren',
      updated: false,
    });
    await expect(caller.registration.submitInitial(validPayload())).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects student accounts from the child-registration prompt', async () => {
    const store = makeFakeDb();

    await expect(
      makeCaller(studentUser, store.db).registration.answerChildRegistrationPrompt({
        hasChildren: true,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(store.db.user.update).not.toHaveBeenCalled();
  });

  it('prevents duplicate first registration when a registration or child link already exists', async () => {
    const store = makeFakeDb();
    const caller = makeCaller(parentUser, store.db);
    await caller.registration.submitInitial(validPayload());

    await expect(caller.registration.submitInitial(validPayload())).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'initial registration has already been completed for this account',
    });
  });
});

describe('registration.mine', () => {
  it('returns the current parent registration and audits the sensitive read', async () => {
    const store = makeFakeDb();
    await makeCaller(parentUser, store.db).registration.submitInitial(validPayload());

    const result = await makeCaller(parentUser, store.db).registration.mine();

    expect(result).toMatchObject({
      registrationId: 'reg_1',
      homeAddress: '12 Oasis Road, London',
      students: [
        {
          studentId: 'student_1',
          fullName: 'Jane Learner',
          dob: '2016-03-04',
          consents: { Accuracy: { granted: true, initials: 'JF' } },
        },
        {
          studentId: 'student_2',
          fullName: 'John Learner',
        },
      ],
    });
    expect(store.db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: parentUser.id,
        action: 'ReadSensitive',
        entity: 'ParentRegistration',
        entityId: 'reg_1',
        meta: {
          source: 'registration.mine',
          studentCount: 2,
        },
      },
    });
  });

  it('returns null when the current parent has no registration', async () => {
    const store = makeFakeDb();

    await expect(makeCaller(parentUser, store.db).registration.mine()).resolves.toBeNull();
  });
});

describe('registration.updateMine', () => {
  it('updates the parent registration, linked student records, consents, and audit rows', async () => {
    const store = makeFakeDb();
    await makeCaller(parentUser, store.db).registration.submitInitial(validPayload());

    const updatePayload = {
      ...validPayload(),
      homeAddress: '34 Updated Street, London',
      students: [
        {
          ...validStudent('Jane Updated'),
          studentId: 'student_1',
          consents: {
            Contact: validConsent('JU'),
            EmergencyMedical: validConsent('JU'),
            LocalActivities: validConsent('JU'),
            PhotoVideo: validConsent('JU'),
            Accuracy: validConsent('JU'),
          },
        },
        {
          ...validStudent('John Learner'),
          studentId: 'student_2',
        },
      ],
    };

    await expect(
      makeCaller(parentUser, store.db).registration.updateMine(updatePayload),
    ).resolves.toEqual({
      registrationId: 'reg_1',
      studentIds: ['student_1', 'student_2'],
    });

    expect(store.registrations[0]).toMatchObject({
      homeAddressEnc: 'enc:34 Updated Street, London',
    });
    expect(store.students[0]).toMatchObject({
      fullNameEnc: 'enc:Jane Updated',
      nameBidx: 'bidx:jane updated',
    });
    expect(
      store.consents.find(
        (consent) => consent.profileId === 'profile_1' && consent.consentType === 'Accuracy',
      ),
    ).toMatchObject({ initialsEnc: 'enc:JU' });
    expect(store.db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: parentUser.id,
        action: 'Update',
        entity: 'ParentRegistration',
        entityId: 'reg_1',
        meta: {
          source: 'registration.updateMine',
          studentIds: ['student_1', 'student_2'],
        },
      },
    });
  });

  it('rejects edits for student ids outside the current parent registration', async () => {
    const store = makeFakeDb();
    await makeCaller(parentUser, store.db).registration.submitInitial({
      ...validPayload(),
      students: [validStudent('Jane Learner')],
    });
    await makeCaller(otherParentUser, store.db).registration.submitInitial({
      ...validPayload(),
      students: [validStudent('Other Learner')],
    });

    await expect(
      makeCaller(otherParentUser, store.db).registration.updateMine({
        ...validPayload(),
        students: [{ ...validStudent('Jane Learner'), studentId: 'student_1' }],
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'student is not attached to this registration',
    });
  });

  it('returns not found when editing without a registration', async () => {
    const store = makeFakeDb();

    await expect(
      makeCaller(parentUser, store.db).registration.updateMine({
        ...validPayload(),
        students: [{ ...validStudent('Jane Learner'), studentId: 'student_1' }],
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('registration.addSibling', () => {
  it('adds a sibling to the current parent registration and links the guardian', async () => {
    const store = makeFakeDb();
    await makeCaller(parentUser, store.db).registration.submitInitial({
      ...validPayload(),
      students: [validStudent('Jane Learner')],
    });

    await expect(
      makeCaller(parentUser, store.db).registration.addSibling(validSiblingPayload('New Sibling')),
    ).resolves.toEqual({
      registrationId: 'reg_1',
      studentId: 'student_2',
    });

    expect(store.students).toHaveLength(2);
    expect(store.students[1]).toMatchObject({
      fullNameEnc: 'enc:New Sibling',
      active: true,
    });
    expect(store.guardians).toContainEqual({
      id: 'guardian_2',
      userId: parentUser.id,
      studentId: 'student_2',
    });
    expect(store.profiles).toHaveLength(2);
    expect(store.db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: parentUser.id,
        action: 'Update',
        entity: 'ParentRegistration',
        entityId: 'reg_1',
        meta: {
          source: 'registration.addSibling',
          studentId: 'student_2',
        },
      },
    });
  });

  it('rejects sibling add when the registration already has six children', async () => {
    const store = makeFakeDb();
    await makeCaller(parentUser, store.db).registration.submitInitial({
      ...validPayload(),
      students: Array.from({ length: 6 }, (_, index) =>
        validStudent(`Student ${String(index + 1)}`),
      ),
    });

    await expect(
      makeCaller(parentUser, store.db).registration.addSibling(validSiblingPayload('Student 7')),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'registration already has the maximum number of children',
    });
  });

  it('returns not found when adding a sibling without a registration', async () => {
    const store = makeFakeDb();

    await expect(
      makeCaller(parentUser, store.db).registration.addSibling(validSiblingPayload('New Sibling')),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('registration.addSiblings', () => {
  it('adds multiple siblings in one transaction without editing household details', async () => {
    const store = makeFakeDb();
    await makeCaller(parentUser, store.db).registration.submitInitial({
      ...validPayload(),
      students: [validStudent('Jane Learner')],
    });

    await expect(
      makeCaller(parentUser, store.db).registration.addSiblings({
        students: [validStudent('New Sibling'), validStudent('Second Sibling')],
      }),
    ).resolves.toEqual({
      registrationId: 'reg_1',
      studentIds: ['student_2', 'student_3'],
    });

    expect(store.students).toHaveLength(3);
    expect(store.students[1]).toMatchObject({ fullNameEnc: 'enc:New Sibling' });
    expect(store.students[2]).toMatchObject({ fullNameEnc: 'enc:Second Sibling' });
    expect(store.guardians).toContainEqual({
      id: 'guardian_2',
      userId: parentUser.id,
      studentId: 'student_2',
    });
    expect(store.guardians).toContainEqual({
      id: 'guardian_3',
      userId: parentUser.id,
      studentId: 'student_3',
    });
    expect(store.db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: parentUser.id,
        action: 'Update',
        entity: 'ParentRegistration',
        entityId: 'reg_1',
        meta: {
          source: 'registration.addSiblings',
          studentIds: ['student_2', 'student_3'],
        },
      },
    });
  });

  it('rejects batch sibling add when the requested children exceed the six-child limit', async () => {
    const store = makeFakeDb();
    await makeCaller(parentUser, store.db).registration.submitInitial({
      ...validPayload(),
      students: Array.from({ length: 5 }, (_, index) =>
        validStudent(`Student ${String(index + 1)}`),
      ),
    });

    await expect(
      makeCaller(parentUser, store.db).registration.addSiblings({
        students: [validStudent('Student 6'), validStudent('Student 7')],
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'registration already has the maximum number of children',
    });
  });
});

describe('registration.byStudent', () => {
  it('allows full admin to read decrypted registration data and audits the sensitive read', async () => {
    const store = makeFakeDb();
    await makeCaller(parentUser, store.db).registration.submitInitial(validPayload());

    const result = await makeCaller(headUser, store.db).registration.byStudent({
      studentId: 'student_1',
    });

    expect(result).toMatchObject({
      registrationId: 'reg_1',
      homeAddress: '12 Oasis Road, London',
      student: {
        id: 'student_1',
        fullName: 'Jane Learner',
        dob: '2016-03-04',
        address: '12 Oasis Road, London',
        consents: { Accuracy: { granted: true, initials: 'JF' } },
      },
      siblings: [
        { id: 'student_1', fullName: 'Jane Learner' },
        { id: 'student_2', fullName: 'John Learner' },
      ],
    });
    expect(store.db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'ReadSensitive',
        entity: 'ParentRegistration',
        entityId: 'reg_1',
        meta: {
          source: 'registration.byStudent',
          siblingCount: 2,
          studentId: 'student_1',
        },
      },
    });
  });

  it('denies parent reads through the admin registration endpoint', async () => {
    const store = makeFakeDb();
    await makeCaller(parentUser, store.db).registration.submitInitial(validPayload());

    await expect(
      makeCaller(parentUser, store.db).registration.byStudent({ studentId: 'student_1' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
