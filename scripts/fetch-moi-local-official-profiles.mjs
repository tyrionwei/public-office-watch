import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(repoRoot, 'data-sources', 'tnl-dark-guide');
const outputPath = path.join(dataDir, 'moi-local-official-profiles.json');
const listUrl = 'https://www.moi.gov.tw/LocalOfficial.aspx?PageSize=1000&TYP=KND0001&n=573&page=1&sms=11400';
const requestDelayMs = 400;

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

function profileKey(name, city) {
  const normalizedName = normalizeText(name);
  const normalizedCity = normalizeText(city);
  return normalizedName && normalizedCity ? `${normalizedName}|${normalizedCity}` : null;
}

export function parseListCards(html) {
  return String(html ?? '')
    .split(/<div class="block">/i)
    .slice(1)
    .map((block) => {
      const name = stripHtml(block.match(/<div class="caption">\s*<span>([\s\S]*?)<\/span>/i)?.[1]);
      const city = stripHtml(block.match(/<div class="locate">\s*<span>([\s\S]*?)<\/span>/i)?.[1]);
      const party = stripHtml(block.match(/<div class="group">\s*<span>([\s\S]*?)<\/span>/i)?.[1]);
      const href = decodeHtml(block.match(/href="([^"]*LocalOfficial_Content\.aspx[^"]*)"/i)?.[1]);
      if (!name || !city || !href) return null;
      return {
        name,
        city,
        party,
        sourceUrl: new URL(href, 'https://www.moi.gov.tw').toString(),
      };
    })
    .filter(Boolean);
}

function extractField(html, label) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(html ?? '').match(new RegExp(
    `<div class="essay">\\s*<div class="caption">${escapedLabel}</div>\\s*<div class="p">([\\s\\S]*?)</div>\\s*</div>`,
    'i',
  ));
  return stripHtml(match?.[1]);
}

export function parseProfileDetail(html) {
  return {
    electionTerm: extractField(html, '選舉屆次'),
    education: extractField(html, '學歷'),
    experience: extractField(html, '簡歷'),
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html',
      'user-agent': 'PublicOfficeWatchResearch/1.0 (low-rate public-source verification)',
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

function guideProfileKeys() {
  const guideIdsByKey = new Map();
  for (const year of [2018, 2022]) {
    const dataset = JSON.parse(fs.readFileSync(
      path.join(dataDir, `tnl-dark-guide-${year}.json`),
      'utf8',
    ));
    for (const candidate of dataset.candidates) {
      const key = profileKey(candidate.name, candidate.city);
      if (!key) continue;
      const guideIds = guideIdsByKey.get(key) ?? [];
      guideIds.push(candidate.id);
      guideIdsByKey.set(key, guideIds);
    }
  }
  return guideIdsByKey;
}

async function main() {
  const guideIdsByKey = guideProfileKeys();
  const cards = parseListCards(await fetchText(listUrl));
  const matchedCards = cards.filter((card) => guideIdsByKey.has(profileKey(card.name, card.city)));
  const profiles = [];

  for (let index = 0; index < matchedCards.length; index += 1) {
    const card = matchedCards[index];
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, requestDelayMs));
    const detail = parseProfileDetail(await fetchText(card.sourceUrl));
    profiles.push({
      ...card,
      ...detail,
      mappingMode: 'exact_name_city',
      guideIds: guideIdsByKey.get(profileKey(card.name, card.city)),
    });
    if ((index + 1) % 25 === 0 || index + 1 === matchedCards.length) {
      console.log(`Fetched ${index + 1}/${matchedCards.length} matched MOI profiles`);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    sourceName: '內政部地方公職人員資訊專區',
    sourceUrl: listUrl,
    method: {
      scope: 'Current metropolitan councilors whose exact normalized name and city match a 2018 or 2022 Dark Guide candidate.',
      identityRule: 'Exact normalized name plus city only; no same-name inference across cities.',
      requestPolicy: `One request at a time with at least ${requestDelayMs} ms between profile pages.`,
      reviewPolicy: 'Education and experience are public official-profile text but remain manual-review evidence, not automatic approval.',
    },
    summary: {
      listProfiles: cards.length,
      matchedProfiles: profiles.length,
      coveredGuideRows: new Set(profiles.flatMap((profile) => profile.guideIds)).size,
      duplicateProfileKeys: cards.length - new Set(cards.map((card) => profileKey(card.name, card.city))).size,
    },
    profiles,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report.summary, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
