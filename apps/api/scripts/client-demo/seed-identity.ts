import { bidx, dateValue, enc } from './helpers.js';
import type { SeedContext } from './types.js';

export async function seedIdentityDemoData(ctx: SeedContext): Promise<void> {
  const { db, plan, clerkIdsByUserId, now } = ctx;

  await db.subject.createMany({
    data: [
      { id: 'clientdemo_subject_math', code: 'DEMO-MATH', name: 'Mathematics', active: true },
      { id: 'clientdemo_subject_english', code: 'DEMO-ENG', name: 'English', active: true },
      { id: 'clientdemo_subject_science', code: 'DEMO-SCI', name: 'Science', active: true },
    ],
  });

  await db.yearGroupBand.createMany({
    data: [
      {
        id: 'clientdemo_band_upper_primary',
        name: 'Demo Upper Primary',
        standardYears: ['Y5', 'Y6', 'Y7'],
        colour: '#2f7d6d',
        sortOrder: 50,
      },
    ],
  });

  await db.user.createMany({
    data: plan.users.map((user) => {
      const clerkId = clerkIdsByUserId.get(user.id);
      if (!clerkId) throw new Error(`Missing Clerk user id for ${user.email}.`);
      return {
        id: user.id,
        clerkId,
        role: user.role,
        tags: user.tags,
        fullNameEnc: enc(user.fullName),
        emailEnc: enc(user.email),
        emailBidx: bidx(user.email),
        active: true,
        childRegistrationPromptStatus: user.linkedAsGuardian ? 'HasChildren' : 'NoChildren',
        childRegistrationPromptAnsweredAt: now,
      };
    }),
  });

  await db.student.createMany({
    data: plan.students.map((student) => ({
      id: student.id,
      userId: student.userId ?? null,
      fullNameEnc: enc(student.fullName),
      nameBidx: bidx(student.fullName),
      dobEnc: enc(student.dob),
      addressEnc: enc(student.address),
      yearGroup: student.yearGroup,
      enrolmentDate: dateValue(student.enrolmentDate),
      active: true,
    })),
  });

  await db.guardian.createMany({
    data: plan.students.flatMap((student) => [
      {
        id: `${student.id}_head_parent_guardian`,
        userId: 'clientdemo_user_head_parent',
        studentId: student.id,
        notesEnc: enc('Demo head account is also linked as a parent/carer.'),
      },
      {
        id: `${student.id}_parent_guardian`,
        userId: 'clientdemo_user_parent',
        studentId: student.id,
        notesEnc: enc('Synthetic demo parent/carer link.'),
      },
    ]),
  });

  await db.studentPortalSettings.createMany({
    data: plan.students.map((student, index) => ({
      id: `${student.id}_portal_settings`,
      studentId: student.id,
      loginHandleEnc: enc(index === 0 ? 'ava.demo' : 'noah.demo'),
      loginHandleBidx: bidx(index === 0 ? 'ava.demo' : 'noah.demo'),
      studentCanManagePassword: true,
      dailyUsageLimitMinutes: index === 0 ? 45 : 30,
      settingsUpdatedById: 'clientdemo_user_head_parent',
      settingsUpdatedAt: now,
    })),
  });
}
