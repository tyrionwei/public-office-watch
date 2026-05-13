import type { PollComparison } from '../types/polling';

export const mockPollComparisons: PollComparison[] = [
  {
    electionId: 'election-local-2026',
    title: '民調焦點比較',
    summary: '以 UI 測試資料模擬前兩位候選人的支持度比較版面。',
    leadingCandidates: [
      {
        candidateId: 'candidate-example-a',
        displayName: '範例人物甲',
        partyKey: 'dpp',
        partyLabel: '民主進步黨',
        supportPercent: 37,
        trendLabel: '支持度穩定',
        spriteVariant: 'pulse-a',
        note: 'UI 測試資料，未接入正式民調來源。',
      },
      {
        candidateId: 'candidate-example-b',
        displayName: '範例人物乙',
        partyKey: 'kmt',
        partyLabel: '中國國民黨',
        supportPercent: 34,
        trendLabel: '支持度接近',
        spriteVariant: 'pulse-b',
        note: 'UI 測試資料，未接入正式民調來源。',
      },
    ],
    otherCandidates: [
      {
        candidateId: 'candidate-example-c',
        displayName: '範例人物丙',
        partyKey: 'independent',
        partyLabel: '無黨籍',
        supportPercent: 11,
        trendLabel: '其他候選人',
        spriteVariant: 'pulse-c',
        note: 'UI 測試資料，未接入正式民調來源。',
      },
    ],
    sourceSummary: {
      sourceCount: 3,
      dateRangeStart: '2026-09-01',
      dateRangeEnd: '2026-09-15',
      updatedAt: '2026-09-16',
      methodologyNote: 'UI 測試用欄位，未接入正式民調來源。',
      disclaimer: '此為 UI 測試資料，不代表正式民調彙整或選舉結果。',
    },
  },
];
