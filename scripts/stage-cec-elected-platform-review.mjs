import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultInputPath = path.join(repoRoot, 'tmp', 'cec-elected-platforms', 'platform-review-final.json');
const defaultOutputPath = path.join(repoRoot, 'tmp', 'cec-elected-platforms', 'platform-review-staging.json');
const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);
const officialBulletinHostnames = new Set(['eebulletin.cec.gov.tw', 'bulletin.cec.gov.tw']);

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')];
      }),
  );
}

function parseArgs(argv) {
  const options = { inputPath: defaultInputPath, outputPath: defaultOutputPath, applyLocal: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') options.inputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--apply-local') options.applyLocal = true;
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  if (!fs.existsSync(options.inputPath)) throw new Error(`Review report not found: ${options.inputPath}`);
  return options;
}

function assertLocalSupabase(supabaseUrl) {
  const hostname = new URL(supabaseUrl).hostname;
  if (!localHostnames.has(hostname)) {
    throw new Error(`CEC platform review writes are local-only; received Supabase host ${hostname}`);
  }
}

function validateReport(report) {
  if (!Array.isArray(report?.entries) || report.entries.length === 0 || report?.summary?.targetCount !== report.entries.length) {
    throw new Error('Expected a complete non-empty elected-candidate review report');
  }
  const ids = new Set();
  for (const entry of report.entries) {
    if (!entry.candidate_id || !entry.person_id || ids.has(entry.candidate_id)) {
      throw new Error(`Invalid or duplicate candidate ID for ${entry.person_name ?? 'unknown'}`);
    }
    ids.add(entry.candidate_id);
    if (![2022, 2024].includes(entry.election_year) || entry.is_elected !== true || entry.election_result !== 'elected') {
      throw new Error(`Review entry is not a supported elected candidacy: ${entry.person_name}`);
    }
    const sourceUrl = new URL(entry.sourceDocument?.url ?? '');
    if (sourceUrl.protocol !== 'https:' || !officialBulletinHostnames.has(sourceUrl.hostname)
      || !/^[a-f0-9]{64}$/u.test(entry.sourceDocument?.sha256 ?? '')) {
      throw new Error(`Invalid official source evidence for ${entry.person_name}`);
    }
    const candidates = [
      entry.extraction.textLayer,
      entry.extraction.ocrText,
      entry.extraction.bestOcrText,
    ].filter((value) => String(value ?? '').trim());
    const extractionReady = entry.extraction?.status?.startsWith('ocr_ready')
      && entry.extraction.reviewStatus === 'private_manual_transcription_required';
    if (extractionReady && candidates.length === 0) throw new Error(`No transcription candidates for ${entry.person_name}`);
  }
  return report.entries;
}

function sanitizeExtractedText(value) {
  const text = String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, '');
  return text || null;
}

function buildPendingClaim(entry, candidateExternalId, canonicalPersonId = entry.person_id) {
  const electionYear = Number(entry.election_year ?? String(entry.election_name).match(/\d{4}/u)?.[0]);
  const exactCandidateMatch = entry.matchStatus !== 'matched_unique_path_name_unverified';
  const extractionReady = entry.extraction?.status?.startsWith('ocr_ready');
  return {
    claim_key: `cec-platform:${electionYear}:${candidateExternalId}`,
    person_id: canonicalPersonId,
    candidate_id: entry.candidate_id,
    claim_type: 'platform',
    claim_value: `${entry.election_name}公報政見（${extractionReady ? '待人工轉錄' : '待人工定位'}）`,
    claim_json: {
      electionContext: {
        candidateId: entry.candidate_id,
        raceId: entry.race_id,
        electionId: entry.election_id,
      },
      sourceDocument: {
        file: entry.sourceDocument.file,
        url: entry.sourceDocument.url,
        sha256: entry.sourceDocument.sha256,
        page: entry.extraction.crop?.page ?? 1,
        cropFile: entry.extraction.cropFile,
        layoutFile: entry.extraction.layoutFile ?? null,
        extractionMethod: entry.extraction.status,
      },
      transcriptionCandidates: {
        pdfTextLayer: sanitizeExtractedText(entry.extraction.textLayer),
        ocrText: sanitizeExtractedText(entry.extraction.ocrText),
        bestOcrText: sanitizeExtractedText(entry.extraction.bestOcrText),
      },
      publicationGate: {
        status: extractionReady ? 'pending_manual_transcription' : 'pending_manual_localization',
        reason: !extractionReady
          ? 'Official bulletin evidence is retained; candidate platform location still requires visual review'
          : exactCandidateMatch
            ? 'Official bulletin and exact elected candidacy are verified; platform text still requires visual transcription review'
            : 'Official district bulletin is verified; candidate name and platform text still require visual review',
      },
      phase: 1,
    },
    confidence_level: exactCandidateMatch ? 'B' : 'C',
    review_status: 'pending',
    visibility: 'private',
    source_name: `中央選舉委員會：${electionYear}年選舉公報`,
    source_url: entry.sourceDocument.url,
    observed_at: electionYear === 2024 ? '2024-01-13T00:00:00+08:00' : '2022-11-26T00:00:00+08:00',
    is_public: false,
    review_score: exactCandidateMatch ? (extractionReady ? 70 : 60) : (extractionReady ? 55 : 45),
    scoring_version: 'cec-elected-platform-review-v1',
    scoring_reasons: [
      'Central Election Commission election bulletin',
      exactCandidateMatch ? 'Exact elected candidate and race match' : 'District and candidacy match; name requires visual confirmation',
      extractionReady ? 'Private OCR candidates awaiting visual transcription review' : 'Private source evidence awaiting manual localization',
    ],
  };
}

