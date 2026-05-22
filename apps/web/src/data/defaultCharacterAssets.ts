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
export const unknownCandidateSprite = '/assets/characters/candidate-unknown.png';
export const dataPrinciplesGuideSprite = '/assets/characters/data-principles-guide.png';

function pickFromSprites(seed: string, sprites: string[]) {
  const hash = Array.from(seed).reduce((value, char) => value + char.charCodeAt(0), 0);
  return sprites[hash % sprites.length];
}

export function pickDefaultCandidateSprite(seed: string, gender?: string | null) {
  if (gender === 'male') {
    return pickFromSprites(seed, defaultMaleCandidateSprites);
  }

  if (gender === 'female') {
    return pickFromSprites(seed, defaultFemaleCandidateSprites);
  }

  return pickFromSprites(seed, defaultCandidateSprites);
}
