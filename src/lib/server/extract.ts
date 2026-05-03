import 'server-only';
import { ExtractedElectionData, MISSING } from '@/types';

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : MISSING;
}

function list(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function civicAddress(value: any) {
  return {
    locationName: text(value?.locationName),
    line1: text(value?.line1),
    city: text(value?.city),
    state: text(value?.state),
    zip: text(value?.zip),
  };
}

export function extractElectionData(payload: any): ExtractedElectionData {
  const election = payload?.election || {};
  const state = list(payload?.state)[0] || {};
  const electionAdministrationBody = state?.electionAdministrationBody || {};
  const pollingLocations = list(payload?.pollingLocations).map((location: any) => ({
    address: civicAddress(location?.address),
    pollingHours: text(location?.pollingHours),
    startDate: text(location?.startDate),
    endDate: text(location?.endDate),
  }));

  const contests = list(payload?.contests).map((contest: any) => ({
    type: text(contest?.type),
    office: text(contest?.office),
    level: list(contest?.level).map(text),
    district: {
      name: text(contest?.district?.name),
      scope: text(contest?.district?.scope),
    },
    candidates: list(contest?.candidates).map((candidate: any) => ({
      name: text(candidate?.name),
      party: text(candidate?.party),
      candidateUrl: text(candidate?.candidateUrl),
      phone: text(candidate?.phone),
      photoUrl: text(candidate?.photoUrl),
      email: text(candidate?.email),
      orderOnBallot: typeof candidate?.orderOnBallot === 'number' ? candidate.orderOnBallot : undefined,
    })),
  }));

  return {
    election: {
      id: text(election?.id),
      name: text(election?.name),
      electionDay: text(election?.electionDay),
      ocdDivisionId: text(election?.ocdDivisionId),
    },
    normalizedInput: civicAddress(payload?.normalizedInput),
    officialResources: {
      stateName: text(state?.name),
      electionAuthorityName: text(electionAdministrationBody?.name),
      electionAuthorityPhone: text(electionAdministrationBody?.electionOfficials?.[0]?.officePhoneNumber),
      electionAuthorityEmail: text(electionAdministrationBody?.electionOfficials?.[0]?.emailAddress),
      electionInfoUrl: text(electionAdministrationBody?.electionInfoUrl),
      votingLocationFinderUrl: text(electionAdministrationBody?.votingLocationFinderUrl),
      ballotInfoUrl: text(electionAdministrationBody?.ballotInfoUrl),
      electionRegistrationUrl: text(electionAdministrationBody?.electionRegistrationUrl),
      electionRegistrationConfirmationUrl: text(electionAdministrationBody?.electionRegistrationConfirmationUrl),
      absenteeVotingInfoUrl: text(electionAdministrationBody?.absenteeVotingInfoUrl),
    },
    pollingLocations,
    contests,
    rawPayload: payload,
  };
}
