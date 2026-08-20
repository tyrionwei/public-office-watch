import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const regionalSeedPath = path.join(repoRoot, 'data-sources', 'cec-2024-bulletin-profile-claims.seed.json');
const regionalReviewPath = path.join(repoRoot, 'tmp', 'cec-representative-platforms', '2024-legislator', 'profile-review.json');
const partyListSeedPath = path.join(repoRoot, 'data-sources', 'cec-2024-party-list-bulletin-profile-claims.seed.json');
const qaPath = path.join(repoRoot, 'tmp', 'cec-representative-platforms', '2024-profile-seed-qa.json');
const chenKuanTingExperience = [
  '行政院政務顧問',
  '民主進步黨蔡英文主席特助',
  '翁章梁縣長競選團隊發言人',
  '台灣世代教育基金會執行長',
  '臺北市政府副發言人',
  '淡江大學外交與國際關係學系講師',
].join('\n');
const contaminationPattern = /投票時間|選舉人資格|選舉票顏色|基本資料|推薦之政黨|第\s*\d+\s*頁（共/u;

function fixRegionalExtraction(seed, review) {
  const claim = seed.personClaims.find((item) => item.personName === '陳冠廷' && item.claimType === 'experience');
  if (!claim) throw new Error('Missing 陳冠廷 experience claim');
  claim.claimValue = chenKuanTingExperience;
  claim.claimJson.value = chenKuanTingExperience;
  claim.claimJson.items = [chenKuanTingExperience];
  claim.claimJson.extractionMethod = 'manual_official_bulletin_transcription';
  claim.claimJson.extractionNote = 'Automatic right-edge extraction crossed into the election notice; manually corrected from the exact candidate row.';
  const entry = review.entries.find((item) => item.personName === '陳冠廷');
  if (!entry) throw new Error('Missing 陳冠廷 review entry');
  entry.extraction.experience = chenKuanTingExperience;
  entry.extraction.extractionMethod = 'manual_official_bulletin_transcription';
  entry.extraction.reason = 'Automatic right-edge extraction crossed into the election notice; manually corrected from the exact candidate row.';
}

function validateSeed(seed, expected) {
  const problems = [];
  const claimKeys = new Set();
  for (const claim of seed.personClaims) {
    if (claimKeys.has(claim.claimKey)) problems.push(`${claim.personName}: duplicate claim key ${claim.claimKey}`);
    claimKeys.add(claim.claimKey);
    if (!['education', 'experience'].includes(claim.claimType)) problems.push(`${claim.personName}: unexpected type ${claim.claimType}`);
    if (!claim.claimValue?.trim()) problems.push(`${claim.personName}: empty ${claim.claimType}`);
    if (contaminationPattern.test(claim.claimValue)) problems.push(`${claim.personName}: contaminated ${claim.claimType}`);
    if (claim.claimValue.length > 1500) problems.push(`${claim.personName}: unusually long ${claim.claimType}`);
    if (claim.claimJson?.profileSource !== 'cec_election_bulletin') problems.push(`${claim.personName}: missing CEC profile marker`);
    if (claim.confidenceLevel !== 'A' || claim.reviewStatus !== 'verified' || claim.visibility !== 'public') {
      problems.push(`${claim.personName}: incorrect publication state`);
    }
  }
  const people = new Set(seed.personClaims.map((claim) => claim.personId));
  const educationCount = seed.personClaims.filter((claim) => claim.claimType === 'education').length;
  const experienceCount = seed.personClaims.filter((claim) => claim.claimType === 'experience').length;
  if (people.size !== expected.people) problems.push(`expected ${expected.people} people, found ${people.size}`);
  if (educationCount !== expected.education) problems.push(`expected ${expected.education} education claims, found ${educationCount}`);
  if (experienceCount !== expected.experience) problems.push(`expected ${expected.experience} experience claims, found ${experienceCount}`);
  return { people: people.size, educationCount, experienceCount, claimCount: seed.personClaims.length, problems };
}

function main() {
  const regionalSeed = JSON.parse(fs.readFileSync(regionalSeedPath, 'utf8'));
  const regionalReview = JSON.parse(fs.readFileSync(regionalReviewPath, 'utf8'));
  const partyListSeed = JSON.parse(fs.readFileSync(partyListSeedPath, 'utf8'));
  fixRegionalExtraction(regionalSeed, regionalReview);
  const qa = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    regional: validateSeed(regionalSeed, { people: 79, education: 79, experience: 79 }),
    partyList: validateSeed(partyListSeed, { people: 34, education: 33, experience: 34 }),
    officialBlankFields: [{ personName: '林倩綺', claimType: 'education', reason: 'The official bulletin leaves the education column blank; degrees are printed in the experience column.' }],
  };
  const problems = [...qa.regional.problems, ...qa.partyList.problems];
  if (problems.length > 0) throw new Error(`CEC 2024 profile QA failed:\n${problems.join('\n')}`);
  fs.writeFileSync(regionalSeedPath, `${JSON.stringify(regionalSeed, null, 2)}\n`);
  fs.writeFileSync(regionalReviewPath, `${JSON.stringify(regionalReview, null, 2)}\n`);
  fs.writeFileSync(qaPath, `${JSON.stringify(qa, null, 2)}\n`);
  console.log(JSON.stringify(qa, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export { validateSeed };
