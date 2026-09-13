-- Run after the production website, database, and feedback-admin smoke checks.
-- This statement only publishes the reviewed announcement staged by migration.
begin;

do $$
begin
  if not exists (
    select 1 from public.public_update_events
    where update_key = 'september-2026-platform-office-and-feedback-update'
      and title = '改善首頁與手機體驗，完善回饋管理'
      and summary = '改善首頁政黨與推薦資訊呈現、手機輸入體驗，並完善使用者回饋的分類、處理備註與管理功能。'
  ) then
    raise exception 'Expected release announcement is missing or changed';
  end if;
end
$$;

update public.public_update_events
set review_status = 'verified', visibility = 'public', is_public = true,
    occurred_at = now(), published_at = now(), updated_at = now()
where update_key = 'september-2026-platform-office-and-feedback-update'
  and review_status = 'draft' and visibility = 'internal' and not is_public;

commit;
