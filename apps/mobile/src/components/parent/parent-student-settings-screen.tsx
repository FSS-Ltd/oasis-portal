import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { api } from '../../lib/trpc';
import {
  Card,
  ErrorText,
  Field,
  InlineSpinner,
  MutedText,
  SectionTitle,
  MobileButton,
} from '../core/mobile-ui';
import { parentStudentSettingsStyles as styles } from './parent-student-settings-styles';
import {
  ChildIcon,
  ChildPicker,
  SettingsStatusCard,
  ToggleRow,
} from './parent-student-settings-status';
import type { LinkedChildSettings, PreparedChildIconPhoto } from './parent-student-settings-types';

const weekdays = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
] as const;

function childById(
  children: readonly LinkedChildSettings[],
  selectedChildId: string | null,
): LinkedChildSettings | null {
  return children.find((child) => child.studentId === selectedChildId) ?? children[0] ?? null;
}

function passwordMeetsPolicy(value: string): boolean {
  return value.length >= 12 && value.length <= 128;
}

function normalisedNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalisedPositiveInteger(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
}

export function ParentStudentSettingsScreen({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const utils = api.useUtils();
  const linkedChildren = api.studentSettings.listLinkedChildren.useQuery(undefined, {
    retry: false,
  });
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const children = useMemo(() => linkedChildren.data ?? [], [linkedChildren.data]);
  const selectedChild = childById(children, selectedChildId);

  useEffect(() => {
    if (!selectedChildId && children[0]) {
      setSelectedChildId(children[0].studentId);
    }
  }, [children, selectedChildId]);

  async function refreshAll() {
    setStatus(null);
    setFormError(null);
    await Promise.all([onRefresh(), linkedChildren.refetch()]);
  }

  function updateCachedChild(updated: LinkedChildSettings): void {
    utils.studentSettings.listLinkedChildren.setData(undefined, (current) =>
      current?.map((child) => (child.studentId === updated.studentId ? updated : child)),
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void refreshAll();
          }}
          refreshing={linkedChildren.isFetching}
        />
      }
      showsVerticalScrollIndicator={false}
      style={styles.scroller}
    >
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>Student settings</Text>
        <Text style={styles.title}>Linked-child settings</Text>
        <MutedText>
          Control under-18 student portal access, credentials, usage limits, locks, and merit shop
          access, plus PACE status visibility.
        </MutedText>
      </View>

      {linkedChildren.isLoading ? <InlineSpinner label="Loading student settings" /> : null}
      {linkedChildren.error ? (
        <ErrorText>Access denied: {linkedChildren.error.message}</ErrorText>
      ) : null}
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {status ? (
        <Card style={styles.successCard}>
          <Text style={styles.successText}>{status}</Text>
        </Card>
      ) : null}

      {!linkedChildren.isLoading && children.length === 0 ? (
        <Card>
          <SectionTitle>No linked children</SectionTitle>
          <MutedText>
            Settings unavailable until Oasis links a child record to this parent account.
          </MutedText>
        </Card>
      ) : null}

      {children.length > 0 ? (
        <ChildPicker
          children={children}
          selectedChildId={selectedChild?.studentId ?? null}
          onSelect={(studentId) => {
            setSelectedChildId(studentId);
            setStatus(null);
            setFormError(null);
          }}
        />
      ) : null}

      {selectedChild ? (
        <>
          <SettingsStatusCard child={selectedChild} />
          <CredentialsCard
            child={selectedChild}
            disabled={!selectedChild.parentControlAllowed}
            onError={setFormError}
            onSaved={(message, updated) => {
              updateCachedChild(updated);
              setStatus(message);
            }}
          />
          <UsageLimitsCard
            child={selectedChild}
            disabled={!selectedChild.parentControlAllowed}
            onError={setFormError}
            onSaved={(updated) => {
              updateCachedChild(updated);
              setStatus('Settings saved. Usage limits updated.');
            }}
          />
          <ChildIconCard
            child={selectedChild}
            disabled={!selectedChild.parentControlAllowed}
            onError={setFormError}
            onSaved={(updated) => {
              updateCachedChild(updated);
              setStatus('Settings saved. Child icon updated.');
            }}
          />
          <AccessControlsCard
            child={selectedChild}
            disabled={!selectedChild.parentControlAllowed}
            onError={setFormError}
            onSaved={(message, updated) => {
              updateCachedChild(updated);
              setStatus(message);
            }}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

function CredentialsCard({
  child,
  disabled,
  onError,
  onSaved,
}: {
  child: LinkedChildSettings;
  disabled: boolean;
  onError: (message: string | null) => void;
  onSaved: (message: string, child: LinkedChildSettings) => void;
}) {
  const [loginHandle, setLoginHandle] = useState(child.loginHandle ?? '');
  const [createHandle, setCreateHandle] = useState(child.loginHandle ?? '');
  const [createPasswordValue, setCreatePasswordValue] = useState('');
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const setLoginHandleMutation = api.studentSettings.setLoginHandle.useMutation();
  const createChildLogin = api.studentSettings.createChildLogin.useMutation();
  const setChildPassword = api.studentSettings.setChildPassword.useMutation();
  const setPasswordControl = api.studentSettings.setPasswordControl.useMutation();
  const busy =
    setLoginHandleMutation.isPending ||
    createChildLogin.isPending ||
    setChildPassword.isPending ||
    setPasswordControl.isPending;

  useEffect(() => {
    setLoginHandle(child.loginHandle ?? '');
    setCreateHandle(child.loginHandle ?? '');
    setCreatePasswordValue('');
    setResetPasswordValue('');
  }, [child.loginHandle, child.studentId]);

  async function saveHandle() {
    onError(null);
    try {
      const updated = await setLoginHandleMutation.mutateAsync({
        loginHandle: normalisedNullable(loginHandle),
        studentId: child.studentId,
      });
      onSaved('Settings saved. Login handle updated.', updated);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Login handle could not be saved.');
    }
  }

  async function createLogin() {
    onError(null);
    const handle = createHandle.trim();
    if (handle.length < 4) {
      onError('Login handle must be at least 4 letters or numbers.');
      return;
    }
    if (!passwordMeetsPolicy(createPasswordValue)) {
      onError('Initial password must be 12 to 128 characters.');
      return;
    }
    try {
      const updated = await createChildLogin.mutateAsync({
        loginHandle: handle,
        password: createPasswordValue,
        studentId: child.studentId,
      });
      setCreatePasswordValue('');
      onSaved('Settings saved. Student login created.', updated);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Student login could not be created.');
    }
  }

  async function resetPassword() {
    onError(null);
    if (!passwordMeetsPolicy(resetPasswordValue)) {
      onError('Reset password must be 12 to 128 characters.');
      return;
    }
    try {
      await setChildPassword.mutateAsync({
        password: resetPasswordValue,
        studentId: child.studentId,
      });
      setResetPasswordValue('');
      onSaved('Settings saved. Password reset submitted.', child);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Password could not be reset.');
    }
  }

  async function setStudentPasswordControl(studentCanManagePassword: boolean) {
    onError(null);
    try {
      const updated = await setPasswordControl.mutateAsync({
        studentCanManagePassword,
        studentId: child.studentId,
      });
      onSaved('Settings saved. Password control updated.', updated);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Password control could not be updated.');
    }
  }

  return (
    <Card>
      <SectionTitle>Child login</SectionTitle>
      {!child.accountLinked ? (
        <>
          <MutedText>Create login credentials for this child.</MutedText>
          <Field label="Login handle" onChangeText={setCreateHandle} value={createHandle} />
          <Field
            label="Initial password"
            onChangeText={setCreatePasswordValue}
            secureTextEntry
            value={createPasswordValue}
          />
          <MobileButton
            disabled={disabled || busy}
            label="Create login"
            onPress={() => {
              void createLogin();
            }}
          />
        </>
      ) : (
        <>
          <MutedText>
            Login handle display and reset controls for the linked student account.
          </MutedText>
          <Field label="Login handle" onChangeText={setLoginHandle} value={loginHandle} />
          <MobileButton
            disabled={disabled || busy}
            label="Save handle"
            onPress={() => {
              void saveHandle();
            }}
            variant="secondary"
          />
          <Field
            label="Reset password"
            onChangeText={setResetPasswordValue}
            secureTextEntry
            value={resetPasswordValue}
          />
          <MobileButton
            disabled={disabled || busy || resetPasswordValue.length === 0}
            label="Reset password"
            onPress={() => {
              void resetPassword();
            }}
          />
        </>
      )}
      <ToggleRow
        checked={child.studentCanManagePassword}
        disabled={disabled || busy}
        label="Child can manage password"
        sub="When off, password changes stay with the parent until the child is 18."
        onToggle={(checked) => {
          void setStudentPasswordControl(checked);
        }}
      />
      {disabled ? <MutedText>Adult child controls are read-only.</MutedText> : null}
    </Card>
  );
}

function UsageLimitsCard({
  child,
  disabled,
  onError,
  onSaved,
}: {
  child: LinkedChildSettings;
  disabled: boolean;
  onError: (message: string | null) => void;
  onSaved: (child: LinkedChildSettings) => void;
}) {
  const [dailyLimit, setDailyLimit] = useState(
    child.dailyUsageLimitMinutes === null ? '' : String(child.dailyUsageLimitMinutes),
  );
  const [offLimitWeekdays, setOffLimitWeekdays] = useState<number[]>(child.offLimitWeekdays);
  const setUsageLimits = api.studentSettings.setUsageLimits.useMutation();

  useEffect(() => {
    setDailyLimit(
      child.dailyUsageLimitMinutes === null ? '' : String(child.dailyUsageLimitMinutes),
    );
    setOffLimitWeekdays(child.offLimitWeekdays);
  }, [child.dailyUsageLimitMinutes, child.offLimitWeekdays, child.studentId]);

  async function saveLimits() {
    onError(null);
    const parsedDailyLimit = normalisedPositiveInteger(dailyLimit);
    if (Number.isNaN(parsedDailyLimit)) {
      onError('Daily usage limit must be a whole number of minutes.');
      return;
    }
    try {
      const updated = await setUsageLimits.mutateAsync({
        dailyUsageLimitMinutes: parsedDailyLimit,
        offLimitWeekdays,
        studentId: child.studentId,
      });
      onSaved(updated);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Usage limits could not be saved.');
    }
  }

  function toggleWeekday(day: number): void {
    setOffLimitWeekdays((current) => {
      const next = new Set(current);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return [...next].sort((left, right) => left - right);
    });
  }

  return (
    <Card>
      <SectionTitle>Usage limits</SectionTitle>
      <MutedText>Leave the daily limit blank for unlimited student portal time.</MutedText>
      <Field
        keyboardType="numeric"
        label="Daily limit minutes"
        onChangeText={setDailyLimit}
        value={dailyLimit}
      />
      <View style={styles.weekdayRow}>
        {weekdays.map((day) => {
          const active = offLimitWeekdays.includes(day.value);
          return (
            <Pressable
              accessibilityRole="button"
              key={day.value}
              onPress={() => {
                if (!disabled && !setUsageLimits.isPending) toggleWeekday(day.value);
              }}
              style={[styles.dayButton, active ? styles.dayButtonActive : null]}
            >
              <Text style={[styles.dayButtonText, active ? styles.dayButtonTextActive : null]}>
                {day.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <MobileButton
        disabled={disabled || setUsageLimits.isPending}
        label="Save limits"
        onPress={() => {
          void saveLimits();
        }}
        variant="secondary"
      />
    </Card>
  );
}

function ChildIconCard({
  child,
  disabled,
  onError,
  onSaved,
}: {
  child: LinkedChildSettings;
  disabled: boolean;
  onError: (message: string | null) => void;
  onSaved: (child: LinkedChildSettings) => void;
}) {
  const [fileName, setFileName] = useState('');
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [sizeBytes, setSizeBytes] = useState('');
  const [uploadSlot, setUploadSlot] = useState<PreparedChildIconPhoto | null>(null);
  const prepareChildIconPhotoUpload = api.studentSettings.prepareChildIconPhotoUpload.useMutation();
  const updateChildIconPhoto = api.studentSettings.updateChildIconPhoto.useMutation();
  const busy = prepareChildIconPhotoUpload.isPending || updateChildIconPhoto.isPending;

  useEffect(() => {
    setUploadSlot(null);
    setFileName('');
    setMimeType('image/jpeg');
    setSizeBytes('');
  }, [child.studentId]);

  async function prepareIconPhoto() {
    onError(null);
    const parsedSize = Number(sizeBytes.trim());
    if (!fileName.trim() || !mimeType.trim() || !Number.isInteger(parsedSize) || parsedSize <= 0) {
      onError('Enter a file name, MIME type, and positive byte size before preparing an upload.');
      return;
    }
    try {
      const prepared = await prepareChildIconPhotoUpload.mutateAsync({
        photo: {
          fileName,
          mimeType,
          sizeBytes: parsedSize,
        },
        studentId: child.studentId,
      });
      setUploadSlot(prepared);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Child icon upload could not be prepared.');
    }
  }

  async function confirmUploadedIcon() {
    if (!uploadSlot) return;
    onError(null);
    try {
      const updated = await updateChildIconPhoto.mutateAsync({
        photo: {
          fileName: uploadSlot.fileName,
          mimeType: uploadSlot.mimeType,
          sizeBytes: uploadSlot.sizeBytes,
          storageBucket: uploadSlot.storageBucket,
          storagePath: uploadSlot.storagePath,
        },
        studentId: child.studentId,
      });
      setUploadSlot(null);
      onSaved(updated);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Child icon photo could not be saved.');
    }
  }

  return (
    <Card>
      <SectionTitle>Child icon</SectionTitle>
      <View style={styles.iconRow}>
        <ChildIcon child={child} />
        <View style={styles.iconText}>
          <Text style={styles.smallStrong}>
            {child.childIconPhotoUrl ? 'Photo set' : 'Initials shown'}
          </Text>
          <MutedText>JPEG, PNG, or WebP. Maximum 5 MB.</MutedText>
        </View>
      </View>
      <Field label="Photo file name" onChangeText={setFileName} value={fileName} />
      <Field label="Photo MIME type" onChangeText={setMimeType} value={mimeType} />
      <Field
        keyboardType="numeric"
        label="Photo size bytes"
        onChangeText={setSizeBytes}
        value={sizeBytes}
      />
      <MobileButton
        disabled={disabled || busy}
        label="Prepare icon upload"
        onPress={() => {
          void prepareIconPhoto();
        }}
        variant="secondary"
      />
      {uploadSlot ? (
        <Card style={styles.uploadCard}>
          <Text style={styles.smallStrong}>Upload prepared</Text>
          <MutedText>
            Upload the selected file to Oasis storage, then confirm it here so the child icon record
            is updated.
          </MutedText>
          <MobileButton
            disabled={disabled || busy}
            label="Confirm uploaded icon"
            onPress={() => {
              void confirmUploadedIcon();
            }}
          />
        </Card>
      ) : null}
    </Card>
  );
}

function AccessControlsCard({
  child,
  disabled,
  onError,
  onSaved,
}: {
  child: LinkedChildSettings;
  disabled: boolean;
  onError: (message: string | null) => void;
  onSaved: (message: string, child: LinkedChildSettings) => void;
}) {
  const [lockReason, setLockReason] = useState(child.parentLockReason ?? '');
  const setParentLock = api.studentSettings.setParentLock.useMutation();
  const setMeritShopBlock = api.studentSettings.setMeritShopBlock.useMutation();
  const setPaceStatusVisibility = api.studentSettings.setPaceStatusVisibility.useMutation();
  const busy =
    setParentLock.isPending || setMeritShopBlock.isPending || setPaceStatusVisibility.isPending;

  useEffect(() => {
    setLockReason(child.parentLockReason ?? '');
  }, [child.parentLockReason, child.studentId]);

  async function updateParentLock(locked: boolean) {
    onError(null);
    try {
      const updated = await setParentLock.mutateAsync({
        locked,
        reason: locked ? normalisedNullable(lockReason) : null,
        studentId: child.studentId,
      });
      onSaved(
        locked ? 'Settings saved. Parent lock enabled.' : 'Settings saved. Parent lock cleared.',
        updated,
      );
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Parent lock could not be updated.');
    }
  }

  async function updateMeritShopBlock(blocked: boolean) {
    onError(null);
    try {
      const updated = await setMeritShopBlock.mutateAsync({
        blocked,
        studentId: child.studentId,
      });
      onSaved(
        blocked ? 'Settings saved. Merit shop blocked.' : 'Settings saved. Merit shop allowed.',
        updated,
      );
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Merit shop access could not be updated.');
    }
  }

  async function updatePaceStatusVisibility(paceStatusVisible: boolean) {
    onError(null);
    try {
      const updated = await setPaceStatusVisibility.mutateAsync({
        paceStatusVisible,
        studentId: child.studentId,
      });
      onSaved(
        paceStatusVisible
          ? 'Settings saved. PACE status shown.'
          : 'Settings saved. PACE status hidden.',
        updated,
      );
    } catch (error) {
      onError(
        error instanceof Error ? error.message : 'PACE status visibility could not be updated.',
      );
    }
  }

  return (
    <Card>
      <SectionTitle>Parent lock</SectionTitle>
      <MutedText>
        Locking the portal blocks student access until the parent lock is cleared.
      </MutedText>
      <Field label="Parent lock reason" multiline onChangeText={setLockReason} value={lockReason} />
      <View style={styles.actionRow}>
        <MobileButton
          disabled={disabled || busy}
          label={child.parentAccountLocked ? 'Clear lock' : 'Apply lock'}
          onPress={() => {
            void updateParentLock(!child.parentAccountLocked);
          }}
          variant={child.parentAccountLocked ? 'success' : 'danger'}
        />
      </View>
      <SectionTitle>Merit shop</SectionTitle>
      <MutedText>Block or allow this child to reserve merit shop items.</MutedText>
      <ToggleRow
        checked={child.parentMeritShopBlocked}
        disabled={disabled || busy}
        label="Block Merit shop"
        sub="Account locks also block shop access through backend policy."
        onToggle={(checked) => {
          void updateMeritShopBlock(checked);
        }}
      />
      <SectionTitle>PACE status</SectionTitle>
      <MutedText>Show or hide ahead, behind, and on-track badges in the student portal.</MutedText>
      <ToggleRow
        checked={child.paceStatusVisible}
        disabled={disabled || busy}
        label="Show PACE status badge"
        sub="PACE work and scores remain visible when this is off."
        onToggle={(checked) => {
          void updatePaceStatusVisibility(checked);
        }}
      />
    </Card>
  );
}
