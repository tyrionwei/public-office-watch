import { useEffect, useState } from 'react';
import type { MyBallotResult } from '../types/ballot.ts';
import type { VotingRegionPreference } from '../votingRegion.tsx';

type BallotQueryModule = typeof import('./myBallot.ts');

let loadedModule: BallotQueryModule | null = null;
let loadingPromise: Promise<BallotQueryModule> | null = null;

/** The large official mapping bundle is fetched only for an active ballot lookup. */
export function loadMyBallotModule(): Promise<BallotQueryModule> {
  if (loadedModule) return Promise.resolve(loadedModule);
  if (!loadingPromise) {
    loadingPromise = import('./myBallot.ts').then(
      (module) => {
        loadedModule = module;
        return module;
      },
      (error: unknown) => {
        loadingPromise = null;
        throw error;
      },
    );
  }
  return loadingPromise;
}

export function useMyBallot(eventKey: string | undefined, preference: VotingRegionPreference | null, enabled = true): {
  result: MyBallotResult | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
} {
  const [module, setModule] = useState<BallotQueryModule | null>(() => loadedModule);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const shouldLoad = enabled && Boolean(eventKey && preference);

  useEffect(() => {
    if (!shouldLoad || module) return;
    let active = true;
    setError(false);
    void loadMyBallotModule().then(
      (loaded) => { if (active) setModule(loaded); },
      () => { if (active) setError(true); },
    );
    return () => { active = false; };
  }, [shouldLoad, module, attempt]);

  const result = shouldLoad && module && eventKey && preference
    ? module.queryMyBallot(eventKey, preference)
    : null;
  return { result, loading: shouldLoad && !module && !error, error: shouldLoad && error, retry: () => setAttempt((value) => value + 1) };
}
