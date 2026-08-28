import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chatDateKey,
  countChatCharacters,
  formatChatTimestamp,
  getChatRoomContext,
  isCurrentChatRealtimeSubscription,
  isReferendumChatRoom,
  limitChatInput,
  mergeChatMessages,
  normalizeChatUuid,
  sortElectionChatRoomsNewestFirst,
  type ChatMessage,
  type ChatRoom,
} from '../src/lib/globalChat.ts';

const regionId = '11111111-1111-4111-8111-111111111111';
const electionId = '22222222-2222-4222-8222-222222222222';

function message(id: string, createdAt: string, body = id): ChatMessage {
  return {
    id,
    room_id: '00000000-0000-4000-8000-000000000001',
    topic_tag: null,
    room_key: 'global',
    room_type: 'global',
    room_display_name: '全站大廳',
    display_name_snapshot: '測試者',
    public_code_snapshot: 'A7K2F9',
    body,
    reply_to_message_id: null,
    reply_state: null,
    reply_to_display_name_snapshot: null,
    reply_to_public_code_snapshot: null,
    reply_to_body_snapshot: null,
    created_at: createdAt,
    visibility_state: 'visible',
    visibility_until: null,
  };
}

test('chat room context uses route context without creating person rooms', () => {
  assert.deepEqual(getChatRoomContext(`/regions/${regionId}`, null), {
    regionId,
    eventKey: null,
    electionId: null,
  });
  assert.deepEqual(getChatRoomContext('/elections/events/2024-2024-01-13-national', regionId), {
    regionId,
    eventKey: '2024-2024-01-13-national',
    electionId: null,
  });
  assert.deepEqual(getChatRoomContext(`/elections/${electionId}`, regionId), {
    regionId,
    eventKey: null,
    electionId,
  });
  assert.deepEqual(getChatRoomContext('/people/person-1', regionId), {
    regionId,
    eventKey: null,
    electionId: null,
  });
});

test('ignores late realtime statuses from a replaced room subscription', () => {
  assert.equal(isCurrentChatRealtimeSubscription(2, 1), false);
  assert.equal(isCurrentChatRealtimeSubscription(2, 2), true);
});

test('chat room context keeps region slugs while ignoring the nationwide sentinel', () => {
  assert.equal(normalizeChatUuid(' national '), null);
  assert.equal(normalizeChatUuid(` ${regionId} `), regionId);
  assert.deepEqual(getChatRoomContext('/people/person-1', 'national'), {
    regionId: null,
    eventKey: null,
    electionId: null,
  });
  assert.deepEqual(getChatRoomContext('/people/person-1', 'new-taipei-city'), {
    regionId: 'new-taipei-city',
    eventKey: null,
    electionId: null,
  });
  assert.deepEqual(getChatRoomContext('/regions/new-taipei-city', regionId), {
    regionId: 'new-taipei-city',
    eventKey: null,
    electionId: null,
  });
});

test('election chat rooms are sorted from newest year to oldest', () => {
  const rooms: ChatRoom[] = [
    {
      id: '1', room_key: 'event:2022-local', room_type: 'election_event',
      entity_key: '2022-2022-11-26-local', display_name: '2022 地方公職人員選舉',
      region_id: null, display_order: 20,
    },
    {
      id: '2', room_key: 'event:2026-local', room_type: 'election_event',
      entity_key: '2026-2026-11-28-local', display_name: '2026 地方公職人員選舉',
      region_id: null, display_order: 20,
    },
    {
      id: '3', room_key: 'event:2024-national', room_type: 'election_event',
      entity_key: '2024-2024-01-13-national', display_name: '2024 總統副總統及立法委員選舉',
      region_id: null, display_order: 20,
    },
    {
      id: '4', room_key: 'event:unknown', room_type: 'election_event',
      entity_key: null, display_name: '未標年份選舉', region_id: null, display_order: 20,
    },
  ];

  assert.deepEqual(
    sortElectionChatRoomsNewestFirst(rooms).map((room) => room.display_name),
    [
      '2026 地方公職人員選舉',
      '2024 總統副總統及立法委員選舉',
      '2022 地方公職人員選舉',
      '未標年份選舉',
    ],
  );
  assert.equal(rooms[0].display_name, '2022 地方公職人員選舉');
});

test('identifies referendum rooms separately from election rooms', () => {
  const electionRoom: ChatRoom = {
    id: 'election',
    room_key: 'event:2022:election',
    room_type: 'election_event',
    entity_key: '2022:election',
    display_name: '2022 地方公職人員選舉',
    region_id: null,
    display_order: 20,
  };

  assert.equal(isReferendumChatRoom(electionRoom), false);
  assert.equal(isReferendumChatRoom({
    ...electionRoom,
    id: 'referendum',
    room_key: 'event:2022:referendum',
    entity_key: '2022:referendum',
    display_name: '2022 公民投票',
  }), true);
});

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
