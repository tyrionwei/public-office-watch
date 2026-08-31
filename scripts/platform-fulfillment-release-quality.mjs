const releaseQualityVersion = 'platform-fulfillment-release-v2';

const actionPattern = /(?:爭取|推動|改善|增設|加速|建立|支持|保障|監督|落實|提升|促進|強化|維護|興建|整建|補助|制定|修法|反對|要求|取消|開放|整合|規劃|活化|打造|完善|擴大|降低|提高|增加|確保|督促|檢討|協助|輔導|提供|設置|建置|發展|保護|捍衛|解決|鼓勵|充實|優化|保存|杜絕|重啟|放寬|暫緩|編列|清查|嚴查|普設|籌措|改建|重建|照顧|培育|引進|減輕|廣設|增建|研議|推廣|結合|升級|維持|建構|實施|延長)/u;
const webPromotionPattern = /(?:https?:\/\/|www\.|更多(?:政見|訊息)|請搜尋|輸入網址|掃\s*QR(?:-?CODE)?|[a-z0-9-]+\.(?:tw|com|org|net)(?:\b|\/))/iu;
const biographyPattern = /(?:政見如下|候選人(?:簡介|介紹)|懇請.*(?:支持|機會)|請投|票投|我(?:是|叫|參選|投入這場選舉|願意承擔)|本人(?:出生|參選)|當選以來|這四年我|從政.*(?:初衷|目標))/u;
const resumePattern = /(?:【\s*(?:經歷|學歷|現任|曾任)\s*】|^(?:經歷|學歷|現任|曾任)\s*[：:])/u;
const pastAchievementPattern = /(?:(?:已|己)(?:經)?(?:完成|動工|完工|啟用)|成功(?:爭取|推動|促成)|爭取到|任內(?:完成|促成)|過去.*(?:完成|促成)|曾經.*(?:完成|促成)|重大成果)/u;
const reviewedHardSafetyReasonCodes = new Set([
  'election_metadata',
  'web_promotion',
  'past_achievement',
  'abnormal_structure',
]);

function compactText(value) {
  return value.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu, '');
}

function hasUnreadableScriptMix(value) {
  const letters = Array.from(value).filter((character) => /\p{Letter}/u.test(character));
  if (letters.length < 20) return false;
  const unexpectedLetters = letters.filter((character) => (
    !/[\p{Script=Han}\p{Script=Latin}]/u.test(character)
  ));
  return unexpectedLetters.length >= 5
    && unexpectedLetters.length / letters.length >= 0.08;
}

function sourceSectionHeadings(value) {
  const lines = value.split(/\r?\n/gu);
  const headings = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    const nextLine = lines.slice(index + 1).find((candidate) => candidate.trim())?.trim() ?? '';
    const bulletHeading = line.match(/^[•●○▪◆◇★※◎]\s*(.+)$/u)?.[1]?.trim() ?? null;
    if (bulletHeading && /^(?:\d{1,3}[.、．）)]|\(\d{1,3}\)|（\d{1,3}）)\s*/u.test(nextLine)) {
      headings.push(bulletHeading);
    } else if (/[>＞]\s*$/u.test(line)) {
      headings.push(line.replace(/[>＞]\s*$/u, ''));
    } else if (
      /^[\p{Script=Han}]{2,8}$/u.test(line)
      && /^[•●○▪◆◇★※◎]\s*/u.test(nextLine)
    ) {
      headings.push(line);
    }
  }
  return headings;
}

function hasSectionHeadingMismatch(source, items) {
  const headings = sourceSectionHeadings(source);
  if (headings.length < 2) return false;
  const itemPrefixes = new Set(items.map((item) => {
    const separator = item.search(/[：:]/u);
    return separator < 0 ? '' : compactText(item.slice(0, separator));
  }).filter(Boolean));
  return headings.some((heading) => !itemPrefixes.has(compactText(heading)));
}

function looksLikeElectionMetadata(value) {
  return /(?:19|20)\d{2}\s*年/u.test(value)
    && /選舉/u.test(value)
    && /(?:第\s*\d+\s*選舉區|議員|立法委員|總統|副總統)/u.test(value)
    && compactText(value).length <= 80
    && !actionPattern.test(value);
}

function hasUnbalancedClosingDelimiter(value) {
  const pairs = [
    ['「', '」'],
    ['『', '』'],
    ['【', '】'],
    ['《', '》'],
  ];
  return pairs.some(([opening, closing]) => (
    value.split(closing).length - 1 > value.split(opening).length - 1
  ));
}

