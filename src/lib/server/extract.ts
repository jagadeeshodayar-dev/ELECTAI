import 'server-only';
import { ExtractedElectionData, MISSING, SupportedCountry } from '@/types';

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

const INDIA_OFFICIAL_RESOURCES = {
  stateName: MISSING,
  electionAuthorityName: 'Election Commission of India',
  electionAuthorityPhone: MISSING,
  electionAuthorityEmail: MISSING,
  electionInfoUrl: 'https://www.eci.gov.in/',
  votingLocationFinderUrl: 'https://voters.eci.gov.in/',
  ballotInfoUrl: 'https://affidavit.eci.gov.in/',
  electionRegistrationUrl: 'https://voters.eci.gov.in/',
  electionRegistrationConfirmationUrl: 'https://electoralsearch.eci.gov.in/',
  absenteeVotingInfoUrl: 'https://ecisveep.nic.in/voters/how-to-vote/',
};

function postalCodeFromAddress(address: string, country: SupportedCountry) {
  const pattern = country === 'IN' ? /\b\d{6}\b/ : /\b\d{5}(?:-\d{4})?\b/;
  return address.match(pattern)?.[0] || MISSING;
}

export function buildIndiaElectionData(displayAddress: string): ExtractedElectionData {
  return {
    country: 'IN',
    dataProvider: 'Google Geocoding + official Election Commission of India resources',
    providerStatus: 'India official-link workflow. Google can normalize the address, while polling booth, voter record, schedule, and candidate details must be checked on official ECI services.',
    providerNotes: [
      'Google Civic voterInfo is U.S.-focused, so India mode does not call Civic for polling booth or candidate data.',
      'India polling station lookup requires an official ECI voter search using EPIC, mobile, or voter details.',
      'Candidate data is published on the ECI Candidate Affidavit portal after nominations are filed.',
    ],
    election: {
      id: 'india-election-services',
      name: 'India voter record and polling-booth lookup',
      electionDay: MISSING,
      ocdDivisionId: 'country:in',
    },
    normalizedInput: {
      locationName: MISSING,
      line1: displayAddress,
      city: MISSING,
      state: MISSING,
      zip: postalCodeFromAddress(displayAddress, 'IN'),
    },
    officialResources: INDIA_OFFICIAL_RESOURCES,
    pollingLocations: [],
    contests: [],
    rawPayload: { provider: 'india-scaffold' },
  };
}

export function extractElectionData(payload: any, country: SupportedCountry = 'US'): ExtractedElectionData {
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
    country,
    dataProvider: 'Google Civic Information API',
    providerStatus: 'Live Google Civic voterInfo lookup',
    providerNotes: ['Google Civic voterInfo currently powers the U.S. provider in this app.'],
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
