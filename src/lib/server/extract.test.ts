import { describe, expect, it } from 'vitest';
import { MISSING } from '@/types';
import { extractElectionData } from './extract';

describe('extractElectionData', () => {
  it('uses exact missing copy for absent Civic fields', () => {
    const data = extractElectionData({ election: { name: 'Local Election' }, contests: [{ office: 'Mayor' }] });

    expect(data.election.name).toBe('Local Election');
    expect(data.election.electionDay).toBe(MISSING);
    expect(data.pollingLocations).toEqual([]);
    expect(data.contests[0].district.name).toBe(MISSING);
    expect(data.contests[0].candidates).toEqual([]);
    expect(data.officialResources.electionInfoUrl).toBe(MISSING);
  });

  it('extracts official election administration links from Civic state data', () => {
    const data = extractElectionData({
      state: [
        {
          name: 'District of Columbia',
          electionAdministrationBody: {
            name: 'DC Board of Elections',
            electionInfoUrl: 'https://example.gov/elections',
            votingLocationFinderUrl: 'https://example.gov/where-to-vote',
          },
        },
      ],
    });

    expect(data.officialResources.stateName).toBe('District of Columbia');
    expect(data.officialResources.electionAuthorityName).toBe('DC Board of Elections');
    expect(data.officialResources.votingLocationFinderUrl).toBe('https://example.gov/where-to-vote');
  });
});