export function platformFulfillmentItemReasonCodes(value) {
  const reasons = [];
  const compact = compactText(value);
  if (looksLikeElectionMetadata(value)) reasons.push('election_metadata');
  if (webPromotionPattern.test(value)) reasons.push('web_promotion');
  if (biographyPattern.test(value)) reasons.push('candidate_introduction');
  if (resumePattern.test(value)) reasons.push('resume_content');
  if (pastAchievementPattern.test(value)) reasons.push('past_achievement');
  if (
    /^[，。；：、）」』】》]/u.test(value)
    || hasUnbalancedClosingDelimiter(value)
    || value.length > 420
  ) {
    reasons.push('abnormal_structure');
  }

  const colonBody = value.match(/[：:]\s*([^：:]*)$/u)?.[1] ?? null;
  if (
    /[：:]\s*$/u.test(value)
    || (colonBody !== null && compactText(colonBody).length <= 8 && !/[。！？!?]/u.test(colonBody))
    || (compact.length <= 18 && !actionPattern.test(value))
  ) {
    reasons.push('heading_or_slogan');
  }
  return reasons;
}

export function classifyPlatformFulfillmentRelease(claim) {
  const reviewStatus = claim.claim_json?.contentSplit?.reviewStatus;
  const sourceItems = Array.isArray(claim.claim_json?.items)
    ? claim.claim_json.items.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];

  if (reviewStatus === 'auto_approved') {
    const source = String(claim.claim_json?.platformText ?? claim.claim_value ?? '');
    const sourceReasonCodes = [];
    if (hasUnreadableScriptMix(source)) sourceReasonCodes.push('unreadable_text');
    if (hasSectionHeadingMismatch(source, sourceItems)) {
      sourceReasonCodes.push('section_heading_mismatch');
    }
    if (sourceReasonCodes.length > 0) {
      return {
        releaseable: false,
        items: [],
        reasonCodes: sourceReasonCodes,
        excludedItemCount: 0,
      };
    }
  }

  if (reviewStatus === 'reviewed') {
    const auditedItems = sourceItems.map((item) => ({
      item,
      reasonCodes: platformFulfillmentItemReasonCodes(item)
        .filter((reasonCode) => reviewedHardSafetyReasonCodes.has(reasonCode)),
    }));
    const structurallyAbnormal = auditedItems.some(({ reasonCodes }) => (
      reasonCodes.includes('abnormal_structure')
    ));
    const items = auditedItems
      .filter(({ reasonCodes }) => reasonCodes.length === 0)
      .map(({ item }) => item);
    const reasonCodes = structurallyAbnormal ? ['abnormal_structure'] : [];
    if (items.length === 0) reasonCodes.push('no_items');
    const excludedItemCount = sourceItems.length - items.length;
    const excludedReasonCodes = Array.from(new Set(
      auditedItems.flatMap(({ reasonCodes: itemReasonCodes }) => itemReasonCodes),
    ));

    return {
      releaseable: reasonCodes.length === 0,
      items: reasonCodes.length === 0 ? items : [],
      reasonCodes,
      excludedItemCount,
      excludedReasonCodes,
    };
  }
  if (reviewStatus !== 'auto_approved') {
    return { releaseable: false, items: [], reasonCodes: ['source_needs_review'], excludedItemCount: 0 };
  }

  const reviewedItems = sourceItems.map((item) => ({
    item,
    reasonCodes: platformFulfillmentItemReasonCodes(item),
  }));
  const structurallyAbnormal = reviewedItems.some(({ reasonCodes }) => (
    reasonCodes.includes('abnormal_structure')
  ));
  const items = reviewedItems
    .filter(({ reasonCodes }) => reasonCodes.length === 0)
    .map(({ item }) => item);
  const excludedItemCount = sourceItems.length - items.length;
  const excludedReasonCodes = Array.from(new Set(
    reviewedItems.flatMap(({ reasonCodes }) => reasonCodes),
  ));
  const reasonCodes = structurallyAbnormal ? ['abnormal_structure'] : [];
  const normalized = items.map(compactText);
  if (new Set(normalized).size !== normalized.length) reasonCodes.push('duplicate_items');
  if (items.length === 0) reasonCodes.push('no_items');

  return {
    releaseable: reasonCodes.length === 0,
    items: reasonCodes.length === 0 ? items : [],
    reasonCodes: Array.from(new Set(reasonCodes)),
    excludedItemCount,
    excludedReasonCodes,
  };
}

export { releaseQualityVersion };
