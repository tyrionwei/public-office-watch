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
type PersonFeedbackRow = {
  id: string;
  person_id: string;
  feedback_kind: 'supplement_request' | 'problem_report';
  section_key: string;
  problem_type: string | null;
  message: string | null;
  evidence_url: string | null;
  review_status: string;
  submission_count: number;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
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
const wikidataSourceName = 'Wikidata 人物補充資料';
const wikidataExternalIdUnlockedClaimTypes = new Set([
  'gender',
  'birth_date',
  'education',
  'experience',
  'position',
  'office',
  'district',
  'party',
]);

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

function normalizeTargetName(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/[臺]/g, '台')
    .replace(/[‧·．・･•]/g, '')
    .replace(/[\s\u00A0\u3000]+/g, '');
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

  if (claim.source_name !== wikidataSourceName || !qid || !personName) {
    return;
  }

  const skippedPath = rootPath('data-sources', 'person-enrichment-skipped.json');
  const payload = readSkippedPayload();
  const skippedTargets = Array.isArray(payload.skippedTargets) ? payload.skippedTargets : [];
  const key = `${claim.person_id ?? 'name'}:${normalizeTargetName(personName)}`;
  const existingIndex = skippedTargets.findIndex((item) => `${item.target?.personId ?? 'name'}:${normalizeTargetName(item.target?.name ?? item.name)}` === key);
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

function wikidataQidForClaim(claim: InternalClaim) {
  const qidFromJson = claim.claim_json?.wikidataQid;
  if (typeof qidFromJson === 'string' && /^Q\d+$/i.test(qidFromJson)) {
    return qidFromJson.toUpperCase();
  }

  const qidFromValue = String(claim.claim_value ?? '').match(/^wikidata:(Q\d+)$/i)?.[1];
  return qidFromValue ? qidFromValue.toUpperCase() : null;
}

async function approveRelatedWikidataClaims(claim: InternalClaim, now: string) {
  const qid = wikidataQidForClaim(claim);

  if (
    claim.source_name !== wikidataSourceName ||
    claim.claim_type !== 'external_id' ||
    !claim.person_id ||
    !qid
  ) {
    return [];
  }

  const relatedClaims = await supabaseRest(
    `person_claims?select=id,claim_type,claim_json,scoring_reasons&person_id=eq.${encodeURIComponent(claim.person_id)}&source_name=eq.${encodeURIComponent(wikidataSourceName)}&review_status=in.(pending,needs_more_evidence)&limit=1000`,
  ) as InternalClaim[];
  const targets = relatedClaims.filter((relatedClaim) => (
    wikidataExternalIdUnlockedClaimTypes.has(relatedClaim.claim_type) &&
    wikidataQidForClaim(relatedClaim) === qid
  ));

  for (const target of targets) {
    const scoringReasons = Array.isArray(target.scoring_reasons) ? target.scoring_reasons : [];
    await supabaseRest(`person_claims?id=eq.${encodeURIComponent(target.id)}`, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({
        review_status: 'verified',
        visibility: 'public',
        is_public: true,
        auto_reviewed_at: now,
        scoring_version: 'internal-review-ui-external-id-cascade-v1',
        scoring_reasons: [
          ...scoringReasons,
          {
            version: 'internal-review-ui-external-id-cascade-v1',
            reason: 'low-sensitivity Wikidata claim approved after verified external_id for the same person and QID',
            reviewedAt: now,
          },
        ],
        updated_at: now,
      }),
    });
  }

  return targets.map((target) => target.id);
}

