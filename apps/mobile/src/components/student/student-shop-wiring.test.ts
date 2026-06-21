import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('student shop mobile wiring', () => {
  it('adds a focused student shop screen without duplicating shop catalogue components', () => {
    expect(
      existsSync(path.join(mobileRoot, 'src/components/student/student-shop-screen.tsx')),
    ).toBe(true);

    const shop = readMobile('src/components/student/student-shop-screen.tsx');

    for (const sharedComponent of [
      'ParentShopCategoryFilters',
      'ParentShopItemCard',
      'ParentShopItemDetailCard',
      'ParentShopCart',
      'ParentShopReservationsList',
      'parentShopCartLinesFor',
    ]) {
      expect(shop).toContain(sharedComponent);
    }
  });

  it('exposes Shop through the student mobile More navigation and home card', () => {
    const portal = readMobile('src/components/student/student-portal-screen.tsx');
    const home = readMobile('src/components/student/student-home-screen.tsx');

    expect(portal).toMatch(/\|\s*'shop'/);
    expect(portal).toMatch(/id: 'shop'/);
    expect(portal).toMatch(/label: 'Shop'/);
    expect(portal).toMatch(/icon: 'shop'/);
    expect(portal).toMatch(/activeTab === 'shop'/);
    expect(portal).toMatch(/<StudentShopScreen/);
    expect(home).toContain('onOpenShop');
    expect(home).toContain('Reward shop');
  });

  it('uses student-safe shop APIs and keeps manager-only procedures out of the mobile student shop', () => {
    const source = [
      'src/components/student/student-portal-screen.tsx',
      'src/components/student/student-shop-screen.tsx',
    ]
      .map(readMobile)
      .join('\n');

    for (const required of [
      /api\.shop\.listItems\.useQuery/,
      /api\.shop\.studentHistory\.useQuery/,
      /api\.shop\.reserve\.useMutation/,
      /utils\.shop\.listItems\.invalidate/,
      /utils\.shop\.studentHistory\.invalidate/,
      /utils\.student\.wallet\.invalidate/,
    ]) {
      expect(source).toMatch(required);
    }

    for (const forbidden of [
      /api\.shop\.(createItem|updateItem|deleteItem|purchase|collectReservation|cancelReservation)/,
      /api\.shop\.listPurchasers/,
      /api\.shop\.upload/,
      /utils\.shop\.listReservations\.invalidate/,
      /childLog\.parentDashboard/,
      /linkedChildSignupContext/,
    ]) {
      expect(source).not.toMatch(forbidden);
    }
  });

  it('keeps shop loading, empty, balance, cart, and reservation states visible', () => {
    const source = [
      'src/components/student/student-shop-screen.tsx',
      'src/components/parent/parent-shop-reservations-list.tsx',
      'src/components/parent/parent-shop-cart.tsx',
      'src/components/parent/parent-shop-catalog.tsx',
    ]
      .map(readMobile)
      .join('\n');

    for (const text of [
      'Merit Shop',
      'Reserve rewards',
      'Spend balance',
      'Shop holds',
      'Ready reservations',
      'No current reservations.',
      'Loading shop',
      'No shop items',
      'Add an item first.',
      'Not enough Spend merits.',
      'Reserve at Counter',
      'Reservation placed.',
    ]) {
      expect(source).toContain(text);
    }
  });
});
