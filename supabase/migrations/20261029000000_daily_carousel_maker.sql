-- Daily Carousel Maker — initial schema
--
-- Run this once in the Supabase SQL Editor (or with `supabase db push`).
-- Every table is protected by Row Level Security: a signed-in user can only
-- read and change rows they own. The anon role gets no access at all.

-- ---------------------------------------------------------------------------
-- Helpers
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

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.carousel_projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null default 'Untitled carousel' check (char_length(title) between 1 and 300),
  topic         text check (topic is null or char_length(topic) <= 500),
  caption       text not null default '' check (char_length(caption) <= 63206),
  scheduled_at  timestamptz,
  status        text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  archived_at   timestamptz,
  -- Small JPEG data URL of the cover, used only for calendar/list previews.
  -- Never used as an export source.
  thumbnail     text check (thumbnail is null or char_length(thumbnail) <= 400000),
  slide_count   integer not null default 0,
  -- Bumped on every save; used to reject stale saves (optimistic concurrency).
  revision      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint carousel_projects_scheduled_needs_date
    check (status <> 'scheduled' or scheduled_at is not null)
);

create table if not exists public.carousel_slides (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references public.carousel_projects (id) on delete cascade,
  slide_order           integer not null check (slide_order >= 0),
  slide_type            text not null check (slide_type in ('cover', 'card')),
  title                 text,
  subtitle              text,
  description           text,
  background_image_url  text,
  background_public_id  text,
  canvas_width          integer not null default 1254 check (canvas_width > 0),
  canvas_height         integer not null default 1254 check (canvas_height > 0),
  -- Full editable design (elements, positions, fonts, gradients, layer order).
  design_json           jsonb not null default '{}'::jsonb
                        check (octet_length(design_json::text) <= 2000000),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- The cover is always slide 0, and slide 0 is always the cover.
  constraint carousel_slides_cover_first check ((slide_type = 'cover') = (slide_order = 0)),
  -- Deferred so slides can be reordered inside one transaction.
  constraint carousel_slides_order_unique unique (project_id, slide_order) deferrable initially deferred
);

create table if not exists public.carousel_assets (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cloudinary_public_id  text not null unique,
  secure_url            text not null,
  original_filename     text,
  format                text,
  width                 integer,
  height                integer,
  bytes                 bigint,
  -- SHA-256 of the original file; prevents duplicate uploads of the same image.
  sha256                text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at            timestamptz not null default now(),
  constraint carousel_assets_user_sha_unique unique (user_id, sha256)
);

