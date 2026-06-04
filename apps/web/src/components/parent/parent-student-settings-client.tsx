'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  CircleSlash,
  Clock3,
  Image as ImageIcon,
  KeyRound,
  Lock,
  ShieldCheck,
  ShoppingBag,
  UserCog,
  UserPlus,
} from 'lucide-react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, TextInput } from '@/components/ui/field';
import { Panel } from '@/components/ui/panel';
import {
  ChildIconPhotoUploadButton,
  type ChildIconPhotoUploadPayload,
} from './child-icon-photo-upload';
import { ParentChildSelector } from './parent-child-selector';

type LinkedChildSettings = RouterOutputs['studentSettings']['listLinkedChildren'][number];
type LimitField = 'hourlyUsageLimitMinutes' | 'dailyUsageLimitMinutes' | 'weeklyUsageLimitMinutes';
type UsageLimitForm = Record<LimitField, string>;

const usageLimitFields = [
  {
    field: 'hourlyUsageLimitMinutes',
    label: 'Hourly limit',
    max: 60,
    placeholder: '60',
  },
  {
    field: 'dailyUsageLimitMinutes',
    label: 'Daily limit',
    max: 1440,
    placeholder: '180',
  },
  {
    field: 'weeklyUsageLimitMinutes',
    label: 'Weekly limit',
    max: 10080,
    placeholder: '900',
  },
] as const satisfies readonly {
  field: LimitField;
  label: string;
  max: number;
  placeholder: string;
}[];

function emptyUsageLimitForm(): UsageLimitForm {
  return {
    dailyUsageLimitMinutes: '',
    hourlyUsageLimitMinutes: '',
    weeklyUsageLimitMinutes: '',
  };
}

function usageLimitFormFor(child: LinkedChildSettings | null): UsageLimitForm {
  if (!child) return emptyUsageLimitForm();

  return {
    dailyUsageLimitMinutes:
      child.dailyUsageLimitMinutes === null ? '' : String(child.dailyUsageLimitMinutes),
    hourlyUsageLimitMinutes:
      child.hourlyUsageLimitMinutes === null ? '' : String(child.hourlyUsageLimitMinutes),
    weeklyUsageLimitMinutes:
      child.weeklyUsageLimitMinutes === null ? '' : String(child.weeklyUsageLimitMinutes),
  };
}

function parseOptionalMinutes(value: string, label: string, max: number): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error(`${label} must be a whole number from 1 to ${String(max)} minutes.`);
  }
  return parsed;
}

function lockLabel(child: LinkedChildSettings): string {
  if (!child.effectiveLock.locked) return 'Open';
  if (child.effectiveLock.primarySource === 'HeadAcademic') return 'Academic lock';
  return 'Parent lock';
}

function firstName(fullName: string): string {
  return fullName.split(' ')[0] ?? fullName;
}

function SettingsStatusCard({ child }: { child: LinkedChildSettings }) {
  const adult = !child.parentControlAllowed;
  const locked = child.effectiveLock.locked;

  return (
    <Panel body className="parent-settings-status">
      <div className="parent-settings-status__head">
        <ChildIconPreview child={child} />
        <div>
          <strong>{child.fullName}</strong>
          <span>{displaySchoolYearLabel(child.yearGroup)}</span>
        </div>
      </div>

      <div className="parent-settings-state-grid">
        <div>
          <span>Parent controls</span>
          <Badge tone={adult ? 'grey' : 'green'}>{adult ? 'Read-only at 18' : 'Available'}</Badge>
        </div>
        <div>
          <span>Portal account</span>
          <Badge tone={!child.accountLinked ? 'amber' : locked ? 'red' : 'green'}>
            {child.accountLinked ? lockLabel(child) : 'Login needed'}
          </Badge>
        </div>
        <div>
          <span>Password changes</span>
          <Badge tone={child.studentCanManagePassword || adult ? 'blue' : 'amber'}>
            {adult ? 'Student owned' : child.studentCanManagePassword ? 'Allowed' : 'Parent only'}
          </Badge>
        </div>
        <div>
          <span>Merit Shop</span>
          <Badge tone={child.parentMeritShopBlocked ? 'red' : 'green'}>
            {child.parentMeritShopBlocked ? 'Blocked' : 'Allowed'}
          </Badge>
        </div>
      </div>

      {child.headAcademicLocked ? (
        <div className="parent-settings-notice is-academic">
          <Lock aria-hidden="true" size={16} />
          <span>
            Oasis has locked this portal for academic reasons.
            {child.headAcademicLockReason ? ` ${child.headAcademicLockReason}` : ''}
          </span>
        </div>
      ) : null}

      {adult ? (
        <div className="parent-settings-notice">
          <ShieldCheck aria-hidden="true" size={16} />
          <span>
            {firstName(child.fullName)} is 18 or older. You can still view linked-child information
            that Oasis makes visible to parents, but account controls are disabled.
          </span>
        </div>
      ) : null}
    </Panel>
  );
}

