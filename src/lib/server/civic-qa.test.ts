import { describe, expect, it } from 'vitest';
import { answerCivicQuestion } from './civic-qa';

describe('answerCivicQuestion', () => {
  it('explains the post-cycle CM election question without inventing a date', () => {
    const answer = answerCivicQuestion('Our CM election is done, when is the next election?', 'IN');

    expect(answer.answer).toContain('up to five years');
    expect(answer.answer).toContain('exact election date as unknown');
    expect(answer.sourceLinks.some((link) => link.href.includes('eci.gov.in'))).toBe(true);
  });

  it('routes voter-list questions to official voter services', () => {
    const answer = answerCivicQuestion('How do I check my name in voter list?', 'IN');

    expect(answer.answer).toContain('electoral roll');
    expect(answer.sourceLinks.some((link) => link.href.includes('voters.eci.gov.in'))).toBe(true);
  });
});
