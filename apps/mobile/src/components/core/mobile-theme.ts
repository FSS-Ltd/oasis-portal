import type { TextStyle } from 'react-native';

export const C = {
  navy: '#1B2B5E',
  navyMid: '#243570',
  navyLight: '#2D3F72',
  blue: '#5B90C5',
  blueLight: '#D4E5F5',
  blueMid: '#A8C8E8',
  crimson: '#7D1C2C',
  crimsonLight: '#FCE8EA',
  bg: '#EEF2F9',
  surface: '#FFFFFF',
  border: '#DDE3F0',
  borderLight: '#EEF2F9',
  textPrimary: '#1B2B5E',
  textSecondary: '#5A6A8A',
  textMuted: '#8899BB',
  success: '#166534',
  successBg: '#DCFCE7',
  successMid: '#86EFAC',
  warning: '#92400E',
  warningBg: '#FEF3C7',
  danger: '#991B1B',
  dangerBg: '#FEE2E2',
  dangerMid: '#FCA5A5',
  link: '#3D6EA5',
  // Premium layer: hairlines and tinted fills read as iOS grouped surfaces, not boxed borders.
  hairline: 'rgba(27,43,94,0.10)',
  fill: 'rgba(27,43,94,0.06)',
  fillPressed: 'rgba(27,43,94,0.12)',
  bubble: '#E6E9F1',
  glassTint: 'rgba(125,28,44,0.12)',
  scrim: 'rgba(10,18,42,0.34)',
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

// Mirrors the iOS text-style ramp so sizes match system apps and scale with Dynamic Type.
export const typeRamp = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.37 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: 0.35 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: 0.38 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.41 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.41 },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.24 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: -0.08 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0 },
} as const satisfies Record<string, TextStyle>;

// boxShadow strings (New Architecture) rather than the legacy shadow* props.
export const elevation = {
  card: '0 1px 2px rgba(27,43,94,0.05), 0 6px 18px rgba(27,43,94,0.06)',
  float: '0 10px 28px rgba(27,43,94,0.18), 0 2px 6px rgba(27,43,94,0.08)',
} as const;

// Space the floating tab bar occupies above the safe area, so scroll content can clear it.
export const FLOATING_NAV_CLEARANCE = 96;
