import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Card, MutedText, SectionTitle } from '../core/mobile-ui';

const pwaUrl = 'https://app.oasisportal.space';

const installSections = [
  {
    badge: 'iPhone and iPad',
    steps: [
      'Open Safari on your iPhone or iPad.',
      `Go to ${pwaUrl}`,
      'Tap the Share button at the bottom of the screen.',
      'Choose Add to Home Screen.',
      'Tap Add to confirm.',
    ],
    note: 'Safari is required for iOS home-screen install.',
  },
  {
    badge: 'Android',
    steps: [
      'Open Chrome on your Android phone or tablet.',
      `Go to ${pwaUrl}`,
      'Tap the three-dot menu in the top right corner.',
      'Choose Add to Home Screen or Install app.',
      'Tap Add or Install to confirm.',
    ],
  },
  {
    badge: 'Desktop Chrome',
    steps: [
      'Open Google Chrome on your computer.',
      `Go to ${pwaUrl}`,
      'Look for the install icon on the right side of the address bar.',
      'Click it, then choose Install.',
    ],
  },
] as const;

export function TechnicalSupportMobileAppScreen() {
  return (
    <View style={styles.stack}>
      <Card style={styles.heroCard}>
        <Text style={styles.eyebrow}>Mobile App</Text>
        <SectionTitle>Install guidance</SectionTitle>
        <MutedText>Help parents and support users add the Oasis app to their device.</MutedText>
      </Card>

      {installSections.map((section) => (
        <Card key={section.badge} style={styles.sectionCard}>
          <Text style={styles.badge}>{section.badge}</Text>
          <View style={styles.steps}>
            {section.steps.map((step, index) => (
              <View key={step} style={styles.stepRow}>
                <Text style={styles.stepNumber}>{String(index + 1)}</Text>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
          {'note' in section ? <MutedText>{section.note}</MutedText> : null}
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroCard: {
    gap: 8,
    padding: 16,
  },
  sectionCard: {
    gap: 12,
    padding: 16,
  },
  stack: {
    gap: 14,
  },
  stepNumber: {
    backgroundColor: C.navy,
    borderRadius: 10,
    color: C.surface,
    fontSize: 12,
    fontWeight: '900',
    minWidth: 20,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    textAlign: 'center',
  },
  stepRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  steps: {
    gap: 10,
  },
  stepText: {
    color: C.textPrimary,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
});
