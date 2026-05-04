import 'server-only';
import { SupportedCountry } from '@/types';
import { resolveAddressForCivic } from './address';
import { fetchVoterInfo } from './civic';
import { buildIndiaElectionData, extractElectionData } from './extract';

export async function getElectionDataForAddress(address: string, country: SupportedCountry) {
  const addressResolution = await resolveAddressForCivic(address, country);

  if (country === 'US') {
    const civicPayload = await fetchVoterInfo(addressResolution.civicAddress);
    return {
      addressResolution,
      electionData: extractElectionData(civicPayload, 'US'),
    };
  }

  return {
    addressResolution,
    electionData: buildIndiaElectionData(addressResolution.displayAddress),
  };
}
