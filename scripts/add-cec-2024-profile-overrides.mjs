import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultReviewPath = path.join(repoRoot, 'tmp', 'cec-representative-platforms', '2024-legislator', 'review.json');
const defaultProfileReviewPath = path.join(repoRoot, 'tmp', 'cec-representative-platforms', '2024-legislator', 'profile-review.json');
const defaultSeedPath = path.join(repoRoot, 'data-sources', 'cec-2024-bulletin-profile-claims.seed.json');

const overrides = new Map([
  ['1f2f0d1b-aa8d-47d2-b3f7-114d2e06a751', {
    page: 1,
    education: '一、高雄市立五甲國小\n二、高雄市立五甲國中\n三、高雄中學\n四、台灣大學機械工程系\n五、國立高雄師範大學教育學系碩士',
    experience: '一、高雄師範大學教育所博士候選人\n二、鳳山市第八屆市民代表\n三、第十五屆高雄縣議員\n四、第十屆鳳山市市長\n五、首任高雄市鳳山區區長\n六、第八屆立法委員\n七、第九屆立法委員\n八、第十屆立法委員',
    reason: 'Official bulletin page is image-only; manually transcribed from candidate no. 4 profile.',
  }],
  ['5984c280-4a3a-4dcc-9407-a7b96facd941', {
    page: 2,
    education: '花蓮縣瑞美國小、瑞穗國中、花蓮高中、國立臺灣大學法律系畢業',
    experience: '省府法規會編審、省原民局副局長、省原住民事務委員會副主委、行政院原住民族委員會教文處處長、社福處處長、企劃處處長、副主任委員、省政府副秘書長、考試院頒發九十一年公務人員傑出貢獻獎、第八、九、十屆立法委員、21世紀基金會國會評鑑第九屆優質立委',
    reason: 'Manually transcribed after exact-name localization in the official bulletin.',
  }],
  ['a60d25d9-c06f-4801-b56d-0d2d0725500c', {
    page: 2,
    education: '1 屏東師院國教所碩士\n2 屏東師院\n3 屏東師專',
    experience: '立法院第10屆立法委員\n屏東大學教行所博士候選人\n屏東縣政府原住民處處長\n地磨兒國小校長\n泰武國小校長\n總統府原住民族歷史正義與轉型正義委員會委員\n教育部USR推動中心委員\n新境界文教基金會原住民教育小組\n為台灣而教基金會董事\n原住民族文化事業基金會董事\n行政院原住民基本法推動委員',
    reason: 'Manually transcribed after exact-name localization in the official bulletin.',
  }],
]);

const huangOverride = {
  page: 1,
  education: '靜宜大學外國語文學系畢業',
  experience: '第九、十屆立法委員。立法院第29屆厚生會會長。民進黨第18屆中央常務執行委員。彰化縣第16、17、18屆議員。民主進步黨全國黨代表。立法委員周清玉服務處主任。立法委員姚嘉文服務處助理。關懷文教基金會執行長。台灣關懷婦女協會理事長。東海大學人力資源管理班結業。國立彰化師範大學110EMBA。',
  reason: 'Candidate name is image-only; manually transcribed from candidate no. 1 profile in the official bulletin.',
};

function claimFor(entry, claimType, claimValue, override) {
  return {
    claimKey: `official-profile:cec-2024-election-bulletins:${entry.candidate_id}:${claimType}`,
    personId: entry.person_id,
    personName: entry.person_name,
    claimType,
    claimValue,
    claimJson: {
      value: claimValue,
      items: [claimValue],
      profileSource: 'cec_election_bulletin',
      electionYear: 2024,
      electionName: entry.election_name,
      raceTitle: entry.race_title,
      candidateId: entry.candidate_id,
      candidateNo: entry.candidate_no,
      sourceDocument: { sha256: entry.sourceDocument.sha256, page: override.page },
      extractionMethod: 'manual_official_bulletin_transcription',
      extractionNote: override.reason,
      publicationGate: {
        status: 'passed',
        reason: 'Official CEC bulletin matched to the exact elected candidate record',
      },
    },
    confidenceLevel: 'A',
    reviewStatus: 'verified',
    visibility: 'public',
    sourceId: 'cec-2024-election-bulletins',
    sourceName: '中央選舉委員會：2024年第11屆立法委員選舉公報',
    sourceUrl: entry.sourceDocument.url,
    observedAt: '2024-01-13T00:00:00+08:00',
  };
}

function main() {
  const review = JSON.parse(fs.readFileSync(defaultReviewPath, 'utf8'));
  const profileReview = JSON.parse(fs.readFileSync(defaultProfileReviewPath, 'utf8'));
  const seed = JSON.parse(fs.readFileSync(defaultSeedPath, 'utf8'));
  const manualEntries = profileReview.entries.filter((entry) => entry.extraction.status !== 'extracted');
  for (const manualEntry of manualEntries) {
    const entry = review.entries.find((candidate) => candidate.candidate_id === manualEntry.candidateId);
    if (!entry) throw new Error(`Missing source entry for ${manualEntry.personName}`);
    const override = overrides.get(entry.candidate_id)
      ?? (entry.person_name === '黃秀芳' && entry.sourceDocument.sha256.startsWith('435a5b1dc1c09015') ? huangOverride : null);
    if (!override) throw new Error(`Missing manual override for ${entry.person_name}`);
    seed.personClaims.push(claimFor(entry, 'education', override.education, override));
    seed.personClaims.push(claimFor(entry, 'experience', override.experience, override));
    manualEntry.extraction = {
      status: 'extracted',
      page: override.page,
      education: override.education,
      experience: override.experience,
      extractionMethod: 'manual_official_bulletin_transcription',
      reason: override.reason,
    };
  }
  seed.summary = {
    ...seed.summary,
    extractedCount: seed.summary.targetCount,
    manualCount: 0,
    educationCount: seed.personClaims.filter((claim) => claim.claimType === 'education').length,
    experienceCount: seed.personClaims.filter((claim) => claim.claimType === 'experience').length,
    manuallyTranscribedCount: manualEntries.length,
  };
  profileReview.summary = { ...profileReview.summary, ...seed.summary };
  fs.writeFileSync(defaultSeedPath, `${JSON.stringify(seed, null, 2)}\n`);
  fs.writeFileSync(defaultProfileReviewPath, `${JSON.stringify(profileReview, null, 2)}\n`);
  console.log(JSON.stringify(seed.summary, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
