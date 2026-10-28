import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSignIn, useSSO } from '@clerk/clerk-expo';
import { WebBrowserResultType } from 'expo-web-browser';
import crest from '../../../assets/crest.png';
import { Card, ErrorText, Field, MutedText, MobileButton } from './mobile-ui';
import { C, radius, typeRamp } from './mobile-theme';

type SecondFactor =
  | { strategy: 'totp' }
  | { strategy: 'backup_code' }
  | { strategy: 'phone_code'; phoneNumberId?: string | undefined; safeIdentifier?: string }
  | { strategy: 'email_code'; emailAddressId?: string | undefined; safeIdentifier?: string };

const secondFactorPriority: readonly SecondFactor['strategy'][] = [
  'totp',
  'phone_code',
  'email_code',
  'backup_code',
];
const PASSWORD_RESET_URL = 'https://www.oasisportal.space/sign-in/forgot-password';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Sign-in failed.';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSecondFactor(value: unknown): value is SecondFactor {
  if (!isObject(value)) return false;

  switch (value.strategy) {
    case 'totp':
    case 'backup_code':
      return true;
    case 'phone_code':
      return value.phoneNumberId === undefined || typeof value.phoneNumberId === 'string';
    case 'email_code':
      return value.emailAddressId === undefined || typeof value.emailAddressId === 'string';
    default:
      return false;
  }
}

function preferredSecondFactor(factors: SecondFactor[]): SecondFactor | null {
  for (const strategy of secondFactorPriority) {
    const factor = factors.find((candidate) => candidate.strategy === strategy);
    if (factor) return factor;
  }

  return null;
}

function factorLabel(factor: SecondFactor | null): string {
  if (!factor) return 'Second factor';
  if (factor.strategy === 'totp') return 'Authenticator code';
  if (factor.strategy === 'backup_code') return 'Backup code';
  if (factor.strategy === 'email_code') {
    return `Email code${factor.safeIdentifier ? ` · ${factor.safeIdentifier}` : ''}`;
  }
  return `Phone code${factor.safeIdentifier ? ` · ${factor.safeIdentifier}` : ''}`;
}

function supportedSecondFactorsFrom(values: readonly unknown[] | null): SecondFactor[] {
  return (values ?? []).filter(isSecondFactor);
}

