import { useCallback, useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HomeElectionSpotlight } from '../components/HomeElectionSpotlight';
import { PartySeatDistributionPanel } from '../components/PartySeatDistributionPanel';
import { RegionIssueConcernPanel } from '../components/RegionIssueConcernPanel';
import { TaiwanStageSelect } from '../components/TaiwanStageSelect';
import { useI18n } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import type { UpcomingRace } from '../lib/publicDataProvider';
import { normalizeTaiwanText } from '../lib/taiwanText';
import { useSelectedRegion } from '../selectedRegion';

const NATIONAL_REGION_QUERY = 'national';
const DEFAULT_FALLBACK_REGION_ID = 'taipei-city';

function isNationalRace(race: UpcomingRace) {
  const regionKey = `${race.regionId ?? ''} ${race.region ?? ''}`.toLowerCase();
  return race.raceType === 'president'
    || race.raceType === 'vice_president'
    || race.raceType === 'legislator'
    || race.raceType === 'legislative_district'
    || race.raceType === 'party_list_legislator'
    || race.raceType === 'indigenous'
    || race.raceType === 'referendum'
    || /taiwan|nationwide|全國|臺灣|台灣/.test(regionKey);
}

function getSelectedStageRegionId(
  regions: { id: string }[],
  requestedRegionId: string | null,
  hasUpcomingNationalRace: boolean,
) {
  if (requestedRegionId === NATIONAL_REGION_QUERY) {
    return null;
  }

  if (requestedRegionId && regions.some((region) => region.id === requestedRegionId)) {
    return requestedRegionId;
  }

  if (!hasUpcomingNationalRace && regions.some((region) => region.id === DEFAULT_FALLBACK_REGION_ID)) {
    return DEFAULT_FALLBACK_REGION_ID;
  }

  return null;
}

export function HomePage() {
  const { t } = useI18n();
  const { selectedRegionId: storedRegionId, setSelectedRegionId } = useSelectedRegion();
  const [searchParams, setSearchParams] = useSearchParams();
  const homeData = publicDataProvider.getHomePageData();
  const requestedRegionId = searchParams.get('region');
  const nationalRaces = publicDataProvider
    .getUpcomingRaces()
    .filter(isNationalRace)
    .filter((race) => race.status !== 'completed');
  const hasUpcomingNationalRace = nationalRaces.length > 0;
  const selectedRegionId = getSelectedStageRegionId(
    homeData.stageRegions,
    requestedRegionId ?? storedRegionId,
    hasUpcomingNationalRace,
  );
  const isNationalView = selectedRegionId === null;
  const [relatedRaces, setRelatedRaces] = useState(() => selectedRegionId
    ? publicDataProvider.getRelatedRacesByRegionId(selectedRegionId).filter((race) => race.status !== 'completed')
    : nationalRaces);
  const [, startTransition] = useTransition();
  useEffect(() => {
    let active = true;
    if (!selectedRegionId) {
      setRelatedRaces(publicDataProvider
        .getUpcomingRaces()
        .filter(isNationalRace)
        .filter((race) => race.status !== 'completed'));
      return () => {
        active = false;
      };
    }

    setRelatedRaces(publicDataProvider
      .getRelatedRacesByRegionId(selectedRegionId)
      .filter((race) => race.status !== 'completed'));

    void publicDataProvider.loadRelatedRacesByRegionId(selectedRegionId)
      .then((races) => {
        if (active) {
          setRelatedRaces(races.filter((race) => race.status !== 'completed'));
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [selectedRegionId]);

  const selectedRegionNode = selectedRegionId ? publicDataProvider.getStageRegion(selectedRegionId) : null;
  const selectedRegionSummary = selectedRegionId ? publicDataProvider.getRegionSummary(selectedRegionId) : null;
  const selectedRegionLabel = isNationalView
    ? t('national.taiwan')
    : normalizeTaiwanText(selectedRegionSummary?.label ?? selectedRegionNode?.label ?? t('home.unspecifiedRegion'));

  useEffect(() => {
    const nextStoredRegionId = selectedRegionId ?? NATIONAL_REGION_QUERY;
    if (storedRegionId !== nextStoredRegionId) setSelectedRegionId(nextStoredRegionId);
  }, [selectedRegionId, setSelectedRegionId, storedRegionId]);

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
