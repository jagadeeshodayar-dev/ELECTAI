export const MISSING = 'Official data pending.';

export type SupportedCountry = 'IN' | 'US';

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
  country: SupportedCountry;
  dataProvider: string;
  providerStatus: string;
  providerNotes: string[];
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
  country: SupportedCountry;
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

export type SourceLink = {
  label: string;
  href: string;
};

export type CivicQuestionResponse = {
  answer: string;
  sourceLinks: SourceLink[];
  suggestedQuestions: string[];
  transparencyNote: string;
};

export type LocationSuggestion = {
  id: string;
  label: string;
  locality: string;
  state: string;
  postalCode: string;
  country: SupportedCountry;
};

export type LocationSuggestionResponse = {
  configured: boolean;
  suggestions: LocationSuggestion[];
  message?: string;
};

export type FeedbackResponse = {
  id: string;
  saved: boolean;
  message: string;
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
