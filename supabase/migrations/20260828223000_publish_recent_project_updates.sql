begin;

insert into public.public_update_events (
  update_id,
  update_key,
  update_type,
  title,
  summary,
  entity_type,
  entity_href,
  occurred_at,
  published_at,
  review_status,
  visibility,
  is_public
)
values
  (
    '10000000-0000-4000-8000-000000000004',
    'profile-text-quality-review-2026-08',
    'correction',
    '校正學經歷與政見條目',
    '重新檢查 2024 立法委員與 2022 議員人物資料，改善重複、無意義字串、斷句與條目切分問題。',
    'person',
    '/people',
    '2026-08-28 16:30:00+08',
    '2026-08-28 16:30:00+08',
    'verified',
    'public',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    'contextual-chat-channels-2026-08',
    'site',
    '聊天室加入情境頻道與議題標籤',
    '聊天室可在全站、地區與選舉情境間切換，議題作為訊息標籤；全站大廳仍可查看所有頻道發言。',
    null,
    null,
    '2026-08-28 17:30:00+08',
    '2026-08-28 17:30:00+08',
    'verified',
    'public',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000006',
    'platform-fulfillment-voting-2026-08',
    'election',
    '當選人政見履行情況社群投票上線',
    '符合條件的 2024 總統與立法委員、2022 議員政見可進行社群投票；選舉結果公布滿一年後才開放，總統搭檔共用投票紀錄。',
    'election',
    '/elections',
    '2026-08-28 18:30:00+08',
    '2026-08-28 18:30:00+08',
    'verified',
    'public',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000007',
    'data-quality-and-open-source-guidance-2026-08',
    'site',
    '補充資料品質與開源貢獻說明',
    '公開說明批次文字整理可能出現的限制，人物頁新增短提示，並補上開源貢獻流程與 Codex 維護邊界。',
    null,
    null,
    '2026-08-28 22:00:00+08',
    '2026-08-28 22:00:00+08',
    'verified',
    'public',
    true
  )
on conflict (update_key) do nothing;

commit;
