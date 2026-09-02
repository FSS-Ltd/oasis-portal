import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ADULT_USER_ACCOUNT_ROLES, PERMISSION_TAGS, type PermissionTag } from '@oasis/domain';
import { api } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import {
  Badge,
  Card,
  ErrorText,
  Field,
  MobileButton,
  MutedText,
  SectionTitle,
} from '../core/mobile-ui';
import {
  formatAccountDate,
  roleLabel,
  toPermissionTags,
  type AccessAccount,
} from './user-access-model';

function togglePermissionTag(tags: readonly string[], tag: PermissionTag): PermissionTag[] {
  const next = new Set(tags);
  if (next.has(tag)) {
    next.delete(tag);
  } else {
    next.add(tag);
  }
  return toPermissionTags([...next]);
}

function permissionTagLabel(tag: PermissionTag): string {
  return tag.replaceAll('-', ' ');
}

export function UserAccessAccountDetail({
  account,
  currentUserId,
}: {
  account: AccessAccount;
  currentUserId: string;
}) {
  const utils = api.useUtils();
  const [fullName, setFullName] = useState(account.fullName);
  const [phone, setPhone] = useState(account.phone ?? '');
  const [address, setAddress] = useState(account.address ?? '');
  const updateProfile = api.admin.updateUserAccountProfile.useMutation({
    async onSuccess() {
      await utils.admin.listUserAccounts.invalidate();
    },
  });
  const updateRole = api.admin.updateUserRole.useMutation({
    async onSuccess() {
      await utils.admin.listUserAccounts.invalidate();
    },
  });
  const updateTags = api.admin.updateUserTags.useMutation({
    async onSuccess() {
      await utils.admin.listUserAccounts.invalidate();
    },
  });
  const updateStatus = api.admin.updateUserAccountStatus.useMutation({
    async onSuccess() {
      await utils.admin.listUserAccounts.invalidate();
    },
  });
  const isSelf = account.id === currentUserId;

  useEffect(() => {
    setFullName(account.fullName);
    setPhone(account.phone ?? '');
    setAddress(account.address ?? '');
  }, [account]);

  return (
    <>
      <Card>
        <View style={styles.detailHeader}>
          <View>
            <SectionTitle>{account.fullName}</SectionTitle>
            <MutedText>{roleLabel(account.role)}</MutedText>
          </View>
          <Badge variant={account.active ? 'success' : 'warning'}>
            {account.active ? 'Active' : 'Inactive'}
          </Badge>
        </View>
        <Field label="Full name" onChangeText={setFullName} value={fullName} />
        <Field label="Phone" onChangeText={setPhone} value={phone} />
        <Field label="Address" onChangeText={setAddress} value={address} />
        <DetailRow label="Email" value={account.email} />
        <DetailRow label="Joined" value={formatAccountDate(account.createdAt)} />
        {updateProfile.error ? <ErrorText>{updateProfile.error.message}</ErrorText> : null}
        <MobileButton
          disabled={updateProfile.isPending || fullName.trim().length === 0}
          label={updateProfile.isPending ? 'Saving...' : 'Save profile'}
          onPress={() => {
            updateProfile.mutate({ userId: account.id, fullName, phone, address });
          }}
          variant="blue"
        />
      </Card>

      <Card>
        <SectionTitle>Role</SectionTitle>
        <MutedText>Choose the account role. Your own role cannot be changed here.</MutedText>
        <View style={styles.choiceList}>
          {ADULT_USER_ACCOUNT_ROLES.map((role) => (
            <Pressable
              accessibilityRole="button"
              disabled={isSelf || updateRole.isPending}
              key={role}
              onPress={() => {
                updateRole.mutate({ userId: account.id, role });
              }}
              style={[styles.choice, account.role === role ? styles.choiceActive : null]}
            >
              <Text
                style={[styles.choiceText, account.role === role ? styles.choiceTextActive : null]}
              >
                {roleLabel(role)}
              </Text>
            </Pressable>
          ))}
        </View>
        {account.role === 'Student' ? (
          <MutedText>Student roles cannot be changed from this account screen.</MutedText>
        ) : null}
        {isSelf ? <MutedText>Your own role cannot be changed here.</MutedText> : null}
        {updateRole.error ? <ErrorText>{updateRole.error.message}</ErrorText> : null}
      </Card>

      <Card>
        <SectionTitle>Permission tags</SectionTitle>
        <MutedText>Grant or revoke operational access without changing role.</MutedText>
        <View style={styles.choiceList}>
          {PERMISSION_TAGS.map((tag) => {
            const selected = account.tags.includes(tag);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: selected,
                  disabled: !account.active || updateTags.isPending,
                }}
                disabled={!account.active || updateTags.isPending}
                key={tag}
                onPress={() => {
                  updateTags.mutate({
                    userId: account.id,
                    tags: togglePermissionTag(account.tags, tag),
                  });
                }}
                style={[styles.choice, selected ? styles.choiceActive : null]}
              >
                <Text style={[styles.choiceText, selected ? styles.choiceTextActive : null]}>
                  {permissionTagLabel(tag)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {!account.active ? (
          <MutedText>Reactivate the account before changing permission tags.</MutedText>
        ) : null}
        {updateTags.error ? <ErrorText>{updateTags.error.message}</ErrorText> : null}
      </Card>

      <Card>
        <SectionTitle>Account status</SectionTitle>
        <MutedText>Control whether this person can sign in.</MutedText>
        <MobileButton
          disabled={isSelf || updateStatus.isPending}
          label={
            updateStatus.isPending ? 'Updating...' : account.active ? 'Deactivate' : 'Reactivate'
          }
          onPress={() => {
            updateStatus.mutate({ userId: account.id, active: !account.active });
          }}
          variant={account.active ? 'danger' : 'success'}
        />
        {isSelf && account.active ? (
          <MutedText>Your own account cannot be deactivated here.</MutedText>
        ) : null}
        {updateStatus.error ? <ErrorText>{updateStatus.error.message}</ErrorText> : null}
      </Card>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  choice: {
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  choiceActive: { backgroundColor: C.navy, borderColor: C.navy },
  choiceList: { gap: 8 },
  choiceText: { color: C.textSecondary, fontSize: 13, fontWeight: '700' },
  choiceTextActive: { color: C.surface },
  detailHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  detailLabel: { color: C.textSecondary, fontSize: 12, fontWeight: '700' },
  detailRow: { borderBottomColor: C.border, borderBottomWidth: 1, gap: 4, paddingBottom: 10 },
  detailValue: { color: C.textPrimary, fontSize: 13, fontWeight: '600' },
});
