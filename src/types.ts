import { z } from 'zod';

export interface VoterInfoResponse {
  election: {
    id: string;
    name: string;
    electionDay: string;
    ocdDivisionId: string;
  };
  pollingLocations?: {
    address: {
      locationName: string;
      line1: string;
      city: string;
      state: string;
      zip: string;
    };
    pollingHours?: string;
    startDate?: string;
    endDate?: string;
  }[];
  contests?: {
    type: string;
    office: string;
    level: string[];
    district?: {
      name: string;
      scope: string;
    };
    candidates?: {
      name: string;
      party: string;
      candidateUrl?: string;
      phone?: string;
      photoUrl?: string;
      email?: string;
      orderOnBallot?: number;
    }[];
  }[];
}

export interface UserSession {
  id: string;
  address: string;
  electionData: VoterInfoResponse;
  currentStep: number;
  updatedAt: number;
  userId?: string;
}

export const AddressSchema = z.string().min(5).max(200);
