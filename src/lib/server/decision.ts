import 'server-only';
import { DecisionFlags, ExtractedElectionData, MISSING } from '@/types';

export function evaluateElectionData(data: ExtractedElectionData, now = new Date()): DecisionFlags {
  const electionDay = data.election.electionDay;
  const parsedDate = electionDay !== MISSING ? new Date(`${electionDay}T23:59:59`) : null;

  return {
    hasUpcomingElection: Boolean(parsedDate && !Number.isNaN(parsedDate.valueOf()) && parsedDate >= now),
    hasPollingLocation: data.pollingLocations.length > 0,
    hasCandidateData: data.contests.some((contest) => contest.candidates.length > 0),
  };
}
