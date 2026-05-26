import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

type EnvMap = Record<string, string>;
type JsonObject = Record<string, unknown>;
type DevRequest = {
  method?: string;
  on(event: 'data', listener: (chunk: Uint8Array | string) => void): void;
  on(event: 'end', listener: () => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
};
type DevResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};
type RestInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};
type InternalClaim = {
  id: string;
  person_id: string | null;
  claim_type: string;
  claim_value: string | null;
  claim_json: JsonObject | null;
  source_name: string | null;
  source_url: string | null;
  scoring_reasons: unknown;
};
type PersonRow = {
  id: string;
  name: string;
  gender: string | null;
  party: string | null;
  position: string | null;
  district: string | null;
  education: string | null;
  experience: string | null;
};
type SkippedTarget = {
  target?: {
    personId?: string | null;
    name?: string;
    rejectedWikidataQids?: string[];
  };
  name?: string;
};
type SkippedPayload = {
  schemaVersion?: number;
  name?: string;
  updatedAt?: string;
  skippedTargets?: SkippedTarget[];
};

function parseEnvFile(filePath: string): EnvMap {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return Object.fromEntries(
    fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
        return [key, value];
      }),
  );
}

function readJsonBody(request: DevRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    request.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function jsonResponse(response: DevResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify(body));
}

function rootPath(...segments: string[]) {
  return path.resolve(__dirname, '..', '..', ...segments);
}

function loadInternalEnv() {
  const rootEnv = parseEnvFile(rootPath('.env.local'));
  const webEnv = parseEnvFile(path.resolve(__dirname, '.env.local'));
  return {
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || rootEnv.SUPABASE_URL || rootEnv.VITE_SUPABASE_URL || webEnv.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || rootEnv.SUPABASE_SERVICE_ROLE_KEY,
  };
}

async function supabaseRest(pathname: string, init: RestInit = {}) {
  const env = loadInternalEnv();

  if (!env.supabaseUrl || !env.serviceRoleKey) {
    throw new Error('Internal review API requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local env.');
  }

  const response = await fetch(`${env.supabaseUrl.replace(/\/$/, '')}/rest/v1/${pathname}`, {
    ...init,
    headers: {
      apikey: env.serviceRoleKey,
      authorization: `Bearer ${env.serviceRoleKey}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(body?.message ?? response.statusText);
  }

  return body;
}

function readSkippedPayload(): SkippedPayload {
  const skippedPath = rootPath('data-sources', 'person-enrichment-skipped.json');
  if (!fs.existsSync(skippedPath)) {
    return { schemaVersion: 1, name: 'person-enrichment-skipped-targets', skippedTargets: [] };
  }
  return JSON.parse(fs.readFileSync(skippedPath, 'utf8'));
}

function writeSkippedRetryTarget(claim: InternalClaim, person: PersonRow | null) {
  const claimJson = claim.claim_json ?? {};
  const qid = typeof claimJson.wikidataQid === 'string' ? claimJson.wikidataQid : null;
  const personName = typeof claimJson.personName === 'string' ? claimJson.personName : person?.name;

  if (claim.source_name !== 'Wikidata 人物補充資料' || !qid || !personName) {
    return;
  }

  const skippedPath = rootPath('data-sources', 'person-enrichment-skipped.json');
  const payload = readSkippedPayload();
  const skippedTargets = Array.isArray(payload.skippedTargets) ? payload.skippedTargets : [];
  const key = `${claim.person_id ?? 'name'}:${personName}`;
  const existingIndex = skippedTargets.findIndex((item) => `${item.target?.personId ?? 'name'}:${item.target?.name ?? item.name}` === key);
  const existing = existingIndex >= 0 ? skippedTargets[existingIndex] : null;
  const rejectedWikidataQids = Array.from(new Set([...(existing?.target?.rejectedWikidataQids ?? []), qid]));
  const next = {
    target: {
      personId: claim.person_id,
      name: personName,
      gender: person?.gender ?? 'unknown',
      party: person?.party ?? '',
      position: person?.position ?? '',
      district: person?.district ?? '',
      education: person?.education ?? '',
      experience: person?.experience ?? '',
      rejectedWikidataQids,
    },
    name: personName,
    reason: `review rejected Wikidata QID ${qid}`,
    checkedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    skippedTargets[existingIndex] = next;
  } else {
    skippedTargets.push(next);
  }

  fs.writeFileSync(skippedPath, `${JSON.stringify({ ...payload, updatedAt: new Date().toISOString().slice(0, 10), skippedTargets }, null, 2)}\n`);
}

function internalReviewApiPlugin(): Plugin {
  return {
    name: 'internal-review-api',
    configureServer(server) {
      server.middlewares.use('/internal-api/review-claim', async (request, response) => {
          const devRequest = request as DevRequest;
        if (devRequest.method !== 'POST') {
          jsonResponse(response, 405, { error: 'Method not allowed.' });
          return;
        }

        try {
          const body = await readJsonBody(devRequest) as { claimId?: string; action?: string };
          const claimId = body.claimId?.trim();
          const action = body.action;

          if (!claimId || (action !== 'approve' && action !== 'reject')) {
            jsonResponse(response, 400, { error: 'claimId and action=approve|reject are required.' });
            return;
          }

          const claims = await supabaseRest(
            `person_claims?select=id,person_id,claim_type,claim_value,claim_json,source_name,source_url,scoring_reasons&id=eq.${encodeURIComponent(claimId)}&limit=1`,
          ) as InternalClaim[];
          const claim = claims[0];

          if (!claim) {
            jsonResponse(response, 404, { error: 'Claim not found.' });
            return;
          }

          const people = claim.person_id
            ? await supabaseRest(
              `people?select=id,name,gender,party,position,district,education,experience&id=eq.${encodeURIComponent(claim.person_id)}&limit=1`,
            ) as PersonRow[]
            : [];
          const person = people[0] ?? null;
          const now = new Date().toISOString();
          const scoringReasons = Array.isArray(claim.scoring_reasons) ? claim.scoring_reasons : [];
          const decisionReason = {
            version: 'internal-review-ui-v1',
            decision: action,
            reviewedAt: now,
          };
          const patch = action === 'approve'
            ? {
                review_status: 'verified',
                visibility: 'public',
                is_public: true,
                auto_reviewed_at: now,
                scoring_reasons: [...scoringReasons, decisionReason],
                updated_at: now,
              }
            : {
                review_status: 'rejected',
                visibility: 'private',
                is_public: false,
                claim_json: {
                  ...(claim.claim_json ?? {}),
                  reviewDecision: decisionReason,
                },
                scoring_reasons: [...scoringReasons, decisionReason],
                updated_at: now,
              };

          await supabaseRest(`person_claims?id=eq.${encodeURIComponent(claimId)}`, {
            method: 'PATCH',
            headers: { prefer: 'return=minimal' },
            body: JSON.stringify(patch),
          });

          if (action === 'reject') {
            writeSkippedRetryTarget(claim, person);
          }

          jsonResponse(response, 200, { status: 'ok', action });
        } catch (error) {
          jsonResponse(response, 500, { error: error instanceof Error ? error.message : 'Unknown error.' });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), internalReviewApiPlugin()],
});
