import { partyTheme, type PartyThemeKey } from '../styles/partyThemes';

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
  const theme = partyTheme[partyKey];

  return (
    <div className={`flex ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
      <div className="inline-flex items-center gap-3">
        <div
          className="pixel-corners relative h-24 w-20 shrink-0 border p-2"
          style={{ borderColor: theme.primary, background: `linear-gradient(180deg, ${theme.primary}20, rgba(15,23,42,0.9))` }}
          aria-hidden="true"
        >
          <div className="grid h-full grid-cols-4 gap-1">
            {Array.from({ length: 16 }).map((_, index) => {
              const active = [1, 2, 4, 5, 6, 8, 9, 10, 13, 14].includes(index);
              const accent = variant === 'pulse-b' ? theme.accent : theme.primary;
              return (
                <div
                  key={`${variant}-${index}`}
                  className="rounded-none"
                  style={{ backgroundColor: active ? accent : 'rgba(255,255,255,0.06)' }}
                />
              );
            })}
          </div>
        </div>
        <div className="min-w-0">
          <p className="font-display text-sm text-white">{displayName}</p>
          <p className="mt-1 text-xs text-slate-400">{partyLabel}</p>
        </div>
      </div>
    </div>
  );
}
