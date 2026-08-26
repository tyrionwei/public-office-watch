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
  const [homeData, setHomeData] = useState(() => publicDataProvider.getHomePageData());
  useEffect(() => {
    let active = true;
    void publicDataProvider.loadHomePageData()
      .then((data) => {
        if (active) setHomeData(data);
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) console.warn('Failed to load home data', error);
      });
    return () => { active = false; };
  }, []);
  const requestedRegionId = searchParams.get('region');
  const selectedRegionId = selectHomeRegionId(
    homeData.stageRegions,
    requestedRegionId ?? storedRegionId,
  );
  const isNationalView = selectedRegionId === null;
  const [relatedRaces, setRelatedRaces] = useState(() => (
    selectHomeRelatedRaces(homeData, selectedRegionId)
  ));
  const [, startTransition] = useTransition();
  useEffect(() => {
    let active = true;
    setRelatedRaces(selectHomeRelatedRaces(homeData, selectedRegionId));
    if (!selectedRegionId) {
      return () => {
        active = false;
      };
    }

    void publicDataProvider.loadRelatedRacesByRegionId(selectedRegionId)
      .then((races) => {
        if (active) {
          setRelatedRaces(selectHomeRelatedRaces({
            stageRegions: homeData.stageRegions,
            upcomingRaces: races,
          }, selectedRegionId));
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [homeData, selectedRegionId]);

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
    if (regionId === selectedRegionId && searchParams.get('region') === regionId) {
      return;
    }

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
          />
        </section>

        <section className="min-w-0 space-y-3 xl:grid xl:h-full xl:grid-rows-[400px_minmax(0,1fr)] xl:gap-3 xl:space-y-0">
          <PartySeatDistributionPanel
            regionId={selectedRegionId}
            regionLabel={selectedRegionLabel}
            national={isNationalView}
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
