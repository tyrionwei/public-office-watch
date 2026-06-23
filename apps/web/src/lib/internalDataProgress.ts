import { getSupabasePublicClient } from './supabasePublicClient';
import type { SupabaseClient } from '@supabase/supabase-js';

type PublicPersonRow = {
  person_id: string;
  name: string;
  gender: string | null;
  education: string | null;
  experience: string | null;
};

type PublicClaimRow = {
  claim_id: string;
  person_id: string;
  claim_type: string;
  claim_value: string | null;
  claim_json: Record<string, unknown> | null;
  source_name: string | null;
};

type ReviewClaimRow = {
  claim_id: string;
  person_id: string | null;
  claim_type: string;
  source_name: string | null;
  review_score: number;
};

type DuplicateReviewRow = {
  duplicate_person_id: string;
  confidence_level: string;
};

export type DataProgressMetric = {
  key: string;
  label: string;
  current: number;
  total: number;
  note: string;
};

export type DataProgressItem = {
  key: string;
  label: string;
  detail: string;
};

export type DataProgressSummary = {
  peopleTotal: number;
  publicClaimTotal: number;
  pendingClaimTotal: number;
  externalIdPeople: number;
  birthDatePeople: number;
  wikidataExternalIdPeople: number;
  sensitivePendingTotal: number;
  publicLegalClaimTotal: number;
  duplicateQueueTotal: number;
  metrics: DataProgressMetric[];
  completedItems: DataProgressItem[];
  pendingItems: DataProgressItem[];
  pendingByType: Array<{ type: string; count: number }>;
  pendingBySource: Array<{ source: string; count: number }>;
  missingCorePeople: Array<{ personId: string; name: string; missing: string[] }>;
  error: string | null;
};

const sensitiveClaimTypes = new Set(['legal_case', 'family_relation']);

function percentReady(current: number, total: number) {
  return total > 0 ? Math.round((current / total) * 100) : 0;
}

function countBy<T>(rows: T[], keyFor: (row: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyFor(row) || '未分類';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ type: key, source: key, count }))
    .sort((left, right) => right.count - left.count);
}

async function fetchAllRows<T>(client: SupabaseClient, table: string, select: string) {
  const rows: T[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await client
      .from(table)
      .select(select)
      .range(offset, offset + pageSize - 1);

    if (error) {
      return { rows, error: error.message };
    }

    const page = (data ?? []) as T[];
    rows.push(...page);

    if (page.length < pageSize) {
      return { rows, error: null };
    }

    offset += pageSize;
  }
}

function claimKeysByPerson(claims: PublicClaimRow[]) {
  const keys = new Map<string, Set<string>>();

  for (const claim of claims) {
    const personClaims = keys.get(claim.person_id) ?? new Set<string>();
    personClaims.add(claim.claim_type);
    keys.set(claim.person_id, personClaims);
  }

  return keys;
}

function hasClaim(keys: Map<string, Set<string>>, personId: string, claimType: string) {
  return keys.get(personId)?.has(claimType) ?? false;
}

