begin;

create table public.site_display_settings (
  id smallint primary key default 1 check (id = 1),
  birth_date_year_only boolean not null default false,
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);

insert into public.site_display_settings (id) values (1);

alter table public.site_display_settings enable row level security;
revoke all on table public.site_display_settings from public, anon, authenticated, service_role;
grant select on table public.site_display_settings to anon, authenticated;
grant select, update on table public.site_display_settings to service_role;
create policy site_display_settings_public_read on public.site_display_settings
  for select to anon, authenticated using (id = 1);

create table public.site_display_setting_actions (
  action_id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  birth_date_year_only boolean not null,
  previous_birth_date_year_only boolean not null,
  revision integer not null unique,
  created_at timestamptz not null default now()
);
alter table public.site_display_setting_actions enable row level security;
revoke all on table public.site_display_setting_actions from public, anon, authenticated, service_role;
grant select, insert on table public.site_display_setting_actions to service_role;

-- The update-admin Edge Function verifies getUser(), non-anonymous identity and
-- server app_metadata.chat_admin before supplying its own user ID here. Browser
-- roles cannot call this RPC or write either table. No elevated SQL execution.
create function public.admin_set_birth_date_display(
  p_admin_user_id uuid,
  p_year_only boolean,
  p_expected_revision integer
)
returns public.site_display_settings
language plpgsql
security invoker
set search_path = pg_catalog, public
set lock_timeout = '2s'
as $$
declare
  prior public.site_display_settings%rowtype;
  result public.site_display_settings%rowtype;
begin
  if p_admin_user_id is null or p_year_only is null
    or p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode = 'P0001', message = 'PUBLIC_UPDATE_ADMIN_INVALID_DISPLAY_SETTING';
  end if;

  select * into prior from public.site_display_settings where id = 1 for update;
  if not found or prior.revision <> p_expected_revision then
    raise exception using errcode = 'P0001', message = 'PUBLIC_UPDATE_ADMIN_DISPLAY_CONFLICT';
  end if;
  if prior.birth_date_year_only = p_year_only then return prior; end if;

  update public.site_display_settings
  set birth_date_year_only = p_year_only, revision = revision + 1, updated_at = clock_timestamp()
  where id = 1 returning * into result;

  insert into public.site_display_setting_actions (
    admin_user_id, birth_date_year_only, previous_birth_date_year_only, revision
  ) values (p_admin_user_id, p_year_only, prior.birth_date_year_only, result.revision);
  return result;
end;
$$;

revoke all on function public.admin_set_birth_date_display(uuid, boolean, integer)
  from public, anon, authenticated;
grant execute on function public.admin_set_birth_date_display(uuid, boolean, integer) to service_role;

comment on table public.site_display_settings is
  'Global website display preferences; birth date source claims remain intact and public under existing review rules.';

commit;
