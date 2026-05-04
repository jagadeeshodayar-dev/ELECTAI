import 'server-only';
import { CivicQuestionResponse, SourceLink, SupportedCountry } from '@/types';

const INDIA_SOURCES = {
  eci: { label: 'Election Commission of India', href: 'https://www.eci.gov.in/' },
  voters: { label: 'ECI Voter Services', href: 'https://voters.eci.gov.in/' },
  search: { label: 'Electoral Search', href: 'https://electoralsearch.eci.gov.in/' },
  affidavits: { label: 'Candidate Affidavits', href: 'https://affidavit.eci.gov.in/' },
  sveep: { label: 'How to Vote', href: 'https://ecisveep.nic.in/voters/how-to-vote/' },
};

const INDIA_SUGGESTIONS = [
  'When is the next CM election?',
  'How do I check my name in the voter list?',
  'How do I find my polling booth?',
  'Where can I see candidate affidavits?',
  'What election laws or rules should I know?',
  'How do I complain about election violations?',
];

function includesAny(value: string, words: string[]) {
  return words.some((word) => value.includes(word));
}

function response(answer: string, sourceLinks: SourceLink[]): CivicQuestionResponse {
  return {
    answer,
    sourceLinks,
    suggestedQuestions: INDIA_SUGGESTIONS,
    transparencyNote:
      'This is general civic information from official portals. It is not legal advice, and it does not replace ECI notifications, court orders, or state election office instructions.',
  };
}

export function answerCivicQuestion(question: string, country: SupportedCountry = 'IN'): CivicQuestionResponse {
  const text = question.trim().toLowerCase();

  if (country !== 'IN') {
    return response(
      'For the U.S. provider, use a complete address first so Google Civic can return official election fields where available.',
      [INDIA_SOURCES.eci],
    );
  }

  if (!text) {
    return response('Ask a voter question, and I will point you to the safest official next step.', [INDIA_SOURCES.eci]);
  }

  if (includesAny(text, ['cm', 'chief minister', 'assembly', 'next election', '5 year', 'five year', 'term', 'when'])) {
    return response(
      'For Chief Minister or State Assembly elections, the normal assembly term is up to five years, but elections can happen earlier if the assembly is dissolved or a schedule is notified. Treat the exact election date as unknown until ECI publishes an official schedule. Your next step is to watch ECI and your state Chief Electoral Officer announcements.',
      [INDIA_SOURCES.eci, INDIA_SOURCES.voters],
    );
  }

  if (includesAny(text, ['register', 'registration', 'voter list', 'electoral roll', 'name', 'epic', 'mobile'])) {
    return response(
      'Use ECI Voter Services or Electoral Search to check whether your name is on the electoral roll. You may need EPIC number, registered mobile, or personal details. If your name is missing or details are wrong, use the official voter services forms instead of relying on this assistant.',
      [INDIA_SOURCES.voters, INDIA_SOURCES.search],
    );
  }

  if (includesAny(text, ['polling', 'booth', 'station', 'where vote', 'location'])) {
    return response(
      'Your polling booth is not safely inferable from a typed address alone. Use official ECI voter search or voter services to retrieve the booth tied to your voter record. If the portal does not work, use the voter helpline route shown by ECI or contact your local election office.',
      [INDIA_SOURCES.voters, INDIA_SOURCES.search],
    );
  }

  if (includesAny(text, ['candidate', 'affidavit', 'criminal', 'asset', 'party', 'nomination'])) {
    return response(
      'Candidate details should be checked from official candidate affidavits after nominations are filed. Use the ECI Candidate Affidavit portal, then choose the election, state, district, constituency, and candidate.',
      [INDIA_SOURCES.affidavits, INDIA_SOURCES.eci],
    );
  }

  if (includesAny(text, ['law', 'rule', 'rules', 'mcc', 'model code', 'code of conduct', 'legal', 'bribe', 'cash', 'gift'])) {
    return response(
      'Election rules can involve the Constitution, election laws, ECI instructions, and the Model Code of Conduct during an active election period. I can explain them in plain language, but for a decision or complaint use ECI instructions and official notices. As a safe baseline, do not accept cash, gifts, threats, or misinformation connected to voting.',
      [INDIA_SOURCES.eci, INDIA_SOURCES.sveep],
    );
  }

  if (includesAny(text, ['complaint', 'violation', 'report', 'threat', 'fraud', 'fake', 'misinformation'])) {
    return response(
      'For suspected election violations, use official ECI complaint channels or the tools listed by ECI for the current election. Keep evidence such as date, place, screenshots, and description. Do not share private identity documents in unofficial channels.',
      [INDIA_SOURCES.eci, INDIA_SOURCES.voters],
    );
  }

  if (includesAny(text, ['id', 'document', 'voter id', 'aadhaar', 'passport', 'pan'])) {
    return response(
      'Identity document rules can vary by ECI instruction and election notification. Check ECI voter guidance before election day and carry an accepted photo identity document. Do not upload identity documents anywhere unless you are on an official government portal and understand why it is required.',
      [INDIA_SOURCES.sveep, INDIA_SOURCES.eci],
    );
  }

  return response(
    'I can help with voter registration, voter-list checks, polling booth lookup, candidate affidavits, election rules, complaints, and what to do between election cycles. Ask one specific question and I will give the official next step.',
    [INDIA_SOURCES.voters, INDIA_SOURCES.eci],
  );
}
