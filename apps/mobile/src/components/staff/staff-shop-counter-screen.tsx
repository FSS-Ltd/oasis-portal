import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../smoke/mobile-theme';
import { PortalMobileHeader } from '../smoke/portal-mobile-shell';
import { ErrorText, InlineSpinner } from '../smoke/smoke-ui';
import { TabButton } from './staff-rota-common';
import { StaffShopCounterPurchase } from './staff-shop-counter-purchase';
import { StaffShopCounterStock } from './staff-shop-counter-stock';
import { StaffShopPickupQueue } from './staff-shop-counter-pickup-queue';
import {
  activeShopItems,
  quantityValue,
  shopCounterTabs,
  validateCounterSale,
  type CounterSaleForm,
  type ShopCounterReservation,
  type ShopCounterTab,
} from './staff-shop-counter-utils';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type StatusMessage = { message: string; tone: 'error' | 'success' };

function friendlyError(error: unknown): string {
  return error instanceof Error ? error.message : 'Please try again.';
}

function initialSaleForm(): CounterSaleForm {
  return {
    itemId: '',
    quantity: '1',
    studentId: '',
  };
}

export function StaffShopCounterScreen({
  onBack,
  user,
}: {
  onBack: () => void;
  user: SessionUser | undefined;
}) {
  const { signOut } = useClerk();
  const utils = api.useUtils();
  const [activeTab, setActiveTab] = useState<ShopCounterTab>('pickups');
  const [saleForm, setSaleForm] = useState<CounterSaleForm>(() => initialSaleForm());
  const [collectingReservationId, setCollectingReservationId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);

  const reservations = api.shop.listReservations.useQuery({ status: 'Ready' }, { retry: false });
  const purchasers = api.shop.listPurchasers.useQuery(undefined, { retry: false });
  const items = api.shop.listItems.useQuery(undefined, { retry: false });
  const collectReservation = api.shop.collectReservation.useMutation();
  const purchase = api.shop.purchase.useMutation();

  const activeItems = useMemo(() => activeShopItems(items.data ?? []), [items.data]);
  const purchaserRows = useMemo(() => purchasers.data ?? [], [purchasers.data]);
  const selectedPurchaser =
    purchaserRows.find((purchaser) => purchaser.id === saleForm.studentId) ??
    purchaserRows[0] ??
    null;
  const selectedItem =
    activeItems.find((item) => item.id === saleForm.itemId) ?? activeItems[0] ?? null;
  const quantity = quantityValue(saleForm.quantity);

  useEffect(() => {
    setSaleForm((current) => ({
      ...current,
      itemId:
        current.itemId && activeItems.some((item) => item.id === current.itemId)
          ? current.itemId
          : (activeItems[0]?.id ?? ''),
      studentId:
        current.studentId && purchaserRows.some((purchaser) => purchaser.id === current.studentId)
          ? current.studentId
          : (purchaserRows[0]?.id ?? ''),
    }));
  }, [activeItems, purchaserRows]);

  async function refresh() {
    await Promise.all([reservations.refetch(), purchasers.refetch(), items.refetch()]);
  }

  async function invalidateShopCounter() {
    await Promise.all([
      utils.shop.listReservations.invalidate({ status: 'Ready' }),
      utils.shop.listItems.invalidate(),
      utils.shop.listPurchasers.invalidate(),
      utils.staffHome.summary.invalidate(),
    ]);
  }

  async function collectPickup(reservation: ShopCounterReservation) {
    setStatusMessage(null);
    setCollectingReservationId(reservation.id);
    try {
      await collectReservation.mutateAsync({ reservationId: reservation.id });
      setStatusMessage({
        message: `Reservation collected for ${reservation.studentName}.`,
        tone: 'success',
      });
      await invalidateShopCounter();
    } catch (error) {
      setStatusMessage({
        message: `Shop action could not be completed: ${friendlyError(error)}`,
        tone: 'error',
      });
    } finally {
      setCollectingReservationId(null);
    }
  }

  async function recordPurchase() {
    setStatusMessage(null);
    const validation = validateCounterSale({
      item: selectedItem,
      purchaser: selectedPurchaser,
      quantity,
    });
    if (validation || !selectedItem || !selectedPurchaser || quantity === null) {
      return;
    }
    try {
      const result = await purchase.mutateAsync({
        itemId: selectedItem.id,
        studentId: selectedPurchaser.id,
        unitsBought: quantity,
      });
      setStatusMessage({
        message: `Purchase recorded for ${selectedPurchaser.fullName}: ${String(
          result.totalPriceMerits,
        )} merits.`,
        tone: 'success',
      });
      setSaleForm((current) => ({ ...current, quantity: '1' }));
      await invalidateShopCounter();
    } catch (error) {
      setStatusMessage({
        message: `Shop action could not be completed: ${friendlyError(error)}`,
        tone: 'error',
      });
    }
  }

  const loading = reservations.isLoading || purchasers.isLoading || items.isLoading;
  const refreshing =
    reservations.isFetching ||
    purchasers.isFetching ||
    items.isFetching ||
    collectReservation.isPending ||
    purchase.isPending;

  return (
    <SafeAreaView style={styles.shell}>
      <PortalMobileHeader
        actionAccessibilityLabel="Sign out of staff account"
        actionLabel="Out"
        avatarLabel="S"
        eyebrow="Staff Portal"
        onActionPress={() => {
          void signOut();
        }}
        subtitle={`${user?.role ?? 'Staff'} · Shop counter`}
        title="Oasis Learning Centre"
        variant="dark"
      />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityLabel="Back to staff home"
            accessibilityRole="button"
            onPress={onBack}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <View style={styles.titleGroup}>
            <Text style={styles.eyebrow}>Merit Shop Counter</Text>
            <Text style={styles.title}>Pickups, counter sales and live stock</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          {shopCounterTabs.map((tab) => (
            <TabButton
              active={activeTab === tab.id}
              badge={tab.id === 'pickups' ? (reservations.data?.length ?? 0) : 0}
              key={tab.id}
              label={tab.label}
              onPress={() => {
                setActiveTab(tab.id);
                setStatusMessage(null);
              }}
            />
          ))}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              onRefresh={() => {
                void refresh();
              }}
              refreshing={refreshing}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {loading ? <InlineSpinner label="Loading shop counter" /> : null}
          {reservations.error ? <ErrorText>{reservations.error.message}</ErrorText> : null}
          {purchasers.error ? <ErrorText>{purchasers.error.message}</ErrorText> : null}
          {items.error ? <ErrorText>{items.error.message}</ErrorText> : null}

          {statusMessage ? (
            <View
              style={[
                styles.statusMessage,
                statusMessage.tone === 'error' ? styles.errorMessage : styles.successMessage,
              ]}
            >
              <Text
                style={[
                  styles.statusMessageText,
                  statusMessage.tone === 'error'
                    ? styles.errorMessageText
                    : styles.successMessageText,
                ]}
              >
                {statusMessage.message}
              </Text>
            </View>
          ) : null}

          {activeTab === 'pickups' ? (
            <StaffShopPickupQueue
              collectingReservationId={collectingReservationId}
              error={reservations.error?.message ?? null}
              loading={reservations.isLoading}
              onCollect={(reservation) => {
                void collectPickup(reservation);
              }}
              reservations={reservations.data ?? []}
            />
          ) : null}

          {activeTab === 'sale' ? (
            <StaffShopCounterPurchase
              form={saleForm}
              items={activeItems}
              loading={purchasers.isLoading || items.isLoading}
              onChangeForm={(nextForm) => {
                setSaleForm(nextForm);
                setStatusMessage(null);
              }}
              onSubmit={() => {
                void recordPurchase();
              }}
              pending={purchase.isPending}
              purchasers={purchaserRows}
              quantity={quantity}
              selectedItem={selectedItem}
              selectedPurchaser={selectedPurchaser}
            />
          ) : null}

          {activeTab === 'stock' ? (
            <StaffShopCounterStock
              error={items.error?.message ?? null}
              items={activeItems}
              loading={items.isLoading}
            />
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: C.blue,
    fontSize: 13,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    gap: 14,
    padding: 16,
  },
  errorMessage: {
    backgroundColor: C.dangerBg,
    borderColor: C.dangerMid,
  },
  errorMessageText: {
    color: C.danger,
  },
  eyebrow: {
    color: C.blue,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 36,
  },
  shell: {
    backgroundColor: C.bg,
    flex: 1,
  },
  statusMessage: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  statusMessageText: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  successMessage: {
    backgroundColor: C.successBg,
    borderColor: C.successMid,
  },
  successMessageText: {
    color: C.success,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  title: {
    color: C.navy,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
  },
  titleGroup: {
    flex: 1,
    gap: 2,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
});
