-- Daily Carousel Maker — when a carousel was posted.
-- Run once in the Supabase SQL Editor after 20261030000000_trash_and_news.sql.
-- Safe to run again.

-- The date and time the carousel went live (set from the website or the app).
alter table public.carousel_projects add column if not exists posted_at timestamptz;

-- Kept in step with the status, wherever it changes: Published without a time
-- gets "now", any other status has no posted time.
create or replace function public.set_posted_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' then
    if new.posted_at is null then
      new.posted_at := now();
    end if;
  else
    new.posted_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists carousel_projects_posted_at on public.carousel_projects;
create trigger carousel_projects_posted_at
  before insert or update on public.carousel_projects
  for each row execute function public.set_posted_at();

create index if not exists carousel_projects_user_posted_idx on public.carousel_projects (user_id, posted_at desc);

-- PostgREST picks up the new column.
notify pgrst, 'reload schema';
