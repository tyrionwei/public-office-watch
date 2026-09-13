begin;

-- Publish only after the website and feedback service pass release smoke checks.
insert into public.public_update_events (
  update_key, update_type, title, summary, review_status, visibility, is_public
) values (
  'september-2026-platform-office-and-feedback-update',
  'site',
  '改善首頁與手機體驗，完善回饋管理',
  '改善首頁政黨與推薦資訊呈現、手機輸入體驗，並完善使用者回饋的分類、處理備註與管理功能。',
  'draft', 'internal', false
)
on conflict (update_key) do nothing;

commit;
