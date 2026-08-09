export const defaultMaleCandidateSprites = [
  '/assets/characters/candidate-male-01.png',
  '/assets/characters/candidate-male-02.png',
  '/assets/characters/candidate-male-03.png',
  '/assets/characters/candidate-male-04.png',
];

export const defaultFemaleCandidateSprites = [
  '/assets/characters/candidate-female-01.png',
  '/assets/characters/candidate-female-02.png',
  '/assets/characters/candidate-female-03.png',
  '/assets/characters/candidate-female-04.png',
];

export const defaultCandidateSprites = [...defaultMaleCandidateSprites, ...defaultFemaleCandidateSprites];
export const xiezhiMascotPoses = {
  idle: '/assets/characters/xiezhi/xiezhi-idle.png',
  blink: '/assets/characters/xiezhi/xiezhi-blink.png',
  hop: '/assets/characters/xiezhi/xiezhi-hop.png',
  play: '/assets/characters/xiezhi/xiezhi-play.png',
  signInfo: '/assets/characters/xiezhi/xiezhi-sign-info.png',
  signWarning: '/assets/characters/xiezhi/xiezhi-sign-warning.png',
} as const;

export const xiezhiMascotSprite = xiezhiMascotPoses.idle;
export const unknownCandidateSprite = xiezhiMascotSprite;
export const dataPrinciplesGuideSprite = xiezhiMascotSprite;

export type CandidateAgeGroup = 'under-40' | '40-49' | '50-59' | '60-plus';

const ageGroupIndexes: Record<CandidateAgeGroup, number> = {
  'under-40': 0,
  '40-49': 1,
  '50-59': 2,
  '60-plus': 3,
};

type BirthDateParts = {
  year: number;
  month: number;
  day: number;
};

function validBirthDateParts(year: number, month: number, day: number): BirthDateParts | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function parseBirthDate(value: string | null | undefined): BirthDateParts | null {
  if (!value) return null;
  const normalized = value.normalize('NFKC').trim();
  const yearMarker = '\\u5e74';
  const monthMarker = '\\u6708';
  const dayMarker = '\\u65e5';

  const western = normalized.match(new RegExp(
    `(?:^|\\D)((?:18|19|20)\\d{2})\\s*(?:[-/.]\\s*|${yearMarker}\\s*)(\\d{1,2})\\s*(?:[-/.]\\s*|${monthMarker}\\s*)(\\d{1,2})(?:\\s*${dayMarker})?(?:\\D|$)`,
  ));
  if (western) {
    return validBirthDateParts(Number(western[1]), Number(western[2]), Number(western[3]));
  }

  const roc = normalized.match(new RegExp(
    `\\u6c11\\u570b\\s*(\\d{1,3})\\s*(?:[-/.]\\s*|${yearMarker}\\s*)(\\d{1,2})\\s*(?:[-/.]\\s*|${monthMarker}\\s*)(\\d{1,2})(?:\\s*${dayMarker})?`,
  ));
  if (roc) {
    return validBirthDateParts(1911 + Number(roc[1]), Number(roc[2]), Number(roc[3]));
  }

  return null;
}

export function candidateAgeGroup(
  birthDate: string | null | undefined,
  referenceDate = new Date(),
): CandidateAgeGroup | null {
  const parts = parseBirthDate(birthDate);
  if (!parts || Number.isNaN(referenceDate.getTime())) return null;

  let age = referenceDate.getFullYear() - parts.year;
  const beforeBirthday = (
    referenceDate.getMonth() + 1 < parts.month
    || (
      referenceDate.getMonth() + 1 === parts.month
      && referenceDate.getDate() < parts.day
    )
  );
  if (beforeBirthday) age -= 1;
  if (age < 0 || age > 120) return null;

  if (age < 40) return 'under-40';
  if (age < 50) return '40-49';
  if (age < 60) return '50-59';
  return '60-plus';
}

export function pickDefaultCandidateSprite(
  _seed: string,
  gender?: string | null,
  birthDate?: string | null,
  referenceDate = new Date(),
) {
  if (gender !== 'male' && gender !== 'female') return xiezhiMascotSprite;

  const ageGroup = candidateAgeGroup(birthDate, referenceDate);
  if (!ageGroup) return xiezhiMascotSprite;

  const sprites = gender === 'male' ? defaultMaleCandidateSprites : defaultFemaleCandidateSprites;
  return sprites[ageGroupIndexes[ageGroup]];
}
