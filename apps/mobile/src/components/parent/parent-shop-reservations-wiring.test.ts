import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('parent shop reservations mobile wiring', () => {
  it('adds a focused production parent shop reservations screen', () => {
    expect(
      existsSync(
        path.join(mobileRoot, 'src/components/parent/parent-shop-reservations-screen.tsx'),
      ),
    ).toBe(true);
  });

  it('wires the parent portal shop route to the production screen', () => {
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');

    expect(portal).toMatch(/ParentShopReservationsScreen/);
    expect(portal).toMatch(/route === 'shop'/);
    expect(portal).toMatch(/api\.shop\.listItems\.useQuery/);
    expect(portal).toMatch(/api\.shop\.listReservations\.useQuery/);
    expect(portal).toMatch(/api\.meritLedger\.balances\.useQuery/);
    expect(portal).not.toMatch(/MobileShopReservationPanel/);
    expect(portal).not.toMatch(/student-smoke-shop/);
  });

  it('uses parent-safe reservation APIs and refreshes reservation state', () => {
    const screen = readMobile('src/components/parent/parent-shop-reservations-screen.tsx');
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');

    expect(screen).toMatch(/api\.shop\.reserve\.useMutation/);
    expect(screen).toMatch(/utils\.shop\.listItems\.invalidate/);
    expect(screen).toMatch(/utils\.shop\.listReservations\.invalidate/);
    expect(screen).toMatch(/utils\.meritLedger\.balances\.invalidate/);
    expect(screen).toMatch(/utils\.childLog\.parentDashboard\.invalidate/);

    for (const source of [screen, portal]) {
      expect(source).not.toMatch(/listPurchasers/);
      expect(source).not.toMatch(/collectReservation/);
      expect(source).not.toMatch(/purchase\.useMutation/);
      expect(source).not.toMatch(/createItem/);
      expect(source).not.toMatch(/updateItem/);
      expect(source).not.toMatch(/prepareItemPhotoUpload/);
      expect(source).not.toMatch(/updateItemPhoto/);
      expect(source).not.toMatch(/shopadmin/);
      expect(source).not.toMatch(/shopkeeper/);
    }
  });

  it('keeps shop browsing, cart, policy, balance, stock, and reservation states visible', () => {
    const screen = [
      'src/components/parent/parent-shop-reservations-screen.tsx',
      'src/components/parent/parent-shop-catalog.tsx',
      'src/components/parent/parent-shop-cart.tsx',
      'src/components/parent/parent-shop-reservations-list.tsx',
      'src/components/parent/parent-shop-reservations-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    for (const text of [
      'Merit Shop',
      'Spend balance',
      'Shop Holds',
      'My Cart',
      'Add an item to reserve it.',
      'Reserve at Counter',
      'Pickup at Shopkeeper Counter',
      'Ready reservations',
      'Ready',
      'Collected',
      'Cancelled',
      'Reservation placed',
      'Loading shop',
      'No shop items',
      'Out of Stock',
      'Low',
      'Not enough Spend merits.',
      'Merit Shop access is blocked by a parent or carer.',
      'Tithe due before Merit Shop opens.',
      'insufficient stock',
      'insufficient spend balance',
    ]) {
      expect(screen).toContain(text);
    }
  });
});
