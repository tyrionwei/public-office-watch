import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultTargetPath = path.join(repoRoot, 'data-sources', 'person-profile-gap-targets.json');
const defaultOutputPath = path.join(repoRoot, 'data-sources', 'moi-township-mayor-profiles.seed.json');
const listUrl = 'https://www.moi.gov.tw/LocalOfficial.aspx?PageSize=1000&TYP=KND0006&n=580&page=1&sms=11400';
const sourceId = 'moi-official-officer-township-mayors';
const sourceName = '內政部地方公職人員資訊專區：鄉鎮市長';

function parseArgs(argv) {
  const options = {
    targetPath: defaultTargetPath,
    outputPath: defaultOutputPath,
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--targets') {
      options.targetPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
    } else if (arg === '--output') {
      options.outputPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
    } else if (arg === '--write') {
      options.write = true;
    } else {
      throw new Error(`Unsupported argument: ${arg}`);
    }
  }

  return options;
}

function decodeHtml(value) {
  return String(value ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&nbsp;', ' ');
}

function stripHtml(value) {
  return decodeHtml(String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/臺/g, '台')
    .replace(/[\s　·．・‧,，.。:：;；!！?？()（）\[\]【】「」『』\/]/g, '')
    .toLowerCase();
}

function normalizeParty(value) {
  const party = String(value ?? '').trim();
  if (!party || party === '無' || party === '無黨') return '無黨籍';
  return party;
}

function hashId(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 12);
}

function extractField(html, label) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(html ?? '').match(new RegExp(
    `<div class="essay">\\s*<div class="caption">${escapedLabel}</div>\\s*<div class="p">([\\s\\S]*?)</div>\\s*</div>`,
    'i',
  ));
  return stripHtml(match?.[1]);
}

function parseListCards(html) {
  return String(html ?? '')
    .split(/<div class="block">/i)
    .slice(1)
    .map((block) => {
      const name = stripHtml(block.match(/<div class="caption">\s*<span>([\s\S]*?)<\/span>/i)?.[1]);
      const region = stripHtml(block.match(/<div class="locate">\s*<span>([\s\S]*?)<\/span>/i)?.[1]);
      const party = normalizeParty(stripHtml(block.match(/<div class="group">\s*<span>([\s\S]*?)<\/span>/i)?.[1]));
      const href = decodeHtml(block.match(/href="([^"]*LocalOfficial_Content\.aspx[^"]*)"/i)?.[1]);
      if (!name || !region || !href) return null;
      const sourceUrl = new URL(href, 'https://www.moi.gov.tw').toString();
      return {
        name,
        region,
        party,
        sourceUrl,
        externalId: new URL(sourceUrl).searchParams.get('_PARENT_ID'),
      };
    })
    .filter(Boolean);
}

function parseProfileDetail(html) {
  return {
    electionTerm: extractField(html, '選舉屆次'),
    education: extractField(html, '學歷'),
    experience: extractField(html, '簡歷'),
  };
}

function targetRegion(target) {
  const text = String(target.currentOfficeLabel ?? target.position ?? target.district ?? '');
  return text.match(/^(.+?[縣市])/u)?.[1]?.replaceAll('臺', '台') ?? '';
}

function isTownshipMayorTarget(target) {
  const position = String(target.currentOfficeLabel ?? target.position ?? '');
  return target.listStatus === 'current' && /[鄉鎮市]長/u.test(position) && !/縣長|直轄市長/u.test(position);
}

function loadTargets(targetPath) {
  const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  const targets = Array.isArray(parsed) ? parsed : parsed.targets ?? parsed.people ?? [];
  if (!Array.isArray(targets)) throw new Error('Target file must contain an array or targets array.');
  return targets.filter(isTownshipMayorTarget);
}

function matchTargets(cards, targets) {
  const matches = [];
  const unmatchedTargets = [];

  for (const target of targets) {
    const expectedRegion = normalizeText(targetRegion(target));
    const candidates = cards.filter((card) => (
      normalizeText(card.name) === normalizeText(target.name) &&
      normalizeText(card.region) === expectedRegion
    ));

    if (candidates.length !== 1) {
      unmatchedTargets.push({
        personId: target.personId,
        name: target.name,
        region: targetRegion(target),
        candidateCount: candidates.length,
      });
      continue;
    }

    matches.push({ target, card: candidates[0] });
  }

  return { matches, unmatchedTargets };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html',
      'user-agent': 'PublicOfficeWatch/1.0 official-source-adapter',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const body = await response.text();
  if (body.length < 500) throw new Error(`${url}: unexpectedly short response`);
  return body;
}

function claimRecord(match, claimType, claimValue) {
  const { target, card } = match;
  return {
    claimKey: `official-profile:${sourceId}:${hashId(card.externalId)}:${target.personId}:${claimType}`,
    personId: target.personId,
    personName: target.name,
    claimType,
    claimValue,
    claimJson: {
      value: claimValue,
      officialExternalId: card.externalId,
      officeTitle: target.currentOfficeLabel || target.position,
      district: target.district,
      identityMatch: {
        status: 'matched',
        method: 'exact_name_region_current_office',
        score: 100,
        reasons: ['name matched', 'region matched', 'current township mayor role matched'],
      },
    },
    confidenceLevel: 'A',
    reviewStatus: 'verified',
    visibility: 'public',
    sourceId,
    sourceName,
    sourceUrl: card.sourceUrl,
  };
}

function claimsForMatch(match) {
  const fields = [
    ['party', match.card.party],
    ['education', match.education],
    ['experience', match.experience],
    ['external_id', `${sourceId}:${match.card.externalId}`],
  ];
  return fields
    .filter(([, value]) => value)
    .map(([claimType, claimValue]) => claimRecord(match, claimType, claimValue));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const targets = loadTargets(options.targetPath);
  const cards = parseListCards(await fetchText(listUrl));
  const { matches, unmatchedTargets } = matchTargets(cards, targets);
  const enrichedMatches = [];
  const skippedRows = [];

  for (const match of matches) {
    try {
      const detail = parseProfileDetail(await fetchText(match.card.sourceUrl));
      enrichedMatches.push({ ...match, ...detail });
    } catch (error) {
      skippedRows.push({
        personId: match.target.personId,
        name: match.target.name,
        sourceUrl: match.card.sourceUrl,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const personClaims = enrichedMatches.flatMap(claimsForMatch);
  const output = {
    schemaVersion: 1,
    name: 'moi-township-mayor-profiles',
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: 'Current township/city mayors matched to the MOI official directory by exact normalized name, county/city, and current office role.',
    sources: [{ id: sourceId, name: sourceName, url: listUrl }],
    summary: {
      listProfiles: cards.length,
      targetCount: targets.length,
      matchedRows: enrichedMatches.length,
      unmatchedRows: unmatchedTargets.length,
      skippedRows: skippedRows.length,
      claims: personClaims.length,
    },
    unmatchedRows: unmatchedTargets,
    skippedRows,
    personClaims,
  };

  if (options.write) {
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, `${JSON.stringify(output, null, 2)}\n`);
  }

  console.log(JSON.stringify({
    status: options.write ? 'written' : 'dry-run',
    outputPath: options.outputPath,
    summary: output.summary,
  }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

export {
  matchTargets,
  parseListCards,
  parseProfileDetail,
  targetRegion,
};
