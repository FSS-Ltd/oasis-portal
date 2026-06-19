import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { quantityValue } from './staff-shop-counter-utils';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('staff shop counter mobile wiring', () => {
  it('accepts only positive whole-number quantities', () => {
    expect(quantityValue('1')).toBe(1);
    expect(quantityValue(' 12 ')).toBe(12);
    expect(quantityValue('0')).toBeNull();
    expect(quantityValue('1.5')).toBeNull();
    expect(quantityValue('2abc')).toBeNull();
  });

  it('adds focused production staff shop counter components', () => {
    const staffFiles = [
      'staff-shop-counter-screen.tsx',
      'staff-shop-counter-pickup-queue.tsx',
      'staff-shop-counter-purchase.tsx',
      'staff-shop-counter-stock.tsx',
      'staff-shop-counter-utils.ts',
    ];

    for (const file of staffFiles) {
      expect(existsSync(path.join(mobileRoot, 'src/components/staff', file))).toBe(true);
    }
  });

  it('routes Staff Home shop pickups into a production counter screen', () => {
    const portal = readMobile('src/components/staff/staff-portal-screen.tsx');
    const home = readMobile('src/components/staff/staff-home-screen.tsx');
    const model = readMobile('src/components/staff/staff-home-model.ts');

    expect(portal).toMatch(/StaffShopCounterScreen/);
    expect(portal).toMatch(/'shop'/);
    expect(portal).toMatch(/setRoute\('shop'\)/);
    expect(home).toMatch(/onOpenShop/);
    expect(home).toMatch(/shop: onOpenShop/);
    expect(model).toMatch(/id: 'shop'/);
    expect(model).toMatch(/label: 'Shop pickups'/);
    expect(model).toMatch(/Collect shop reservations/);
  });

  it('uses counter sale and collection APIs without exposing item management', () => {
    const screen = readMobile('src/components/staff/staff-shop-counter-screen.tsx');
    const pickupQueue = readMobile('src/components/staff/staff-shop-counter-pickup-queue.tsx');
    const purchase = readMobile('src/components/staff/staff-shop-counter-purchase.tsx');
    const stock = readMobile('src/components/staff/staff-shop-counter-stock.tsx');

    expect(screen).toMatch(/api\.shop\.listReservations\.useQuery/);
    expect(screen).toMatch(/api\.shop\.collectReservation\.useMutation/);
    expect(screen).toMatch(/api\.shop\.listPurchasers\.useQuery/);
    expect(screen).toMatch(/api\.shop\.listItems\.useQuery/);
    expect(screen).toMatch(/api\.shop\.purchase\.useMutation/);
    expect(screen).toMatch(/utils\.shop\.listReservations\.invalidate/);
    expect(screen).toMatch(/utils\.shop\.listItems\.invalidate/);
    expect(screen).toMatch(/utils\.shop\.listPurchasers\.invalidate/);
    expect(screen).toMatch(/utils\.staffHome\.summary\.invalidate/);

    for (const source of [screen, pickupQueue, purchase, stock]) {
      expect(source).not.toMatch(/api\.shop\.createItem/);
      expect(source).not.toMatch(/api\.shop\.updateItem/);
      expect(source).not.toMatch(/api\.shop\.prepareItemPhotoUpload/);
      expect(source).not.toMatch(/api\.shop\.updateItemPhoto/);
      expect(source).not.toMatch(/api\.shop\.cancelReservation/);
    }
  });

  it('handles shopkeeper states with shop-specific copy', () => {
    const screen = readMobile('src/components/staff/staff-shop-counter-screen.tsx');
    const pickupQueue = readMobile('src/components/staff/staff-shop-counter-pickup-queue.tsx');
    const purchase = readMobile('src/components/staff/staff-shop-counter-purchase.tsx');
    const stock = readMobile('src/components/staff/staff-shop-counter-stock.tsx');
    const utils = readMobile('src/components/staff/staff-shop-counter-utils.ts');

    expect(screen).toMatch(/Merit Shop Counter/);
    expect(screen).toMatch(/Loading shop counter/);
    expect(screen).toMatch(/Reservation collected/);
    expect(screen).toMatch(/Purchase recorded/);
    expect(screen).toMatch(/Shop action could not be completed/);
    expect(pickupQueue).toMatch(/Ready pickups/);
    expect(pickupQueue).toMatch(/Collect pickup/);
    expect(purchase).toMatch(/Counter sale/);
    expect(utils).toMatch(/Insufficient stock/);
    expect(utils).toMatch(/Insufficient balance/);
    expect(stock).toMatch(/Counter stock/);

    expect(screen).not.toMatch(/Supervisor/);
    expect(screen).not.toMatch(/Club manager/);
    expect(screen).not.toMatch(/Club lead/);
  });
});
