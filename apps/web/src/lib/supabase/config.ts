interface SupabaseConfig {
  publishableKey: string;
  url: string;
}

interface SupabaseServiceRoleConfig extends SupabaseConfig {
  noticeAttachmentsBucket: string;
  serviceRoleKey: string;
  shopItemPhotosBucket: string;
}

export function getSupabaseConfig(): SupabaseConfig {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const publishableKey = process.env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];

  if (!url) {
    throw new Error('Missing required env var: NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!publishableKey) {
    throw new Error('Missing required env var: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }

  return { publishableKey, url };
}

export function getSupabaseServiceRoleConfig(): SupabaseServiceRoleConfig {
  const config = getSupabaseConfig();
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const noticeAttachmentsBucket =
    process.env['SUPABASE_NOTICE_ATTACHMENTS_BUCKET'] ?? 'notice-attachments';
  const shopItemPhotosBucket =
    process.env['SUPABASE_SHOP_ITEM_PHOTOS_BUCKET'] ?? 'shop-item-photos';

  if (!serviceRoleKey) {
    throw new Error('Missing required env var: SUPABASE_SERVICE_ROLE_KEY');
  }

  return { ...config, noticeAttachmentsBucket, serviceRoleKey, shopItemPhotosBucket };
}
