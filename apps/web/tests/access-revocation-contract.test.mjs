import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const webRoot = path.resolve(import.meta.dirname, '..');

function readWeb(relativePath) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

function readWebIfExists(relativePath) {
  const absolutePath = path.join(webRoot, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : '';
}

const adminNavSource = readWeb('src/components/admin/admin-nav.tsx');
const accessModelSource = readWeb('src/app/(admin)/admin/access/access-account-model.ts');
const accessPanelSource = readWeb('src/app/(admin)/admin/access/access-account-panel.tsx');
const inviteSource = readWeb('src/app/(admin)/admin/access/access-invite-form.tsx');
const resolveSource = readWeb('src/app/post-sign-in/resolve/page.tsx');
const transitionSource = readWeb('src/app/post-sign-in/resolve/post-sign-in-transition.tsx');
const revokedPageSource = readWebIfExists('src/app/access-revoked/page.tsx');
const revokedScreenSource = readWebIfExists('src/app/access-revoked/access-revoked-screen.tsx');
const revokedStyleSource = readWebIfExists('src/app/access-revoked/access-revoked.module.css');

test('User Access is available to both full admins and Technical Support', () => {
  assert.match(adminNavSource, /if \(item\.label === 'User Access'\) return access\.canManageUserAccounts;/);
  assert.doesNotMatch(adminNavSource, /if \(item\.label === 'User Access'\) return false;/);
});

test('account management uses the shared complete role catalog', () => {
  assert.match(accessModelSource, /import \{ ROLES, type Role \} from '@oasis\/domain';/);
  assert.match(accessModelSource, /export const ACCESS_INVITE_ROLES = ROLES;/);
  assert.match(accessModelSource, /type AccessFilter = 'all' \| 'active' \| 'inactive' \| Role;/);
  assert.match(accessModelSource, /ROLES\.map\(\(role\) =>/);
  assert.match(inviteSource, /z\.enum\(ACCESS_INVITE_ROLES\)/);
});

test('account management exposes API-backed profile, role, tag, and status controls', () => {
  assert.match(accessPanelSource, /api\.admin\.updateUserAccountProfile\.useMutation/);
  assert.match(accessPanelSource, /api\.admin\.updateUserRole\.useMutation/);
  assert.match(accessPanelSource, /api\.admin\.updateUserTags\.useMutation/);
  assert.match(accessPanelSource, /roleOptions\.map\(\(role\) =>/);
  assert.match(accessPanelSource, /PERMISSION_TAGS\.map\(\(tag\) =>/);
  assert.match(accessPanelSource, /disabled=\{isSelf\}/);
  assert.match(accessPanelSource, /Reactivate account/);
});

test('only a trusted deactivated account is routed to the access-revoked notice', () => {
  assert.match(resolveSource, /ctx\.accountAccessState === 'deactivated'/);
  assert.match(resolveSource, /redirect\('\/access-revoked'\);/);
  assert.ok(
    resolveSource.indexOf("ctx.accountAccessState === 'deactivated'") <
      resolveSource.indexOf('if (ctx.user)'),
  );
  assert.doesNotMatch(transitionSource, /'\/access-revoked'/);
});

test('the public access-revoked route provides an accessible deadline countdown and safe sign-out', () => {
  assert.match(revokedPageSource, /export default function AccessRevokedPage\(\)/);
  assert.match(revokedScreenSource, /You no longer have access to the portal\./);
  assert.match(revokedScreenSource, /ACCESS_REVOKED_DURATION_MS = 60_000/);
  assert.match(revokedScreenSource, /const deadline = Date\.now\(\) \+ ACCESS_REVOKED_DURATION_MS/);
  assert.match(revokedScreenSource, /<label className=\{styles\.progressLabel\} htmlFor="access-revoked-progress">/);
  assert.match(revokedScreenSource, /<progress id="access-revoked-progress"/);
  assert.match(revokedScreenSource, /aria-live="polite"/);
  assert.match(revokedScreenSource, /await signOut\(\)/);
  assert.match(revokedScreenSource, /catch \{/);
  assert.match(revokedScreenSource, /finally \{\s*window\.location\.replace\('\/'\);\s*\}/);
  assert.match(revokedScreenSource, /window\.clearInterval\(interval\)/);
  assert.match(revokedScreenSource, /window\.clearTimeout\(timeout\)/);
  assert.match(revokedStyleSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(revokedStyleSource, /animation:/);
});
