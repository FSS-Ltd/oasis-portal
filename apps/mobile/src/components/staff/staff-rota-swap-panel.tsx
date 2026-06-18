import { StyleSheet, Text, View } from 'react-native';
import { Badge, Card, ErrorText, InlineSpinner, MutedText, SmokeButton } from '../smoke/smoke-ui';
import { C } from '../smoke/mobile-theme';
import {
  SelectableList,
  selectedShiftLabel,
  type RotaShift,
  type SwapCandidate,
  type SwapRequest,
} from './staff-rota-common';

export function SwapPanel({
  candidates,
  candidatesError,
  candidatesLoading,
  fromShiftId,
  onChangeFrom,
  onChangeTo,
  onSubmit,
  saving,
  swaps,
  swapsError,
  swapsLoading,
  toShiftId,
  weekShifts,
}: {
  candidates: readonly SwapCandidate[];
  candidatesError: string | undefined;
  candidatesLoading: boolean;
  fromShiftId: string;
  onChangeFrom: (id: string) => void;
  onChangeTo: (id: string) => void;
  onSubmit: () => void;
  saving: boolean;
  swaps: readonly SwapRequest[];
  swapsError: string | undefined;
  swapsLoading: boolean;
  toShiftId: string;
  weekShifts: readonly RotaShift[];
}) {
  const selectedFrom = weekShifts.find((shift) => shift.id === fromShiftId) ?? null;
  const selectedTo = candidates.find((shift) => shift.id === toShiftId) ?? null;
  return (
    <>
      <Card style={styles.compactCard}>
        <Text style={styles.cardTitle}>Request shift swap</Text>
        <MutedText>
          Pick one of your shifts and one available staff shift for Head review.
        </MutedText>
        <Text style={styles.fieldTitle}>Your shift</Text>
        <SelectableList
          emptyLabel="No shifts available this week."
          items={weekShifts}
          renderLabel={selectedShiftLabel}
          selectedId={fromShiftId}
          onSelect={onChangeFrom}
        />
        <Text style={styles.fieldTitle}>Requested shift</Text>
        {candidatesLoading ? <InlineSpinner label="Loading swap candidates" /> : null}
        {candidatesError ? <ErrorText>{candidatesError}</ErrorText> : null}
        <SelectableList
          emptyLabel="No other staff shifts are available this week."
          items={candidates}
          renderLabel={selectedShiftLabel}
          selectedId={toShiftId}
          onSelect={onChangeTo}
        />
        <View style={styles.selectionSummary}>
          <MutedText>Your shift: {selectedShiftLabel(selectedFrom)}</MutedText>
          <MutedText>Requested: {selectedShiftLabel(selectedTo)}</MutedText>
        </View>
        <SmokeButton
          disabled={!fromShiftId || !toShiftId || saving}
          label={saving ? 'Sending...' : 'Send swap request'}
          onPress={onSubmit}
          variant="navy"
        />
      </Card>

      <Card style={styles.compactCard}>
        <View style={styles.cardHeader}>
          <View style={styles.rowBody}>
            <Text style={styles.cardTitle}>Swap status</Text>
            <MutedText>Requests stay pending until Head review.</MutedText>
          </View>
          <Badge variant={swaps.length > 0 ? 'warning' : 'neutral'}>{String(swaps.length)}</Badge>
        </View>
        {swapsLoading ? <InlineSpinner label="Loading swap requests" /> : null}
        {swapsError ? <ErrorText>{swapsError}</ErrorText> : null}
        {!swapsLoading && swaps.length === 0 ? (
          <MutedText>No swap requests found.</MutedText>
        ) : null}
        {swaps.map((swap) => (
          <SwapRequestRow key={swap.id} swap={swap} />
        ))}
      </Card>
    </>
  );
}

function SwapRequestRow({ swap }: { swap: SwapRequest }) {
  return (
    <View style={styles.swapRow}>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{selectedShiftLabel(swap.fromShift)}</Text>
        <MutedText>Requested: {selectedShiftLabel(swap.toShift)}</MutedText>
      </View>
      <View style={styles.swapBadges}>
        <Badge variant={swap.direction === 'Incoming' ? 'blue' : 'neutral'}>{swap.direction}</Badge>
        <Badge variant={swap.status === 'Pending' ? 'warning' : 'neutral'}>{swap.status}</Badge>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '900',
  },
  compactCard: {
    gap: 12,
    padding: 16,
  },
  fieldTitle: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  rowBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowTitle: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  selectionSummary: {
    backgroundColor: C.bg,
    borderRadius: 10,
    gap: 4,
    padding: 10,
  },
  swapBadges: {
    alignItems: 'flex-end',
    gap: 5,
  },
  swapRow: {
    alignItems: 'flex-start',
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
  },
});
