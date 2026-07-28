import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chatDateKey,
  countChatCharacters,
  formatChatTimestamp,
  limitChatInput,
  mergeChatMessages,
  type ChatMessage,
} from '../src/lib/globalChat.ts';

function message(id: string, createdAt: string, body = id): ChatMessage {
  return {
    id,
    display_name_snapshot: '測試者',
    public_code_snapshot: 'A7K2F9',
    body,
    reply_to_message_id: null,
    reply_state: null,
    reply_to_display_name_snapshot: null,
    reply_to_public_code_snapshot: null,
    reply_to_body_snapshot: null,
    created_at: createdAt,
  };
}

test('chat input stays single-line and stops at 50 Unicode characters', () => {
  assert.equal(countChatCharacters('😀'), 1);
  assert.equal(limitChatInput(`第一行\n第二行`), '第一行第二行');
  assert.equal(limitChatInput('政'.repeat(51)), '政'.repeat(50));
});

test('history pages and realtime messages merge without duplicates in cursor order', () => {
  const older = message('00000000-0000-4000-8000-000000000001', '2026-07-29T01:00:00.000Z');
  const newer = message('00000000-0000-4000-8000-000000000002', '2026-07-29T02:00:00.000Z');
  const duplicate = { ...newer, body: '更新後內容' };

  assert.deepEqual(
    mergeChatMessages([newer], [older, duplicate]).map((item) => [item.id, item.body]),
    [
      [older.id, older.body],
      [newer.id, '更新後內容'],
    ],
  );
});

test('Taipei timestamps omit the current year and include it across years', () => {
  const now = new Date('2026-07-29T04:00:00.000Z');
  assert.equal(formatChatTimestamp('2026-07-28T08:42:00.000Z', now), '07/28 16:42');
  assert.equal(
    formatChatTimestamp('2025-12-31T15:58:00.000Z', now),
    '2025/12/31 23:58',
  );
  assert.equal(chatDateKey('2026-07-28T16:30:00.000Z'), '2026-07-29');
});
