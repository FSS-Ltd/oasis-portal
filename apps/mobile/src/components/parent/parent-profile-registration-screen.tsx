import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { REGISTRATION_LEVEL_OPTIONS, type RegistrationLevel } from '@oasis/domain';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import {
  Badge,
  Card,
  ErrorText,
  Field,
  InlineSpinner,
  MutedText,
  MobileButton,
} from '../core/mobile-ui';
import { displaySchoolYearLabel, formatParentDate } from './parent-home-utils';
import {
  blankSibling,
  hasRegistrationLevel,
  hasValidDate,
  profileForm,
  registrationForm,
  siblingInputFromForm,
  updateInputFromRegistration,
  type ProfileForm,
  type RegistrationForm,
  type SiblingForm,
} from './parent-profile-registration-utils';

type LinkRequest = RouterOutputs['registration']['listMyStudentParentLinkRequests'][number];

export function ParentProfileRegistrationScreen({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const utils = api.useUtils();
  const profile = api.profile.me.useQuery(undefined, { retry: false });
  const spouseInviteStatus = api.profile.spouseInviteStatus.useQuery(undefined, { retry: false });
  const registration = api.registration.mine.useQuery(undefined, { retry: false });
  const registrationStatus = api.registration.status.useQuery(undefined, { retry: false });
  const linkRequests = api.registration.listMyStudentParentLinkRequests.useQuery(undefined, {
    retry: false,
  });
  const updateProfile = api.profile.updateMe.useMutation();
  const inviteSpouse = api.profile.inviteSpouse.useMutation();
  const updateRegistration = api.registration.updateMine.useMutation();
  const addSiblings = api.registration.addSiblings.useMutation();
  const confirmLink = api.registration.confirmStudentParentLinkRequest.useMutation();
  const rejectLink = api.registration.rejectStudentParentLinkRequest.useMutation();
  const [profileFields, setProfileFields] = useState<ProfileForm>(profileForm(undefined));
  const [registrationFields, setRegistrationFields] = useState<RegistrationForm>(
    registrationForm(undefined),
  );
  const [spouseEmail, setSpouseEmail] = useState('');
  const [siblingFields, setSiblingFields] = useState<SiblingForm>(blankSibling());
  const [status, setStatus] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (profile.data) setProfileFields(profileForm(profile.data));
  }, [profile.data]);

  useEffect(() => {
    if (registration.data) setRegistrationFields(registrationForm(registration.data));
  }, [registration.data]);

  const refreshing =
    profile.isFetching ||
    spouseInviteStatus.isFetching ||
    registration.isFetching ||
    registrationStatus.isFetching ||
    linkRequests.isFetching;
  const mutationPending =
    updateProfile.isPending ||
    inviteSpouse.isPending ||
    updateRegistration.isPending ||
    addSiblings.isPending ||
    confirmLink.isPending ||
    rejectLink.isPending;
  const queryError =
    profile.error?.message ??
    spouseInviteStatus.error?.message ??
    registration.error?.message ??
    registrationStatus.error?.message ??
    linkRequests.error?.message ??
    null;
  const mutationError =
    updateProfile.error?.message ??
    inviteSpouse.error?.message ??
    updateRegistration.error?.message ??
    addSiblings.error?.message ??
    confirmLink.error?.message ??
    rejectLink.error?.message ??
    null;
  const children = profile.data?.children ?? [];
  const canAddSibling = (registration.data?.students.length ?? 6) < 6;
  const pendingInvitation = spouseInviteStatus.data?.pendingInvitation ?? null;
  const registrationStudentCount = registration.data?.students.length ?? 0;
  const linkedChildCount = registrationStatus.data?.linkedChildrenCount ?? children.length;
  const missingLinks = linkedChildCount === 0;
  const pendingLinkCount = linkRequests.data?.length ?? 0;

  async function refreshAll() {
    setStatus(null);
    await Promise.all([
      onRefresh(),
      profile.refetch(),
      spouseInviteStatus.refetch(),
      registration.refetch(),
      registrationStatus.refetch(),
      linkRequests.refetch(),
    ]);
  }

  async function saveProfile() {
    if (!profileFields.fullName.trim() || !profileFields.email.trim()) {
      setFormError('Enter a full name and email address.');
      return;
    }
    setFormError(null);
    const saved = await updateProfile.mutateAsync({
      address: profileFields.address,
      email: profileFields.email,
      fullName: profileFields.fullName,
      phone: profileFields.phone,
    });
    setProfileFields(profileForm(saved));
    setStatus('Profile saved.');
    await utils.profile.me.invalidate();
  }

  async function sendSpouseInvite() {
    const email = spouseEmail.trim();
    if (!email) {
      setFormError('Enter a spouse email address.');
      return;
    }
    setFormError(null);
    await inviteSpouse.mutateAsync({ email });
    setSpouseEmail('');
    setStatus('Spouse invite sent.');
    await utils.profile.spouseInviteStatus.invalidate();
  }

  async function saveRegistration() {
    if (!registration.data) {
      setFormError('Registration unavailable.');
      return;
    }
    if (!registrationFields.homeAddress.trim() || !registrationFields.guardianName.trim()) {
      setFormError('Enter the home address and guardian agreement name.');
      return;
    }
    setFormError(null);
    await updateRegistration.mutateAsync(
      updateInputFromRegistration(registration.data, registrationFields),
    );
    setStatus('Registration maintenance saved.');
    await utils.registration.mine.invalidate();
  }

  async function addSibling() {
    if (!siblingFields.fullName.trim()) {
      setFormError('Enter the sibling full name.');
      return;
    }
    if (!hasValidDate(siblingFields.dob)) {
      setFormError('Enter a valid date of birth.');
      return;
    }
    if (!hasValidDate(siblingFields.startDate)) {
      setFormError('Enter a valid start date.');
      return;
    }
    if (!hasRegistrationLevel(siblingFields.registrationLevel)) {
      setFormError('Choose ABC, Primary, or Secondary.');
      return;
    }
    const sibling = siblingInputFromForm(siblingFields, profile.data);
    setFormError(null);
    await addSiblings.mutateAsync({ students: [sibling] });
    setSiblingFields(blankSibling());
    setStatus('Sibling added.');
    await Promise.all([
      utils.registration.mine.invalidate(),
      utils.childLog.parentDashboard.invalidate(),
    ]);
  }

  async function answerLinkRequest(request: LinkRequest, action: 'confirm' | 'reject') {
    setFormError(null);
    if (action === 'confirm') {
      await confirmLink.mutateAsync({ id: request.id });
      setStatus(`Student link confirmed for ${request.studentName}.`);
    } else {
      await rejectLink.mutateAsync({ id: request.id });
      setStatus(`Student link rejected for ${request.studentName}.`);
    }
    await Promise.all([
      utils.registration.listMyStudentParentLinkRequests.invalidate(),
      utils.profile.me.invalidate(),
      utils.childLog.parentDashboard.invalidate(),
    ]);
  }

  const introDetail = useMemo(() => {
    if (pendingLinkCount > 0) return `${String(pendingLinkCount)} pending student links`;
    if (missingLinks) return 'No linked children';
    return `${String(linkedChildCount)} linked children`;
  }, [linkedChildCount, missingLinks, pendingLinkCount]);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void refreshAll();
          }}
          refreshing={refreshing}
        />
      }
      style={styles.scroller}
    >
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>Parent Profile</Text>
        <Text style={styles.title}>Profile and family setup</Text>
        <Text style={styles.subtitle}>{introDetail}</Text>
      </View>

      {profile.isLoading ? <InlineSpinner label="Loading profile and registration" /> : null}
      {queryError ? <ErrorText>{queryError}</ErrorText> : null}
      {mutationError ? <ErrorText>{mutationError}</ErrorText> : null}
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {status ? <Text style={styles.success}>{status}</Text> : null}

      <Card>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>My account</Text>
            <MutedText>Keep your profile details current for Oasis staff.</MutedText>
          </View>
          <Badge variant={profile.data?.active ? 'success' : 'warning'}>
            {profile.data?.active ? 'Active' : 'Pending'}
          </Badge>
        </View>
        <Field
          label="Full name"
          onChangeText={(fullName) => {
            setProfileFields((current) => ({ ...current, fullName }));
          }}
          value={profileFields.fullName}
        />
        <Field
          keyboardType="email-address"
          label="Email"
          onChangeText={(email) => {
            setProfileFields((current) => ({ ...current, email }));
          }}
          value={profileFields.email}
        />
        <Field
          label="Phone"
          onChangeText={(phone) => {
            setProfileFields((current) => ({ ...current, phone }));
          }}
          value={profileFields.phone}
        />
        <Field
          label="Address"
          multiline
          onChangeText={(address) => {
            setProfileFields((current) => ({ ...current, address }));
          }}
          value={profileFields.address}
        />
        <MobileButton
          disabled={mutationPending}
          label={updateProfile.isPending ? 'Saving profile...' : 'Save profile'}
          onPress={() => {
            void saveProfile();
          }}
          variant="primary"
        />
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Spouse invite</Text>
            <MutedText>Invite a second parent when at least one child is linked.</MutedText>
          </View>
          {spouseInviteStatus.data?.spouseLinked ? <Badge variant="success">Linked</Badge> : null}
        </View>
        {spouseInviteStatus.data?.linkedChildCount === 0 ? (
          <MutedText>Link a child before inviting a spouse.</MutedText>
        ) : null}
        {spouseInviteStatus.data?.spouseLinked ? (
          <MutedText>A parent or spouse account is already linked to this family.</MutedText>
        ) : null}
        {pendingInvitation ? (
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.rowTitle}>{pendingInvitation.email}</Text>
              <MutedText>Invite sent for this family.</MutedText>
            </View>
            <Badge variant={pendingInvitation.emailStatus === 'Sent' ? 'success' : 'warning'}>
              {pendingInvitation.emailStatus}
            </Badge>
          </View>
        ) : null}
        {spouseInviteStatus.data?.canInvite ? (
          <>
            <Field
              keyboardType="email-address"
              label="Spouse email"
              onChangeText={setSpouseEmail}
              value={spouseEmail}
            />
            <MobileButton
              disabled={mutationPending}
              label={inviteSpouse.isPending ? 'Sending invite...' : 'Send invite'}
              onPress={() => {
                void sendSpouseInvite();
              }}
              variant="secondary"
            />
          </>
        ) : null}
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Registration maintenance</Text>
            <MutedText>Review and update the family registration summary.</MutedText>
          </View>
          <Badge variant={registration.data ? 'blue' : 'warning'}>
            {registration.data ? `${String(registrationStudentCount)} child records` : 'Missing'}
          </Badge>
        </View>
        {!registration.data ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyTitle}>Registration unavailable</Text>
            <MutedText>
              Complete the initial family registration on web before mobile maintenance is
              available.
            </MutedText>
          </View>
        ) : (
          <>
            <Field
              label="Home address"
              multiline
              onChangeText={(homeAddress) => {
                setRegistrationFields((current) => ({ ...current, homeAddress }));
              }}
              value={registrationFields.homeAddress}
            />
            <Field
              label="Guardian agreement name"
              onChangeText={(guardianName) => {
                setRegistrationFields((current) => ({ ...current, guardianName }));
              }}
              value={registrationFields.guardianName}
            />
            <Field
              label="Agreement date"
              onChangeText={(agreementDate) => {
                setRegistrationFields((current) => ({ ...current, agreementDate }));
              }}
              value={registrationFields.agreementDate}
            />
            <View style={styles.studentList}>
              {registration.data.students.map((student) => (
                <View key={student.studentId} style={styles.studentRow}>
                  <View>
                    <Text style={styles.rowTitle}>{student.fullName}</Text>
                    <MutedText>
                      {displaySchoolYearLabel(student.yearGroup)} · Started{' '}
                      {formatParentDate(student.startDate)}
                    </MutedText>
                  </View>
                  <Badge variant={student.active ? 'success' : 'neutral'}>
                    {student.active ? 'Active' : 'Inactive'}
                  </Badge>
                </View>
              ))}
            </View>
            <MobileButton
              disabled={mutationPending}
              label={
                updateRegistration.isPending
                  ? 'Saving registration...'
                  : 'Save registration maintenance'
              }
              onPress={() => {
                void saveRegistration();
              }}
              variant="blue"
            />
          </>
        )}
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Add sibling</Text>
            <MutedText>Create another child record on the current family registration.</MutedText>
          </View>
          <Badge variant={canAddSibling ? 'success' : 'warning'}>
            {canAddSibling ? 'Available' : 'Unavailable'}
          </Badge>
        </View>
        {!registration.data ? (
          <MutedText>Registration is required before adding a sibling.</MutedText>
        ) : null}
        {registration.data && !canAddSibling ? (
          <MutedText>This registration already has the maximum number of children.</MutedText>
        ) : null}
        {canAddSibling ? (
          <>
            <Field
              label="Sibling full name"
              onChangeText={(fullName) => {
                setSiblingFields((current) => ({ ...current, fullName }));
              }}
              value={siblingFields.fullName}
            />
            <Field
              label="Preferred name"
              onChangeText={(preferredName) => {
                setSiblingFields((current) => ({ ...current, preferredName }));
              }}
              value={siblingFields.preferredName}
            />
            <Field
              label="Date of birth"
              onChangeText={(dob) => {
                setSiblingFields((current) => ({ ...current, dob }));
              }}
              placeholder="YYYY-MM-DD"
              value={siblingFields.dob}
            />
            <RegistrationLevelSelector
              disabled={mutationPending}
              onChange={(registrationLevel) => {
                setSiblingFields((current) => ({ ...current, registrationLevel }));
              }}
              value={siblingFields.registrationLevel}
            />
            <MobileButton
              disabled={mutationPending}
              label={addSiblings.isPending ? 'Adding sibling...' : 'Add sibling'}
              onPress={() => {
                void addSibling();
              }}
              variant="secondary"
            />
          </>
        ) : null}
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Pending student links</Text>
            <MutedText>Confirm or reject requests that name this parent account.</MutedText>
          </View>
          <Badge variant={pendingLinkCount > 0 ? 'warning' : 'neutral'}>
            {String(pendingLinkCount)}
          </Badge>
        </View>
        {missingLinks && pendingLinkCount === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyTitle}>No linked children</Text>
            <MutedText>
              Pending-link and rejected-link outcomes appear here when a student requests this
              account.
            </MutedText>
          </View>
        ) : null}
        {linkRequests.data?.length === 0 && !missingLinks ? (
          <MutedText>No pending student links.</MutedText>
        ) : null}
        {linkRequests.data?.map((request) => (
          <LinkRequestCard
            disabled={mutationPending}
            key={request.id}
            onAnswer={answerLinkRequest}
            request={request}
          />
        ))}
      </Card>
    </ScrollView>
  );
}

