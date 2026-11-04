-- Daily Carousel Maker — team sharing and the Facebook pages posting checklist.
-- Run once in the Supabase SQL Editor after 20261030120000_posted_at.sql.
-- Safe to run again.

-- ---------------------------------------------------------------------------
-- Names: what teammates see in "Made by" and "Posted by"
-- ---------------------------------------------------------------------------

-- A person's name: their "Your name" from Settings, otherwise the start of their email.
create or replace function public.carousel_user_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email::text, '@', 1), '')
    from auth.users u
   where u.id = p_user
$$;

revoke all on function public.carousel_user_name(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Teams: people who share carousels. A team is named after its owner (team_id
-- is the owner's user id). Everyone in a team sees, edits and posts the team's
-- carousels; only a carousel's owner can delete it for good.
-- ---------------------------------------------------------------------------

create table if not exists public.carousel_team_members (
  team_id   uuid not null references auth.users (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  added_at  timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index if not exists carousel_team_members_user_idx on public.carousel_team_members (user_id);

alter table public.carousel_team_members enable row level security;
revoke all on public.carousel_team_members from anon;
grant select on public.carousel_team_members to authenticated;

-- True when the signed-in user may work on rows owned by p_owner: their own, or
-- a teammate's. SECURITY DEFINER so policies can read the team table directly.
create or replace function public.carousel_shares_team(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_owner = (select auth.uid())
      or exists (
        select 1
          from public.carousel_team_members me
          join public.carousel_team_members them on them.team_id = me.team_id
         where me.user_id = (select auth.uid())
           and them.user_id = p_owner
      )
$$;

revoke all on function public.carousel_shares_team(uuid) from public, anon;
grant execute on function public.carousel_shares_team(uuid) to authenticated;

-- The teams the signed-in user belongs to (read without going through RLS again).
create or replace function public.carousel_my_teams()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.team_id from public.carousel_team_members m where m.user_id = (select auth.uid())
$$;

revoke all on function public.carousel_my_teams() from public, anon;
grant execute on function public.carousel_my_teams() to authenticated;

-- Members see who else is in their teams. Changes only go through the functions below.
drop policy if exists "Team members: select" on public.carousel_team_members;
create policy "Team members: select" on public.carousel_team_members
  for select to authenticated using (team_id in (select public.carousel_my_teams()));

-- Adds someone (by the email of their existing account) to the caller's team.
create or replace function public.carousel_team_add(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := auth.uid();
  v_user uuid;
begin
  if v_me is null then
    raise sqlstate 'PT401' using message = 'Sign in first.';
  end if;
  select u.id into v_user from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
  if v_user is null then
    raise sqlstate 'PT404' using message = 'No account uses that email yet. They need to create one first (Supabase → Authentication → Add user, or sign up in the app).';
  end if;
  if v_user = v_me then
    raise sqlstate 'PT400' using message = 'That''s your own account.';
  end if;
  insert into public.carousel_team_members (team_id, user_id, role) values (v_me, v_me, 'owner') on conflict do nothing;
  insert into public.carousel_team_members (team_id, user_id, role) values (v_me, v_user, 'member') on conflict do nothing;
end;
$$;

-- The owner removes a member; a member can also leave.
create or replace function public.carousel_team_remove(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.carousel_team_members m
   where m.user_id = p_user
     and m.role = 'member'
     and (m.team_id = auth.uid() or p_user = auth.uid());
end;
$$;

-- Everyone in the caller's teams, with names and emails.
create or replace function public.carousel_team_list()
returns table (team_id uuid, user_id uuid, email text, name text, role text, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select m.team_id, m.user_id, u.email::text, public.carousel_user_name(m.user_id), m.role, m.user_id = auth.uid()
    from public.carousel_team_members m
    join auth.users u on u.id = m.user_id
   where m.team_id in (select x.team_id from public.carousel_team_members x where x.user_id = auth.uid())
   order by m.team_id, m.role desc, u.email
$$;

revoke all on function public.carousel_team_add(text) from public, anon;
revoke all on function public.carousel_team_remove(uuid) from public, anon;
revoke all on function public.carousel_team_list() from public, anon;
grant execute on function public.carousel_team_add(text) to authenticated;
grant execute on function public.carousel_team_remove(uuid) to authenticated;
grant execute on function public.carousel_team_list() to authenticated;

-- ---------------------------------------------------------------------------
-- Carousels and slides: shared within the team
-- ---------------------------------------------------------------------------

drop policy if exists "Own projects: select" on public.carousel_projects;
drop policy if exists "Team projects: select" on public.carousel_projects;
create policy "Team projects: select" on public.carousel_projects
  for select to authenticated using (public.carousel_shares_team(user_id));

drop policy if exists "Own projects: update" on public.carousel_projects;
drop policy if exists "Team projects: update" on public.carousel_projects;
create policy "Team projects: update" on public.carousel_projects
  for update to authenticated using (public.carousel_shares_team(user_id)) with check (public.carousel_shares_team(user_id));
-- Insert (own rows) and delete (owner only) keep their original policies.

drop policy if exists "Own slides: select" on public.carousel_slides;
drop policy if exists "Team slides: select" on public.carousel_slides;
create policy "Team slides: select" on public.carousel_slides
  for select to authenticated using (exists (
    select 1 from public.carousel_projects p where p.id = project_id and public.carousel_shares_team(p.user_id)));
drop policy if exists "Own slides: insert" on public.carousel_slides;
drop policy if exists "Team slides: insert" on public.carousel_slides;
create policy "Team slides: insert" on public.carousel_slides
  for insert to authenticated with check (exists (
    select 1 from public.carousel_projects p where p.id = project_id and public.carousel_shares_team(p.user_id)));
drop policy if exists "Own slides: update" on public.carousel_slides;
drop policy if exists "Team slides: update" on public.carousel_slides;
create policy "Team slides: update" on public.carousel_slides
  for update to authenticated
  using (exists (select 1 from public.carousel_projects p where p.id = project_id and public.carousel_shares_team(p.user_id)))
  with check (exists (select 1 from public.carousel_projects p where p.id = project_id and public.carousel_shares_team(p.user_id)));
drop policy if exists "Own slides: delete" on public.carousel_slides;
drop policy if exists "Team slides: delete" on public.carousel_slides;
create policy "Team slides: delete" on public.carousel_slides
  for delete to authenticated using (exists (
    select 1 from public.carousel_projects p where p.id = project_id and public.carousel_shares_team(p.user_id)));

-- Who made each carousel, and how far its posting got.
alter table public.carousel_projects add column if not exists created_by uuid references auth.users (id) on delete set null;
alter table public.carousel_projects add column if not exists created_by_name text not null default '';
alter table public.carousel_projects add column if not exists posted_count integer not null default 0;
alter table public.carousel_projects add column if not exists posted_by text[] not null default '{}';
update public.carousel_projects set created_by = user_id where created_by is null;

-- Stamps the maker on new carousels. Teammates can edit a carousel, but its
-- owner and maker never change.
create or replace function public.carousel_projects_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.user_id);
    new.created_by_name := coalesce(public.carousel_user_name(new.created_by), '');
    new.posted_count := 0;
    new.posted_by := '{}';
  else
    new.user_id := old.user_id;
    new.created_by := old.created_by;
    new.created_by_name := old.created_by_name;
  end if;
  return new;
end;
$$;

drop trigger if exists carousel_projects_stamp on public.carousel_projects;
create trigger carousel_projects_stamp
  before insert or update on public.carousel_projects
  for each row execute function public.carousel_projects_stamp();

-- ---------------------------------------------------------------------------
-- Posting checklist: the Facebook pages every carousel goes to
-- ---------------------------------------------------------------------------

create table if not exists public.carousel_post_pages (
  key         text primary key check (key ~ '^[a-z0-9-]{1,40}$'),
  name        text not null check (char_length(name) between 1 and 120),
  short_name  text not null check (char_length(short_name) between 1 and 60),
  sort        integer not null
);

insert into public.carousel_post_pages (key, name, short_name, sort) values
  ('main', 'Homes.ph Main Page', 'Main Page', 1),
  ('ozamiz', 'Homes.ph Ozamiz', 'Ozamiz', 2),
  ('dumaguete', 'Homes.ph Dumaguete', 'Dumaguete', 3),
  ('bgc-taguig', 'Homes.ph BGC Taguig', 'BGC Taguig', 4),
  ('cebu', 'Homes.ph Cebu', 'Cebu', 5),
  ('pampanga', 'Homes.ph Pampanga', 'Pampanga', 6),
  ('cavite', 'Homes.ph Cavite', 'Cavite', 7),
  ('iloilo', 'Homes.ph Iloilo', 'Iloilo', 8),
  ('bacolod', 'Homes.ph Bacolod', 'Bacolod', 9),
  ('davao', 'Homes.ph Davao', 'Davao', 10),
  ('palawan', 'Homes.ph Palawan', 'Palawan', 11),
  ('bohol', 'Homes.ph Bohol', 'Bohol', 12),
  ('makati', 'Homes.ph Makati', 'Makati', 13),
  ('cdo', 'Homes.ph CDO', 'CDO', 14),
  ('gensan', 'Homes.ph Gensan', 'Gensan', 15),
  ('caraga', 'Homes.ph Caraga', 'Caraga', 16),
  ('leyte', 'Homes.ph Leyte', 'Leyte', 17)
on conflict (key) do update set name = excluded.name, short_name = excluded.short_name, sort = excluded.sort;

alter table public.carousel_post_pages enable row level security;
revoke all on public.carousel_post_pages from anon;
grant select on public.carousel_post_pages to authenticated;
drop policy if exists "Post pages: read" on public.carousel_post_pages;
create policy "Post pages: read" on public.carousel_post_pages for select to authenticated using (true);

-- One row per page a carousel was posted on: who ticked it and when.
create table if not exists public.carousel_post_checks (
  project_id       uuid not null references public.carousel_projects (id) on delete cascade,
  page_key         text not null references public.carousel_post_pages (key) on delete cascade on update cascade,
  checked_by       uuid references auth.users (id) on delete set null,
  checked_by_name  text not null default '',
  checked_at       timestamptz not null default now(),
  primary key (project_id, page_key)
);

alter table public.carousel_post_checks enable row level security;
revoke all on public.carousel_post_checks from anon;
grant select, insert, delete on public.carousel_post_checks to authenticated;

drop policy if exists "Post checks: select" on public.carousel_post_checks;
create policy "Post checks: select" on public.carousel_post_checks
  for select to authenticated using (exists (
    select 1 from public.carousel_projects p where p.id = project_id and public.carousel_shares_team(p.user_id)));
drop policy if exists "Post checks: insert" on public.carousel_post_checks;
create policy "Post checks: insert" on public.carousel_post_checks
  for insert to authenticated with check (exists (
    select 1 from public.carousel_projects p where p.id = project_id and public.carousel_shares_team(p.user_id)));
drop policy if exists "Post checks: delete" on public.carousel_post_checks;
create policy "Post checks: delete" on public.carousel_post_checks
  for delete to authenticated using (exists (
    select 1 from public.carousel_projects p where p.id = project_id and public.carousel_shares_team(p.user_id)));

-- The signed-in person and the current time are recorded, whatever the app sends.
create or replace function public.carousel_post_checks_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.checked_by := auth.uid();
  new.checked_by_name := coalesce(public.carousel_user_name(auth.uid()), '');
  new.checked_at := now();
  return new;
end;
$$;

drop trigger if exists carousel_post_checks_stamp on public.carousel_post_checks;
create trigger carousel_post_checks_stamp
  before insert on public.carousel_post_checks
  for each row execute function public.carousel_post_checks_stamp();

-- Keeps the carousel in step with its checklist: how many pages are done, who
-- posted, and Published (with the time of the last page) once every page is
-- ticked. Unticking a page of a complete checklist makes it not posted again.
create or replace function public.carousel_post_checks_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project uuid := coalesce(new.project_id, old.project_id);
  v_done    integer;
  v_total   integer;
  v_last    timestamptz;
  v_names   text[];
begin
  select count(*), max(c.checked_at) into v_done, v_last
    from public.carousel_post_checks c where c.project_id = v_project;
  select coalesce(array_agg(n.name order by n.first_at), '{}') into v_names
    from (select c.checked_by_name as name, min(c.checked_at) as first_at
            from public.carousel_post_checks c
           where c.project_id = v_project and c.checked_by_name <> ''
           group by c.checked_by_name) n;
  select count(*) into v_total from public.carousel_post_pages;

  update public.carousel_projects p set
    posted_count = v_done,
    posted_by = v_names,
    status = case
      when v_total > 0 and v_done >= v_total then 'published'
      when tg_op = 'DELETE' and p.status = 'published' and v_done = v_total - 1
        then case when p.scheduled_at is null then 'draft' else 'scheduled' end
      else p.status
    end,
    posted_at = case when v_total > 0 and v_done >= v_total then v_last else p.posted_at end
  where p.id = v_project;
  return null;
end;
$$;

drop trigger if exists carousel_post_checks_sync on public.carousel_post_checks;
create trigger carousel_post_checks_sync
  after insert or delete on public.carousel_post_checks
  for each row execute function public.carousel_post_checks_sync();

revoke all on function public.carousel_projects_stamp() from public, anon, authenticated;
revoke all on function public.carousel_post_checks_stamp() from public, anon, authenticated;
revoke all on function public.carousel_post_checks_sync() from public, anon, authenticated;

-- PostgREST picks up the new tables and columns.
notify pgrst, 'reload schema';
