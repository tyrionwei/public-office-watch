type JsonObject = Record<string, unknown>;

type PlatformClaim = {
  candidate_id: string | null;
  claim_type: string;
  claim_value: string | null;
  claim_json: JsonObject | null;
  source_name: string | null;
  source_url: string | null;
  scoring_reasons: unknown;
};

const councilHosts: Record<string, string> = {
  '新北市議會：現任議員': 'www.ntp.gov.tw',
  '新竹市議會：現任議員': 'www.hsinchu-cc.gov.tw',
  '臺中市議會：現任議員': 'www.tccc.gov.tw',
  '臺北市議會：現任議員': 'www.tcc.gov.tw',
  '臺南市議會：現任議員': 'www.tncc.gov.tw',
};

const cecHosts = new Set(['eebulletin.cec.gov.tw', 'bulletin.cec.gov.tw']);

function objectValue(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null;
}

function extractedPlatformText(claim: PlatformClaim) {
  const candidates = objectValue(claim.claim_json?.transcriptionCandidates);
  for (const value of [candidates?.bestOcrText, candidates?.ocrText, candidates?.pdfTextLayer]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function hasSubstantivePlatformText(value: string) {
  return (value.match(/[一-龥]/g) ?? []).length >= 8;
}

export function buildPlatformApprovalPatch(claim: PlatformClaim, platformText: string | undefined, reviewedAt: string) {
  const electionContext = objectValue(claim.claim_json?.electionContext);
  let sourceUrl: URL;

  try {
    sourceUrl = new URL(claim.source_url ?? '');
  } catch {
    throw new Error('政見資料缺少有效的中選會來源網址。');
  }

  if (claim.claim_type !== 'platform') throw new Error('這筆資料不是政見。');
  if (!claim.candidate_id || electionContext?.candidateId !== claim.candidate_id) {
    throw new Error('這筆政見尚未配對到確切參選紀錄，不能公開。');
  }

  const isCecSource = /^中央選舉委員會：\d{4}年(?:[^：\r\n]{1,40})?選舉公報$/u.test(claim.source_name ?? '')
    && sourceUrl.protocol === 'https:' && cecHosts.has(sourceUrl.hostname);
  const expectedCouncilHost = claim.source_name ? councilHosts[claim.source_name] : null;
  const isCouncilSource = Boolean(expectedCouncilHost)
    && sourceUrl.protocol === 'https:' && sourceUrl.hostname === expectedCouncilHost;
  if (!isCecSource && !isCouncilSource) {
    throw new Error('這筆政見的來源尚未納入可公開的官方來源。');
  }

  const suppliedText = platformText?.trim() ?? '';
  const reviewedText = suppliedText || (isCecSource ? extractedPlatformText(claim) : claim.claim_value?.trim() ?? '');
  if (!reviewedText) throw new Error('這筆政見沒有可公開的文字內容。');
  if (isCecSource && !suppliedText && !hasSubstantivePlatformText(reviewedText)) {
    throw new Error('中選會公報的辨識文字不足，需先重新擷取或人工轉錄。');
  }

  const decisionReason = {
    version: 'internal-platform-review-ui-v2',
    decision: 'approve',
    reviewedAt,
  };
  const scoringReasons = Array.isArray(claim.scoring_reasons) ? claim.scoring_reasons : [];
  const publicClaimJson = { ...(claim.claim_json ?? {}) };
  delete publicClaimJson.transcriptionCandidates;

  return {
    claim_value: reviewedText,
    claim_json: {
      ...publicClaimJson,
      platformText: reviewedText,
      publicationGate: {
        status: 'passed',
        reason: isCecSource
          ? 'Election-scoped CEC platform text accepted; minor transcription errors may remain'
          : 'Official council platform matched to the incumbent elected candidacy',
        reviewedAt,
      },
      campaignPlatformReview: {
        status: 'passed',
        reason: 'Exact person and candidacy were confirmed before publication',
        reviewedAt,
      },
      reviewDecision: decisionReason,
    },
    review_status: 'verified',
    visibility: 'public',
    is_public: true,
    auto_reviewed_at: reviewedAt,
    scoring_reasons: [...scoringReasons, decisionReason],
    updated_at: reviewedAt,
  };
}
