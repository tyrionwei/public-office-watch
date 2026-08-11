begin;

alter table public.public_update_events
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text check (review_note is null or char_length(btrim(review_note)) between 2 and 300);

create table if not exists public.public_update_event_actions (
  action_id uuid primary key default gen_random_uuid(),
  update_id uuid not null references public.public_update_events(update_id) on delete restrict,
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  action_type text not null check (action_type in ('created', 'approved', 'rejected', 'withdrawn')),
  reason text check (reason is null or char_length(btrim(reason)) between 2 and 300),
  created_at timestamptz not null default now()
);

create index if not exists public_update_event_actions_update_idx
  on public.public_update_event_actions (update_id, created_at desc);

alter table public.public_update_event_actions enable row level security;
revoke all on table public.public_update_event_actions from public, anon, authenticated;
grant select, insert on table public.public_update_event_actions to service_role;

create or replace function public.assert_public_update_admin(p_admin_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_admin_user_id is null or not exists (
    select 1
    from auth.users account
    where account.id = p_admin_user_id
      and account.raw_app_meta_data ->> 'chat_admin' = 'true'
  ) then
    raise exception using errcode = 'P0001', message = 'PUBLIC_UPDATE_ADMIN_FORBIDDEN';
  end if;
end;
$$;

revoke all on function public.assert_public_update_admin(uuid)
from public, anon, authenticated, service_role;

create or replace function public.admin_create_public_update_event(
  p_admin_user_id uuid,
  p_update_type text,
  p_title text,
  p_summary text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_entity_href text default null,
  p_source_name text default null,
  p_source_url text default null,
  p_occurred_at timestamptz default null
)
returns public.public_update_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created_event public.public_update_events%rowtype;
begin
  perform public.assert_public_update_admin(p_admin_user_id);

  if p_update_type not in ('candidate', 'person', 'party', 'election', 'correction', 'site')
    or char_length(btrim(coalesce(p_title, ''))) not between 1 and 120
    or char_length(btrim(coalesce(p_summary, ''))) not between 1 and 500
    or (p_entity_type is not null and p_entity_type not in ('person', 'party', 'election', 'race', 'region'))
    or (p_entity_type is null and p_entity_id is not null)
    or (p_entity_href is not null and (p_entity_href not like '/%' or p_entity_href like '//%' or p_entity_href like '/internal/%'))
    or (p_source_url is not null and p_source_url !~ '^https?://')
  then
    raise exception using errcode = 'P0001', message = 'PUBLIC_UPDATE_ADMIN_INVALID_DRAFT';
  end if;

  insert into public.public_update_events (
    update_key,
    update_type,
    title,
    summary,
    entity_type,
    entity_id,
    entity_href,
    source_name,
    source_url,
    occurred_at,
    review_status,
    visibility,
    is_public,
    created_by
  ) values (
    'admin-' || gen_random_uuid()::text,
    p_update_type,
    btrim(p_title),
    btrim(p_summary),
    p_entity_type,
    nullif(btrim(p_entity_id), ''),
    nullif(btrim(p_entity_href), ''),
    nullif(btrim(p_source_name), ''),
    nullif(btrim(p_source_url), ''),
    p_occurred_at,
    'draft',
    'internal',
    false,
    p_admin_user_id
  )
  returning * into created_event;

  insert into public.public_update_event_actions (
    update_id,
    admin_user_id,
    action_type,
    reason
  ) values (
    created_event.update_id,
    p_admin_user_id,
    'created',
    '建立內部草稿'
  );

  return created_event;
end;
$$;

create or replace function public.admin_review_public_update_event(
  p_admin_user_id uuid,
  p_update_id uuid,
  p_action text,
  p_reason text default null
)
returns public.public_update_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_event public.public_update_events%rowtype;
  normalized_reason text := nullif(btrim(p_reason), '');
begin
  perform public.assert_public_update_admin(p_admin_user_id);

  if p_action not in ('approve', 'reject', 'withdraw')
    or (p_action in ('reject', 'withdraw') and char_length(coalesce(normalized_reason, '')) not between 2 and 300)
    or (normalized_reason is not null and char_length(normalized_reason) > 300)
  then
    raise exception using errcode = 'P0001', message = 'PUBLIC_UPDATE_ADMIN_INVALID_REVIEW';
  end if;

  select event.*
  into target_event
  from public.public_update_events event
  where event.update_id = p_update_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'PUBLIC_UPDATE_ADMIN_NOT_FOUND';
  end if;

  if (p_action = 'withdraw' and target_event.review_status <> 'verified')
    or (p_action = 'approve' and target_event.review_status = 'verified')
    or (p_action = 'reject' and target_event.review_status <> 'draft')
  then
    raise exception using errcode = 'P0001', message = 'PUBLIC_UPDATE_ADMIN_INVALID_STATE';
  end if;

  update public.public_update_events event
  set review_status = case
        when p_action = 'approve' then 'verified'
        when p_action = 'reject' then 'rejected'
        else 'draft'
      end,
      visibility = case when p_action = 'approve' then 'public' else 'internal' end,
      is_public = p_action = 'approve',
      published_at = case when p_action = 'approve' then now() else event.published_at end,
      reviewed_by = p_admin_user_id,
      reviewed_at = now(),
      review_note = normalized_reason,
      updated_at = now()
  where event.update_id = p_update_id
  returning * into target_event;

  insert into public.public_update_event_actions (
    update_id,
    admin_user_id,
    action_type,
    reason
  ) values (
    target_event.update_id,
    p_admin_user_id,
    case p_action
      when 'approve' then 'approved'
      when 'reject' then 'rejected'
      else 'withdrawn'
    end,
    coalesce(normalized_reason, '人工核准公開')
  );

  return target_event;
end;
$$;

revoke all on function public.admin_create_public_update_event(uuid, text, text, text, text, text, text, text, text, timestamptz)
from public, anon, authenticated;
revoke all on function public.admin_review_public_update_event(uuid, uuid, text, text)
from public, anon, authenticated;

grant execute on function public.admin_create_public_update_event(uuid, text, text, text, text, text, text, text, text, timestamptz)
to service_role;
grant execute on function public.admin_review_public_update_event(uuid, uuid, text, text)
to service_role;

commit;
