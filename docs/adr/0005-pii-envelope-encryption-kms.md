# ADR 0005: Per-record envelope encryption of PII with AWS KMS + blind indexes

- **Status:** Superseded by [ADR 0006](0006-pii-envelope-encryption-env-key.md)
- **Date:** 2026-04-23
- **Superseded:** 2026-04-25 — Phase 1 hosting decision constrained the project to free-tier services. KMS is deferred until the centre outgrows free-tier limits. The envelope-encryption *strategy* (per-record DEK, AES-256-GCM, versioned wire format, blind indexes, RLS as second wall) is unchanged; only the wrap mechanism moves from KMS to an env-managed master key.

## Context

The user requirement: "nothing on the db can reveal someone's identity."
A raw `pg_dump` of the production database must not expose names,
addresses, phone numbers, dates of birth, or any field that could
re-identify a student, parent, or staff member — even if the dump leaks.
Authenticated users with the right role must still see decrypted values
seamlessly in the UI. We also need equality lookups on some fields (find a
parent by email, merge a student profile by NI/ID number) without
decrypting every row.

Options considered:

1. **Transparent Data Encryption (TDE) at rest** — protects the disk, not
   the dump. Fails the requirement.
2. **Column-level deterministic AES** with a single global key — an
   attacker with DB + app key sees all plaintext and deterministic
   ciphertexts leak frequency/equality information.
3. **Envelope encryption per record with AWS KMS** — a per-record Data
   Encryption Key (DEK), wrapped by a KMS Customer Master Key. DB holds
   only wrapped DEKs + ciphertexts. Raw dump is useless without KMS.

## Decision

- Every PII field is stored as an `Enc` column (`firstNameEnc`, `emailEnc`,
  etc.) containing a versioned wire format:
  `v1:<kmsKeyId>:<wrappedDek>:<iv>:<tag>:<ct>` (base64 parts).
- `packages/db/src/encryption.ts` generates a fresh 256-bit DEK per write,
  encrypts the plaintext with **AES-256-GCM**, wraps the DEK via KMS, and
  zeros the plaintext DEK from memory after use.
- On read, the wrapped DEK is unwrapped via KMS, the ciphertext decrypted,
  and the DEK zeroed. KMS calls are cached per-request to avoid cost
  explosions on list queries.
- For searchable fields (email, phone, external ID), we store a sibling
  `*_bidx` column containing `HMAC-SHA256(value, pepper)` where `pepper`
  lives in a separate secrets store. Equality queries hit the blind index
  — we never see plaintext frequency across records because the pepper
  lives outside the DB.
- Postgres RLS (ADR 0003) is the second wall preventing unauthorized
  rows from ever leaving the DB — encryption protects the dump, RLS
  protects live queries.

## Consequences

- **Positive:** A leaked DB dump is cryptographically useless. KMS key
  rotation rotates wrapping keys without re-encrypting ciphertexts
  (the wire format embeds `kmsKeyId`). Per-record DEKs defeat frequency
  analysis. Blind indexes enable lookups without decryption.
- **Negative:** Every PII read costs a KMS `Decrypt` call unless cached —
  mitigated by per-request caching and batched list views that decrypt
  once per render. Losing the KMS key = losing the data (backup the key,
  enable multi-region replicas). Search is equality-only on blind indexes;
  prefix/LIKE searches require re-thinking (e.g. Clerk-side email search).
- **Reversible?** The wire format is versioned (`v1:...`) so algorithm
  migration is straightforward. Removing encryption would require a
  bulk-decrypt migration and redesign of RLS.