export async function fetchInternalDataProgress(): Promise<DataProgressSummary> {
  const client = getSupabasePublicClient();
  if (!client) {
    return {
      peopleTotal: 0,
      publicClaimTotal: 0,
      pendingClaimTotal: 0,
      externalIdPeople: 0,
      birthDatePeople: 0,
      wikidataExternalIdPeople: 0,
      sensitivePendingTotal: 0,
      publicLegalClaimTotal: 0,
      duplicateQueueTotal: 0,
      metrics: [],
      completedItems: [],
      pendingItems: [],
      pendingByType: [],
      pendingBySource: [],
      missingCorePeople: [],
      error: 'Supabase public env not configured.',
    };
  }

  const [peopleResult, publicClaimsResult, reviewClaimsResult, duplicateQueueResult] = await Promise.all([
    fetchAllRows<PublicPersonRow>(client, 'public_people', 'person_id,name,gender,education,experience'),
    fetchAllRows<PublicClaimRow>(client, 'public_person_claims', 'claim_id,person_id,claim_type,claim_value,claim_json,source_name'),
    fetchAllRows<ReviewClaimRow>(client, 'person_claim_review_queue', 'claim_id,person_id,claim_type,source_name,review_score'),
    fetchAllRows<DuplicateReviewRow>(client, 'person_duplicate_review_queue', 'duplicate_person_id,confidence_level'),
  ]);

  const error = peopleResult.error ?? publicClaimsResult.error ?? reviewClaimsResult.error ?? duplicateQueueResult.error ?? null;
  const people = peopleResult.rows;
  const publicClaims = publicClaimsResult.rows;
  const reviewClaims = reviewClaimsResult.rows;
  const duplicateQueue = duplicateQueueResult.rows;
  const total = people.length;
  const claimKeys = claimKeysByPerson(publicClaims);
  const externalIdPeople = new Set(
    publicClaims
      .filter((claim) => claim.claim_type === 'external_id')
      .map((claim) => claim.person_id),
  ).size;
  const birthDatePeople = new Set(
    publicClaims
      .filter((claim) => claim.claim_type === 'birth_date')
      .map((claim) => claim.person_id),
  ).size;
  const wikidataExternalIdPeople = new Set(
    publicClaims
      .filter((claim) => claim.claim_type === 'external_id' && String(claim.claim_value ?? '').startsWith('wikidata:'))
      .map((claim) => claim.person_id),
  ).size;

  const withGender = people.filter((person) => person.gender && person.gender !== 'unknown').length;
  const withEducation = people.filter((person) => person.education || hasClaim(claimKeys, person.person_id, 'education')).length;
  const withExperience = people.filter((person) => person.experience || hasClaim(claimKeys, person.person_id, 'experience')).length;
  const sensitivePendingTotal = reviewClaims.filter((claim) => sensitiveClaimTypes.has(claim.claim_type)).length;
  const publicLegalClaimTotal = publicClaims.filter((claim) => claim.claim_type === 'legal_case').length;
  const duplicateQueueTotal = duplicateQueue.length;
  const pendingByType = countBy(reviewClaims, (claim) => claim.claim_type).map(({ type, count }) => ({ type, count }));
  const pendingBySource = countBy(reviewClaims, (claim) => claim.source_name).map(({ source, count }) => ({ source, count }));
  const missingCorePeople = people
    .map((person) => ({
      personId: person.person_id,
      name: person.name,
      missing: [
        person.gender && person.gender !== 'unknown' ? null : '性別',
        hasClaim(claimKeys, person.person_id, 'external_id') ? null : '外部 ID',
        hasClaim(claimKeys, person.person_id, 'birth_date') ? null : '生日',
        person.education || hasClaim(claimKeys, person.person_id, 'education') ? null : '學歷',
        person.experience || hasClaim(claimKeys, person.person_id, 'experience') ? null : '經歷',
      ].filter((value): value is string => Boolean(value)),
    }))
    .filter((person) => person.missing.length > 0)
    .slice(0, 25);
  const completedItems: DataProgressItem[] = [
    {
      key: 'base-people',
      label: '人物基礎資料已匯入',
      detail: `${total} 位 public_people 可查詢`,
    },
    {
      key: 'gender',
      label: '性別欄位已補齊',
      detail: `${withGender} / ${total} 位已有性別`,
    },
    {
      key: 'review-queue',
      label: '一般審核佇列已清空',
      detail: `${reviewClaims.length} 筆待審核 claim`,
    },
    {
      key: 'legal-boundary',
      label: '犯罪紀錄維持人工防線',
      detail: `${publicLegalClaimTotal} 筆 legal_case 公開 claim`,
    },
  ].filter((item) => {
    if (item.key === 'gender') return withGender === total && total > 0;
    if (item.key === 'review-queue') return reviewClaims.length === 0;
    if (item.key === 'legal-boundary') return publicLegalClaimTotal === 0;
    return total > 0;
  });
  const pendingItems: DataProgressItem[] = [
    {
      key: 'birth-date',
      label: '生日 / 穩定身份訊號待補',
      detail: `${Math.max(total - birthDatePeople, 0)} 位缺公開生日 claim，去重仍需補強`,
    },
    {
      key: 'external-id',
      label: '官方或外部 ID 待補',
      detail: `${Math.max(total - externalIdPeople, 0)} 位缺外部 ID claim`,
    },
    {
      key: 'education',
      label: '學歷待補',
      detail: `${Math.max(total - withEducation, 0)} 位缺學歷資料`,
    },
    {
      key: 'experience',
      label: '經歷待補',
      detail: `${Math.max(total - withExperience, 0)} 位缺經歷資料`,
    },
    {
      key: 'duplicates',
      label: '同名人物待判斷',
      detail: `${duplicateQueueTotal} 組 duplicate review queue`,
    },
  ].filter((item) => !item.detail.startsWith('0 '));

  return {
    peopleTotal: total,
    publicClaimTotal: publicClaims.length,
    pendingClaimTotal: reviewClaims.length,
    externalIdPeople,
    birthDatePeople,
    wikidataExternalIdPeople,
    sensitivePendingTotal,
    publicLegalClaimTotal,
    duplicateQueueTotal,
    metrics: [
      { key: 'gender', label: '性別', current: withGender, total, note: `${percentReady(withGender, total)}% 已補齊` },
      { key: 'external-id', label: '外部 ID', current: externalIdPeople, total, note: `${percentReady(externalIdPeople, total)}% 已建立` },
      { key: 'birth-date', label: '生日', current: birthDatePeople, total, note: `${percentReady(birthDatePeople, total)}% 已補齊` },
      { key: 'education', label: '學歷', current: withEducation, total, note: `${percentReady(withEducation, total)}% 已補齊` },
      { key: 'experience', label: '經歷', current: withExperience, total, note: `${percentReady(withExperience, total)}% 已補齊` },
    ],
    completedItems,
    pendingItems,
    pendingByType,
    pendingBySource,
    missingCorePeople,
    error,
  };
}
