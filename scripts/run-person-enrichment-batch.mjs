import { spawn } from 'node:child_process';

const localSupabaseUrl = process.env.SUPABASE_URL?.trim() || 'http://127.0.0.1:54321';
const localAnonKey = process.env.SUPABASE_ANON_KEY?.trim() || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const localServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || 'REDACTED_SUPABASE_SERVICE_ROLE_KEY';
const wikidataSourceName = 'Wikidata 人物補充資料';

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      ...options,
      env: {
        ...process.env,
        ...options.env,
      },
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

async function countRows(viewName, sourceName) {
  const url = new URL(`${localSupabaseUrl.replace(/\/$/, '')}/rest/v1/${viewName}`);
  url.searchParams.set('select', 'claim_id');
  url.searchParams.set('source_name', `eq.${sourceName}`);

  const response = await fetch(url, {
    method: 'HEAD',
    headers: {
      apikey: localAnonKey,
      authorization: `Bearer ${localAnonKey}`,
      prefer: 'count=exact',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Failed to count ${viewName}: ${response.status} ${response.statusText}`);
  }

  const range = response.headers.get('content-range') ?? '';
  const total = range.split('/')[1];
  return total === '*' || total === undefined ? 0 : Number.parseInt(total, 10);
}

async function countRowsByClaimType(viewName, sourceName, claimType) {
  const url = new URL(`${localSupabaseUrl.replace(/\/$/, '')}/rest/v1/${viewName}`);
  url.searchParams.set('select', 'claim_id');
  url.searchParams.set('source_name', `eq.${sourceName}`);
  url.searchParams.set('claim_type', `eq.${claimType}`);

  const response = await fetch(url, {
    method: 'HEAD',
    headers: {
      apikey: localAnonKey,
      authorization: `Bearer ${localAnonKey}`,
      prefer: 'count=exact',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Failed to count ${viewName}/${claimType}: ${response.status} ${response.statusText}`);
  }

  const range = response.headers.get('content-range') ?? '';
  const total = range.split('/')[1];
  return total === '*' || total === undefined ? 0 : Number.parseInt(total, 10);
}

function taipeiHour() {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Taipei',
      hour: '2-digit',
      hour12: false,
    }).format(new Date()),
  );
}

async function maybeFetchJudicialLeads() {
  const user = process.env.JUDICIAL_OPEN_DATA_USER?.trim();
  const password = process.env.JUDICIAL_OPEN_DATA_PASSWORD?.trim();

  if (!user || !password) {
    return { status: 'skipped', reason: 'missing judicial credentials' };
  }

  const hour = taipeiHour();
  if (hour < 0 || hour >= 6) {
    return { status: 'skipped', reason: 'outside judicial API service window' };
  }

  await run('npm', ['run', 'fetch:judicial-legal-leads', '--', '--target-names-from-supabase', '--max-docs', '50'], {
    env: {
      SUPABASE_URL: localSupabaseUrl,
      SUPABASE_ANON_KEY: localAnonKey,
      JUDICIAL_OPEN_DATA_USER: user,
      JUDICIAL_OPEN_DATA_PASSWORD: password,
    },
  });
  await run('npm', ['run', 'sync:legal-leads:write'], {
    env: {
      SUPABASE_URL: localSupabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: localServiceRoleKey,
    },
  });

  return { status: 'ok' };
}

async function main() {
  const beforeReviewCount = await countRows('person_claim_review_queue', wikidataSourceName);
  const beforePublicCount = await countRows('public_person_claims', wikidataSourceName);

  await run('npm', ['run', 'fetch:wikidata-person-enrichment:resume'], {
    env: {
      SUPABASE_URL: localSupabaseUrl,
      SUPABASE_ANON_KEY: localAnonKey,
    },
  });
  await run('npm', ['run', 'sync:person-enrichment:write'], {
    env: {
      SUPABASE_URL: localSupabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: localServiceRoleKey,
    },
  });
  await run('npm', ['run', 'review:person-claims:write'], {
    env: {
      SUPABASE_URL: localSupabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: localServiceRoleKey,
    },
  });

  const judicial = await maybeFetchJudicialLeads();
  const afterReviewCount = await countRows('person_claim_review_queue', wikidataSourceName);
  const afterPublicCount = await countRows('public_person_claims', wikidataSourceName);
  const publicFamilyCount = await countRowsByClaimType('public_person_claims', wikidataSourceName, 'family_relation');
  const publicLegalCount = await countRowsByClaimType('public_person_claims', wikidataSourceName, 'legal_case');

  if (publicFamilyCount !== 0 || publicLegalCount !== 0) {
    throw new Error(
      `Sensitive Wikidata claims must remain private, but public_person_claims has family=${publicFamilyCount}, legal=${publicLegalCount}.`,
    );
  }

  console.log(JSON.stringify({
    status: 'ok',
    wikidataReviewBefore: beforeReviewCount,
    wikidataReviewAfter: afterReviewCount,
    wikidataReviewAdded: afterReviewCount - beforeReviewCount,
    wikidataPublicBefore: beforePublicCount,
    wikidataPublicAfter: afterPublicCount,
    wikidataPublicFamily: publicFamilyCount,
    wikidataPublicLegal: publicLegalCount,
    judicial,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`person enrichment batch failed: ${message}`);
  process.exit(1);
});
