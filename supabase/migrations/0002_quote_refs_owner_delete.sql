-- 0002_quote_refs_owner_delete.sql
-- The admin quote inbox (/admin/quotes/) deletes a request's reference photo
-- before deleting the row. 0001 only let the owner read quote-refs, so the
-- storage API silently removed nothing. Allow authenticated delete as well.

drop policy if exists "quote-refs bucket: authenticated delete" on storage.objects;
create policy "quote-refs bucket: authenticated delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'quote-refs');
