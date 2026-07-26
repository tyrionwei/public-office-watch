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
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
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

function currentPartyRoles(records) {
  return [...new Set(
    records
      .flatMap((record) => record.experience ?? [])
      .filter((item) => /[（(]現職[）)]/.test(item))
      .map((item) => item.replace(/[（(]現職[）)]/g, '').trim()),
  )];
}

async function main() {
  const root = process.cwd();
  const sourcePath = path.join(root, 'data-sources/tpp/extracted-members.json');
  const outputPath = path.join(root, 'data-sources/tpp/member-match-report.json');
  const envPath = path.join(root, 'apps/web/.env.local');
  const [source, envContent] = await Promise.all([
    fs.readFile(sourcePath, 'utf8').then(JSON.parse),
    fs.readFile(envPath, 'utf8'),
  ]);
  const env = parseEnv(envContent);
  const baseUrl = env.VITE_SUPABASE_URL;
  const apiKey = env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !apiKey) throw new Error('Local Supabase URL or public API key is missing from apps/web/.env.local');

  const people = await fetchPublicPeople(baseUrl, apiKey);
  const peopleByName = new Map();
  for (const person of people) {
    const matches = peopleByName.get(person.name) ?? [];
    matches.push(person);
    peopleByName.set(person.name, matches);
  }

  const recordsByName = new Map();
  for (const record of source.records) {
    const records = recordsByName.get(record.name) ?? [];
    records.push(record);
    recordsByName.set(record.name, records);
  }

  const matches = [...recordsByName.entries()]
    .map(([name, records]) => {
      const candidates = peopleByName.get(name) ?? [];
      return {
        name,
        categories: [...new Set(records.map((record) => record.category))],
        role_groups: [...new Set(records.map((record) => record.role_group))],
        current_party_roles: currentPartyRoles(records),
        education: [...new Set(records.flatMap((record) => record.education ?? []))],
        experience: [...new Set(records.flatMap((record) => record.experience ?? []))],
        source_urls: [...new Set(records.map((record) => record.source_person_url).filter(Boolean))],
        match_status: candidates.length === 1 ? 'unique_name' : candidates.length > 1 ? 'ambiguous_name' : 'not_found',
        candidates,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-Hant'));

  const payload = {
    source_name: source.source_name,
    observed_date: source.observed_date,
    generated_at: new Date().toISOString(),
    summary: {
      source_records: source.records.length,
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
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
