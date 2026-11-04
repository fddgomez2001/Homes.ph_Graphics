-- Daily Carousel Maker — Trash and News articles.
-- Run once in the Supabase SQL Editor after 20261029000000_daily_carousel_maker.sql.
-- Safe to run again.

-- Trash: a deleted carousel keeps its rows (deleted_at is set) until it's deleted
-- forever from the Trash. Row Level Security already limits rows to their owner.
alter table public.carousel_projects add column if not exists deleted_at timestamptz;

-- What the project is: a carousel (1254 × 1254 slides) or a news article (one 1408 × 1408 graphic).
alter table public.carousel_projects add column if not exists kind text not null default 'carousel';
do $$
begin
  alter table public.carousel_projects add constraint carousel_projects_kind_check check (kind in ('carousel', 'news'));
exception
  when duplicate_object then null;
end
$$;

create index if not exists carousel_projects_user_deleted_idx on public.carousel_projects (user_id, deleted_at);
create index if not exists carousel_projects_user_kind_idx on public.carousel_projects (user_id, kind);

-- Duplicates keep their kind and never start in the Trash.
create or replace function public.duplicate_carousel_project(p_project_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_new_id uuid;
begin
  insert into public.carousel_projects (title, topic, caption, scheduled_at, status, thumbnail, kind)
  select left(p.title || ' (copy)', 300), p.topic, p.caption, p.scheduled_at, 'draft', p.thumbnail, p.kind
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

revoke all on function public.duplicate_carousel_project(uuid) from public, anon;
grant execute on function public.duplicate_carousel_project(uuid) to authenticated;

-- PostgREST picks up the new columns.
notify pgrst, 'reload schema';
