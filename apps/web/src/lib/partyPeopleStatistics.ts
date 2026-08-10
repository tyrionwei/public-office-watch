import { candidateAgeGroup } from '../data/defaultCharacterAssets.ts';
import type {
  PublicPartyPeopleStatisticBucket,
  PublicPartyPeopleStatisticDimension,
  PublicPartyPeopleStatisticRow,
  PublicPerson,
  PublicPersonClaim,
} from '../types/publicViews.ts';
import { getEducationStatisticsDimension, getStatisticsPartyLabel } from './statisticsDimensions.ts';

const dimensionBuckets: Record<
  PublicPartyPeopleStatisticDimension,
  PublicPartyPeopleStatisticBucket[]
> = {
  current_status: ['current', 'not_current'],
  gender: ['male', 'female', 'unknown'],
  age: ['under_40', '40_49', '50_59', '60_plus', 'unknown'],
  education: [
    'doctorate',
    'master',
    'university',
    'tertiary_unspecified',
    'junior_college',
    'high_school',
    'secondary_or_below',
    'other',
    'unknown',
  ],
};

function getBirthDateByPersonId(claims: PublicPersonClaim[]) {
  const valuesByPersonId = new Map<string, Set<string>>();

  for (const claim of claims) {
    const value = claim.claim_value?.trim();
    if (claim.claim_type !== 'birth_date' || !value) continue;
    const values = valuesByPersonId.get(claim.person_id) ?? new Set<string>();
    values.add(value);
    valuesByPersonId.set(claim.person_id, values);
  }

  return new Map(Array.from(valuesByPersonId.entries())
    .filter(([, values]) => values.size === 1)
    .map(([personId, values]) => [personId, Array.from(values)[0]]));
}

function ageBucket(birthDate: string | undefined, referenceDate: Date) {
  const group = candidateAgeGroup(birthDate, referenceDate);
  return group?.replace('-', '_') as PublicPartyPeopleStatisticBucket | undefined;
}

export function buildPartyPeopleStatistics(
  partyName: string,
  people: PublicPerson[],
  claims: PublicPersonClaim[],
  referenceDate = new Date(),
): PublicPartyPeopleStatisticRow[] {
  const normalizedPartyName = getStatisticsPartyLabel(partyName);
  const partyPeople = people.filter(
    (person) => getStatisticsPartyLabel(person.party) === normalizedPartyName,
  );
  const birthDates = getBirthDateByPersonId(claims);
  const counts = new Map<string, number>();

  function add(dimension: PublicPartyPeopleStatisticDimension, bucket: PublicPartyPeopleStatisticBucket) {
    const key = `${dimension}:${bucket}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  for (const person of partyPeople) {
    add('current_status', person.current_office_label?.trim() ? 'current' : 'not_current');
    add('gender', person.gender === 'male' || person.gender === 'female' ? person.gender : 'unknown');
    add('age', ageBucket(birthDates.get(person.person_id), referenceDate) ?? 'unknown');
    add('education', getEducationStatisticsDimension(person.education).key);
  }

  return (Object.entries(dimensionBuckets) as Array<[
    PublicPartyPeopleStatisticDimension,
    PublicPartyPeopleStatisticBucket[],
  ]>).flatMap(([dimension, buckets]) => buckets.map((bucket) => ({
    party_name: normalizedPartyName,
    dimension_key: dimension,
    bucket_key: bucket,
    people_count: counts.get(`${dimension}:${bucket}`) ?? 0,
    total_people: partyPeople.length,
  })));
}
