-- Run against an isolated database with the display-setting migration applied.
-- Synthetic fixtures and every change are rolled back at the end.
begin;

do $$ begin
  if not exists (select 1 from public.site_display_settings where id = 1 and not birth_date_year_only and revision = 0) then
    raise exception 'Expected freshly migrated default full-date setting';
  end if;
end $$;

insert into auth.users (id, aud, role, email, raw_app_meta_data, created_at, updated_at)
values ('418f9e79-7399-4fd0-bfca-5aae32014bd9', 'authenticated', 'authenticated',
  'birthday-admin@example.test', '{"chat_admin":true}', now(), now());
insert into public.people(id, name) values ('518f9e79-7399-4fd0-bfca-5aae32014bd9', 'Synthetic Birthday Person');
insert into public.person_claims(claim_key, person_id, claim_type, claim_value, review_status, visibility, is_public)
values ('birthday-display-synthetic', '518f9e79-7399-4fd0-bfca-5aae32014bd9', 'birth_date', '1981-07-23', 'verified', 'public', true);

set local role anon;
do $$ begin
  if (select count(*) from public.site_display_settings) <> 1 then raise exception 'Public read missing'; end if;
  begin
    update public.site_display_settings set birth_date_year_only = true where id = 1;
    raise exception 'anon wrote settings';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_set_birth_date_display('418f9e79-7399-4fd0-bfca-5aae32014bd9', true, 0);
    raise exception 'anon called settings RPC';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.site_display_setting_actions;
    raise exception 'anon read administrator audit';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
do $$ begin
  if (select count(*) from public.site_display_settings) <> 1 then raise exception 'Signed-in public read missing'; end if;
  begin
    update public.site_display_settings set birth_date_year_only = true where id = 1;
    raise exception 'authenticated wrote settings';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_set_birth_date_display('418f9e79-7399-4fd0-bfca-5aae32014bd9', true, 0);
    raise exception 'authenticated called settings RPC';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.site_display_setting_actions;
    raise exception 'authenticated read administrator audit';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role service_role;
do $$ declare changed public.site_display_settings; begin
  begin
    perform public.admin_set_birth_date_display(null, true, 0);
    raise exception 'null actor accepted';
  exception when raise_exception then
    if sqlerrm <> 'PUBLIC_UPDATE_ADMIN_INVALID_DISPLAY_SETTING' then raise; end if;
  end;
  -- Audit FK failure after settings UPDATE must roll back both writes.
  begin
    perform public.admin_set_birth_date_display('618f9e79-7399-4fd0-bfca-5aae32014bd9', true, 0);
    raise exception 'nonexistent audit actor accepted';
  exception when foreign_key_violation then null; end;
  if not exists (select 1 from public.site_display_settings where revision = 0 and not birth_date_year_only)
    or exists (select 1 from public.site_display_setting_actions) then raise exception 'Audit failure left partial settings'; end if;

  changed := public.admin_set_birth_date_display('418f9e79-7399-4fd0-bfca-5aae32014bd9', true, 0);
  if not changed.birth_date_year_only or changed.revision <> 1 then raise exception 'Enable did not persist'; end if;
  begin
    perform public.admin_set_birth_date_display('418f9e79-7399-4fd0-bfca-5aae32014bd9', false, 0);
    raise exception 'stale revision accepted';
  exception when raise_exception then
    if sqlerrm <> 'PUBLIC_UPDATE_ADMIN_DISPLAY_CONFLICT' then raise; end if;
  end;
  changed := public.admin_set_birth_date_display('418f9e79-7399-4fd0-bfca-5aae32014bd9', true, 1);
  if changed.revision <> 1 or (select count(*) from public.site_display_setting_actions) <> 1 then
    raise exception 'Same-setting replay changed history';
  end if;
end $$;
reset role;

set local role anon;
do $$ begin
  if not exists (select 1 from public.site_display_settings where birth_date_year_only and revision = 1) then
    raise exception 'Public reader did not see admin change';
  end if;
end $$;
reset role;

set local role service_role;
select public.admin_set_birth_date_display('418f9e79-7399-4fd0-bfca-5aae32014bd9', false, 1);
reset role;

do $$ begin
  if not exists (select 1 from public.site_display_settings where not birth_date_year_only and revision = 2) then
    raise exception 'Full date was not restored';
  end if;
  if (select count(*) from public.site_display_setting_actions) <> 2 then raise exception 'Audit count wrong'; end if;
  if not exists (select 1 from public.person_claims where claim_key = 'birthday-display-synthetic'
      and claim_value = '1981-07-23' and is_public and review_status = 'verified' and visibility = 'public') then
    raise exception 'Display setting changed full date claim';
  end if;
  if exists (select 1 from pg_class where oid in ('public.site_display_settings'::regclass, 'public.site_display_setting_actions'::regclass)
    and not relrowsecurity) then raise exception 'New table missing RLS'; end if;
  if exists (select 1 from pg_proc where oid = 'public.admin_set_birth_date_display(uuid,boolean,integer)'::regprocedure and prosecdef) then
    raise exception 'RPC must remain SECURITY INVOKER';
  end if;
end $$;

rollback;
select 'PASS display settings: default, public reads, denied writes/audit, atomic audit rollback, revision conflict, restore and intact full birthday' as result;
