/* eslint-disable react-refresh/only-export-components */
import { createContext, type PropsWithChildren, useContext, useMemo, useState } from 'react';

export const votingRegionStorageKey = 'public-office-watch.voting-region-preference.v1';

export type VotingRegionChoice = {
  id: string;
  name: string;
};

export type VotingRegionPreference = {
  county: VotingRegionChoice;
  district?: VotingRegionChoice;
  village?: VotingRegionChoice;
  source: 'manual' | 'confirmed-location';
  confirmedAt: string;
};

export type CurrentLocation = {
  county: VotingRegionChoice;
  district?: VotingRegionChoice;
  detectedAt: string;
};

type VotingRegionContextValue = {
  preference: VotingRegionPreference | null;
  currentLocation: CurrentLocation | null;
  setCurrentLocation: (location: CurrentLocation | null) => void;
  confirmPreference: (preference: VotingRegionPreference) => void;
  clearPreference: () => void;
};

const VotingRegionContext = createContext<VotingRegionContextValue | null>(null);

function isChoice(value: unknown): value is VotingRegionChoice {
  if (!value || typeof value !== 'object') return false;
  const choice = value as Partial<VotingRegionChoice>;
  return typeof choice.id === 'string' && choice.id.length > 0
    && typeof choice.name === 'string' && choice.name.length > 0;
}

function readStoredPreference(): VotingRegionPreference | null {
  if (typeof window === 'undefined') return null;

  try {
    const value = JSON.parse(window.localStorage.getItem(votingRegionStorageKey) ?? 'null') as Partial<VotingRegionPreference> | null;
    if (!value || !isChoice(value.county)) return null;
    if (value.district !== undefined && !isChoice(value.district)) return null;
    if (value.village !== undefined && !isChoice(value.village)) return null;
    if (value.source !== 'manual' && value.source !== 'confirmed-location') return null;
    if (typeof value.confirmedAt !== 'string') return null;
    return value as VotingRegionPreference;
  } catch {
    return null;
  }
}

export function VotingRegionProvider({ children }: PropsWithChildren) {
  const [preference, setPreference] = useState<VotingRegionPreference | null>(readStoredPreference);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null);

  const value = useMemo<VotingRegionContextValue>(() => ({
    preference,
    currentLocation,
    setCurrentLocation,
    confirmPreference(nextPreference) {
      window.localStorage.setItem(votingRegionStorageKey, JSON.stringify(nextPreference));
      setPreference(nextPreference);
    },
    clearPreference() {
      window.localStorage.removeItem(votingRegionStorageKey);
      setPreference(null);
    },
  }), [currentLocation, preference]);

  return <VotingRegionContext.Provider value={value}>{children}</VotingRegionContext.Provider>;
}

export function useVotingRegion() {
  const context = useContext(VotingRegionContext);
  if (!context) throw new Error('useVotingRegion must be used within VotingRegionProvider');
  return context;
}
