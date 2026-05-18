export const defaultCandidateSprites = [
  '/assets/characters/candidate-male-01.png',
  '/assets/characters/candidate-male-02.png',
  '/assets/characters/candidate-male-03.png',
  '/assets/characters/candidate-male-04.png',
  '/assets/characters/candidate-female-01.png',
  '/assets/characters/candidate-female-02.png',
  '/assets/characters/candidate-female-03.png',
  '/assets/characters/candidate-female-04.png',
];

export const unknownCandidateSprite = '/assets/characters/candidate-unknown.png';
export const dataPrinciplesGuideSprite = '/assets/characters/data-principles-guide.png';

export function pickDefaultCandidateSprite(seed: string) {
  const hash = Array.from(seed).reduce((value, char) => value + char.charCodeAt(0), 0);
  return defaultCandidateSprites[hash % defaultCandidateSprites.length];
}
