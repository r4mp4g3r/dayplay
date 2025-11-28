-- Create storage bucket for local suggestions photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'local-suggestions',
  'local-suggestions',
  true,
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view photos
CREATE POLICY "Anyone can view local suggestion photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'local-suggestions');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload local suggestion photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'local-suggestions' AND
  auth.role() = 'authenticated'
);

-- Allow users to update their own photos
CREATE POLICY "Users can update their own local suggestion photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'local-suggestions' AND
  auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'local-suggestions' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own photos
CREATE POLICY "Users can delete their own local suggestion photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'local-suggestions' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

