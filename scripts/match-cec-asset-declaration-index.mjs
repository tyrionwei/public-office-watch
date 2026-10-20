// Only typographic separators are ignored. Character variants, transliterations,
// prefixes and Chinese-only portions of a full name require a separate review.
export const normalizedIndexName = (value) => value.replace(/[\s·．‧・˙.]/gu, '').replaceAll('台', '臺');

export function registrationNamePolicy({ official, site, method }) {
  const acceptedNames = [official.name, site.name];
  if (method === '全名比對（忽略空白、間隔符、台臺）') return { acceptedNames };
  return { acceptedNames, holdReason: method.includes('用字衝突')
    ? 'official_registration_name_conflict' : 'registration_full_name_identity_unreviewed' };
}

export function declarationScope(record, fromIndex = false) {
  const region = fromIndex ? record.region : record.county;
  const chief = fromIndex
    ? ['municipality_mayor', 'county_city_chief'].includes(record.office)
    : record.office === 'mayor';
  if (!chief && !(fromIndex
    ? ['municipality_councilor', 'county_city_councilor'].includes(record.office)
    : record.office === 'councilor')) throw new Error(`Unsupported office: ${record.office}`);
  const district = chief ? '' : /第([0-9]+)選舉區/u.exec(record.district)?.[1];
  if (district === undefined) throw new Error(`Missing council district: ${record.district}`);
  return [normalizedIndexName(region), chief ? 'mayor' : 'councilor', district].join('|');
}

export function matchDeclarationIndex({ index, registrations, rejectedExternalIds = [] }) {
  const rejected = new Set(rejectedExternalIds);
  const sourceByUrl = new Map(index.sources.map((source) => [source.url, source]));
  const matched = [], pending = [], excluded = [];
  const seen = new Set();
  for (const record of index.records) {
    if (record.electionYear !== 2026) throw new Error('Unexpected election year');
    if (!/^https:\/\/pdps-dec\.cec\.gov\.tw\/release\/formal\/files\/[0-9]+\.pdf$/u.test(record.documentUrl)) {
      throw new Error('Non-official declaration PDF URL');
    }
    const source = sourceByUrl.get(record.indexUrl);
    if (!source || !/^[a-f0-9]{64}$/u.test(source.sha256)) throw new Error('Missing index provenance');
    const scope = declarationScope(record, true);
    const sameScope = registrations.filter((candidate) => declarationScope(candidate.official) === scope);
    const options = sameScope.filter((candidate) => candidate.acceptedNames.some(
      (name) => normalizedIndexName(name) === normalizedIndexName(record.name),
    ));
    if (options.length !== 1) {
      pending.push({ officialIndex: record, reason: options.length ? 'ambiguous_exact_name' : 'name_difference',
        scopedRegistrations: sameScope.map(({ candidateExternalId, official, acceptedNames }) => ({ candidateExternalId, name: official.name, acceptedNames })) });
      continue;
    }
    const candidate = options[0];
    if (rejected.has(candidate.candidateExternalId)) {
      excluded.push({ officialIndex: record, candidateExternalId: candidate.candidateExternalId, reason: 'qualification_rejected' });
      continue;
    }
    if (candidate.holdReason || !candidate.subjectId || !candidate.raceId || !['candidate', 'registration_name'].includes(candidate.subjectType)) {
      pending.push({ officialIndex: record, candidateExternalId: candidate.candidateExternalId,
        reason: candidate.holdReason || 'unresolved_local_subject' });
      continue;
    }
    const externalId = `cec-asset-declaration-2026:${candidate.candidateExternalId}:${new URL(record.documentUrl).pathname.split('/').at(-1).slice(0, -4)}`;
    if (seen.has(externalId)) throw new Error(`Duplicate subject/document: ${externalId}`);
    seen.add(externalId);
    matched.push({ candidateExternalId: candidate.candidateExternalId, subjectType: candidate.subjectType,
      subjectId: candidate.subjectId, raceId: candidate.raceId, personId: candidate.personId || null,
      officialRegistration: candidate.official, officialIndex: record,
      matchMethod: 'same_region_office_district_and_previously_recorded_exact_name',
      event: {
        external_id: externalId,
        candidate_id: candidate.subjectType === 'candidate' ? candidate.subjectId : null,
        registration_name_id: candidate.subjectType === 'registration_name' ? candidate.subjectId : null,
        event_type: 'asset_declaration_published', occurred_on: null, source_published_on: '2026-10-16',
        source_name: '中央選舉委員會｜候選人財產申報文件（未核對金額）',
        source_url: record.documentUrl, source_hash: source.sha256,
        fetched_at: index.retrievedAt, is_public: true,
        event_data: { reviewScope: 'document_index_only', hashTarget: record.indexUrl,
          electionYear: 2026, amountsReviewed: false, indexName: record.name },
      },
    });
  }
  const people = (records) => new Set(records.map((row) => {
    const r = row.officialIndex; return `${declarationScope(r, true)}|${normalizedIndexName(r.name)}`;
  })).size;
  return { schemaVersion: 1, sourceRetrievedAt: index.retrievedAt,
    reviewScope: 'document_index_only', amountsReviewed: false, productionExecuted: false,
    summary: { indexedDocuments: index.records.length,
      indexedPeople: people(index.records.map((officialIndex) => ({ officialIndex }))),
      matchedDocuments: matched.length, matchedPeople: people(matched),
      pendingDocuments: pending.length, pendingPeople: people(pending),
      excludedDocuments: excluded.length, excludedPeople: people(excluded) },
    matched, pending, excluded };
}
