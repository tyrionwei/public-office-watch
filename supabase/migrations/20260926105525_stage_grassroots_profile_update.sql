begin;

-- Publish after the grassroots compaction and website release pass acceptance.
-- Set published_at to the actual publication time when approving this draft.
insert into public.public_update_events (
  update_key, update_type, title, summary, review_status, visibility, is_public
) values (
  'grassroots-name-only-profile-adjustment-2026-09',
  'site',
  '暫時調整村里長與鄉鎮市民代表人物頁',
  '為降低資料庫負擔並維持網站穩定，本站暫時停止提供僅有村里長或鄉鎮市民代表參選紀錄的人物詳細頁面，姓名與歷屆參選紀錄仍會保留；曾參選較高層級公職的人物頁不受影響。相關詳細資料已另行備份保存，後續將視維運經費與資料庫資源狀況，逐步恢復。',
  'draft', 'internal', false
)
on conflict (update_key) do nothing;

commit;
