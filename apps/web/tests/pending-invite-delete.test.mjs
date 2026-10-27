import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const webRoot = path.resolve(import.meta.dirname, '..');
const adminDir = 'src/app/(admin)/admin';
const read = (relativePath) => {
  const absolutePath = path.join(webRoot, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : '';
};

const deleteAction = read(`${adminDir}/_components/pending-invite-delete-action.tsx`);
const profilePanel = read(`${adminDir}/staff/_components/pending-invite-profile-panel.tsx`);
const accessPanel = read(`${adminDir}/access/access-pending-invite-panel.tsx`);
const profilesClient = read(`${adminDir}/staff/people-profiles-client.tsx`);

test('shared delete action revokes through admin.deleteUserInvitation behind a confirmation', () => {
  assert.match(deleteAction, /export function PendingInviteDeleteAction/);
  assert.match(deleteAction, /api\.admin\.deleteUserInvitation\.useMutation/);
  assert.match(deleteAction, /<ConfirmationDialog/);
  assert.match(deleteAction, /admin\.listUserInvitations\.invalidate/);
});

test('People & Profiles offers invitation delete only to account admins', () => {
  assert.match(profilePanel, /PendingInviteDeleteAction/);
  assert.match(profilePanel, /canDelete/);
  assert.match(profilesClient, /canManageUserAccounts\(\{ role: currentUserRole \}\)/);
  assert.match(profilesClient, /canDeleteInvitation=/);
});

test('Access management reuses the shared delete action', () => {
  assert.match(accessPanel, /PendingInviteDeleteAction/);
  assert.doesNotMatch(accessPanel, /deleteUserInvitation\.useMutation/);
});
