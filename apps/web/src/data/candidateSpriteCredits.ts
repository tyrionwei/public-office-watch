import sourceManifest from './candidateSpriteSources.json';
import { pickPersonCandidateSprite } from './defaultCharacterAssets';

type SpriteCredit = (typeof sourceManifest.assets)[number] & { adaptationLicense?: string };
export const candidateSpriteCredits: SpriteCredit[] = sourceManifest.assets;

export function getCandidateSpriteCredit(personId: string | null | undefined) {
  if (!personId) return null;
  const canonicalId = personId.toLowerCase();
  const credit = candidateSpriteCredits.find((item) => item.canonicalId === canonicalId);
  return credit && pickPersonCandidateSprite(canonicalId) === `/assets/characters/candidates/${credit.file}`
    ? credit : null;
}