function ChildIconPreview({ child }: { child: LinkedChildSettings }) {
  if (child.childIconPhotoUrl) {
    return (
      <span
        aria-hidden="true"
        className="parent-settings-child-icon__photo"
        style={{ backgroundImage: `url("${child.childIconPhotoUrl}")` }}
      />
    );
  }

  return <Avatar className="parent-settings-child-icon__fallback" name={child.fullName} />;
}

function PanelTitle({ children, icon, sub }: { children: string; icon: ReactNode; sub: string }) {
  return (
    <div className="parent-settings-panel-title">
      <span>{icon}</span>
      <div>
        <h2>{children}</h2>
        <p>{sub}</p>
      </div>
    </div>
  );
}

function InlineStatus({ error, success }: { error?: unknown; success: string | null }) {
  if (error) {
    return <p className="status--error">{friendlyErrorMessage(error)}</p>;
  }
  if (success) {
    return <p className="parent-settings-success">{success}</p>;
  }
  return null;
}

function SwitchRow({
  checked,
  disabled,
  label,
  onChange,
  pending,
  sub,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  pending: boolean;
  sub: string;
}) {
  return (
    <label className="parent-settings-switch">
      <span>
        <strong>{label}</strong>
        <small>{sub}</small>
      </span>
      <input
        checked={checked}
        className="switch-input"
        disabled={disabled || pending}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        type="checkbox"
      />
    </label>
  );
}

function CredentialsPanel({
  child,
  disabled,
  onSaved,
}: {
  child: LinkedChildSettings;
  disabled: boolean;
  onSaved: (child: LinkedChildSettings) => void;
}) {
  const utils = api.useUtils();
  const [loginHandle, setLoginHandle] = useState(child.loginHandle ?? '');
  const [password, setPassword] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordPolicySuccess, setPasswordPolicySuccess] = useState<string | null>(null);

  useEffect(() => {
    setLoginHandle(child.loginHandle ?? '');
    setPassword('');
    setSuccess(null);
    setPasswordError(null);
    setPasswordPolicySuccess(null);
  }, [child.studentId, child.loginHandle]);

  const saveLoginHandle = api.studentSettings.setLoginHandle.useMutation({
    onError(error) {
      showErrorToast(error, 'Login handle could not be saved.');
    },
    async onSuccess(updated) {
      onSaved(updated);
      setSuccess('Login handle saved.');
      showSuccessToast('Login handle saved.');
      await utils.studentSettings.listLinkedChildren.invalidate();
    },
  });
  const setChildPassword = api.studentSettings.setChildPassword.useMutation({
    onError(error) {
      showErrorToast(error, 'Password could not be updated.');
    },
    async onSuccess() {
      setPassword('');
      setPasswordPolicySuccess(
        'Password reset submitted. The password is not stored or shown here.',
      );
      showSuccessToast('Password reset submitted.');
      await utils.studentSettings.listLinkedChildren.invalidate();
    },
  });
  const setPasswordControl = api.studentSettings.setPasswordControl.useMutation({
    onError(error) {
      showErrorToast(error, 'Password policy could not be updated.');
    },
    async onSuccess(updated) {
      onSaved(updated);
      setPasswordPolicySuccess('Password policy updated.');
      showSuccessToast('Password policy updated.');
      await utils.studentSettings.listLinkedChildren.invalidate();
    },
  });

  function submitPassword(): void {
    setPasswordError(null);
    if (password.length < 12 || password.length > 128) {
      setPasswordError('Password must be 12 to 128 characters.');
      return;
    }
    setChildPassword.mutate({ password, studentId: child.studentId });
  }

  return (
    <Panel body className="parent-settings-panel">
      <PanelTitle
        icon={<KeyRound aria-hidden="true" size={17} />}
        sub="Set the sign-in handle and decide who controls password changes."
      >
        Credentials
      </PanelTitle>

      <div className="parent-settings-form-row">
        <Field hint="Leave blank if Oasis should manage the account handle." label="Login handle">
          <TextInput
            disabled={disabled || saveLoginHandle.isPending}
            maxLength={80}
            onChange={(event) => {
              setLoginHandle(event.target.value);
              setSuccess(null);
            }}
            placeholder="joshua.johnson"
            value={loginHandle}
          />
        </Field>
        <Button
          disabled={disabled}
          onClick={() => {
            saveLoginHandle.mutate({
              loginHandle: loginHandle.trim() ? loginHandle.trim() : null,
              studentId: child.studentId,
            });
          }}
          pending={saveLoginHandle.isPending}
          type="button"
          variant="secondary"
        >
          Save handle
        </Button>
      </div>
      <InlineStatus error={saveLoginHandle.error} success={success} />

      <SwitchRow
        checked={child.studentCanManagePassword}
        disabled={disabled}
        label="Child can set their password"
        onChange={(checked) => {
          setPasswordPolicySuccess(null);
          setPasswordControl.mutate({
            studentCanManagePassword: checked,
            studentId: child.studentId,
          });
        }}
        pending={setPasswordControl.isPending}
        sub="When off, password changes stay with the parent until the child is 18."
      />

      <div className="parent-settings-form-row">
        <Field
          error={passwordError ?? undefined}
          hint="Minimum 12 characters. The value is cleared after submission."
          label="Set new password"
        >
          <TextInput
            autoComplete="new-password"
            disabled={disabled || setChildPassword.isPending}
            maxLength={128}
            onChange={(event) => {
              setPassword(event.target.value);
              setPasswordError(null);
              setPasswordPolicySuccess(null);
            }}
            placeholder="New secure password"
            type="password"
            value={password}
          />
        </Field>
        <Button
          disabled={disabled || password.length === 0}
          onClick={submitPassword}
          pending={setChildPassword.isPending}
          type="button"
        >
          Set password
        </Button>
      </div>
      <InlineStatus
        error={setPasswordControl.error ?? setChildPassword.error}
        success={passwordPolicySuccess}
      />
    </Panel>
  );
}

