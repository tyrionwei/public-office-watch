import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import { normalizeTaiwanText } from '../lib/taiwanText';
import { useSelectedRegion } from '../selectedRegion';

const NATIONAL_REGION_QUERY = 'national';

export function CurrentRegionControl() {
  const { t } = useI18n();
  const { selectedRegionId } = useSelectedRegion();

  if (!selectedRegionId) return null;

  const regionLabel = selectedRegionId === NATIONAL_REGION_QUERY
    ? t('stage.nationalOverview')
    : normalizeTaiwanText(
      publicDataProvider.getRegionSummary(selectedRegionId)?.label
        ?? publicDataProvider.getStageRegion(selectedRegionId)?.label
        ?? selectedRegionId,
    );
  const query = new URLSearchParams({ region: selectedRegionId });

  return (
    <Link
      to={`/?${query.toString()}`}
      data-current-region
      className="pixel-corners inline-flex min-h-8 items-center gap-2 border border-line/70 bg-bg/35 px-3 py-1.5 text-[11px] text-slate-300 transition hover:border-accent/55 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent/35"
      aria-label={t('regionPreference.changeAria', { region: regionLabel })}
    >
      <span>{t('regionPreference.current', { region: regionLabel })}</span>
      <span className="text-accent">{t('regionPreference.change')}</span>
    </Link>
  );
}
