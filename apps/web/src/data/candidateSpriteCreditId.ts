import creditFiles from './candidateSpriteCreditFiles.json';
import { pickPersonCandidateSprite } from './defaultCharacterAssets';

// The complete attribution text stays in the About page's lazy-loaded module.
export function getCandidateSpriteCreditId(personId: string | null | undefined) {
  if (!personId) return null;
  const canonicalId = personId.toLowerCase();
  const file = (creditFiles as Record<string, string>)[canonicalId];
  return file && pickPersonCandidateSprite(canonicalId) === `/assets/characters/candidates/${file}`
    ? canonicalId : null;
}
