-- Lister verification by government-ID photo. Private bucket (not public) —
-- only the owner (or the service role) can read their document. Path is
-- <uid>/<file>, so the owner-only policies key off the first folder segment.

insert into storage.buckets (id, name, public)
values ('id-documents', 'id-documents', false)
on conflict (id) do nothing;

drop policy if exists "owner inserts id docs" on storage.objects;
create policy "owner inserts id docs" on storage.objects for insert to authenticated
  with check (bucket_id = 'id-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "owner reads id docs" on storage.objects;
create policy "owner reads id docs" on storage.objects for select to authenticated
  using (bucket_id = 'id-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Reference to the uploaded document (for audit / future manual review).
alter table profiles add column if not exists id_document_path text;
