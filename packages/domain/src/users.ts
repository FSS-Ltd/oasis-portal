/**
 * User invite + guardian-linking domain validation (PR-1.5).
 *
 * Pure module — no Prisma, no tRPC. Zod schemas for the two admin mutations
 * (`admin.inviteUser`, `admin.linkGuardian`) plus `resolveInviteMetadata`
 * which the Clerk webhook uses to read pre-stamped role/tags off
 * `user.public_metadata` at signup.
 */
import { z } from 'zod';
import {
  ADULT_USER_ACCOUNT_ROLES,
  PERMISSION_TAGS,
  ROLES,
  type PermissionTag,
  type Role,
} from './rbac.js';

const roleEnum = z.enum(ROLES as unknown as readonly [Role, ...Role[]]);
const adultUserAccountRoleEnum = z.enum(
  ADULT_USER_ACCOUNT_ROLES as unknown as readonly [
    (typeof ADULT_USER_ACCOUNT_ROLES)[number],
    ...(typeof ADULT_USER_ACCOUNT_ROLES)[number][],
  ],
);
const tagEnum = z.enum(PERMISSION_TAGS as unknown as readonly [PermissionTag, ...PermissionTag[]]);

export const inviteUserInput = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    role: roleEnum,
    tags: z.array(tagEnum).default([]),
  })
  .strict();
export type InviteUserInput = z.infer<typeof inviteUserInput>;

export const linkGuardianInput = z.object({
  userId: z.string().min(1),
  studentId: z.string().min(1),
});
export type LinkGuardianInput = z.infer<typeof linkGuardianInput>;

export const updateUserRoleInput = z.object({
  userId: z.string().min(1),
  role: adultUserAccountRoleEnum,
});
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleInput>;

export const userPublicMetadataSchema = z
  .object({
    role: roleEnum.optional(),
    tags: z.array(tagEnum).optional(),
  })
  .partial();
export type UserPublicMetadata = z.infer<typeof userPublicMetadataSchema>;

export interface ResolvedInviteMetadata {
  role: Role;
  tags: PermissionTag[];
}

/**
 * Read role/tags off Clerk's user.public_metadata. Never throws — invalid input
 * falls back to defaults and emits a warning. Reason: a poison-pill webhook
 * would have Clerk retry forever; we'd rather quietly default than 400.
 */
export function resolveInviteMetadata(
  raw: unknown,
  defaults: { role: Role; tags: PermissionTag[] },
): ResolvedInviteMetadata {
  if (raw === null || raw === undefined) {
    return { role: defaults.role, tags: [...defaults.tags] };
  }
  const parsed = userPublicMetadataSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn(
      '[users] invalid public_metadata, falling back to defaults',
      parsed.error.flatten(),
    );
    return { role: defaults.role, tags: [...defaults.tags] };
  }
  return {
    role: parsed.data.role ?? defaults.role,
    tags: parsed.data.tags ? [...parsed.data.tags] : [...defaults.tags],
  };
}
