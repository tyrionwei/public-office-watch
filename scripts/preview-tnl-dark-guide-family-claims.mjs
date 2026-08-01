import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(repoRoot, 'data-sources', 'tnl-dark-guide');
const defaultOutputPath = path.join(repoRoot, 'local-data', 'tnl-dark-guide-family-claims-preview.json');
const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);

const acceptedEvidenceTiers = new Set([
  'official',
  'institutional',
  'candidate_official',
  'trusted_media',
  'reliable_secondary',
  'secondary',
  'first_party',
]);

const relationAliases = new Map();
const relationLabels = new Map();

function registerRelation(type, label, aliases) {
  relationLabels.set(type, label);
  for (const alias of aliases) relationAliases.set(alias, type);
}

registerRelation('grandfather', '祖父', ['祖父', '爺爺', '外公']);
registerRelation('grandmother', '祖母', ['祖母', '奶奶', '外婆']);
registerRelation('father', '父親', ['爸爸', '父親']);
registerRelation('adoptive_father', '養父', ['養父']);
registerRelation('mother', '母親', ['媽媽', '母親']);
registerRelation('father_in_law', '岳父／公公', ['岳父', '公公']);
registerRelation('mother_in_law', '岳母／婆婆', ['岳母', '婆婆']);
registerRelation('spouse', '配偶', ['丈夫', '妻子', '老婆', '配偶']);
registerRelation('brother', '兄弟', ['兄長', '哥哥', '弟弟', '二哥', '三哥', '四哥']);
registerRelation('sister', '姊妹', ['姊姊', '姐姐', '妹妹']);
registerRelation('sibling_in_law', '姻親手足', ['姐夫', '小叔', '小姑', '大伯', '二嫂']);
registerRelation('uncle', '伯叔舅', ['伯伯', '伯父', '叔叔', '舅舅', '姨丈', '二叔', '三叔', '四叔']);
registerRelation('aunt', '姑姨嬸', ['姑姑', '阿姨', '嬸嬸']);
registerRelation('cousin', '堂／表親', ['堂兄', '堂弟', '堂哥', '堂妹', '表親', '表哥', '表姊', '表姐', '表弟']);
registerRelation('godmother', '乾媽', ['乾媽']);
registerRelation('co_parent_in_law', '親家', ['親家']);
registerRelation('son', '兒子', ['兒子', '長子']);
registerRelation('daughter', '女兒', ['女兒']);
registerRelation('nephew', '姪子／外甥', ['姪子', '侄子', '外甥']);
registerRelation('niece', '姪女', ['姪女', '侄女']);
registerRelation('grandson', '孫子', ['孫子']);
registerRelation('granddaughter', '孫女', ['孫女']);

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        return [
          line.slice(0, separator).trim(),
          line.slice(separator + 1).trim().replace(/^["']|["']$/g, ''),
        ];
      }),
  );
}

function parseArgs(argv) {
  const options = { outputPath: defaultOutputPath };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  return options;
}

function normalizedName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/臺/g, '台')
    .replace(/羣/g, '群')
    .replace(/黄/g, '黃')
    .replace(/[^㐀-鿿a-zA-Z0-9]/g, '')
    .toLowerCase();
}

export function normalizeFamilyRelation(value) {
  const relationType = relationAliases.get(String(value ?? '').trim()) ?? null;
  return relationType == null ? null : {
    relationType,
    relationLabel: relationLabels.get(relationType),
  };
}

function displayFamilyRelationLabel(rawRelationship, fallbackLabel) {
  const value = String(rawRelationship ?? '').trim();
  const aliases = new Map([
    ['爸爸', '父親'],
    ['媽媽', '母親'],
    ['老婆', '配偶'],
    ['妻子', '配偶'],
    ['丈夫', '配偶'],
  ]);
  return (aliases.get(value) ?? value) || fallbackLabel;
}

