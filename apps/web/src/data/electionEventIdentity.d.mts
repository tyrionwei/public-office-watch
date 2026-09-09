import type { PublicElection, PublicRace } from '../types/publicViews';
export type ElectionEventFamily = 'national' | 'local' | 'referendum' | 'recall' | 'by_election' | 'other';
export function getDisplayElectionYear(election: PublicElection): number | null;
export function buildElectionEventKey(year: number | null, votingDate: string | null, family: ElectionEventFamily, discriminator?: string | null): string;
export function initialElectionEventKey(election: PublicElection): string;
export function electionEventIdentity(elections: PublicElection[], raceTypes?: PublicRace['race_type'][]): {
  family: ElectionEventFamily; year: number | null; votingDate: string | null; key: string;
};
