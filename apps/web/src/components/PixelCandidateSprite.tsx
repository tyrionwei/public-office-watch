import { pickDefaultCandidateSprite, unknownCandidateSprite } from '../data/defaultCharacterAssets';
import type { PartyThemeKey } from '../styles/partyThemes';

type PixelCandidateSpriteProps = {
  displayName: string;
  partyKey: PartyThemeKey;
  partyLabel: string;
  variant: string;
  align?: 'left' | 'right';
};

export function PixelCandidateSprite({
  displayName,
  partyKey,
  partyLabel,
  variant,
  align = 'left',
}: PixelCandidateSpriteProps) {
  const spriteSrc = partyKey === 'unknown' ? unknownCandidateSprite : pickDefaultCandidateSprite(`${displayName}-${variant}`);

  return (
    <div className={`flex ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
      <div className="inline-flex items-center gap-3">
        <div
          className="relative flex h-28 w-24 shrink-0 items-end justify-center overflow-visible"
          aria-hidden="true"
        >
          <img
            src={spriteSrc}
            alt=""
            className="h-full w-auto object-contain object-bottom drop-shadow-[0_10px_8px_rgba(0,0,0,0.42)] [image-rendering:pixelated]"
            draggable={false}
          />
        </div>
        <div className="min-w-0">
          <p className="font-display text-sm text-white">{displayName}</p>
          <p className="mt-1 text-xs text-slate-400">{partyLabel}</p>
        </div>
      </div>
    </div>
  );
}