function CreateLoginPanel({
  child,
  disabled,
  onSaved,
}: {
  child: LinkedChildSettings;
  disabled: boolean;
  onSaved: (child: LinkedChildSettings) => void;
}) {
  const utils = api.useUtils();
  const [loginHandle, setLoginHandle] = useState(child.loginHandle ?? '');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setLoginHandle(child.loginHandle ?? '');
    setPassword('');
    setLocalError(null);
    setSuccess(null);
  }, [child.studentId, child.loginHandle]);

  const createChildLogin = api.studentSettings.createChildLogin.useMutation({
    onError(error) {
      showErrorToast(error, 'Student login could not be created.');
    },
    async onSuccess(updated) {
      onSaved(updated);
      setPassword('');
      setSuccess('Student login created.');
      showSuccessToast('Student login created.');
      await utils.studentSettings.listLinkedChildren.invalidate();
    },
  });

  function submit(): void {
    setLocalError(null);
    const trimmedHandle = loginHandle.trim();
    if (trimmedHandle.length < 3) {
      setLocalError('Login handle must be at least 3 characters.');
      return;
    }
    if (password.length < 12 || password.length > 128) {
      setLocalError('Password must be 12 to 128 characters.');
      return;
    }
    createChildLogin.mutate({
      loginHandle: trimmedHandle,
      password,
      studentId: child.studentId,
    });
  }

  return (
    <Panel body className="parent-settings-panel">
      <PanelTitle
        icon={<UserPlus aria-hidden="true" size={17} />}
        sub="Create a username and starting password for this child's student portal."
      >
        Create login
      </PanelTitle>

      <div className="parent-settings-form-row">
        <Field label="Login handle">
          <TextInput
            autoComplete="username"
            disabled={disabled || createChildLogin.isPending}
            maxLength={80}
            onChange={(event) => {
              setLoginHandle(event.target.value);
              setLocalError(null);
              setSuccess(null);
            }}
            placeholder="jamie.learner"
            value={loginHandle}
          />
        </Field>
        <Field label="Initial password">
          <TextInput
            autoComplete="new-password"
            disabled={disabled || createChildLogin.isPending}
            maxLength={128}
            onChange={(event) => {
              setPassword(event.target.value);
              setLocalError(null);
              setSuccess(null);
            }}
            placeholder="New secure password"
            type="password"
            value={password}
          />
        </Field>
      </div>

      <div className="parent-settings-actions">
        <Button
          disabled={disabled || loginHandle.trim().length === 0 || password.length === 0}
          onClick={submit}
          pending={createChildLogin.isPending}
          type="button"
        >
          Create login
        </Button>
      </div>
      {localError ? <p className="status--error">{localError}</p> : null}
      <InlineStatus error={createChildLogin.error} success={success} />
    </Panel>
  );
}

