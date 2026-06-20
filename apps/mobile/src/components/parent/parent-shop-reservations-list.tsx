import { StyleSheet, Text, View } from 'react-native';
import { C } from '../smoke/mobile-theme';
import { Badge, Card, InlineSpinner, MutedText, SectionTitle } from '../smoke/smoke-ui';
import {
  formatParentShopDate,
  formatParentShopMerits,
  parentShopReservationStatusVariant,
  parentShopStatusLabels,
  type ParentShopReservation,
} from './parent-shop-reservations-utils';

export function ParentShopReservationsList({
  loading,
  reservations,
}: {
  loading: boolean;
  reservations: readonly ParentShopReservation[];
}) {
  return (
    <Card style={styles.compactCard}>
      <View style={styles.header}>
        <View>
          <SectionTitle>Ready reservations</SectionTitle>
          <MutedText>Pickup status for this child.</MutedText>
        </View>
        <Badge variant={reservations.length > 0 ? 'warning' : 'neutral'}>
          {String(reservations.length)}
        </Badge>
      </View>
      <View style={styles.statusRow}>
        {parentShopStatusLabels.map((status) => (
          <Badge key={status} variant={parentShopReservationStatusVariant(status)}>
            {status}
          </Badge>
        ))}
      </View>
      {loading ? <InlineSpinner label="Loading reservations" /> : null}
      {reservations.length === 0 && !loading ? (
        <MutedText>No current reservations for this child.</MutedText>
      ) : null}
      {reservations.map((reservation) => (
        <View key={reservation.id} style={styles.reservationCard}>
          <View style={styles.reservationHeader}>
            <View style={styles.reservationBody}>
              <Text style={styles.reservationTitle}>
                {formatParentShopMerits(reservation.totalPriceMerits)} merits
              </Text>
              <MutedText>Reserved {formatParentShopDate(reservation.createdAt)}</MutedText>
            </View>
            <Badge variant={parentShopReservationStatusVariant(reservation.status)}>
              {reservation.status}
            </Badge>
          </View>
          {reservation.lines.map((line) => (
            <Text key={line.id} style={styles.reservationLine}>
              {line.itemName} x {String(line.unitsReserved)}
            </Text>
          ))}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  compactCard: {
    gap: 10,
    padding: 16,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  reservationBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  reservationCard: {
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  reservationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  reservationLine: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  reservationTitle: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
