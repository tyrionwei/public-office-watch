/* eslint-disable react-refresh/only-export-components */
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

const storageKey = 'public-office-watch.selected-region';

type SelectedRegionContextValue = {
  selectedRegionId: string | null;
  setSelectedRegionId: (regionId: string) => void;
};

const SelectedRegionContext = createContext<SelectedRegionContextValue | null>(null);

function getInitialSelectedRegionId() {
  if (typeof window === 'undefined') return null;

  const stored = window.localStorage.getItem(storageKey)?.trim();
  return stored || null;
}

export function SelectedRegionProvider({ children }: PropsWithChildren) {
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(getInitialSelectedRegionId);

  useEffect(() => {
    if (selectedRegionId) {
      window.localStorage.setItem(storageKey, selectedRegionId);
    }
  }, [selectedRegionId]);

  const value = useMemo(() => ({ selectedRegionId, setSelectedRegionId }), [selectedRegionId]);

  return <SelectedRegionContext.Provider value={value}>{children}</SelectedRegionContext.Provider>;
}

export function useSelectedRegion() {
  const context = useContext(SelectedRegionContext);

  if (!context) {
    throw new Error('useSelectedRegion must be used within SelectedRegionProvider');
  }

  return context;
}