function UsageLimitsPanel({
  child,
  disabled,
  onSaved,
}: {
  child: LinkedChildSettings;
  disabled: boolean;
  onSaved: (child: LinkedChildSettings) => void;
}) {
  const utils = api.useUtils();
  const [limits, setLimits] = useState<UsageLimitForm>(() => usageLimitFormFor(child));
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setLimits(usageLimitFormFor(child));
    setLocalError(null);
    setSuccess(null);
  }, [
    child.dailyUsageLimitMinutes,
    child.hourlyUsageLimitMinutes,
    child.studentId,
    child.weeklyUsageLimitMinutes,
  ]);

  const saveUsageLimits = api.studentSettings.setUsageLimits.useMutation({
    onError(error) {
      showErrorToast(error, 'Usage limits could not be saved.');
    },
    async onSuccess(updated) {
      onSaved(updated);
      setSuccess('Usage limits saved.');
      showSuccessToast('Usage limits saved.');
      await utils.studentSettings.listLinkedChildren.invalidate();
    },
  });

  function submit(): void {
    setLocalError(null);
    try {
      saveUsageLimits.mutate({
        dailyUsageLimitMinutes: parseOptionalMinutes(
          limits.dailyUsageLimitMinutes,
          'Daily limit',
          1440,
        ),
        hourlyUsageLimitMinutes: parseOptionalMinutes(
          limits.hourlyUsageLimitMinutes,
          'Hourly limit',
          60,
        ),
        studentId: child.studentId,
        weeklyUsageLimitMinutes: parseOptionalMinutes(
          limits.weeklyUsageLimitMinutes,
          'Weekly limit',
          10080,
        ),
      });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Check the usage limits.');
    }
  }

  return (
    <Panel body className="parent-settings-panel">
      <PanelTitle
        icon={<Clock3 aria-hidden="true" size={17} />}
        sub="Optional limits are stored now and enforced when usage tracking lands."
      >
        Usage limits
      </PanelTitle>

      <div className="parent-settings-limit-grid">
        {usageLimitFields.map((item) => (
          <Field hint={`1 to ${String(item.max)} minutes`} key={item.field} label={item.label}>
            <TextInput
              disabled={disabled || saveUsageLimits.isPending}
              inputMode="numeric"
              min={1}
              onChange={(event) => {
                setLimits((current) => ({ ...current, [item.field]: event.target.value }));
                setLocalError(null);
                setSuccess(null);
              }}
              placeholder={item.placeholder}
              type="number"
              value={limits[item.field]}
            />
          </Field>
        ))}
      </div>

      <div className="parent-settings-actions">
        <Button
          disabled={disabled}
          onClick={submit}
          pending={saveUsageLimits.isPending}
          type="button"
          variant="secondary"
        >
          Save limits
        </Button>
      </div>
      {localError ? <p className="status--error">{localError}</p> : null}
      <InlineStatus error={saveUsageLimits.error} success={success} />
    </Panel>
  );
}

