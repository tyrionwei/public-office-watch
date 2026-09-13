-- Run after the production website, database, and feedback-admin smoke checks.
-- This statement only publishes the reviewed announcement staged by migration.
begin;

do $$
begin
  if not exists (
    select 1 from public.public_update_events
    where update_key = 'september-2026-platform-office-and-feedback-update'
      and title = '調整政見投票與任期判斷，改善使用體驗'
      and summary = '政見投票依當選、政見處理完成及就職滿一年開放；改善公職任期判斷、首頁政黨資訊與手機輸入體驗，並完善回饋管理。'
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
