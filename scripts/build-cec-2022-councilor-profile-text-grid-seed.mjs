import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const sourceId = 'cec-2022-councilor-election-bulletins';
const sourceName = '中央選舉委員會：2022年縣市議員選舉公報';
const sourceUrl = 'https://bulletin.cec.gov.tw/';
const officialHosts = new Set(['bulletin.cec.gov.tw', 'eebulletin.cec.gov.tw']);

function parseArgs(argv) {
  const options = { inputPath: null, gapPath: null, outputPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') options.inputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--gap-report') options.gapPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  for (const [label, file] of [['input', options.inputPath], ['gap report', options.gapPath]]) {
    if (!file || !fs.existsSync(file)) throw new Error(`Missing ${label}: ${file ?? ''}`);
  }
  if (!options.outputPath) throw new Error('--output is required');
  return options;
}

function claimFor(entry, claimType, claimValue) {
  return {
    claimKey: `official-profile:${sourceId}:${entry.candidateId}:${claimType}`,
    personId: entry.personId,
    personName: entry.personName,
    claimType,
    claimValue,
    claimJson: {
      value: claimValue,
      items: [claimValue],
      profileSource: 'cec_election_bulletin',
      electionYear: 2022,
      raceTitle: entry.raceTitle,
      candidateId: entry.candidateId,
      electionParty: entry.ocr.electionPartyRaw ?? null,
      sourceDocument: {
        sha256: entry.sourceDocument.sha256,
        page: entry.ocr.page,
      },
      publicationGate: {
        status: 'passed',
        reason: 'Official CEC PDF text grid matched the exact candidate name, candidate number, and election race.',
      },
    },
    confidenceLevel: 'A',
    reviewStatus: 'verified',
    visibility: 'public',
    sourceId,
    sourceName,
    sourceUrl: entry.sourceDocument.url,
    observedAt: '2022-11-26T00:00:00+08:00',
  };
}

function buildSeed(report, gapReport) {
  if (!Array.isArray(report?.entries) || report.entries.length !== report?.summary?.targetCount) {
    throw new Error('Expected a complete CEC profile review report');
  }
  const missingByPerson = new Map((gapReport.entries ?? []).map((entry) => [
    entry.personId,
    new Set(entry.missingFields.map((field) => field.field)),
  ]));
  const eligible = report.entries.filter((entry) =>
    entry.ocr?.status === 'ocr_ready_private_review'
    && entry.ocr.geometrySource === 'official_pdf_text_layer_grid'
    && entry.ocr.publicationAssessment?.reasons?.some((reason) =>
      ['exact_name_and_candidate_number_revalidated', 'exact_han_name_and_candidate_number_revalidated'].includes(reason)));
  const personClaims = eligible.flatMap((entry) => {
    const source = new URL(entry.sourceDocument?.url ?? '');
    if (source.protocol !== 'https:' || !officialHosts.has(source.hostname)
      || !/^[a-f0-9]{64}$/u.test(entry.sourceDocument?.sha256 ?? '')) {
      throw new Error(`Invalid official evidence for ${entry.personName}`);
    }
    const missing = missingByPerson.get(entry.personId) ?? new Set();
    return ['education', 'experience']
      .filter((claimType) => missing.has(claimType) && String(entry.ocr[claimType] ?? '').trim())
      .map((claimType) => claimFor(entry, claimType, entry.ocr[claimType]));
  });
  const selectedPersonCount = new Set(personClaims.map((claim) => claim.personId)).size;
  const summary = {
    safeExtractedCount: selectedPersonCount,
    selectedPersonCount,
    selectedClaimCount: personClaims.length,
    educationCount: personClaims.filter((claim) => claim.claimType === 'education').length,
    experienceCount: personClaims.filter((claim) => claim.claimType === 'experience').length,
  };
  return {
    schemaVersion: 1,
    name: 'cec-2022-councilor-bulletin-text-grid-profile-claims',
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: 'Exact official CEC PDF text-grid profile fields selected only for currently missing 2022 councilor education and experience coverage.',
    sources: [{ id: sourceId, name: sourceName, url: sourceUrl, confidenceLevel: 'A' }],
    summary,
    personClaims,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = JSON.parse(fs.readFileSync(options.inputPath, 'utf8'));
  const gapReport = JSON.parse(fs.readFileSync(options.gapPath, 'utf8'));
  const seed = buildSeed(report, gapReport);
  if (seed.personClaims.length === 0) throw new Error('No exact text-grid profile claims selected');
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(seed, null, 2)}\n`);
  console.log(JSON.stringify(seed.summary, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export { buildSeed, claimFor, parseArgs };
