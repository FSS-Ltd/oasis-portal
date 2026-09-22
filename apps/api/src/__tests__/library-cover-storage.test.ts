import { afterEach, describe, expect, it } from 'vitest';
import { libraryCoverBucket } from '../services/library-cover-storage.js';

const originalShopBucket = process.env['SUPABASE_SHOP_ITEM_PHOTOS_BUCKET'];

afterEach(() => {
  if (originalShopBucket === undefined) delete process.env['SUPABASE_SHOP_ITEM_PHOTOS_BUCKET'];
  else process.env['SUPABASE_SHOP_ITEM_PHOTOS_BUCKET'] = originalShopBucket;
});

describe('libraryCoverBucket', () => {
  it('uses the configured merit-shop image bucket', () => {
    process.env['SUPABASE_SHOP_ITEM_PHOTOS_BUCKET'] = 'merit-shop-images';

    expect(libraryCoverBucket()).toBe('merit-shop-images');
  });

  it('uses the default merit-shop image bucket', () => {
    delete process.env['SUPABASE_SHOP_ITEM_PHOTOS_BUCKET'];

    expect(libraryCoverBucket()).toBe('shop-item-photos');
  });
});
