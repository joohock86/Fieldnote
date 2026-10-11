-- Allow PDF files alongside existing photos. Run before deploying this update.
-- The bucket remains private and existing files and access policies are retained.
begin;
update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf']
where id = 'fieldnote-photos';
commit;