export function SignInPanel() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { startSSOFlow } = useSSO();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secondFactor, setSecondFactor] = useState<SecondFactor | null>(null);
  const [secondFactorCode, setSecondFactorCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [ssoPending, setSsoPending] = useState(false);
  const authPending = pending || ssoPending;

  type LoadedSignIn = NonNullable<typeof signIn>;
  type LoadedSetActive = NonNullable<typeof setActive>;
  type SignInAttempt = Awaited<ReturnType<LoadedSignIn['create']>>;

  async function activateIfComplete(attempt: SignInAttempt, activate: LoadedSetActive) {
    if (attempt.status === 'complete') {
      await activate({ session: attempt.createdSessionId });
      return true;
    }

    return false;
  }

  async function prepareSecondFactor(client: LoadedSignIn, factor: SecondFactor) {
    if (factor.strategy === 'phone_code') {
      const params = factor.phoneNumberId
        ? { strategy: factor.strategy, phoneNumberId: factor.phoneNumberId }
        : { strategy: factor.strategy };
      await client.prepareSecondFactor(params);
    }

    if (factor.strategy === 'email_code') {
      const params = factor.emailAddressId
        ? { strategy: factor.strategy, emailAddressId: factor.emailAddressId }
        : { strategy: factor.strategy };
      await client.prepareSecondFactor(params);
    }
  }

  async function submitSso() {
    if (!isLoaded || authPending) return;

    setSsoPending(true);
    setError(null);
    setSecondFactor(null);
    setSecondFactorCode('');
    try {
      const result = await startSSOFlow({ strategy: 'oauth_google' });

      if (result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        return;
      }

      if (result.authSessionResult?.type === WebBrowserResultType.CANCEL) {
        setError('Google SSO sign-in was cancelled.');
        return;
      }

      setError('Google SSO did not return a Clerk session. Check the Clerk SSO setup.');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSsoPending(false);
    }
  }

  async function submit() {
    if (!isLoaded || authPending) return;

    setPending(true);
    setError(null);
    try {
      const attempt = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (await activateIfComplete(attempt, setActive)) return;

      if (attempt.status === 'needs_second_factor') {
        const factor = preferredSecondFactor(
          supportedSecondFactorsFrom(attempt.supportedSecondFactors),
        );

        if (!factor) {
          setError('This account requires MFA, but no supported second factor was returned.');
          return;
        }

        await prepareSecondFactor(signIn, factor);
        setSecondFactor(factor);
        setSecondFactorCode('');
        setError(null);
        return;
      }

      const status = attempt.status ?? 'additional verification';
      setError(`Sign-in requires ${status}. Complete it in Clerk before using the mobile app.`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function submitSecondFactor() {
    if (!isLoaded || authPending || !secondFactor) return;

    setPending(true);
    setError(null);
    try {
      const code = secondFactorCode.trim();
      let attempt: SignInAttempt;
      switch (secondFactor.strategy) {
        case 'totp':
          attempt = await signIn.attemptSecondFactor({ strategy: secondFactor.strategy, code });
          break;
        case 'backup_code':
          attempt = await signIn.attemptSecondFactor({ strategy: secondFactor.strategy, code });
          break;
        case 'email_code':
          attempt = await signIn.attemptSecondFactor({ strategy: secondFactor.strategy, code });
          break;
        case 'phone_code':
          attempt = await signIn.attemptSecondFactor({ strategy: secondFactor.strategy, code });
          break;
      }

      if (await activateIfComplete(attempt, setActive)) return;

      const status = attempt.status ?? 'additional verification';
      setError(`Second factor returned ${status}.`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  function resetSecondFactor() {
    setSecondFactor(null);
    setSecondFactorCode('');
    setError(null);
  }

  async function openPasswordReset() {
    if (authPending) return;

    setError(null);
    try {
      await Linking.openURL(PASSWORD_RESET_URL);
    } catch {
      setError('Could not open password reset. Please use the web portal forgot password link.');
    }
  }

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      style={styles.shell}
    >
      <View style={styles.brand}>
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel="Oasis Learning Centre"
          source={crest}
          style={styles.logo}
        />
        <Text accessibilityRole="header" style={styles.title}>
          Oasis Learning Centre
        </Text>
        <Text style={styles.subtitle}>Staff and family mobile portal</Text>
      </View>
      <Card style={styles.loginCard}>
        {secondFactor ? (
          <>
            <MutedText>{factorLabel(secondFactor)}</MutedText>
            <Field
              keyboardType={secondFactor.strategy === 'backup_code' ? 'default' : 'numeric'}
              label="Code"
              onChangeText={setSecondFactorCode}
              placeholder="Enter verification code"
              value={secondFactorCode}
            />
          </>
        ) : (
          <>
            <MobileButton
              disabled={!isLoaded || authPending}
              label={ssoPending ? 'Opening Google SSO...' : 'Continue with Google SSO'}
              onPress={() => {
                void submitSso();
              }}
              variant="secondary"
            />
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
            <Field
              keyboardType="email-address"
              label="Email or username"
              onChangeText={setEmail}
              placeholder="supervisor@example.com"
              testID="sign-in-email"
              value={email}
            />
            <Field
              label="Password"
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
              testID="sign-in-password"
              value={password}
            />
            <Pressable
              accessibilityLabel="Reset your Oasis password"
              accessibilityRole="link"
              disabled={authPending}
              onPress={() => {
                void openPasswordReset();
              }}
              style={[
                styles.forgotPasswordLink,
                authPending ? styles.forgotPasswordDisabled : null,
              ]}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </Pressable>
          </>
        )}
        {error ? <ErrorText>{error}</ErrorText> : null}
        <MobileButton
          disabled={
            !isLoaded ||
            authPending ||
            (secondFactor ? !secondFactorCode.trim() : !email.trim() || !password)
          }
          label={pending ? 'Signing in...' : secondFactor ? 'Verify code' : 'Sign in'}
          onPress={() => {
            void (secondFactor ? submitSecondFactor() : submit());
          }}
        />
        {secondFactor ? (
          <MobileButton
            compact
            label="Use another account"
            onPress={resetSecondFactor}
            variant="secondary"
          />
        ) : null}
        <Text style={styles.securityNote}>Secured with Clerk two-factor authentication</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  brand: {
    alignItems: 'center',
    gap: 6,
  },
  divider: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginVertical: 2,
  },
  dividerLine: {
    backgroundColor: C.hairline,
    flex: 1,
    height: 1,
  },
  dividerText: {
    ...typeRamp.caption,
    color: C.textMuted,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  forgotPasswordDisabled: {
    opacity: 0.45,
  },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    minHeight: 32,
    justifyContent: 'center',
  },
  forgotPasswordText: {
    ...typeRamp.subhead,
    color: C.link,
    fontWeight: '600',
  },
  loginCard: {
    alignSelf: 'center',
    borderRadius: radius.lg + 4,
    gap: 14,
    maxWidth: 440,
    padding: 20,
    width: '100%',
  },
  logo: {
    height: 104,
    resizeMode: 'contain',
    width: 104,
  },
  scrollContent: {
    flexGrow: 1,
    gap: 24,
    justifyContent: 'center',
    padding: 24,
  },
  securityNote: {
    ...typeRamp.caption,
    color: C.textMuted,
    textAlign: 'center',
  },
  shell: {
    backgroundColor: C.bg,
    flex: 1,
  },
  subtitle: {
    ...typeRamp.subhead,
    color: C.textSecondary,
    textAlign: 'center',
  },
  title: {
    color: C.navy,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.36,
    textAlign: 'center',
  },
});
