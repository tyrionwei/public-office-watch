import { useCallback, useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HomeElectionSpotlight } from '../components/HomeElectionSpotlight';
import { PartySeatDistributionPanel } from '../components/PartySeatDistributionPanel';
import { RegionIssueConcernPanel } from '../components/RegionIssueConcernPanel';
import { TaiwanStageSelect } from '../components/TaiwanStageSelect';
import { useI18n } from '../i18n';
import { selectHomeRegionId, selectHomeRelatedRaces } from '../lib/homeRaceSelection';
import { publicDataProvider } from '../lib/publicData';
import { normalizeTaiwanText } from '../lib/taiwanText';
import { useSelectedRegion } from '../selectedRegion';

const NATIONAL_REGION_QUERY = 'national';

export function HomePage() {
  const { t } = useI18n();
  const { selectedRegionId: storedRegionId, setSelectedRegionId } = useSelectedRegion();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedRegionId = searchParams.get('region');
  const requestedHomeRegionId = requestedRegionId ?? storedRegionId;
  const [homeData, setHomeData] = useState(() => publicDataProvider.getHomePageData());
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeLoadError, setHomeLoadError] = useState(false);
  useEffect(() => {
    let active = true;
    const regionId = !requestedHomeRegionId || requestedHomeRegionId === NATIONAL_REGION_QUERY
      ? null
      : requestedHomeRegionId;
    setHomeLoading(true);
    setHomeLoadError(false);
    void publicDataProvider.loadHomePageData(regionId)
      .then((data) => {
        if (active) setHomeData(data);
      })
      .catch((error: unknown) => {
        if (active) setHomeLoadError(true);
        if (import.meta.env.DEV) console.warn('Failed to load home data', error);
      })
      .finally(() => {
        if (active) setHomeLoading(false);
      });
    return () => { active = false; };
  }, [requestedHomeRegionId]);
  const selectedRegionId = selectHomeRegionId(
    homeData.stageRegions,
    requestedRegionId ?? storedRegionId,
  );
  const isNationalView = selectedRegionId === null;
  const relatedRaces = selectHomeRelatedRaces(homeData, selectedRegionId);
  const [, startTransition] = useTransition();

  const selectedRegionNode = selectedRegionId ? publicDataProvider.getStageRegion(selectedRegionId) : null;
  const selectedRegionSummary = selectedRegionId ? publicDataProvider.getRegionSummary(selectedRegionId) : null;
  const selectedRegionLabel = isNationalView
    ? t('national.taiwan')
    : normalizeTaiwanText(selectedRegionSummary?.label ?? selectedRegionNode?.label ?? t('home.unspecifiedRegion'));

  useEffect(() => {
    if (homeData.stageRegions.length === 0) return;
    const nextStoredRegionId = selectedRegionId ?? NATIONAL_REGION_QUERY;
    if (storedRegionId !== nextStoredRegionId) setSelectedRegionId(nextStoredRegionId);
  }, [homeData.stageRegions.length, selectedRegionId, setSelectedRegionId, storedRegionId]);

  const handleSelectRegion = useCallback((regionId: string | null) => {
    const currentRegionQuery = searchParams.get('region');
    const alreadyExplicitlySelected = regionId === selectedRegionId
      && (regionId === null
        ? currentRegionQuery === NATIONAL_REGION_QUERY
        : currentRegionQuery === regionId);
    if (alreadyExplicitlySelected) return;

    const nextRegionId = regionId ?? NATIONAL_REGION_QUERY;
    setSelectedRegionId(nextRegionId);
    startTransition(() => {
      const nextParams = new URLSearchParams(searchParams);
      if (regionId) nextParams.set('region', regionId);
      else nextParams.set('region', NATIONAL_REGION_QUERY);
      nextParams.delete('homeContent');
      nextParams.delete('candidateCategory');
      nextParams.delete('candidateDistrict');
      nextParams.delete('candidateIndex');
      setSearchParams(nextParams);
    });
  }, [searchParams, selectedRegionId, setSearchParams, setSelectedRegionId, startTransition]);

  return (
    <AppShell ticker={homeData.ticker}>
      <div className="grid gap-3 xl:min-h-[880px] xl:grid-cols-[minmax(420px,0.95fr)_minmax(480px,1.08fr)_minmax(300px,0.75fr)] xl:items-stretch">
        <section className="min-w-0 xl:h-full">
          <TaiwanStageSelect
            regions={homeData.stageRegions}
            selectedRegionId={selectedRegionId}
            onSelectRegion={handleSelectRegion}
          />
        </section>

        <section className="min-w-0 xl:h-full">
          <HomeElectionSpotlight
            races={relatedRaces}
            regionNode={selectedRegionNode}
            regionSummary={selectedRegionSummary}
            national={isNationalView}
            candidateSummaries={homeData.candidateSummaries ?? []}
            candidatesLoading={homeLoading}
            candidateLoadError={homeLoadError}
          />
        </section>

        <section className="min-w-0 space-y-3 xl:grid xl:h-full xl:grid-rows-[400px_minmax(0,1fr)] xl:gap-3 xl:space-y-0">
          <PartySeatDistributionPanel
            regionId={selectedRegionId}
            regionLabel={selectedRegionLabel}
            national={isNationalView}
            partyCounts={homeData.seatDistribution ?? []}
            loading={homeLoading}
          />
          <RegionIssueConcernPanel
            regionId={isNationalView ? null : selectedRegionNode?.publicRegionId ?? null}
            regionLabel={selectedRegionLabel}
            national={isNationalView}
          />
        </section>
      </div>
    </AppShell>
  );
}
