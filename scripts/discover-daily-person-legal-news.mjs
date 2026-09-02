import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parseRssItems, validateManifest } from './discover-daily-person-news.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultManifestPath = path.join(repoRoot, 'data-sources', 'daily-person-news-monitor.json');
const defaultInputPath = path.join(repoRoot, 'tmp', 'daily-person-enrichment-targets.json');
const defaultOutputPath = path.join(repoRoot, 'tmp', 'daily-person-legal-news.json');

const historicalLegalTerms = [
  '貪污', '收賄', '行賄', '賄選', '洗錢', '詐欺', '詐領', '侵占', '背信', '圖利',
  '偽造文書', '違反選罷法', '違反政治獻金法', '洩密', '瀆職',
];

const historicalProcedureTerms = [
  '聲押', '羈押', '交保', '起訴', '判刑', '有罪', '無罪', '定讞',
];

const roleTerms = [
  '總統', '副總統', '行政院長', '立法委員', '立委', '市長', '縣長', '議員',
  '鄉長', '鎮長', '區長', '代表', '里長', '村長',
];

const familyRelationTerms = [
  '配偶', '丈夫', '妻子', '父親', '母親', '兒子', '女兒', '子女', '兄弟', '姊妹', '姐妹', '家族',
];

const researchCategoryKeys = ['family_relation', 'party_affiliation', 'legal_case'];

