-- 0001_dresses_quotes.sql
-- Dress catalogue + quote requests for Sri Krishna Designers.
--
-- Safe to run repeatedly (supabase db push, or paste into the SQL editor):
-- every statement is guarded with IF NOT EXISTS / OR REPLACE /
-- DROP ... IF EXISTS, and bucket inserts use ON CONFLICT DO NOTHING.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.dresses (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  category    text not null
              constraint dresses_category_check check (category in (
                'designer-blouse-stitching',
                'bridal-wear-lehenga',
                'salwar-kurti-stitching'
              )),
  description text,
  tags        text[] not null default '{}',
  -- [{ "path": "...", "thumb": "...", "w": 1200, "h": 1600 }, ...]; first item is the cover.
  photos      jsonb not null default '[]'
              constraint dresses_photos_is_array check (jsonb_typeof(photos) = 'array'),
  published   boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.quote_requests (
  id            uuid primary key default gen_random_uuid(),
  dress_id      uuid null references public.dresses (id) on delete set null,
  dress_name    text not null,
  name          text not null,
  phone         text not null,
  occasion_date date,
  contact_time  text
                constraint quote_requests_contact_time_check
                check (contact_time in ('morning', 'afternoon', 'evening', 'any')),
  message       text,
  photo_path    text,  -- object key inside the private bucket "quote-refs"
  status        text not null default 'new'
                constraint quote_requests_status_check
                check (status in ('new', 'contacted', 'done')),
  page          text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace trigger dresses_set_updated_at
  before update on public.dresses
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists dresses_published_category_sort_idx
  on public.dresses (published, category, sort);

create index if not exists dresses_created_at_idx
  on public.dresses (created_at);

create index if not exists dresses_tags_gin_idx
  on public.dresses using gin (tags);

create index if not exists quote_requests_status_created_at_idx
  on public.quote_requests (status, created_at);

create index if not exists quote_requests_dress_id_idx
  on public.quote_requests (dress_id);

-- ---------------------------------------------------------------------------
-- Table privileges (defence in depth; RLS below is the real gate)
-- ---------------------------------------------------------------------------

revoke all on public.dresses from anon;
grant select on public.dresses to anon;
grant select, insert, update, delete on public.dresses to authenticated;
grant all on public.dresses to service_role;

-- Leads are never readable or writable by anon. The server inserts with the
-- service-role key; the signed-in owner can only read / update / delete.
revoke all on public.quote_requests from anon;
revoke all on public.quote_requests from authenticated;
grant select, update, delete on public.quote_requests to authenticated;
grant all on public.quote_requests to service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.dresses enable row level security;
alter table public.quote_requests enable row level security;

-- dresses: everyone may read published rows; the signed-in owner may do anything.
drop policy if exists "dresses: public read published" on public.dresses;
create policy "dresses: public read published"
  on public.dresses
  for select
  to anon, authenticated
  using (published = true);

drop policy if exists "dresses: authenticated all" on public.dresses;
create policy "dresses: authenticated all"
  on public.dresses
  for all
  to authenticated
  using (true)
  with check (true);

-- quote_requests: no anon policies and no insert policy (service role bypasses RLS).
drop policy if exists "quote_requests: authenticated select" on public.quote_requests;
create policy "quote_requests: authenticated select"
  on public.quote_requests
  for select
  to authenticated
  using (true);

drop policy if exists "quote_requests: authenticated update" on public.quote_requests;
create policy "quote_requests: authenticated update"
  on public.quote_requests
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "quote_requests: authenticated delete" on public.quote_requests;
create policy "quote_requests: authenticated delete"
  on public.quote_requests
  for delete
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Storage buckets
--   dresses:    dresses/<dress-id>/<n>.webp, dresses/<dress-id>/<n>-thumb.webp
--   quote-refs: quote-refs/<yyyy-mm>/<uuid>.<ext>
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dresses', 'dresses', true,
  8 * 1024 * 1024,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quote-refs', 'quote-refs', false,
  5 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Storage policies (storage.objects already has RLS enabled by Supabase)
-- ---------------------------------------------------------------------------

drop policy if exists "dresses bucket: public read" on storage.objects;
create policy "dresses bucket: public read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'dresses');

drop policy if exists "dresses bucket: authenticated insert" on storage.objects;
create policy "dresses bucket: authenticated insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'dresses');

drop policy if exists "dresses bucket: authenticated update" on storage.objects;
create policy "dresses bucket: authenticated update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'dresses')
  with check (bucket_id = 'dresses');

drop policy if exists "dresses bucket: authenticated delete" on storage.objects;
create policy "dresses bucket: authenticated delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'dresses');

-- quote-refs is private: the owner may read (needed to create signed URLs).
-- Uploads happen server-side with the service-role key, which bypasses RLS.
drop policy if exists "quote-refs bucket: authenticated select" on storage.objects;
create policy "quote-refs bucket: authenticated select"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'quote-refs');
