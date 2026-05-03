export const MISSING = 'This information is not available.';

export type CivicAddress = {
  locationName: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
};

export type PollingLocation = {
  address: CivicAddress;
  pollingHours: string;
  startDate: string;
  endDate: string;
};

export type Candidate = {
  name: string;
  party: string;
  candidateUrl: string;
  phone: string;
  photoUrl: string;
  email: string;
  orderOnBallot?: number;
};

export type Contest = {
  type: string;
  office: string;
  level: string[];
  district: {
    name: string;
    scope: string;
  };
  candidates: Candidate[];
};

export type OfficialElectionResources = {
  stateName: string;
  electionAuthorityName: string;
  electionAuthorityPhone: string;
  electionAuthorityEmail: string;
  electionInfoUrl: string;
  votingLocationFinderUrl: string;
  ballotInfoUrl: string;
  electionRegistrationUrl: string;
  electionRegistrationConfirmationUrl: string;
  absenteeVotingInfoUrl: string;
};

export type ExtractedElectionData = {
  election: {
    id: string;
    name: string;
    electionDay: string;
    ocdDivisionId: string;
  };
  normalizedInput: CivicAddress;
  officialResources: OfficialElectionResources;
  pollingLocations: PollingLocation[];
  contests: Contest[];
  rawPayload?: unknown;
};

export type DecisionFlags = {
  hasUpcomingElection: boolean;
  hasPollingLocation: boolean;
  hasCandidateData: boolean;
};

export type UserSession = {
  id: string;
  sanitizedAddress: string;
  electionData: ExtractedElectionData;
  decisionFlags: DecisionFlags;
  currentStep: number;
  createdAt: number;
  updatedAt: number;
  addressSource?: 'input' | 'google-geocoding';
  userId?: string | null;
};

export type GuidanceResponse = {
  stepInstructions: string[];
  timelineSummary: string;
  pollingLocationDetails: string;
  candidateOverview: string;
  nextConcreteAction: string;
  transparencyNote: string;
};

export type AssistantResponse = {
  session: UserSession;
  guidance: GuidanceResponse;
};

export type SpeechTranscriptionResponse = {
  transcript: string;
  normalizedAddress: string;
  needsMoreDetail: boolean;
};