async function rejectRelatedWikidataClaims(claim: InternalClaim, now: string) {
  const qid = wikidataQidForClaim(claim);

  if (claim.source_name !== wikidataSourceName || !claim.person_id || !qid) {
    return [];
  }

  const relatedClaims = await supabaseRest(
    `person_claims?select=id,claim_type,claim_json,scoring_reasons&person_id=eq.${encodeURIComponent(claim.person_id)}&source_name=eq.${encodeURIComponent(wikidataSourceName)}&review_status=in.(pending,needs_more_evidence)&limit=1000`,
  ) as InternalClaim[];
  const targets = relatedClaims.filter((relatedClaim) => relatedClaim.id !== claim.id && wikidataQidForClaim(relatedClaim) === qid);

  for (const target of targets) {
    const scoringReasons = Array.isArray(target.scoring_reasons) ? target.scoring_reasons : [];
    await supabaseRest(`person_claims?id=eq.${encodeURIComponent(target.id)}`, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({
        review_status: 'rejected',
        visibility: 'private',
        is_public: false,
        claim_json: {
          ...(target.claim_json ?? {}),
          reviewDecision: {
            version: 'internal-review-ui-qid-reject-cascade-v1',
            decision: 'reject',
            reason: 'same Wikidata QID rejected for this person',
            reviewedAt: now,
          },
        },
        scoring_reasons: [
          ...scoringReasons,
          {
            version: 'internal-review-ui-qid-reject-cascade-v1',
            reason: 'same Wikidata QID rejected for this person',
            reviewedAt: now,
          },
        ],
        updated_at: now,
      }),
    });
  }

  return targets.map((target) => target.id);
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

          const relatedClaimIds = action === 'approve'
            ? await approveRelatedWikidataClaims(claim, now)
            : await rejectRelatedWikidataClaims(claim, now);

          if (action === 'reject') {
            writeSkippedRetryTarget(claim, person);
          }

          jsonResponse(response, 200, { status: 'ok', action, relatedUpdated: relatedClaimIds.length, relatedClaimIds });
        } catch (error) {
          jsonResponse(response, 500, { error: error instanceof Error ? error.message : 'Unknown error.' });
        }
      });
      server.middlewares.use('/internal-api/person-feedback', async (request, response) => {
        const devRequest = request as DevRequest;
        if (devRequest.method !== 'GET') {
          jsonResponse(response, 405, { error: 'Method not allowed.' });
          return;
        }

        try {
          const submissions = await supabaseRest(
            'person_feedback_submissions?select=id,person_id,feedback_kind,section_key,problem_type,message,evidence_url,review_status,submission_count,review_note,reviewed_by,reviewed_at,created_at,updated_at&order=updated_at.desc&limit=500',
          ) as PersonFeedbackRow[];
          const personIds = Array.from(new Set(submissions.map((submission) => submission.person_id)));
          const people = personIds.length > 0
            ? await supabaseRest(
              `people?select=id,name,party,position,district&id=in.(${personIds.map(encodeURIComponent).join(',')})`,
            ) as PersonRow[]
            : [];
          const peopleById = new Map(people.map((person) => [person.id, person]));

          jsonResponse(response, 200, {
            items: submissions.map((submission) => ({
              ...submission,
              person: peopleById.get(submission.person_id) ?? null,
            })),
          });
        } catch (error) {
          jsonResponse(response, 500, { error: error instanceof Error ? error.message : 'Unknown error.' });
        }
      });

      server.middlewares.use('/internal-api/review-person-feedback', async (request, response) => {
        const devRequest = request as DevRequest;
        if (devRequest.method !== 'POST') {
          jsonResponse(response, 405, { error: 'Method not allowed.' });
          return;
        }

        try {
          const body = await readJsonBody(devRequest) as {
            submissionId?: string;
            action?: string;
            note?: string;
          };
          const submissionId = body.submissionId?.trim();
          const action = body.action;
          const note = body.note?.trim() ?? '';

          if (!submissionId || !['start', 'verify', 'reject'].includes(action ?? '')) {
            jsonResponse(response, 400, { error: 'submissionId and action=start|verify|reject are required.' });
            return;
          }

          if (note.length > 1000) {
            jsonResponse(response, 400, { error: 'Review note must not exceed 1000 characters.' });
            return;
          }

          if (action === 'reject' && note.length < 5) {
            jsonResponse(response, 400, { error: 'Rejecting a submission requires a review note of at least 5 characters.' });
            return;
          }

          const submissions = await supabaseRest(
            `person_feedback_submissions?select=id&id=eq.${encodeURIComponent(submissionId)}&limit=1`,
          ) as Pick<PersonFeedbackRow, 'id'>[];
          if (!submissions[0]) {
            jsonResponse(response, 404, { error: 'Feedback submission not found.' });
            return;
          }

          const now = new Date().toISOString();
          const reviewStatus = action === 'start' ? 'reviewing' : action === 'verify' ? 'verified' : 'rejected';
          await supabaseRest(`person_feedback_submissions?id=eq.${encodeURIComponent(submissionId)}`, {
            method: 'PATCH',
            headers: { prefer: 'return=minimal' },
            body: JSON.stringify({
              review_status: reviewStatus,
              review_note: note || null,
              reviewed_by: 'local_internal_review',
              reviewed_at: action === 'start' ? null : now,
              updated_at: now,
            }),
          });

          jsonResponse(response, 200, { status: 'ok', reviewStatus });
        } catch (error) {
          jsonResponse(response, 500, { error: error instanceof Error ? error.message : 'Unknown error.' });
        }
      });


      server.middlewares.use('/internal-api/review-identity-match', async (request, response) => {
        const devRequest = request as DevRequest;
        if (devRequest.method !== 'POST') {
          jsonResponse(response, 405, { error: 'Method not allowed.' });
          return;
        }

        try {
          const body = await readJsonBody(devRequest) as { sourcePersonId?: string; candidatePersonId?: string; action?: string };
          const sourcePersonId = body.sourcePersonId?.trim();
          const candidatePersonId = body.candidatePersonId?.trim();
          const action = body.action;

          const validAction = action === 'approve' || action === 'reject' || action === 'create';
          if (!sourcePersonId || !validAction || (action !== 'create' && !candidatePersonId)) {
            jsonResponse(response, 400, { error: 'sourcePersonId and action=approve|reject|create are required; candidatePersonId is required unless action=create.' });
            return;
          }

          const sourcePeople = await supabaseRest(
            'source_people?select=id,source_person_key,raw_name,alias,gender,party,position,district,election_year,source_name,source_url&id=eq.' + encodeURIComponent(sourcePersonId) + '&limit=1',
          ) as {
            id: string;
            source_person_key: string;
            raw_name: string;
            alias: string | null;
            gender: string | null;
            party: string | null;
            position: string | null;
            district: string | null;
            election_year: number | null;
            source_name: string;
            source_url: string | null;
          }[];
          const sourcePerson = sourcePeople[0];
          if (!sourcePerson) {
            jsonResponse(response, 404, { error: 'Source person not found.' });
            return;
          }

          const now = new Date().toISOString();
          let candidatePerson: { id: string; name: string; party: string | null; position: string | null; district: string | null };

          if (action === 'create') {
            const createdPeople = await supabaseRest('people?on_conflict=external_id', {
              method: 'POST',
              headers: { prefer: 'resolution=merge-duplicates,return=representation' },
              body: JSON.stringify({
                external_id: 'internal-review-source-' + sourcePerson.id,
                name: sourcePerson.raw_name,
                alias: sourcePerson.alias,
                gender: sourcePerson.gender ?? 'unknown',
                party: sourcePerson.party || null,
                position: sourcePerson.position,
                election_year: sourcePerson.election_year,
                district: sourcePerson.district,
                source_url: sourcePerson.source_url,
                is_public: true,
                updated_at: now,
              }),
            }) as { id: string; name: string; party: string | null; position: string | null; district: string | null }[];
            candidatePerson = createdPeople[0];
          } else {
            const people = await supabaseRest(
              'people?select=id,name,party,position,district&id=eq.' + encodeURIComponent(candidatePersonId as string) + '&limit=1',
            ) as { id: string; name: string; party: string | null; position: string | null; district: string | null }[];
            candidatePerson = people[0];
          }

          if (!candidatePerson) {
            jsonResponse(response, 404, { error: action === 'create' ? 'New person could not be created.' : 'Candidate person not found.' });
            return;
          }

          const approved = action !== 'reject';
          await supabaseRest('person_identity_matches?on_conflict=source_person_id,person_id', {
            method: 'POST',
            headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify({
              source_person_id: sourcePersonId,
              person_id: candidatePerson.id,
              match_status: approved ? 'auto_matched' : 'rejected_match',
              score: approved ? 100 : 0,
              match_method: 'manual_internal_review',
              match_reason: action === 'create'
                ? 'created from official source via internal identity review queue'
                : approved
                  ? 'confirmed via internal identity review queue'
                  : 'rejected via internal identity review queue',
              evidence_json: {
                version: 'internal-identity-review-ui-v1',
                action,
                sourcePerson: {
                  id: sourcePerson.id,
                  sourcePersonKey: sourcePerson.source_person_key,
                  name: sourcePerson.raw_name,
                  sourceName: sourcePerson.source_name,
                  position: sourcePerson.position,
                  district: sourcePerson.district,
                },
                candidatePerson: {
                  id: candidatePerson.id,
                  name: candidatePerson.name,
                  party: candidatePerson.party,
                  position: candidatePerson.position,
                  district: candidatePerson.district,
                },
              },
              reviewed_by: 'local_internal_review',
              reviewed_at: now,
              updated_at: now,
            }),
          });

          if (approved) {
            await supabaseRest('source_people?id=eq.' + encodeURIComponent(sourcePersonId), {
              method: 'PATCH',
              headers: { prefer: 'return=minimal' },
              body: JSON.stringify({ is_public: true, updated_at: now }),
            });
            await supabaseRest('person_claims?source_person_id=eq.' + encodeURIComponent(sourcePersonId), {
              method: 'PATCH',
              headers: { prefer: 'return=minimal' },
              body: JSON.stringify({ person_id: candidatePerson.id, review_status: 'verified', visibility: 'public', is_public: true, updated_at: now }),
            });
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
