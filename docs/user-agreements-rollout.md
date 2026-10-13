# User agreements rollout

Deploy the additive `20261013120000_user_agreements` migration and RLS policies before releasing the web and mobile clients. The migration creates the `user-agreements` private Storage bucket when run against Supabase. Confirm that the target project matches `NEXT_PUBLIC_SUPABASE_URL`; the Storage bucket and database must belong to the same project.

1. Run `pnpm --filter @oasis/db migrate:deploy`, then `pnpm --filter @oasis/db rls:apply` with the migration-owner database credentials. Do not point these commands at a different Supabase project.
2. Confirm the private `user-agreements` bucket exists with PDF-only uploads and a 25 MiB object limit. The application restricts source uploads to 10 MiB; the larger bucket limit accommodates receipt copies.
3. Provision `SUPABASE_SERVICE_ROLE_KEY` on the server only. Set `USER_AGREEMENT_SIGNING_KEY_ID`, `USER_AGREEMENT_SIGNING_PRIVATE_KEY_PEM`, and `USER_AGREEMENT_SIGNING_PUBLIC_KEYS` in the web/API runtime. Generate an Ed25519 key pair using Node `crypto.generateKeyPairSync('ed25519')`; put the private PKCS#8 PEM in the private-key secret and a JSON object mapping its key ID to the public SPKI PEM in the public-keys secret. Keep previous public keys in that JSON object when rotating. Never reuse the PII encryption key for signing.
4. Confirm `APP_URL`, `RESEND_API_KEY`, `RESEND_FROM`, and `CRON_SECRET` are present. The protected `/api/cron/user-agreement-emails` route runs every 15 minutes and uses stable Resend idempotency keys.
5. Release the application, then test a Head upload to one parent and one staff account. Verify both see their own pending form, receive email, can open and sign it, and can download and verify the completed PDF. Test a manually recorded signed PDF, an email failure/retry, and a replacement version. Confirm the old signed record remains available and the superseded request no longer appears as pending.

The signing record is a **portal signing record with a cryptographic seal**. It is not a qualified digital signature or an SSH session. The immutable PDF hashes, evidence, signing key ID, and signature ID are verified through the portal.