function parseArgs(argv) {
  const options = {
    manifestPath: defaultManifestPath,
    inputPath: defaultInputPath,
    outputPath: defaultOutputPath,
    offset: 0,
    maxPeople: 25,
    maxResultsPerPerson: 10,
    requestDelayMs: 1000,
    categories: ['legal_case'],
    lookbackDays: 30,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--manifest') options.manifestPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--input') options.inputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--offset') options.offset = Number.parseInt(argv[++index] ?? '', 10);
    else if (arg === '--max-people') options.maxPeople = Number.parseInt(argv[++index] ?? '', 10);
    else if (arg === '--max-results-per-person') options.maxResultsPerPerson = Number.parseInt(argv[++index] ?? '', 10);
    else if (arg === '--request-delay-ms') options.requestDelayMs = Number.parseInt(argv[++index] ?? '', 10);
    else if (arg === '--categories') options.categories = String(argv[++index] ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    else if (arg === '--lookback-days') options.lookbackDays = Number.parseInt(argv[++index] ?? '', 10);
    else throw new Error(`Unsupported argument: ${arg}`);
  }

  for (const [key, value] of Object.entries({
    '--max-people': options.maxPeople,
    '--max-results-per-person': options.maxResultsPerPerson,
  })) {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${key} must be a positive number`);
  }
  if (!Number.isFinite(options.offset) || options.offset < 0) throw new Error('--offset must be zero or positive');
  if (!Number.isFinite(options.requestDelayMs) || options.requestDelayMs < 0) {
    throw new Error('--request-delay-ms must be zero or positive');
  }
  if (!Number.isInteger(options.lookbackDays) || options.lookbackDays <= 0) {
    throw new Error('--lookback-days must be a positive integer');
  }
  if (options.categories.length === 0 || options.categories.some((category) => !researchCategoryKeys.includes(category))) {
    throw new Error(`--categories must contain only: ${researchCategoryKeys.join(', ')}`);
  }

  return options;
}

function normalize(value) {
  return String(value ?? '').normalize('NFKC').replaceAll('臺', '台').replace(/\s+/g, '');
}

function targetFromRecord(record) {
  const value = record?.target ?? record;
  if (!value || typeof value !== 'object') return null;
  const name = String(value.name ?? value.personName ?? '').trim();
  if (!name) return null;
  return {
    personId: value.personId ?? value.person_id ?? null,
    name,
    party: String(value.party ?? '').trim(),
    position: String(value.position ?? value.currentOfficeLabel ?? '').trim(),
    district: String(value.district ?? '').trim(),
    experience: String(value.experience ?? '').trim(),
    collectionMode: value.collectionMode === 'recurring_monitor' ? 'recurring_monitor' : 'historical_backfill',
    researchLookbackDays: Number.isInteger(value.researchLookbackDays) && value.researchLookbackDays > 0
      ? value.researchLookbackDays
      : null,
  };
}

function loadTargets(filePath, offset, maxPeople) {
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const records = Array.isArray(payload)
    ? payload
    : payload.targets ?? payload.people ?? payload.names;
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('Daily legal-news input must contain a non-empty target array');
  }
  return records.map(targetFromRecord).filter(Boolean).slice(offset, offset + maxPeople);
}

function legalTermsFromManifest(manifest) {
  const legalCategory = manifest.categories.find((category) => category.key === 'legal_procedure');
  if (!legalCategory) throw new Error('Daily news manifest must contain legal_procedure');
  return Array.from(new Set([
    ...historicalLegalTerms,
    ...historicalProcedureTerms,
  ]));
}

function researchDefinitions(manifest) {
  const partyCategory = manifest.categories.find((category) => category.key === 'party_affiliation');
  if (!partyCategory) throw new Error('Daily news manifest must contain party_affiliation');
  return {
    family_relation: {
      label: '家族關係',
      terms: familyRelationTerms,
      nextAction: 'confirm the relationship and identity with an official profile, direct statement, or trusted reporting',
    },
    party_affiliation: {
      label: '黨籍異動',
      terms: Array.from(new Set([...partyCategory.queryTerms, ...partyCategory.eventTerms, '入黨'])),
      nextAction: 'confirm formal membership and dates with party, election authority, direct statement, or trusted reporting',
    },
    legal_case: {
      label: '司法線索',
      terms: legalTermsFromManifest(manifest),
      nextAction: 'confirm identity and event details, then search official Judicial Yuan criminal judgments from the event year onward',
    },
  };
}

export function buildPersonResearchFeedUrl(feed, target, terms, lookbackDays = null) {
  const url = new URL(feed.baseUrl);
  const timeLimit = Number.isInteger(lookbackDays) && lookbackDays > 0 ? ` when:${lookbackDays}d` : '';
  url.searchParams.set('q', `"${target.name}" (${terms.join(' OR ')})${timeLimit}`);
  url.searchParams.set('hl', feed.language);
  url.searchParams.set('gl', feed.country);
  url.searchParams.set('ceid', feed.edition);
  return url.toString();
}

export function buildPersonLegalFeedUrl(feed, target, legalTerms) {
  return buildPersonResearchFeedUrl(feed, target, legalTerms);
}

function contextTermsFor(target) {
  const fields = [target.party, target.position, target.district, target.experience];
  const normalizedFields = fields.map(normalize).filter(Boolean);
  const explicit = fields
    .flatMap((field) => String(field).split(/[;；,，、／/()（）]/))
    .map(normalize)
    .filter((term) => term.length >= 2 && term.length <= 20);
  const roles = roleTerms.filter((role) => normalizedFields.some((field) => field.includes(normalize(role))));
  return Array.from(new Set([...explicit, ...roles]));
}

function yearHints(value) {
  const text = String(value ?? '');
  const years = new Set(Array.from(text.matchAll(/\b(?:19|20)\d{2}\b/g), (match) => Number(match[0])));
  for (const match of text.matchAll(/民國\s*(\d{2,3})\s*年/g)) {
    const rocYear = Number(match[1]);
    if (rocYear > 0) years.add(rocYear + 1911);
  }
  return Array.from(years).sort((left, right) => left - right);
}

function hashKey(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
}

export function directLegalSubjectMatch(title, personName, matchedTerms) {
  const normalizedTitle = normalize(title);
  const normalizedName = normalize(personName);
  if (!normalizedName) return false;

  const nameIndexes = [];
  for (let index = normalizedTitle.indexOf(normalizedName); index >= 0; index = normalizedTitle.indexOf(normalizedName, index + 1)) {
    nameIndexes.push(index);
  }

  for (const nameIndex of nameIndexes) {
    const nameEnd = nameIndex + normalizedName.length;
    for (const rawTerm of matchedTerms) {
      const term = normalize(rawTerm);
      for (let termIndex = normalizedTitle.indexOf(term); termIndex >= 0; termIndex = normalizedTitle.indexOf(term, termIndex + 1)) {
        const termEnd = termIndex + term.length;
        const gap = termIndex >= nameEnd
          ? normalizedTitle.slice(nameEnd, termIndex)
          : normalizedTitle.slice(termEnd, nameIndex);
        if (gap.length <= 6 && !/[，。；：？！?!]/u.test(gap)) return true;
      }
    }
  }

  return false;
}

export function buildPersonResearchLeads({
  target,
  items,
  category,
  categoryLabel,
  terms,
  nextAction,
  trustedPublishers,
  maxResultsPerPerson = 10,
  timeScope = 'historical_backfill',
}) {
  const normalizedName = normalize(target.name);
  const contextTerms = contextTermsFor(target);
  const trusted = new Set(trustedPublishers.map(normalize));
  const leads = [];

  for (const item of items) {
    const searchable = normalize(`${item.title}\n${item.summary}`);
    if (!searchable.includes(normalizedName)) continue;
    const matchedTerms = terms.filter((term) => searchable.includes(normalize(term)));
    if (matchedTerms.length === 0) continue;
    if (!directLegalSubjectMatch(item.title, target.name, matchedTerms)) continue;
    const matchedContextTerms = contextTerms.filter((term) => searchable.includes(normalize(term)));
    const publisherTrusted = trusted.has(normalize(item.publisherName));
    const publishedTime = Date.parse(item.publishedAt);
    const identityStatus = matchedContextTerms.length > 0
      ? 'context_supported'
      : 'name_only_requires_review';

    leads.push({
      leadKey: `daily-person-research-news:${hashKey(`${target.personId ?? normalizedName}|${category}|${item.url}`)}`,
      personId: target.personId,
      personName: target.name,
      category,
      categoryLabel,
      timeScope,
      headline: item.title,
      sourceUrl: item.url,
      publisherName: item.publisherName || null,
      publisherUrl: item.publisherUrl || null,
      publishedAt: Number.isFinite(publishedTime) ? new Date(publishedTime).toISOString() : null,
      matchedTerms,
      matchedContextTerms,
      mentionedYears: yearHints(`${item.title}\n${item.summary}`),
      identityStatus,
      sourceQuality: publisherTrusted ? 'B' : 'C',
      matchScore: Math.min(90, 50 + (publisherTrusted ? 15 : 0) + (matchedContextTerms.length > 0 ? 20 : 0)),
      reviewStatus: 'pending',
      visibility: 'review_only',
      reviewRoute: 'codex_identity_review',
      manualReviewRequired: false,
      autoPublish: false,
      nextAction,
    });
  }

  return Array.from(new Map(leads.map((lead) => [lead.leadKey, lead])).values())
    .sort((left, right) => String(right.publishedAt).localeCompare(String(left.publishedAt)))
    .slice(0, maxResultsPerPerson);
}

export function buildPersonLegalLeads({
  target,
  items,
  legalTerms,
  trustedPublishers,
  maxResultsPerPerson = 10,
}) {
  return buildPersonResearchLeads({
    target,
    items,
    category: 'legal_case',
    categoryLabel: '司法線索',
    terms: legalTerms,
    nextAction: 'confirm identity and event details, then search official Judicial Yuan criminal judgments from the event year onward',
    trustedPublishers,
    maxResultsPerPerson,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchFeed(feedUrl) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(feedUrl, {
        headers: { 'user-agent': 'PublicOfficeWatch/1.0 (+historical legal-news lead monitor)' },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`News feed returned HTTP ${response.status}`);
      return parseRssItems(await response.text());
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = validateManifest(JSON.parse(fs.readFileSync(options.manifestPath, 'utf8')));
  const targets = loadTargets(options.inputPath, options.offset, options.maxPeople);
  const definitions = researchDefinitions(manifest);
  const selectedCategories = options.categories.map((category) => [category, definitions[category]]);
  const fetchedAt = new Date();
  const leads = [];
  const results = [];
  let fetchedArticleCount = 0;

  let requestIndex = 0;
  for (const target of targets) {
    for (const [category, definition] of selectedCategories) {
      const historical = target.collectionMode === 'historical_backfill';
      const lookbackDays = historical
        ? null
        : Math.max(options.lookbackDays, target.researchLookbackDays ?? options.lookbackDays);
      const timeScope = historical ? 'historical_backfill' : `recent_${lookbackDays}_days`;
      const feedUrl = buildPersonResearchFeedUrl(
        manifest.feed,
        target,
        definition.terms,
        lookbackDays,
      );
      if (requestIndex > 0 && options.requestDelayMs > 0) await sleep(options.requestDelayMs);
      requestIndex += 1;
      try {
        const items = await fetchFeed(feedUrl);
        fetchedArticleCount += items.length;
        const targetLeads = buildPersonResearchLeads({
          target,
          items,
          category,
          categoryLabel: definition.label,
          terms: definition.terms,
          nextAction: definition.nextAction,
          trustedPublishers: manifest.trustedPublishers,
          maxResultsPerPerson: options.maxResultsPerPerson,
          timeScope,
        });
        leads.push(...targetLeads);
        results.push({
          personId: target.personId,
          personName: target.name,
          category,
          collectionMode: target.collectionMode,
          timeScope,
          lookbackDays,
          status: targetLeads.length > 0 ? 'leads_found' : 'no_leads',
          fetchedArticleCount: items.length,
          leadCount: targetLeads.length,
        });
      } catch (error) {
        results.push({
          personId: target.personId,
          personName: target.name,
          category,
          collectionMode: target.collectionMode,
          timeScope,
          lookbackDays,
          status: 'source_error',
          fetchedArticleCount: 0,
          leadCount: 0,
          reason: error instanceof Error ? error.message : String(error),
          feedUrl,
        });
      }
    }
  }

  const sourceErrorCount = results.filter((result) => result.status === 'source_error').length;
  const report = {
    schemaVersion: 2,
    fetchedAt: fetchedAt.toISOString(),
    status: sourceErrorCount === 0 ? 'ok' : sourceErrorCount < results.length ? 'partial' : 'failed',
    scope: 'daily ordered person family, party, and legal research news',
    targetCount: targets.length,
    categoryCount: selectedCategories.length,
    minimumRecurringLookbackDays: options.lookbackDays,
    fetchedArticleCount,
    leadCount: leads.length,
    sourceErrorCount,
    results,
    leads,
    reviewPolicy: {
      privateOnly: true,
      nameOnlyMatchIsInsufficient: true,
      officialJudgmentSearchRequiresConcreteClue: true,
      autoPublish: false,
    },
  };

  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(report, null, 2)}\n`);
  const outcomeCounts = Object.fromEntries(
    Array.from(new Set(results.map((result) => result.status)))
      .map((status) => [status, results.filter((result) => result.status === status).length]),
  );
  console.log(JSON.stringify({
    status: report.status,
    targetCount: report.targetCount,
    fetchedArticleCount: report.fetchedArticleCount,
    leadCount: report.leadCount,
    sourceErrorCount: report.sourceErrorCount,
    outcomeCounts,
    outputPath: options.outputPath,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
