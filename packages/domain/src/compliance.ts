import { z } from 'zod';
import { ADULT_USER_ACCOUNT_ROLES, type Role } from './rbac.js';
import { isStudentAdult } from './studentPortalSettings.js';

export const COMPLIANCE_ACCOUNT_ROLES: readonly Role[] = [
  ...ADULT_USER_ACCOUNT_ROLES.filter((role) => role !== 'ClubsLead'),
  'Student',
];

export function isComplianceAccount(role: Role, dob: string | null, asOf = new Date()): boolean {
  return (
    COMPLIANCE_ACCOUNT_ROLES.some((eligibleRole) => eligibleRole === role) &&
    (role === 'Student'
      ? Boolean(dob && isStudentAdult({ dateOfBirth: dob, asOf }))
      : !dob || isStudentAdult({ dateOfBirth: dob, asOf }))
  );
}

export const DBS_APPLICATION_TYPES = ['Basic', 'Standard', 'Enhanced'] as const;
export const DBS_CERTIFICATE_STATUSES = [
  'AwaitingCertificate',
  'RecordedCurrent',
  'NoLongerCurrent',
] as const;

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Enter a valid date')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Enter a valid date');

const optionalDate = dateOnly.nullable();
const optionalText = (max: number) => z.string().trim().max(max).nullable();

export const updateAdultComplianceInput = z
  .object({
    userId: z.string().min(1),
    dob: optionalDate,
    dbsCertificateNumber: optionalText(100),
    dbsApplicationReference: optionalText(100),
    dbsCompletedAt: optionalDate,
    dbsIssueDate: optionalDate,
    dbsApplicationType: z.enum(DBS_APPLICATION_TYPES).nullable(),
    dbsStatus: z.enum(DBS_CERTIFICATE_STATUSES),
    firstAidCompletedAt: optionalDate,
    firstAidLevel: optionalText(100),
    safeguardingCompletedAt: optionalDate,
    safeguardingLevel: optionalText(100),
  })
  .strict()
  .superRefine((input, context) => {
    if (
      input.dbsStatus === 'RecordedCurrent' &&
      (!input.dbsCertificateNumber || !input.dbsIssueDate)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dbsStatus'],
        message: 'A recorded current certificate needs its number and issue date.',
      });
    }
    if (Boolean(input.firstAidCompletedAt) !== Boolean(input.firstAidLevel)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['firstAidLevel'],
        message: 'Enter both the first aid level and completion date.',
      });
    }
    if (Boolean(input.safeguardingCompletedAt) !== Boolean(input.safeguardingLevel)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['safeguardingLevel'],
        message: 'Enter both the safeguarding level and completion date.',
      });
    }
  });

export type UpdateAdultComplianceInput = z.infer<typeof updateAdultComplianceInput>;

export interface AdultComplianceBadgeSummary {
  dbsStatus: 'NotRecorded' | (typeof DBS_CERTIFICATE_STATUSES)[number];
  firstAidTrained: boolean;
  safeguardingTrained: boolean;
}

export function complianceBadgeSummary(
  record: {
    dbsStatus: (typeof DBS_CERTIFICATE_STATUSES)[number];
    firstAidCompletedAt: Date | null;
    firstAidLevel: string | null;
    safeguardingCompletedAt: Date | null;
    safeguardingLevel: string | null;
  } | null,
): AdultComplianceBadgeSummary {
  return {
    dbsStatus: record?.dbsStatus ?? 'NotRecorded',
    firstAidTrained: Boolean(record?.firstAidCompletedAt && record.firstAidLevel),
    safeguardingTrained: Boolean(record?.safeguardingCompletedAt && record.safeguardingLevel),
  };
}
