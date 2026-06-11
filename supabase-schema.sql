-- H.KONEKT - Schema Supabase
-- A executer dans SQL Editor apres creation du projet Supabase.

create extension if not exists "pgcrypto";

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  email text not null unique,
  phone text,
  city text,
  user_type text not null check (user_type in ('particulier', 'professionnel', 'organisateur')),
  organization_name text,
  website text,
  category text,
  message text,
  source text default 'landing',
  consent_news boolean not null default false,
  status text not null default 'nouveau' check (status in ('nouveau', 'contacte', 'qualifie', 'valide', 'refuse')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics (
  id integer primary key default 1,
  page_views integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint analytics_singleton check (id = 1)
);

create table if not exists public.site_config (
  id integer primary key default 1,
  hero_image_url text,
  updated_at timestamptz not null default now(),
  constraint site_config_singleton check (id = 1)
);

insert into public.analytics (id, page_views)
values (1, 0)
on conflict (id) do nothing;

insert into public.site_config (id, hero_image_url)
values (1, null)
on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at
before update on public.leads
for each row
execute function public.set_updated_at();

drop trigger if exists set_analytics_updated_at on public.analytics;
create trigger set_analytics_updated_at
before update on public.analytics
for each row
execute function public.set_updated_at();

drop trigger if exists set_site_config_updated_at on public.site_config;
create trigger set_site_config_updated_at
before update on public.site_config
for each row
execute function public.set_updated_at();

create or replace function public.increment_page_views()
returns void
language sql
security definer
set search_path = public
as $$
  update public.analytics
  set page_views = page_views + 1
  where id = 1;
$$;

alter table public.leads enable row level security;
alter table public.analytics enable row level security;
alter table public.site_config enable row level security;

drop policy if exists "Public can insert leads" on public.leads;
create policy "Public can insert leads"
on public.leads
for insert
to anon
with check (
  email is not null
  and user_type in ('particulier', 'professionnel', 'organisateur')
  and consent_news = true
);

drop policy if exists "Authenticated can read leads" on public.leads;
create policy "Authenticated can read leads"
on public.leads
for select
to authenticated
using (true);

drop policy if exists "Authenticated can update leads" on public.leads;
create policy "Authenticated can update leads"
on public.leads
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated can read analytics" on public.analytics;
create policy "Authenticated can read analytics"
on public.analytics
for select
to authenticated
using (true);

drop policy if exists "Public can read site config" on public.site_config;
create policy "Public can read site config"
on public.site_config
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated can update site config" on public.site_config;
create policy "Authenticated can update site config"
on public.site_config
for update
to authenticated
using (true)
with check (true);

-- Storage bucket public pour les images du site.
insert into storage.buckets (id, name, public)
values ('site_images', 'site_images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can read site images" on storage.objects;
create policy "Public can read site images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'site_images');

drop policy if exists "Authenticated can upload site images" on storage.objects;
create policy "Authenticated can upload site images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'site_images');

drop policy if exists "Authenticated can update site images" on storage.objects;
create policy "Authenticated can update site images"
on storage.objects
for update
to authenticated
using (bucket_id = 'site_images')
with check (bucket_id = 'site_images');