function ChildIconPanel({
  child,
  disabled,
  onSaved,
}: {
  child: LinkedChildSettings;
  disabled: boolean;
  onSaved: (child: LinkedChildSettings) => void;
}) {
  const utils = api.useUtils();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [child.studentId, child.childIconPhotoUrl]);

  const updateChildIconPhoto = api.studentSettings.updateChildIconPhoto.useMutation({
    onError(errorValue) {
      showErrorToast(errorValue, 'Child icon photo could not be saved.');
    },
    async onSuccess(updated) {
      onSaved(updated);
      setSuccess('Child icon photo saved.');
      showSuccessToast('Child icon photo saved.');
      await utils.studentSettings.listLinkedChildren.invalidate();
    },
  });

  async function saveUploadedPhoto(photo: ChildIconPhotoUploadPayload): Promise<void> {
    setError(null);
    setSuccess(null);
    await updateChildIconPhoto.mutateAsync({
      photo: {
        fileName: photo.fileName,
        mimeType: photo.mimeType,
        sizeBytes: photo.sizeBytes,
        storageBucket: photo.storageBucket,
        storagePath: photo.storagePath,
      },
      studentId: child.studentId,
    });
  }

  return (
    <Panel body className="parent-settings-panel parent-settings-child-icon">
      <PanelTitle
        icon={<ImageIcon aria-hidden="true" size={17} />}
        sub="Upload a photo used as this child's portal icon."
      >
        Child icon
      </PanelTitle>
      <div className="parent-settings-child-icon__body">
        <ChildIconPreview child={child} />
        <div>
          <strong>{child.childIconPhotoUrl ? 'Photo set' : 'Initials shown'}</strong>
          <span>JPEG, PNG, or WebP. Maximum 5 MB.</span>
        </div>
        <ChildIconPhotoUploadButton
          disabled={disabled || updateChildIconPhoto.isPending}
          onError={(message) => {
            setError(message);
            showErrorToast(message, 'Child icon photo could not be uploaded.');
          }}
          onUploaded={saveUploadedPhoto}
          studentId={child.studentId}
        />
      </div>
      {error ? <p className="status--error">{error}</p> : null}
      <InlineStatus error={updateChildIconPhoto.error} success={success} />
    </Panel>
  );
}

function AccessPanel({
  child,
  disabled,
  onSaved,
}: {
  child: LinkedChildSettings;
  disabled: boolean;
  onSaved: (child: LinkedChildSettings) => void;
}) {
  const utils = api.useUtils();
  const [lockReason, setLockReason] = useState(child.parentLockReason ?? '');
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setLockReason(child.parentLockReason ?? '');
    setSuccess(null);
  }, [child.parentLockReason, child.studentId]);

  const setMeritShopBlock = api.studentSettings.setMeritShopBlock.useMutation({
    onError(error) {
      showErrorToast(error, 'Merit Shop access could not be updated.');
    },
    async onSuccess(updated) {
      onSaved(updated);
      setSuccess('Merit Shop access updated.');
      showSuccessToast('Merit Shop access updated.');
      await utils.studentSettings.listLinkedChildren.invalidate();
    },
  });
  const setParentLock = api.studentSettings.setParentLock.useMutation({
    onError(error) {
      showErrorToast(error, 'Account lock could not be updated.');
    },
    async onSuccess(updated) {
      onSaved(updated);
      setSuccess(updated.parentAccountLocked ? 'Account locked.' : 'Account unlocked.');
      showSuccessToast(updated.parentAccountLocked ? 'Account locked.' : 'Account unlocked.');
      await utils.studentSettings.listLinkedChildren.invalidate();
    },
  });

  return (
    <Panel body className="parent-settings-panel">
      <PanelTitle
        icon={<CircleSlash aria-hidden="true" size={17} />}
        sub="Restrict portal access or Merit Shop use when needed."
      >
        Access controls
      </PanelTitle>

      <SwitchRow
        checked={child.parentMeritShopBlocked}
        disabled={disabled}
        label="Block Merit Shop use"
        onChange={(blocked) => {
          setSuccess(null);
          setMeritShopBlock.mutate({ blocked, studentId: child.studentId });
        }}
        pending={setMeritShopBlock.isPending}
        sub="The child cannot reserve or purchase shop items while this is on."
      />

      <div className="parent-settings-lock-box">
        <SwitchRow
          checked={child.parentAccountLocked}
          disabled={disabled}
          label="Lock portal account"
          onChange={(locked) => {
            setSuccess(null);
            setParentLock.mutate({
              locked,
              reason: locked ? lockReason.trim() || null : null,
              studentId: child.studentId,
            });
          }}
          pending={setParentLock.isPending}
          sub="A parent lock stops the child from using the student portal."
        />
        <Field
          hint="Shown back to the parent user. Keep it brief and child-safe."
          label="Parent lock reason"
        >
          <textarea
            className="input parent-settings-textarea"
            disabled={disabled || setParentLock.isPending || !child.parentAccountLocked}
            maxLength={500}
            onChange={(event) => {
              setLockReason(event.target.value);
              setSuccess(null);
            }}
            placeholder="Reason for the parent lock"
            value={lockReason}
          />
        </Field>
        {child.parentAccountLocked ? (
          <div className="parent-settings-actions">
            <Button
              disabled={disabled}
              onClick={() => {
                setParentLock.mutate({
                  locked: true,
                  reason: lockReason.trim() || null,
                  studentId: child.studentId,
                });
              }}
              pending={setParentLock.isPending}
              type="button"
              variant="secondary"
            >
              Save reason
            </Button>
          </div>
        ) : null}
      </div>

      <InlineStatus error={setMeritShopBlock.error ?? setParentLock.error} success={success} />
    </Panel>
  );
}