function restHeaders(serviceRoleKey, prefer) {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    'content-type': 'application/json',
    ...(prefer ? { prefer } : {}),
  };
}

async function responseJson(response, label) {
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${label}: ${body?.message ?? response.statusText}`);
  return body;
}

async function fetchByCandidateIds(config, table, select, candidateIds, extraFilters = {}) {
  const rows = [];
  for (let index = 0; index < candidateIds.length; index += 100) {
    const ids = candidateIds.slice(index, index + 100);
    const url = new URL(`${config.supabaseUrl}/rest/v1/${table}`);
    url.searchParams.set('select', select);
    url.searchParams.set('id', `in.(${ids.join(',')})`);
    for (const [key, value] of Object.entries(extraFilters)) url.searchParams.set(key, value);
    rows.push(...await responseJson(await fetch(url, {
      headers: restHeaders(config.serviceRoleKey),
      signal: AbortSignal.timeout(30000),
    }), `Failed to fetch ${table}`));
  }
  return rows;
}

async function fetchPlatformClaims(config, candidateIds) {
  const rows = [];
  for (let index = 0; index < candidateIds.length; index += 100) {
    const ids = candidateIds.slice(index, index + 100);
    const url = new URL(`${config.supabaseUrl}/rest/v1/person_claims`);
    url.searchParams.set('select', 'id,candidate_id,claim_key,review_status,visibility,is_public');
    url.searchParams.set('candidate_id', `in.(${ids.join(',')})`);
    url.searchParams.set('claim_type', 'eq.platform');
    rows.push(...await responseJson(await fetch(url, {
      headers: restHeaders(config.serviceRoleKey),
      signal: AbortSignal.timeout(30000),
    }), 'Failed to fetch platform claims'));
  }
  return rows;
}

async function upsertClaims(config, rows) {
  const written = [];
  for (let index = 0; index < rows.length; index += 25) {
    const url = new URL(`${config.supabaseUrl}/rest/v1/person_claims`);
    url.searchParams.set('on_conflict', 'claim_key');
    written.push(...await responseJson(await fetch(url, {
      method: 'POST',
      headers: restHeaders(config.serviceRoleKey, 'resolution=merge-duplicates,return=representation'),
      body: JSON.stringify(rows.slice(index, index + 25)),
      signal: AbortSignal.timeout(30000),
    }), 'Failed to stage platform claims'));
  }
  return written;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = { ...readLocalEnv(), ...process.env };
  const config = {
    supabaseUrl: String(env.SUPABASE_URL ?? 'http://127.0.0.1:54321').replace(/\/$/u, ''),
    serviceRoleKey: String(env.SUPABASE_SERVICE_ROLE_KEY ?? ''),
  };
  assertLocalSupabase(config.supabaseUrl);
  if (!config.serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for local review staging');

  const report = JSON.parse(fs.readFileSync(options.inputPath, 'utf8'));
  const entries = validateReport(report);
  const candidateIds = entries.map((entry) => entry.candidate_id);
  const [candidates, existingBefore] = await Promise.all([
    fetchByCandidateIds(config, 'candidates', 'id,external_id,person_id', candidateIds),
    fetchPlatformClaims(config, candidateIds),
  ]);
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  if (candidateById.size !== entries.length) throw new Error(`Expected ${entries.length} local candidates, found ${candidateById.size}`);
  const existingCandidateIds = new Set(existingBefore.map((claim) => claim.candidate_id));
  const rows = entries
    .filter((entry) => !existingCandidateIds.has(entry.candidate_id))
    .map((entry) => {
      const candidate = candidateById.get(entry.candidate_id);
      if (!candidate.person_id || !candidate.external_id) throw new Error(`Incomplete local candidate identity for ${entry.person_name}`);
      return buildPendingClaim(entry, candidate.external_id, candidate.person_id);
    });
  const canonicalPersonRemapCount = entries.filter((entry) =>
    candidateById.get(entry.candidate_id)?.person_id !== entry.person_id).length;
  const staging = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceReport: path.relative(repoRoot, options.inputPath),
    summary: {
      targetCount: entries.length,
      existingScopedClaimCount: existingBefore.length,
      pendingInsertCount: rows.length,
      publicInsertCount: rows.filter((row) => row.is_public).length,
      canonicalPersonRemapCount,
    },
    claims: rows,
  };
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(staging, null, 2)}\n`);

  if (!options.applyLocal) {
    console.log(JSON.stringify({ ...staging.summary, applied: false }, null, 2));
    return;
  }
  await upsertClaims(config, rows);
  const existingAfter = await fetchPlatformClaims(config, candidateIds);
  const publicBefore = existingBefore.filter((claim) => claim.is_public).length;
  const publicAfter = existingAfter.filter((claim) => claim.is_public).length;
  const privatePendingBefore = existingBefore.filter((claim) =>
    claim.review_status === 'pending' && claim.visibility === 'private' && claim.is_public === false).length;
  const privatePendingAfter = existingAfter.filter((claim) =>
    claim.review_status === 'pending' && claim.visibility === 'private' && claim.is_public === false).length;
  if (existingAfter.length !== entries.length || publicAfter !== publicBefore
    || privatePendingAfter !== privatePendingBefore + rows.length) {
    throw new Error(`Local staging verification failed: total=${existingAfter.length}, public=${publicAfter}, privatePending=${privatePendingAfter}`);
  }
  console.log(JSON.stringify({
    ...staging.summary,
    applied: true,
    localScopedClaimCount: existingAfter.length,
    localPublicClaimCount: publicAfter,
    localPrivatePendingCount: privatePendingAfter,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { assertLocalSupabase, buildPendingClaim, parseArgs, sanitizeExtractedText, validateReport };
