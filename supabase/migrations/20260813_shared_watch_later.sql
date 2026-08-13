create table if not exists public.yt_watch_later (
  video_id text primary key,
  updated_at timestamptz not null default now()
);

alter table public.yt_watch_later enable row level security;
grant select on public.yt_watch_later to anon, authenticated;

do $$
begin
  create policy "shared watch later is readable" on public.yt_watch_later
    for select to anon, authenticated using (true);
exception when duplicate_object then null;
end $$;

insert into public.yt_watch_later (video_id, updated_at)
select video_id, now()
from public.app_config,
     jsonb_array_elements_text(value::jsonb) as video_id
where key = 'yt_wl_playlist_personal_ids_v1'
on conflict (video_id) do update set updated_at = excluded.updated_at;
