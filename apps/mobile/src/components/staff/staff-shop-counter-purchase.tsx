import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, Card, ErrorText, InlineSpinner, MutedText } from '../core/mobile-ui';
import {
  formatMerits,
  saleTotalMerits,
  validateCounterSale,
  type CounterSaleForm,
  type ShopCounterItem,
  type ShopCounterPurchaser,
} from './staff-shop-counter-utils';

export function StaffShopCounterPurchase({
  form,
  items,
  loading,
  onChangeForm,
  onSubmit,
  pending,
  purchasers,
  quantity,
  selectedItem,
  selectedPurchaser,
}: {
  form: CounterSaleForm;
  items: readonly ShopCounterItem[];
  loading: boolean;
  onChangeForm: (form: CounterSaleForm) => void;
  onSubmit: () => void;
  pending: boolean;
  purchasers: readonly ShopCounterPurchaser[];
  quantity: number | null;
  selectedItem: ShopCounterItem | null;
  selectedPurchaser: ShopCounterPurchaser | null;
}) {
  const validation = validateCounterSale({
    item: selectedItem,
    purchaser: selectedPurchaser,
    quantity,
  });
  const total = saleTotalMerits(selectedItem, quantity);
  const disabled = pending || validation !== null;

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.cardTitle}>Counter sale</Text>
          <MutedText>Record an in-person shop purchase for an active student.</MutedText>
        </View>
        <Badge variant="blue">{formatMerits(total)}</Badge>
      </View>

      {loading ? <InlineSpinner label="Loading counter sale data" /> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Student</Text>
        <View style={styles.optionList}>
          {purchasers.slice(0, 8).map((purchaser) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: form.studentId === purchaser.id }}
              key={purchaser.id}
              onPress={() => {
                onChangeForm({ ...form, studentId: purchaser.id });
              }}
              style={[
                styles.optionRow,
                form.studentId === purchaser.id ? styles.optionRowActive : null,
              ]}
            >
              <View style={styles.optionBody}>
                <Text style={styles.optionTitle}>{purchaser.fullName}</Text>
                <MutedText>{purchaser.yearGroup}</MutedText>
              </View>
              <Badge variant="neutral">{formatMerits(purchaser.spendBalance)}</Badge>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Item</Text>
        <View style={styles.optionList}>
          {items.slice(0, 8).map((item) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: form.itemId === item.id }}
              key={item.id}
              onPress={() => {
                onChangeForm({ ...form, itemId: item.id });
              }}
              style={[styles.itemRow, form.itemId === item.id ? styles.optionRowActive : null]}
            >
              <View
                style={[
                  styles.itemStripe,
                  { backgroundColor: item.categoryInk || item.categoryTint || C.blue },
                ]}
              />
              <View style={styles.optionBody}>
                <Text style={styles.optionTitle}>{item.name}</Text>
                <MutedText>
                  {item.categoryLabel} · {formatMerits(item.priceIncVat)}
                </MutedText>
              </View>
              <Badge variant={item.availableStockCount > 0 ? 'neutral' : 'danger'}>
                {String(item.availableStockCount)} stock
              </Badge>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.quantityField}>
        <Text style={styles.sectionTitle}>Quantity</Text>
        <TextInput
          accessibilityLabel="Counter sale quantity"
          keyboardType="numeric"
          onChangeText={(quantityText) => {
            onChangeForm({ ...form, quantity: quantityText });
          }}
          placeholder="1"
          placeholderTextColor={C.textMuted}
          style={styles.input}
          value={form.quantity}
        />
      </View>

      {validation ? (
        <ErrorText>
          {validation.message}
        </ErrorText>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onSubmit}
        style={[styles.submitButton, disabled ? styles.disabledButton : null]}
      >
        <Text style={styles.submitButtonText}>
          {pending ? 'Recording purchase' : 'Record purchase'}
        </Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.45,
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
  input: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    color: C.navy,
    fontSize: 15,
    fontWeight: '800',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  itemRow: {
    alignItems: 'stretch',
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    overflow: 'hidden',
    paddingRight: 10,
  },
  itemStripe: {
    width: 8,
  },
  optionBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
    paddingVertical: 10,
  },
  optionList: {
    gap: 8,
  },
  optionRow: {
    alignItems: 'center',
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
  },
  optionRowActive: {
    backgroundColor: C.blueLight,
    borderColor: C.blue,
  },
  optionTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 17,
  },
  quantityField: {
    gap: 7,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: C.navy,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 44,
  },
  submitButtonText: {
    color: C.surface,
    fontSize: 13,
    fontWeight: '900',
  },
});
