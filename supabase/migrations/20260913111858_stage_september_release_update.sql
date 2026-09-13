begin;

-- Publish only after the website and feedback service pass release smoke checks.
insert into public.public_update_events (
  update_key, update_type, title, summary, review_status, visibility, is_public
) values (
  'september-2026-platform-office-and-feedback-update',
  'site',
  '調整政見投票與任期判斷，改善使用體驗',
  '政見投票依當選、政見處理完成及就職滿一年開放；改善公職任期判斷、首頁政黨資訊與手機輸入體驗，並完善回饋管理。',
  'draft', 'internal', false
)
on conflict (update_key) do nothing;

commit;
