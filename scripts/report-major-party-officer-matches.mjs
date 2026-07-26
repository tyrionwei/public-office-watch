#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function parseEnv(content) {
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^['"]|['"]$/g, '')];
      }),
  );
}

async function fetchPublicPeople(baseUrl, apiKey) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const url = new URL('/rest/v1/public_people_list_cached', baseUrl);
    url.searchParams.set('select', 'person_id,name,party,position,district');
    url.searchParams.set('limit', String(pageSize));
    url.searchParams.set('offset', String(offset));
    const response = await fetch(url, {
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Public people query failed (${response.status}): ${await response.text()}`);
    }
    const page = await response.json();
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function fetchRelatedRows(baseUrl, apiKey, viewName, personIds, select) {
  if (personIds.length === 0) return [];
  const url = new URL(`/rest/v1/${viewName}`, baseUrl);
  url.searchParams.set('select', select);
  url.searchParams.set('person_id', `in.(${personIds.join(',')})`);
  const response = await fetch(url, {
    headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`${viewName} query failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

async function main() {
  const root = process.cwd();
  const sourcePath = path.join(root, 'data-sources/major-parties/current-officers.json');
  const additionalSourcePath = path.join(root, 'data-sources/major-parties/additional-current-officers.json');
  const outputPath = path.join(root, 'data-sources/major-parties/officer-match-report.json');
  const envPath = path.join(root, 'apps/web/.env.local');
  const [source, additionalSource, envContent] = await Promise.all([
    fs.readFile(sourcePath, 'utf8').then(JSON.parse),
    fs.readFile(additionalSourcePath, 'utf8').then(JSON.parse),
    fs.readFile(envPath, 'utf8'),
  ]);
  source.officers.push(...additionalSource.officers);
  const env = parseEnv(envContent);
  const baseUrl = env.VITE_SUPABASE_URL;
  const apiKey = env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !apiKey) throw new Error('Local Supabase URL or public API key is missing');

  const people = await fetchPublicPeople(baseUrl, apiKey);
  const byName = new Map();
  for (const person of people) {
    const candidates = byName.get(person.name) ?? [];
    candidates.push(person);
    byName.set(person.name, candidates);
  }

  const matches = [...new Set(source.officers.map((officer) => officer.name))]
    .map((name) => {
      const candidates = byName.get(name) ?? [];
      return {
        name,
        match_status: candidates.length === 1 ? 'unique_name' : candidates.length > 1 ? 'ambiguous_name' : 'not_found',
        candidates,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-Hant'));

  const ambiguousPersonIds = matches
    .filter((item) => item.match_status === 'ambiguous_name')
    .flatMap((item) => item.candidates.map((candidate) => candidate.person_id));
  const [candidateRows, claimRows] = await Promise.all([
    fetchRelatedRows(
      baseUrl,
      apiKey,
      'public_candidates',
      ambiguousPersonIds,
      'person_id,election_name,election_year,race_title,party,candidate_no,election_result,source_name,source_url',
    ),
    fetchRelatedRows(
      baseUrl,
      apiKey,
      'public_person_claims',
      ambiguousPersonIds,
      'person_id,claim_type,claim_value,source_name,source_url',
    ),
  ]);
  for (const match of matches) {
    for (const candidate of match.candidates) {
      candidate.candidacies = candidateRows.filter((row) => row.person_id === candidate.person_id);
      candidate.claims = claimRows.filter((row) => row.person_id === candidate.person_id);
    }
  }

  const payload = {
    observed_date: source.observed_date,
    generated_at: new Date().toISOString(),
    summary: {
      unique_names: matches.length,
      unique_name_matches: matches.filter((item) => item.match_status === 'unique_name').length,
      ambiguous_name_matches: matches.filter((item) => item.match_status === 'ambiguous_name').length,
      not_found: matches.filter((item) => item.match_status === 'not_found').length,
    },
    matches,
  };
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(payload.summary));
  console.log(`Ambiguous: ${matches.filter((item) => item.match_status === 'ambiguous_name').map((item) => item.name).join('、') || 'none'}`);
  console.log(`Not found: ${matches.filter((item) => item.match_status === 'not_found').map((item) => item.name).join('、') || 'none'}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
