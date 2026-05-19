import { createContext, useContext } from 'react';

export type BgmContextValue = {
  enabled: boolean;
  toggle: () => void;
};

export const BgmContext = createContext<BgmContextValue | null>(null);

export function useBgm() {
  const context = useContext(BgmContext);

  if (!context) {
    throw new Error('useBgm must be used inside BgmProvider');
  }

  return context;
}
