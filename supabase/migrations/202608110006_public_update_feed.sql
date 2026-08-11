begin;

create table if not exists public.public_update_events (
  update_id uuid primary key default gen_random_uuid(),
  update_key text not null unique,
  update_type text not null check (update_type in ('candidate', 'person', 'party', 'election', 'correction', 'site')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  summary text not null check (char_length(btrim(summary)) between 1 and 500),
  entity_type text check (entity_type is null or entity_type in ('person', 'party', 'election', 'race', 'region')),
  entity_id text,
  entity_href text,
  source_name text,
  source_url text check (source_url is null or source_url ~ '^https?://'),
  occurred_at timestamptz,
  published_at timestamptz not null default now(),
  review_status text not null default 'draft' check (review_status in ('draft', 'verified', 'rejected')),
  visibility text not null default 'internal' check (visibility in ('internal', 'public')),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((entity_type is null and entity_id is null) or entity_type is not null)
);

alter table public.public_update_events
  drop constraint if exists public_update_events_entity_href_check;
alter table public.public_update_events
  add constraint public_update_events_entity_href_check check (
    entity_href is null
    or (
      entity_href like '/%'
      and entity_href not like '//%'
      and entity_href not like '/internal/%'
    )
  );

comment on table public.public_update_events is
  'Editorial update events. Only explicitly verified public rows are exposed through published.update_feed.';

alter table public.public_update_events enable row level security;
revoke all on table public.public_update_events from public, anon, authenticated;
grant select, insert, update, delete on table public.public_update_events to service_role;

create index if not exists public_update_events_public_feed_idx
  on public.public_update_events (published_at desc, update_id desc)
  where review_status = 'verified' and visibility = 'public' and is_public;

create or replace view published.update_feed
with (security_barrier = true)
as
select
  update_id,
  update_type,
  title,
  summary,
  entity_type,
  entity_id,
  entity_href,
  source_name,
  source_url,
  occurred_at,
  published_at
from public.public_update_events
where review_status = 'verified'
  and visibility = 'public'
  and is_public
  and published_at <= now();

comment on view published.update_feed is
  'Public, reviewed update feed. Draft and internal research records are excluded.';

revoke all on table published.update_feed from public;
grant select on table published.update_feed to anon, authenticated, service_role;

insert into public.public_update_events (
  update_id,
  update_key,
  update_type,
  title,
  summary,
  entity_type,
  entity_href,
  published_at,
  review_status,
  visibility,
  is_public
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'update-feed-launched',
    'site',
    '公開更新動態上線',
    '集中呈現本站已審核且已公開的資料新增、修正與功能變更。',
    null,
    null,
    '2026-08-11 09:00:00+08',
    'verified',
    'public',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'campaign-platform-election-scope',
    'election',
    '政見改為依選舉與參選紀錄呈現',
    '同一人物在不同選舉提出的政見會分開顯示，避免跨屆資料混在一起。',
    'election',
    '/elections',
    '2026-08-10 18:00:00+08',
    'verified',
    'public',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'party-announced-candidates-2026',
    'candidate',
    '補充 2026 政黨公告參選資料',
    '在中選會正式公告前，依政黨公開資料標示已宣布參選或政黨推薦狀態。',
    'election',
    '/elections',
    '2026-08-09 18:00:00+08',
    'verified',
    'public',
    true
  )
on conflict (update_key) do nothing;

commit;
