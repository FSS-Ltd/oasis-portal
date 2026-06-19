import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../smoke/mobile-theme';
import { Badge, Card, ErrorText, InlineSpinner, MutedText } from '../smoke/smoke-ui';
import {
  formatMerits,
  formatShopDate,
  type ShopCounterReservation,
} from './staff-shop-counter-utils';

export function StaffShopPickupQueue({
  collectingReservationId,
  error,
  loading,
  onCollect,
  reservations,
}: {
  collectingReservationId: string | null;
  error: string | null;
  loading: boolean;
  onCollect: (reservation: ShopCounterReservation) => void;
  reservations: readonly ShopCounterReservation[];
}) {
  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.cardTitle}>Ready pickups</Text>
          <MutedText>Collect reserved items when the student arrives.</MutedText>
        </View>
        <Badge variant={reservations.length > 0 ? 'warning' : 'neutral'}>
          {String(reservations.length)} ready
        </Badge>
      </View>

      {loading ? <InlineSpinner label="Loading ready pickups" /> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}

      {!loading && !error && reservations.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No ready pickups</Text>
          <Text style={styles.emptyText}>Ready reservations will appear here for collection.</Text>
        </View>
      ) : null}

      {reservations.map((reservation) => (
        <View key={reservation.id} style={styles.reservationCard}>
          <View style={styles.reservationTop}>
            <View style={styles.reservationBody}>
              <Text style={styles.studentName}>{reservation.studentName}</Text>
              <MutedText>
                {reservation.studentYearGroup} · Reserved {formatShopDate(reservation.createdAt)}
              </MutedText>
            </View>
            <Badge variant="crimson">{formatMerits(reservation.totalPriceMerits)}</Badge>
          </View>

          <View style={styles.lineList}>
            {reservation.lines.map((line) => (
              <View key={line.id} style={styles.lineRow}>
                <View
                  style={[
                    styles.categoryDot,
                    { backgroundColor: line.categoryInk || C.crimson },
                  ]}
                />
                <Text style={styles.lineText}>
                  {line.itemName} x {String(line.unitsReserved)}
                </Text>
              </View>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={collectingReservationId !== null}
            onPress={() => {
              onCollect(reservation);
            }}
            style={[
              styles.collectButton,
              collectingReservationId !== null ? styles.disabledButton : null,
            ]}
          >
            <Text style={styles.collectButtonText}>
              {collectingReservationId === reservation.id ? 'Collecting pickup' : 'Collect pickup'}
            </Text>
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '900',
  },
  categoryDot: {
    borderRadius: 4,
    height: 8,
    marginTop: 4,
    width: 8,
  },
  collectButton: {
    alignItems: 'center',
    backgroundColor: C.navy,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 42,
  },
  collectButtonText: {
    color: C.surface,
    fontSize: 13,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.45,
  },
  emptyState: {
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  emptyText: {
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyTitle: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '900',
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  lineList: {
    gap: 6,
  },
  lineRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  lineText: {
    color: C.textSecondary,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  reservationBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  reservationCard: {
    backgroundColor: C.warningBg,
    borderColor: '#F7D774',
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  reservationTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  studentName: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '900',
  },
});
