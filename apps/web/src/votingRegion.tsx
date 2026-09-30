/* eslint-disable react-refresh/only-export-components */
import { createContext, type PropsWithChildren, useContext, useMemo, useState } from 'react';

import { validNeighborhood } from './lib/pollingPlace';
import type { BallotCategory } from './types/ballot';

export const votingRegionStorageKey = 'public-office-watch.voting-region-preference.v1';

export type VotingRegionChoice = {
  id: string;
  name: string;
};

export type VotingRegionPreference = {
  county: VotingRegionChoice;
  district?: VotingRegionChoice;
  village?: VotingRegionChoice;
  neighborhood?: number;
  ballotCategory?: BallotCategory;
  source: 'manual' | 'confirmed-location';
  confirmedAt: string;
};

export type CurrentLocation = {
  county: VotingRegionChoice;
  district?: VotingRegionChoice;
  detectedAt: string;
};

export type VotingRegionPanel = 'ballots' | 'polling' | 'settings';

type VotingRegionContextValue = {
  panel: VotingRegionPanel;
  openPanel: (panel: VotingRegionPanel) => void;
  selectPanel: (panel: VotingRegionPanel) => void;
  finishEditing: () => void;
  editorOpen: boolean;
  setEditorOpen: (open: boolean) => void;
  preference: VotingRegionPreference | null;
  currentLocation: CurrentLocation | null;
  setCurrentLocation: (location: CurrentLocation | null) => void;
  confirmPreference: (preference: VotingRegionPreference) => boolean;
  clearPreference: () => boolean;
};

const VotingRegionContext = createContext<VotingRegionContextValue | null>(null);

function isChoice(value: unknown): value is VotingRegionChoice {
  if (!value || typeof value !== 'object') return false;
  const choice = value as Partial<VotingRegionChoice>;
  return typeof choice.id === 'string' && choice.id.length > 0
    && typeof choice.name === 'string' && choice.name.length > 0;
}

function validBallotCategory(value: unknown): BallotCategory {
  return value === 'general' || value === 'lowland' || value === 'highland' ? value : 'unspecified';
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
    return { ...value, neighborhood: value.village ? validNeighborhood(value.neighborhood) : undefined, ballotCategory: validBallotCategory(value.ballotCategory) } as VotingRegionPreference;
  } catch {
    return null;
  }
}

export function VotingRegionProvider({ children }: PropsWithChildren) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [panel, setPanel] = useState<VotingRegionPanel>('settings');
  const [returnPanel, setReturnPanel] = useState<VotingRegionPanel | null>(null);
  const [preference, setPreference] = useState<VotingRegionPreference | null>(readStoredPreference);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null);

  const value = useMemo<VotingRegionContextValue>(() => ({
    editorOpen,
    panel,
    setEditorOpen(open) {
      if (open) { setPanel('settings'); setReturnPanel(null); }
      setEditorOpen(open);
    },
    openPanel(next) {
      setPanel(next);
      setReturnPanel(next === 'settings' ? null : next);
      setEditorOpen(true);
    },
    selectPanel(next) {
      if (next !== 'settings') setReturnPanel(next);
      else if (panel !== 'settings') setReturnPanel(panel);
      setPanel(next);
    },
    finishEditing() {
      if (returnPanel) setPanel(returnPanel);
      else setEditorOpen(false);
    },
    preference,
    currentLocation,
    setCurrentLocation,
    confirmPreference(nextPreference) {
      const safePreference = { ...nextPreference, ballotCategory: validBallotCategory(nextPreference.ballotCategory) };
      try {
        window.localStorage.setItem(votingRegionStorageKey, JSON.stringify(safePreference));
      } catch {
        return false;
      }
      setPreference(safePreference);
      return true;
    },
    clearPreference() {
      try {
        window.localStorage.removeItem(votingRegionStorageKey);
      } catch {
        return false;
      }
      setPreference(null);
      return true;
    },
  }), [currentLocation, preference, editorOpen, panel, returnPanel]);

  return <VotingRegionContext.Provider value={value}>{children}</VotingRegionContext.Provider>;
}

export function useVotingRegion() {
  const context = useContext(VotingRegionContext);
  if (!context) throw new Error('useVotingRegion must be used within VotingRegionProvider');
  return context;
}
