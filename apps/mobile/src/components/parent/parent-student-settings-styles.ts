import { StyleSheet } from 'react-native';
import { C } from '../smoke/mobile-theme';

export const parentStudentSettingsStyles = StyleSheet.create({
  actionRow: {
    alignItems: 'flex-start',
  },
  cardTitle: {
    color: C.navy,
    fontSize: 18,
    fontWeight: '900',
  },
  childChip: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  childChipActive: {
    backgroundColor: C.crimson,
    borderColor: C.crimson,
  },
  childChipText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  childChipTextActive: {
    color: C.surface,
  },
  childHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  childHeaderText: {
    flex: 1,
    gap: 2,
  },
  childInitials: {
    alignItems: 'center',
    backgroundColor: C.blueLight,
    borderColor: C.blueMid,
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  childInitialsText: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '900',
  },
  childPhoto: {
    borderRadius: 24,
    height: 48,
    width: 48,
  },
  childPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  content: {
    gap: 14,
    padding: 16,
    paddingBottom: 36,
  },
  dayButton: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    minWidth: 40,
  },
  dayButtonActive: {
    backgroundColor: C.navy,
    borderColor: C.navy,
  },
  dayButtonText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  dayButtonTextActive: {
    color: C.surface,
  },
  disabled: {
    opacity: 0.55,
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  iconRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  iconText: {
    flex: 1,
    gap: 2,
  },
  intro: {
    gap: 5,
  },
  scroller: {
    backgroundColor: C.bg,
    flex: 1,
  },
  smallStrong: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '800',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusTile: {
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    gap: 8,
    minWidth: 132,
    padding: 12,
  },
  successCard: {
    backgroundColor: C.successBg,
    borderColor: C.successMid,
  },
  successText: {
    color: C.success,
    fontSize: 13,
    fontWeight: '800',
  },
  tileLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    color: C.navy,
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 28,
  },
  toggleKnob: {
    backgroundColor: C.surface,
    borderRadius: 9,
    height: 18,
    width: 18,
  },
  toggleKnobActive: {
    transform: [{ translateX: 18 }],
  },
  toggleRow: {
    alignItems: 'center',
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 12,
  },
  toggleText: {
    flex: 1,
    gap: 3,
  },
  toggleTrack: {
    backgroundColor: C.textMuted,
    borderRadius: 12,
    padding: 3,
    width: 42,
  },
  toggleTrackActive: {
    backgroundColor: C.crimson,
  },
  uploadCard: {
    backgroundColor: C.bg,
  },
  weekdayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
});