create table if not exists public.carousel_templates (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 120),
  slide_type   text not null default 'card' check (slide_type in ('cover', 'card')),
  design_json  jsonb not null check (octet_length(design_json::text) <= 2000000),
  thumbnail    text check (thumbnail is null or char_length(thumbnail) <= 400000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.carousel_settings (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  settings    jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists carousel_projects_user_scheduled_idx on public.carousel_projects (user_id, scheduled_at);
create index if not exists carousel_projects_user_updated_idx   on public.carousel_projects (user_id, updated_at desc);
create index if not exists carousel_projects_user_status_idx    on public.carousel_projects (user_id, status);
create index if not exists carousel_slides_project_idx          on public.carousel_slides (project_id);
create index if not exists carousel_assets_user_created_idx     on public.carousel_assets (user_id, created_at desc);
create index if not exists carousel_templates_user_idx          on public.carousel_templates (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists carousel_projects_updated_at on public.carousel_projects;
create trigger carousel_projects_updated_at
  before update on public.carousel_projects
  for each row execute function public.set_updated_at();

drop trigger if exists carousel_slides_updated_at on public.carousel_slides;
create trigger carousel_slides_updated_at
  before update on public.carousel_slides
  for each row execute function public.set_updated_at();

drop trigger if exists carousel_templates_updated_at on public.carousel_templates;
create trigger carousel_templates_updated_at
  before update on public.carousel_templates
  for each row execute function public.set_updated_at();

drop trigger if exists carousel_settings_updated_at on public.carousel_settings;
create trigger carousel_settings_updated_at
  before update on public.carousel_settings
  for each row execute function public.set_updated_at();

-- Keep carousel_projects.slide_count in sync with the slides table.
create or replace function public.sync_carousel_slide_count()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.carousel_projects p
     set slide_count = (select count(*) from public.carousel_slides s where s.project_id = p.id)
   where p.id = coalesce(new.project_id, old.project_id);
  return null;
end;
$$;

drop trigger if exists carousel_slides_count on public.carousel_slides;
create trigger carousel_slides_count
  after insert or delete on public.carousel_slides
  for each row execute function public.sync_carousel_slide_count();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.carousel_projects  enable row level security;
alter table public.carousel_slides    enable row level security;
alter table public.carousel_assets    enable row level security;
alter table public.carousel_templates enable row level security;
alter table public.carousel_settings  enable row level security;

-- Nothing in this app is public.
revoke all on public.carousel_projects, public.carousel_slides, public.carousel_assets,
              public.carousel_templates, public.carousel_settings from anon;
grant select, insert, update, delete on public.carousel_projects, public.carousel_slides,
              public.carousel_assets, public.carousel_templates, public.carousel_settings to authenticated;

-- Projects
drop policy if exists "Own projects: select" on public.carousel_projects;
create policy "Own projects: select" on public.carousel_projects
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Own projects: insert" on public.carousel_projects;
create policy "Own projects: insert" on public.carousel_projects
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Own projects: update" on public.carousel_projects;
create policy "Own projects: update" on public.carousel_projects
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Own projects: delete" on public.carousel_projects;
create policy "Own projects: delete" on public.carousel_projects
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Slides (ownership comes from the parent project)
drop policy if exists "Own slides: select" on public.carousel_slides;
create policy "Own slides: select" on public.carousel_slides
  for select to authenticated using (exists (
    select 1 from public.carousel_projects p where p.id = project_id and p.user_id = (select auth.uid())));
drop policy if exists "Own slides: insert" on public.carousel_slides;
create policy "Own slides: insert" on public.carousel_slides
  for insert to authenticated with check (exists (
    select 1 from public.carousel_projects p where p.id = project_id and p.user_id = (select auth.uid())));
drop policy if exists "Own slides: update" on public.carousel_slides;
create policy "Own slides: update" on public.carousel_slides
  for update to authenticated
  using (exists (select 1 from public.carousel_projects p where p.id = project_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.carousel_projects p where p.id = project_id and p.user_id = (select auth.uid())));
drop policy if exists "Own slides: delete" on public.carousel_slides;
create policy "Own slides: delete" on public.carousel_slides
  for delete to authenticated using (exists (
    select 1 from public.carousel_projects p where p.id = project_id and p.user_id = (select auth.uid())));

-- Assets
drop policy if exists "Own assets: select" on public.carousel_assets;
create policy "Own assets: select" on public.carousel_assets
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Own assets: insert" on public.carousel_assets;
create policy "Own assets: insert" on public.carousel_assets
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Own assets: delete" on public.carousel_assets;
create policy "Own assets: delete" on public.carousel_assets
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Templates
drop policy if exists "Own templates: select" on public.carousel_templates;
create policy "Own templates: select" on public.carousel_templates
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Own templates: insert" on public.carousel_templates;
create policy "Own templates: insert" on public.carousel_templates
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Own templates: update" on public.carousel_templates;
create policy "Own templates: update" on public.carousel_templates
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Own templates: delete" on public.carousel_templates;
create policy "Own templates: delete" on public.carousel_templates
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Settings
drop policy if exists "Own settings: select" on public.carousel_settings;
create policy "Own settings: select" on public.carousel_settings
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Own settings: insert" on public.carousel_settings;
create policy "Own settings: insert" on public.carousel_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Own settings: update" on public.carousel_settings;
create policy "Own settings: update" on public.carousel_settings
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- RPC functions (SECURITY INVOKER: they run with the caller's RLS)
-- ---------------------------------------------------------------------------

-- Creates a project and its cover slide in one transaction.
create or replace function public.create_carousel_project(
  p_title         text,
  p_topic         text,
  p_caption       text,
  p_scheduled_at  timestamptz,
  p_status        text,
  p_cover_design  jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.carousel_projects (title, topic, caption, scheduled_at, status)
  values (coalesce(nullif(trim(p_title), ''), 'Untitled carousel'), nullif(trim(p_topic), ''),
          coalesce(p_caption, ''), p_scheduled_at, coalesce(p_status, 'draft'))
  returning id into v_id;

  insert into public.carousel_slides (project_id, slide_order, slide_type, design_json)
  values (v_id, 0, 'cover', coalesce(p_cover_design, '{}'::jsonb));

  return v_id;
end;
$$;

-- Saves project metadata and the complete, ordered slide list atomically.
-- Rejects the save (HTTP 409) when p_expected_revision is stale, so an old
-- request can never overwrite newer edits.
create or replace function public.save_carousel_project(
  p_project_id         uuid,
  p_expected_revision  integer,
  p_project            jsonb,
  p_slides             jsonb
)
returns table (revision integer, updated_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_revision   integer;
  v_updated_at timestamptz;
  v_count      integer;
begin
  if jsonb_typeof(p_slides) is distinct from 'array' then
    raise sqlstate 'PT400' using message = 'slides must be an array';
  end if;
  v_count := jsonb_array_length(p_slides);
  if v_count < 1 or v_count > 100 then
    raise sqlstate 'PT400' using message = 'a carousel needs between 1 and 100 slides';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_slides) with ordinality as s(slide, pos)
     where (s.slide->>'slide_type') is distinct from (case when s.pos = 1 then 'cover' else 'card' end)
  ) then
    raise sqlstate 'PT400' using message = 'the first slide must be the cover and all others must be cards';
  end if;

  update public.carousel_projects p set
    title        = case when p_project ? 'title' then coalesce(nullif(trim(p_project->>'title'), ''), 'Untitled carousel') else p.title end,
    topic        = case when p_project ? 'topic' then nullif(trim(p_project->>'topic'), '') else p.topic end,
    caption      = case when p_project ? 'caption' then coalesce(p_project->>'caption', '') else p.caption end,
    scheduled_at = case when p_project ? 'scheduled_at' then (p_project->>'scheduled_at')::timestamptz else p.scheduled_at end,
    status       = case when p_project ? 'status' then p_project->>'status' else p.status end,
    thumbnail    = case when p_project ? 'thumbnail' then p_project->>'thumbnail' else p.thumbnail end,
    revision     = p.revision + 1
  where p.id = p_project_id and p.revision = p_expected_revision
  returning p.revision into v_revision;

  if v_revision is null then
    if exists (select 1 from public.carousel_projects p where p.id = p_project_id) then
      raise sqlstate 'PT409' using message = 'This carousel was changed somewhere else. Reload to get the latest version.';
    end if;
    raise sqlstate 'PT404' using message = 'Carousel not found';
  end if;

  delete from public.carousel_slides s
   where s.project_id = p_project_id
     and s.id not in (select (e->>'id')::uuid from jsonb_array_elements(p_slides) e);

  insert into public.carousel_slides as s (
    id, project_id, slide_order, slide_type, title, subtitle, description,
    background_image_url, background_public_id, canvas_width, canvas_height, design_json
  )
  select (e.slide->>'id')::uuid,
         p_project_id,
         (e.pos - 1)::integer,
         e.slide->>'slide_type',
         e.slide->>'title',
         e.slide->>'subtitle',
         e.slide->>'description',
         e.slide->>'background_image_url',
         e.slide->>'background_public_id',
         coalesce((e.slide->>'canvas_width')::integer, 1254),
         coalesce((e.slide->>'canvas_height')::integer, 1254),
         coalesce(e.slide->'design_json', '{}'::jsonb)
    from jsonb_array_elements(p_slides) with ordinality as e(slide, pos)
  on conflict (id) do update set
         slide_order          = excluded.slide_order,
         slide_type           = excluded.slide_type,
         title                = excluded.title,
         subtitle             = excluded.subtitle,
         description          = excluded.description,
         background_image_url = excluded.background_image_url,
         background_public_id = excluded.background_public_id,
         canvas_width         = excluded.canvas_width,
         canvas_height        = excluded.canvas_height,
         design_json          = excluded.design_json
   where s.project_id = p_project_id;

  select p.updated_at into v_updated_at from public.carousel_projects p where p.id = p_project_id;
  return query select v_revision, v_updated_at;
end;
$$;

-- Copies a project and all of its slides. The copy starts as a draft.
create or replace function public.duplicate_carousel_project(p_project_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_new_id uuid;
begin
  insert into public.carousel_projects (title, topic, caption, scheduled_at, status, thumbnail)
  select left(p.title || ' (copy)', 300), p.topic, p.caption, p.scheduled_at, 'draft', p.thumbnail
    from public.carousel_projects p
   where p.id = p_project_id
  returning id into v_new_id;

  if v_new_id is null then
    raise sqlstate 'PT404' using message = 'Carousel not found';
  end if;

  insert into public.carousel_slides (project_id, slide_order, slide_type, title, subtitle, description,
                                      background_image_url, background_public_id, canvas_width, canvas_height, design_json)
  select v_new_id, s.slide_order, s.slide_type, s.title, s.subtitle, s.description,
         s.background_image_url, s.background_public_id, s.canvas_width, s.canvas_height, s.design_json
    from public.carousel_slides s
   where s.project_id = p_project_id
   order by s.slide_order;

  return v_new_id;
end;
$$;

-- How many of the caller's slides reference each Cloudinary public ID.
-- Used to warn before an asset is deleted from the library.
create or replace function public.carousel_asset_usage(p_public_ids text[])
returns table (public_id text, slide_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select ids.public_id,
         (select count(*) from public.carousel_slides s
           where s.background_public_id = ids.public_id
              or strpos(s.design_json::text, '"' || ids.public_id || '"') > 0)
    from unnest(p_public_ids) as ids(public_id);
$$;

revoke all on function public.create_carousel_project(text, text, text, timestamptz, text, jsonb) from public, anon;
revoke all on function public.save_carousel_project(uuid, integer, jsonb, jsonb) from public, anon;
revoke all on function public.duplicate_carousel_project(uuid) from public, anon;
revoke all on function public.carousel_asset_usage(text[]) from public, anon;
grant execute on function public.create_carousel_project(text, text, text, timestamptz, text, jsonb) to authenticated;
grant execute on function public.save_carousel_project(uuid, integer, jsonb, jsonb) to authenticated;
grant execute on function public.duplicate_carousel_project(uuid) to authenticated;
grant execute on function public.carousel_asset_usage(text[]) to authenticated;
