# ADR 0002: Clerk for authentication and 2FA (UK/EU residency)

- **Status:** Accepted
- **Date:** 2026-04-23

## Context

The brief requires 2FA for every user (Head, Principal, Pastor, Head of
Discipline, Clubs Admin, Supervisor, Parent, Student) and UK/EU data
residency for all personal data. Building our own auth — password hashing,
TOTP enrolment, recovery codes, session rotation, device management, rate
limiting, bot defence — is a multi-month project we would own forever, and
the consequences of getting any one of those pieces wrong are severe.

Options considered:

1. **Roll our own** with Argon2id + TOTP + Redis sessions.
2. **Auth.js (NextAuth)** — flexible, but we would still implement 2FA and
   device management ourselves.
3. **Supabase Auth** — couples us tightly to the Supabase DB product.
4. **Clerk** — managed auth with built-in TOTP + SMS 2FA, recovery codes,
   session management, organizations, and EU data-residency tier.

## Decision

Use **Clerk** with the EU data residency region. Enforce 2FA as a
hard requirement for every user in the Clerk dashboard (factor required
at sign-in, not optional).

- Clerk owns: user store, passwords, 2FA (TOTP/SMS/backup codes), session
  JWT, device list, sign-in throttling.
- Our DB owns: `User` row keyed by `clerkUserId`, role, permission tags,
  relations to `Student`/`Parent` etc. PII on these rows is envelope-
  encrypted (see ADR 0005) — Clerk is not the source of truth for names or
  addresses.

## Consequences

- **Positive:** 2FA, recovery, throttling, and session rotation are
  solved-problems from day one. Expo and Next.js SDKs are first-class.
  UK/EU residency is a dashboard setting.
- **Negative:** Vendor lock-in on the auth surface; migration would require
  exporting users and bulk-inviting. Cost scales with MAU. We still carry
  the PII in our own DB (encrypted) so user data isn't fully delegated.
- **Reversible?** Partially. The `clerkUserId` is an opaque foreign key;
  replacing Clerk means re-auth'ing every user against the new provider but
  our row-level data survives unchanged.
