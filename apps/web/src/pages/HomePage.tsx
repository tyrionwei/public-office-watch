import { useCallback, useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { LocalOfficeSummaryPanel } from '../components/LocalOfficeSummaryPanel';
import { NationalOfficeSummaryPanel } from '../components/NationalOfficeSummaryPanel';
import { NationalOverviewHud } from '../components/NationalOverviewHud';
import { PollComparisonPanel } from '../components/PollComparisonPanel';
import { RegionIssueConcernPanel } from '../components/RegionIssueConcernPanel';
import { SelectedRegionHud } from '../components/SelectedRegionHud';
import { TaiwanStageSelect } from '../components/TaiwanStageSelect';
import { UpcomingElectionCards } from '../components/UpcomingElectionCards';
import { useI18n } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import type { UpcomingRace } from '../lib/publicDataProvider';

const NATIONAL_REGION_QUERY = 'national';
const DEFAULT_FALLBACK_REGION_ID = 'taipei-city';

function isNationalRace(race: UpcomingRace) {
  const regionKey = `${race.regionId ?? ''} ${race.region ?? ''}`.toLowerCase();
  return race.raceType === 'president'
    || race.raceType === 'vice_president'
    || race.raceType === 'party_list_legislator'
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
    requestedRegionId,
    hasUpcomingNationalRace,
  );
  const isNationalView = selectedRegionId === null;
  const isAutomaticRegionFallback = selectedRegionId === DEFAULT_FALLBACK_REGION_ID
    && requestedRegionId !== DEFAULT_FALLBACK_REGION_ID
    && requestedRegionId !== NATIONAL_REGION_QUERY
    && !hasUpcomingNationalRace;
  const [relatedRaces, setRelatedRaces] = useState(() => selectedRegionId
    ? publicDataProvider.getRelatedRacesByRegionId(selectedRegionId).filter((race) => race.status !== 'completed')
    : nationalRaces);
  const [, startTransition] = useTransition();

  const pollComparison = publicDataProvider.getPollComparisonByElectionId(relatedRaces[0]?.electionId ?? '');

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

  const handleSelectRegion = useCallback((regionId: string | null) => {
    if (regionId === selectedRegionId && searchParams.get('region') === regionId) {
      return;
    }

    startTransition(() => {
      const nextParams = new URLSearchParams(searchParams);
      if (regionId) nextParams.set('region', regionId);
      else nextParams.set('region', NATIONAL_REGION_QUERY);
      setSearchParams(nextParams);
    });
  }, [searchParams, selectedRegionId, setSearchParams, startTransition]);

  return (
    <AppShell ticker={homeData.ticker}>
      <div className="grid gap-3 xl:grid-cols-[minmax(460px,1.08fr)_minmax(360px,0.78fr)_minmax(340px,0.72fr)]">
        <section className="min-w-0 space-y-3">
          <div className="min-w-0">
            <TaiwanStageSelect
              regions={homeData.stageRegions}
              selectedRegionId={selectedRegionId}
              onSelectRegion={handleSelectRegion}
              hideQuickSelect
            />
          </div>
        </section>

        <section className="min-w-0 space-y-3">
          {isAutomaticRegionFallback ? (
            <p
              className="pixel-corners border border-accent/35 bg-accent/10 px-3 py-2 text-xs leading-relaxed text-slate-300"
              data-national-fallback-notice
            >
              {t('home.nationalElectionFallback')}
            </p>
          ) : null}
          {isNationalView ? (
            <NationalOverviewHud races={relatedRaces} />
          ) : selectedRegionNode && selectedRegionSummary ? (
            <SelectedRegionHud races={relatedRaces} regionNode={selectedRegionNode} regionSummary={selectedRegionSummary} />
          ) : null}
          {pollComparison ? <PollComparisonPanel comparison={pollComparison} /> : null}
          <UpcomingElectionCards
            races={relatedRaces}
            selectedRegionId={selectedRegionId ?? 'taiwan'}
            selectedRegionLabel={isNationalView ? t('national.taiwan') : selectedRegionSummary?.label ?? selectedRegionNode?.label ?? t('home.unspecifiedRegion')}
            selectedPublicRegionId={selectedRegionNode?.publicRegionId ?? null}
            compact
          />
          <RegionIssueConcernPanel
            regionId={isNationalView ? null : selectedRegionNode?.publicRegionId ?? null}
            regionLabel={isNationalView
              ? t('national.taiwan')
              : selectedRegionSummary?.label ?? selectedRegionNode?.label ?? t('home.unspecifiedRegion')}
            national={isNationalView}
          />
        </section>

        <section className="min-w-0">
          {isNationalView ? <NationalOfficeSummaryPanel /> : <LocalOfficeSummaryPanel regionId={selectedRegionId} />}
        </section>
      </div>
    </AppShell>
  );
}
