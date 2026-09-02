import {
  pickDefaultCandidateSprite,
  pickDefaultCandidateSpriteForAgeGroup,
  pickPersonCandidateSprite,
  unknownCandidateSprite,
  xiezhiMascotSprite,
  type CandidateAgeGroup,
} from '../data/defaultCharacterAssets';
import { useI18n } from '../i18n';
import { partyTheme, type PartyThemeKey } from '../styles/partyThemes';

type PixelCandidateSpriteProps = {
  displayName: string;
  personId?: string | null;
  partyKey: PartyThemeKey;
  partyLabel: string;
  variant: string;
  align?: 'left' | 'right';
  gender?: string | null;
  birthDate?: string | null;
  ageGroup?: CandidateAgeGroup | null;
  useDemographicSprite?: boolean;
};

export function PixelCandidateSprite({
  displayName,
  personId,
  partyKey,
  partyLabel,
  variant,
  align = 'left',
  gender,
  birthDate,
  ageGroup,
  useDemographicSprite = false,
}: PixelCandidateSpriteProps) {
  const { t } = useI18n();
  const personSprite = pickPersonCandidateSprite(personId);
  const demographicSprite = ageGroup === undefined
    ? pickDefaultCandidateSprite(`${displayName}-${variant}`, gender, birthDate)
    : pickDefaultCandidateSpriteForAgeGroup(gender, ageGroup);
  const spriteSrc = personSprite ?? (useDemographicSprite
    ? demographicSprite
    : partyKey === 'unknown' ? unknownCandidateSprite : pickDefaultCandidateSprite(`${displayName}-${variant}`));
  const usesMascot = spriteSrc === xiezhiMascotSprite;
  const usesDemographicFallback = !personSprite && useDemographicSprite && demographicSprite !== xiezhiMascotSprite;
  const theme = partyTheme[partyKey];

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
          <p
            className="theme-party-chip mt-1 inline-flex rounded-sm border px-1.5 py-0.5 text-[10px] font-medium"
            data-candidate-party-label
            data-party-theme={partyKey}
            style={{
              borderColor: theme.accent,
              backgroundColor: `${theme.primary}38`,
              color: theme.accent,
              boxShadow: `inset 0 0 0 1px ${theme.primary}55`,
            }}
          >
            {partyLabel}
          </p>
          {usesMascot ? (
            <p className="mt-1 text-[10px] text-cyan-200/75">{t('person.mascotFallbackLabel')}</p>
          ) : usesDemographicFallback ? (
            <p className="mt-1 text-[10px] text-cyan-200/75">{t('person.demographicFallbackLabel')}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
