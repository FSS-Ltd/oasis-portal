DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'storage'
      AND table_name = 'buckets'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'library-book-covers',
      'library-book-covers',
      true,
      5242880,
      ARRAY['image/jpeg', 'image/png', 'image/webp']
    )
    ON CONFLICT (id) DO UPDATE
      SET public = EXCLUDED.public,
          file_size_limit = EXCLUDED.file_size_limit,
          allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;
END $$;