function uniqueBy(rows, keyFor) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = keyFor(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function evidenceSources(row) {
  return uniqueBy([
    ...(row.externalResearch?.sources ?? []).map((source) => ({
      tier: source.tier,
      name: source.name,
      url: source.url,
      supports: source.supports ?? null,
    })),
    ...(row.localEvidence ?? []).map((source) => ({
      tier: source.tier,
      name: source.sourceName,
      url: source.sourceUrl,
      supports: source.claimValue ?? null,
    })),
  ].filter((source) => (
    acceptedEvidenceTiers.has(source.tier)
    && /^https?:\/\//.test(source.url ?? '')
  )), (source) => source.url).sort((left, right) => {
    const rank = ['official', 'institutional', 'candidate_official', 'trusted_media', 'first_party', 'reliable_secondary', 'secondary'];
    return rank.indexOf(left.tier) - rank.indexOf(right.tier) || left.url.localeCompare(right.url);
  });
}

function evidenceSupportsFamilyFact(source, relativeName) {
  const supports = normalizedName(source.supports);
  const normalizedRelativeName = normalizedName(relativeName);
  if (!supports || !normalizedRelativeName || !supports.includes(normalizedRelativeName)) return false;
  return /(父|母|女|子|妻|夫|兄|弟|姐|姊|妹|祖|孫|姑|叔|伯|舅|姨|甥|嬸|親|家族|結婚)/u.test(
    String(source.supports ?? ''),
  );
}

function familyOccurrenceId(researchId) {
  return String(researchId ?? '').replace(/-政治家族-(\d+)$/u, '-family-$1');
}

function targetRowsByOccurrence(familyPeopleReport, canonicalPersonId) {
  const rowsByOccurrence = new Map();
  for (const [resolution, rows] of [
    ['found', familyPeopleReport.found],
    ['ambiguous', familyPeopleReport.ambiguousSameName],
    ['not_found', familyPeopleReport.notFound],
  ]) {
    for (const row of rows ?? []) {
      for (const occurrence of row.occurrences ?? []) {
        const targets = rowsByOccurrence.get(occurrence.id) ?? [];
        targets.push({
          resolution,
          mentionedName: row.mentionedName,
          relationship: occurrence.relationship,
          matches: uniqueBy((row.matches ?? []).map((match) => ({
            ...match,
            canonicalPersonId: canonicalPersonId(match.canonicalPersonId ?? match.personId),
          })), (match) => match.canonicalPersonId),
        });
        rowsByOccurrence.set(occurrence.id, targets);
      }
    }
  }
  return rowsByOccurrence;
}

function existingFamilyFactKeys(existingClaims, canonicalPersonId) {
  const keys = new Set();
  for (const claim of existingClaims ?? []) {
    if (
      claim.claim_type !== 'family_relation'
      || claim.review_status !== 'verified'
      || claim.visibility !== 'public'
      || claim.is_public !== true
    ) continue;
    const relation = normalizeFamilyRelation(
      claim.claim_json?.relationLabel
      ?? String(claim.claim_value ?? '').split(/[：:]/u)[0],
    );
    const relativeName = claim.claim_json?.relativeName
      ?? String(claim.claim_value ?? '').split(/[：:]/u).slice(1).join('：').trim();
    if (!relation || !relativeName) continue;
    const personId = canonicalPersonId(claim.person_id);
    const relativePersonId = claim.claim_json?.relativePersonId
      ? canonicalPersonId(claim.claim_json.relativePersonId)
      : null;
    if (relativePersonId) keys.add(`${personId}|${relation.relationType}|id:${relativePersonId}`);
    keys.add(`${personId}|${relation.relationType}|name:${normalizedName(relativeName)}`);
  }
  return keys;
}

function heldRow(row, reason, targets = []) {
  return {
    researchId: row.researchId,
    personName: row.personName,
    canonicalPersonId: row.canonicalPersonId,
    reason,
    targets: targets.map((target) => ({
      resolution: target.resolution,
      mentionedName: target.mentionedName,
      relationship: target.relationship,
      matchCount: target.matches.length,
    })),
  };
}

export function buildTnlFamilyClaimPreview({
  sourceResearchReport,
  familyPeopleReport,
  people = [],
  personCanonicalMap = [],
  existingClaims = [],
}) {
  const canonicalIds = new Map(personCanonicalMap.map((row) => [row.person_id, row.canonical_person_id]));
  const canonicalPersonId = (personId) => canonicalIds.get(personId) ?? personId;
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const targetsByOccurrence = targetRowsByOccurrence(familyPeopleReport, canonicalPersonId);
  const existingFactKeys = existingFamilyFactKeys(existingClaims, canonicalPersonId);
  const researchRows = (sourceResearchReport.claims ?? []).filter((row) => (
    row.category === '政治家族' && row.status === 'auto_reviewable'
  ));
  const held = [];
  const facts = [];

  for (const row of researchRows) {
    const primaryPersonId = canonicalPersonId(row.canonicalPersonId);
    const primaryPerson = peopleById.get(primaryPersonId);
    const targets = targetsByOccurrence.get(familyOccurrenceId(row.researchId)) ?? [];
    const evidence = evidenceSources(row);

    if (!primaryPerson || primaryPerson.is_public !== true) {
      held.push(heldRow(row, 'primary_person_missing_or_private', targets));
      continue;
    }
    if (targets.length === 0) {
      held.push(heldRow(row, 'no_explicit_relative', targets));
      continue;
    }
    if (targets.some((target) => target.resolution === 'ambiguous')) {
      held.push(heldRow(row, 'ambiguous_relative', targets));
      continue;
    }
    if (targets.some((target) => target.resolution === 'not_found')) {
      held.push(heldRow(row, targets.some((target) => target.resolution === 'found')
        ? 'mixed_relative_resolution'
        : 'relative_not_found', targets));
      continue;
    }
    if (evidence.length === 0) {
      held.push(heldRow(row, 'acceptable_evidence_missing', targets));
      continue;
    }

    const resolvedTargets = [];
    let heldReason = null;
    for (const target of targets) {
      const relation = normalizeFamilyRelation(target.relationship);
      if (!relation) {
        heldReason = 'unsupported_relation';
        break;
      }
      if (target.matches.length !== 1) {
        heldReason = 'relative_identity_not_unique';
        break;
      }
      const relativePersonId = canonicalPersonId(target.matches[0].canonicalPersonId);
      const relativePerson = peopleById.get(relativePersonId);
      if (!relativePerson || relativePerson.is_public !== true) {
        heldReason = 'relative_person_missing_or_private';
        break;
      }
      const targetEvidence = evidence.filter((source) => evidenceSupportsFamilyFact(source, target.mentionedName));
      if (targetEvidence.length === 0) {
        heldReason = 'direct_relationship_evidence_missing';
        break;
      }
      resolvedTargets.push({
        ...relation,
        rawRelationship: target.relationship,
        relativePersonId,
        relativeName: relativePerson.name,
        evidence: targetEvidence,
      });
    }
    if (heldReason) {
      held.push(heldRow(row, heldReason, targets));
      continue;
    }

    for (const target of uniqueBy(resolvedTargets, (item) => `${item.relationType}|${item.relativePersonId}`)) {
      facts.push({
        factKey: `${primaryPersonId}|${target.relationType}|${target.relativePersonId}`,
        personId: primaryPersonId,
        personName: primaryPerson.name,
        ...target,
        relationGroupLabel: target.relationLabel,
        relationLabel: displayFamilyRelationLabel(target.rawRelationship, target.relationLabel),
        researchId: row.researchId,
        evidence: target.evidence,
      });
    }
  }

  const groupedFacts = new Map();
  for (const fact of facts) {
    const group = groupedFacts.get(fact.factKey) ?? {
      ...fact,
      researchIds: [],
      evidence: [],
    };
    group.researchIds.push(fact.researchId);
    group.evidence.push(...fact.evidence);
    groupedFacts.set(fact.factKey, group);
  }

  const plannedClaims = [];
  const alreadyPublic = [];
  for (const fact of [...groupedFacts.values()].sort((left, right) => left.factKey.localeCompare(right.factKey))) {
    fact.researchIds = [...new Set(fact.researchIds)].sort();
    fact.evidence = uniqueBy(fact.evidence, (source) => source.url);
    const idKey = `${fact.personId}|${fact.relationType}|id:${fact.relativePersonId}`;
    const nameKey = `${fact.personId}|${fact.relationType}|name:${normalizedName(fact.relativeName)}`;
    if (existingFactKeys.has(idKey) || existingFactKeys.has(nameKey)) {
      alreadyPublic.push(fact);
      continue;
    }
    const primaryEvidence = fact.evidence[0];
    const hash = crypto.createHash('sha256').update(fact.factKey).digest('hex').slice(0, 16);
    plannedClaims.push({
      claimKey: `research:tnl-dark-guide-family:${hash}`,
      personId: fact.personId,
      claimType: 'family_relation',
      claimValue: `${fact.relationLabel}：${fact.relativeName}`,
      claimJson: {
        sourceId: 'tnl-dark-guide-independent-family-research',
        relationType: fact.relationType,
        relationLabel: fact.relationLabel,
        relationGroupLabel: fact.relationGroupLabel,
        relativePersonId: fact.relativePersonId,
        relativeName: fact.relativeName,
        researchIds: fact.researchIds,
        evidenceSources: fact.evidence,
        publicationGate: {
          status: 'preview_only',
          requiresHumanApproval: true,
        },
      },
      confidenceLevel: primaryEvidence.tier === 'official' ? 'A' : 'B',
      reviewStatus: 'pending',
      visibility: 'review_only',
      sourceName: primaryEvidence.name,
      sourceUrl: primaryEvidence.url,
      isPublic: false,
    });
  }

  const heldReasonCounts = Object.fromEntries(
    [...held.reduce((counts, row) => counts.set(row.reason, (counts.get(row.reason) ?? 0) + 1), new Map())]
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const payload = {
    policy: {
      databaseWrites: false,
      originalGuideTextPublished: false,
      createsPeople: false,
      ambiguousNamesAutoResolved: false,
      publicClaimsRequireHumanApproval: true,
    },
    summary: {
      autoReviewableResearchRows: researchRows.length,
      safeResearchRows: new Set(facts.map((fact) => fact.researchId)).size,
      uniqueSafeFacts: groupedFacts.size,
      alreadyPublicFacts: alreadyPublic.length,
      plannedReviewClaims: plannedClaims.length,
      heldResearchRows: held.length,
      heldReasonCounts,
    },
    plannedClaims,
    alreadyPublic,
    held,
  };
  return {
    ...payload,
    summary: {
      ...payload.summary,
      estimatedPreviewBytes: Buffer.byteLength(JSON.stringify(payload), 'utf8'),
    },
  };
}

function restUrl(config, tableName) {
  return new URL(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/${tableName}`);
}

async function fetchRows(config, tableName, select, filters = {}) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = restUrl(config, tableName);
    url.searchParams.set('select', select);
    url.searchParams.set('limit', '1000');
    url.searchParams.set('offset', String(offset));
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
    const response = await fetch(url, {
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
      },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`Failed to fetch ${tableName}: ${body?.message ?? response.statusText}`);
    rows.push(...body);
    if (body.length < 1000) return rows;
  }
}

async function fetchRowsByIds(config, tableName, select, column, ids) {
  const rows = [];
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  for (let index = 0; index < uniqueIds.length; index += 80) {
    const chunk = uniqueIds.slice(index, index + 80);
    rows.push(...await fetchRows(config, tableName, select, { [column]: `in.(${chunk.join(',')})` }));
  }
  return rows;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const localEnv = readLocalEnv();
  const config = {
    supabaseUrl: process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (!config.serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  if (!localHostnames.has(new URL(config.supabaseUrl).hostname)) {
    throw new Error('This preview only reads local Supabase');
  }

  const sourceResearchReport = JSON.parse(fs.readFileSync(path.join(dataDir, 'source-research-report.json'), 'utf8'));
  const familyPeopleReport = JSON.parse(fs.readFileSync(path.join(dataDir, 'family-people-report.json'), 'utf8'));
  const existingClaims = await fetchRows(
    config,
    'person_claims',
    'claim_key,person_id,claim_type,claim_value,claim_json,review_status,visibility,is_public,source_name,source_url',
    { claim_type: 'eq.family_relation', order: 'claim_key.asc' },
  );
  const referencedPersonIds = [
    ...sourceResearchReport.claims.map((row) => row.canonicalPersonId),
    ...familyPeopleReport.found.flatMap((row) => row.matches.map((match) => match.personId)),
    ...familyPeopleReport.ambiguousSameName.flatMap((row) => row.matches.map((match) => match.personId)),
    ...existingClaims.flatMap((claim) => [claim.person_id, claim.claim_json?.relativePersonId]),
  ];
  const personCanonicalMap = await fetchRowsByIds(
    config,
    'person_canonical_map',
    'person_id,canonical_person_id',
    'person_id',
    referencedPersonIds,
  );
  const canonicalPersonIds = personCanonicalMap.map((row) => row.canonical_person_id);
  const people = await fetchRowsByIds(
    config,
    'people',
    'id,name,is_public',
    'id',
    [...referencedPersonIds, ...canonicalPersonIds],
  );
  const preview = buildTnlFamilyClaimPreview({
    sourceResearchReport,
    familyPeopleReport,
    people,
    personCanonicalMap,
    existingClaims,
  });
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(preview, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: path.relative(repoRoot, options.outputPath), ...preview.summary }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