function RegistrationLevelSelector({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (value: RegistrationLevel) => void;
  value: RegistrationLevel | '';
}) {
  return (
    <View style={styles.levelSelector}>
      <Text style={styles.readLabel}>Registration level</Text>
      <View style={styles.actionRow}>
        {REGISTRATION_LEVEL_OPTIONS.map((level) => {
          const selected = value === level;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled, selected }}
              disabled={disabled}
              key={level}
              onPress={() => {
                onChange(level);
              }}
              style={[
                styles.levelButton,
                selected ? styles.levelButtonSelected : null,
                disabled ? styles.disabled : null,
              ]}
            >
              <Text
                style={[styles.levelButtonText, selected ? styles.levelButtonTextSelected : null]}
              >
                {level}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <MutedText>Head of Centre decides the exact level.</MutedText>
    </View>
  );
}

function LinkRequestCard({
  disabled,
  onAnswer,
  request,
}: {
  disabled: boolean;
  onAnswer: (request: LinkRequest, action: 'confirm' | 'reject') => Promise<void>;
  request: LinkRequest;
}) {
  return (
    <View style={styles.linkRequest}>
      <View style={styles.statusRow}>
        <View>
          <Text style={styles.rowTitle}>{request.studentName}</Text>
          <MutedText>{displaySchoolYearLabel(request.yearGroup)}</MutedText>
        </View>
        <Badge variant="warning">Pending</Badge>
      </View>
      <View style={styles.readGrid}>
        <ReadTile label="Requested for" value={request.parentEmail} />
        <ReadTile label="Submitted" value={formatParentDate(request.createdAt)} />
      </View>
      <View style={styles.actionRow}>
        <MobileButton
          compact
          disabled={disabled}
          label="Confirm link"
          onPress={() => {
            void onAnswer(request, 'confirm');
          }}
          variant="success"
        />
        <MobileButton
          compact
          disabled={disabled}
          label="Reject"
          onPress={() => {
            void onAnswer(request, 'reject');
          }}
          variant="danger"
        />
      </View>
    </View>
  );
}

function ReadTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.readTile}>
      <Text style={styles.readLabel}>{label}</Text>
      <Text style={styles.readValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: C.navy,
    fontSize: 17,
    fontWeight: '900',
  },
  content: {
    gap: 14,
    padding: 16,
    paddingBottom: 36,
  },
  emptyBlock: {
    backgroundColor: C.bg,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  emptyTitle: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.45,
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  intro: {
    gap: 3,
  },
  linkRequest: {
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  levelButton: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1.5,
    minHeight: 40,
    minWidth: 86,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  levelButtonSelected: {
    backgroundColor: C.blueLight,
    borderColor: C.blueMid,
  },
  levelButtonText: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  levelButtonTextSelected: {
    color: C.navy,
  },
  levelSelector: {
    gap: 7,
  },
  readGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  readLabel: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  readTile: {
    backgroundColor: C.bg,
    borderRadius: 8,
    flex: 1,
    minWidth: 130,
    padding: 10,
  },
  readValue: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  rowTitle: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  scroller: {
    flex: 1,
  },
  statusRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  studentList: {
    gap: 8,
  },
  studentRow: {
    alignItems: 'flex-start',
    backgroundColor: C.bg,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    padding: 12,
  },
  subtitle: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  success: {
    backgroundColor: C.successBg,
    borderColor: C.successMid,
    borderRadius: 8,
    borderWidth: 1,
    color: C.success,
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  title: {
    color: C.navy,
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 28,
  },
});