export function ParentStudentSettingsClient() {
  const utils = api.useUtils();
  const settingsQuery = api.studentSettings.listLinkedChildren.useQuery(undefined, {
    retry: false,
  });
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const children = useMemo(() => settingsQuery.data ?? [], [settingsQuery.data]);
  const selectedChild =
    children.find((child) => child.studentId === selectedStudentId) ?? children[0] ?? null;

  function updateCachedChild(updated: LinkedChildSettings): void {
    utils.studentSettings.listLinkedChildren.setData(undefined, (current) =>
      current?.map((child) => (child.studentId === updated.studentId ? updated : child)),
    );
  }

  if (settingsQuery.isLoading) {
    return <div className="empty-state">Loading student portal settings...</div>;
  }

  if (settingsQuery.error) {
    return (
      <EmptyState
        detail={friendlyErrorMessage(settingsQuery.error)}
        title="Student settings unavailable"
      />
    );
  }

  if (children.length === 0 || !selectedChild) {
    return (
      <EmptyState
        detail="Ask the Head of Centre to link your child records to this account."
        title="No linked children found"
      />
    );
  }

  const childOptions = children.map((child) => ({
    fullName: child.fullName,
    iconPhotoUrl: child.childIconPhotoUrl,
    id: child.studentId,
    yearGroup: child.yearGroup,
  }));
  const controlsDisabled = !selectedChild.parentControlAllowed;

  return (
    <div className="parent-settings-page">
      <div className="dashboard-hero">
        <p>Student portal settings</p>
        <h1>Account controls for linked children</h1>
        <span>Configure sign-in, password policy, usage limits, locks, and Merit Shop access.</span>
      </div>

      <div className="parent-page-title-row parent-settings-title-row">
        <div className="parent-home-intro">
          <p>Parent controlled settings</p>
          <h2>{selectedChild.fullName}</h2>
          <span>{displaySchoolYearLabel(selectedChild.yearGroup)}</span>
        </div>
        <ParentChildSelector
          children={childOptions}
          onSelect={setSelectedStudentId}
          selectedChildId={selectedChild.studentId}
        />
      </div>

      <div className="parent-settings-layout">
        <aside className="parent-settings-sidebar" aria-label="Selected child settings state">
          <SettingsStatusCard child={selectedChild} />
        </aside>

        <div className="parent-settings-stack">
          {selectedChild.accountLinked ? (
            <CredentialsPanel
              child={selectedChild}
              disabled={controlsDisabled}
              onSaved={updateCachedChild}
            />
          ) : (
            <CreateLoginPanel
              child={selectedChild}
              disabled={controlsDisabled}
              onSaved={updateCachedChild}
            />
          )}
          <UsageLimitsPanel
            child={selectedChild}
            disabled={controlsDisabled}
            onSaved={updateCachedChild}
          />
          <ChildIconPanel
            child={selectedChild}
            disabled={controlsDisabled}
            onSaved={updateCachedChild}
          />
          <Panel body className="parent-settings-panel parent-settings-shop-panel">
            <PanelTitle
              icon={<ShoppingBag aria-hidden="true" size={17} />}
              sub="Shop blocking is also shown in access controls for quick toggling."
            >
              Merit Shop policy
            </PanelTitle>
            <div className="parent-settings-shop-summary">
              <span>{selectedChild.parentMeritShopBlocked ? 'Blocked' : 'Allowed'}</span>
              <p>
                {selectedChild.parentMeritShopBlocked
                  ? `${firstName(selectedChild.fullName)} cannot use the Merit Shop.`
                  : `${firstName(selectedChild.fullName)} can use the Merit Shop when the account is not locked.`}
              </p>
            </div>
          </Panel>
          <AccessPanel
            child={selectedChild}
            disabled={controlsDisabled}
            onSaved={updateCachedChild}
          />
          {controlsDisabled ? (
            <Panel body className="parent-settings-panel parent-settings-denied">
              <UserCog aria-hidden="true" size={18} />
              <div>
                <strong>Account control is read-only</strong>
                <span>
                  Parent account-control changes are disabled for students who are 18 or older.
                </span>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
