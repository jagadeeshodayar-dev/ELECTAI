'use client';

import type React from 'react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Info,
  LogIn,
  LogOut,
  MapPin,
  MessageCircle,
  Mic,
  Navigation,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import { formatCivicAddress, getAddressCompletionHint, hasCompleteAddressSignal, normalizeSpokenAddress, safeExternalUrl } from '@/lib/address-utils';
import { askCivicQuestion, createAssistantSession, getGuidance, getLocationSuggestions, submitFeedback, transcribeAddress } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import {
  CivicQuestionResponse,
  GuidanceResponse,
  LocationSuggestion,
  MISSING,
  OfficialElectionResources,
  PollingLocation,
  SupportedCountry,
  UserSession,
} from '@/types';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress as StepProgress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

const STEPS = [
  { id: 1, label: 'Election', icon: Info },
  { id: 2, label: 'When', icon: Calendar },
  { id: 3, label: 'Where', icon: MapPin },
  { id: 4, label: 'Candidates', icon: Users },
  { id: 5, label: 'Action', icon: CheckCircle2 },
];

const COUNTRY_OPTIONS: Array<{
  code: SupportedCountry;
  label: string;
  badge: string;
  addressLabel: string;
  placeholder: string;
  help: string;
}> = [
  {
    code: 'IN',
    label: 'India',
    badge: 'India first, global-ready provider data',
    addressLabel: 'India voting address',
    placeholder: 'MG Road, Bengaluru, Karnataka 560001',
    help: 'Include locality, city, state, and 6-digit PIN code. Google is used to verify the address.',
  },
  {
    code: 'US',
    label: 'United States',
    badge: 'Verified Google Civic data',
    addressLabel: 'U.S. voting address',
    placeholder: '1600 Pennsylvania Ave NW, Washington, DC 20500',
    help: 'Include street, city, state, and ZIP. Google Civic returns election details where supported.',
  },
];

const INDIA_HELP_QUESTIONS = [
  'When is the next CM election?',
  'How do I check my name in the voter list?',
  'How do I find my polling booth?',
  'Where can I see candidate affidavits?',
  'What election laws or rules should I know?',
  'How do I complain about election violations?',
];

type FeedbackCategory = 'missing-info' | 'wrong-answer' | 'hard-to-use' | 'feature-request' | 'other';

const FEEDBACK_CATEGORIES: Array<{ value: FeedbackCategory; label: string }> = [
  { value: 'missing-info', label: 'Incomplete official data' },
  { value: 'wrong-answer', label: 'Wrong answer' },
  { value: 'hard-to-use', label: 'Hard to use' },
  { value: 'feature-request', label: 'Feature request' },
  { value: 'other', label: 'Other' },
];

type SpeechRecognitionResultLike = {
  transcript: string;
};

type SpeechRecognitionEventLike = {
  results?: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechWindow = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

export function ElectionAssistant() {
  const [country, setCountry] = useState<SupportedCountry>('IN');
  const [address, setAddress] = useState('');
  const [session, setSession] = useState<UserSession | null>(null);
  const [guidance, setGuidance] = useState<GuidanceResponse | null>(null);
  const [civicQuestion, setCivicQuestion] = useState('');
  const [civicAnswer, setCivicAnswer] = useState<CivicQuestionResponse | null>(null);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [locationStatus, setLocationStatus] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackCategory, setFeedbackCategory] = useState<FeedbackCategory>('missing-info');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const [speechStatus, setSpeechStatus] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const browserRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const locationRequestRef = useRef(0);
  const selectedLocationLabelRef = useRef('');
  const {
    profile,
    userId: authUserId,
    status: authStatus,
    notice: authNotice,
    signInAsGuest,
    signInGoogle,
    signOutUser,
    clearNotice,
  } = useAuth();

  const activeStep = session?.currentStep || 1;
  const currentUserId = authUserId;
  const countryContent = COUNTRY_OPTIONS.find((option) => option.code === country) || COUNTRY_OPTIONS[0];
  const addressHint = getAddressCompletionHint(address, country);
  const canSubmit = hasCompleteAddressSignal(address, country) && !loading;

  useEffect(() => {
    const query = address.trim();
    if (query.length < 3) {
      setLocationSuggestions([]);
      setLocationStatus('');
      setLocationLoading(false);
      return;
    }
    if (query === selectedLocationLabelRef.current) {
      setLocationSuggestions([]);
      setLocationLoading(false);
      return;
    }

    const requestId = locationRequestRef.current + 1;
    locationRequestRef.current = requestId;
    const timer = window.setTimeout(async () => {
      setLocationLoading(true);
      try {
        const result = await getLocationSuggestions(query, country);
        if (locationRequestRef.current !== requestId) return;
        setLocationSuggestions(result.suggestions);
        if (!result.configured) {
          setLocationStatus('Google location suggestions need a Maps or Geocoding key in this environment.');
        } else if (result.suggestions.length) {
          setLocationStatus('Google location suggestions are ready.');
        } else {
          setLocationStatus(result.message || 'No Google location match yet. Add locality, state, and PIN code.');
        }
      } catch (err) {
        if (locationRequestRef.current !== requestId) return;
        setLocationSuggestions([]);
        setLocationStatus(err instanceof Error ? err.message : 'Unable to load Google location suggestions.');
      } finally {
        if (locationRequestRef.current === requestId) setLocationLoading(false);
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [address, country]);

  useEffect(() => {
    return () => {
      browserRecognitionRef.current?.stop();
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    };
  }, []);

  async function submitAddress(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (loading) return;

    const normalizedAddress = normalizeSpokenAddress(address);
    setAddress(normalizedAddress);
    if (!hasCompleteAddressSignal(normalizedAddress, country)) {
      setError(getAddressCompletionHint(normalizedAddress, country) || 'Add a complete voting address before starting.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await createAssistantSession(normalizedAddress, currentUserId, country);
      setSession(response.session);
      setGuidance(response.guidance);
      setSpeechStatus('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start the assistant.');
    } finally {
      setLoading(false);
    }
  }

  function chooseLocationSuggestion(suggestion: LocationSuggestion) {
    selectedLocationLabelRef.current = suggestion.label;
    setAddress(suggestion.label);
    setLocationSuggestions([]);
    setLocationStatus(formatLocationStatus(suggestion));
    setError('');
  }

  async function handleFeedbackSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = feedbackMessage.trim();
    if (feedbackLoading) return;
    if (message.length < 5) {
      setFeedbackStatus('Share a little more detail so the team can act on it.');
      return;
    }

    setFeedbackLoading(true);
    setFeedbackStatus('');
    try {
      const response = await submitFeedback({
        rating: feedbackRating,
        category: feedbackCategory,
        message,
        country,
        userId: currentUserId || null,
        sessionId: session?.id || null,
        pageHost: getCurrentHost(),
      });
      setFeedbackMessage('');
      setFeedbackStatus(response.message);
    } catch (err) {
      setFeedbackStatus(err instanceof Error ? err.message : 'Unable to save feedback right now.');
    } finally {
      setFeedbackLoading(false);
    }
  }

  async function moveStep(direction: 1 | -1) {
    if (!session) return;
    const currentStep = Math.min(5, Math.max(1, session.currentStep + direction));
    const nextSession = { ...session, currentStep };
    setSession(nextSession);
    setLoading(true);
    setError('');
    try {
      const response = await getGuidance(nextSession);
      setSession(response.session);
      setGuidance(response.guidance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update guidance.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGuestSignIn() {
    setError('');
    await signInAsGuest();
  }

  async function handleGoogleSignIn() {
    setError('');
    await signInGoogle();
  }

  async function handleSignOut() {
    setError('');
    await signOutUser();
  }

  async function submitCivicQuestion(question = civicQuestion) {
    const trimmed = question.trim();
    if (!trimmed || questionLoading) return;

    setCivicQuestion(trimmed);
    setQuestionLoading(true);
    setError('');
    try {
      setCivicAnswer(await askCivicQuestion(trimmed, country));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to answer this civic question.');
    } finally {
      setQuestionLoading(false);
    }
  }

  function tryBrowserSpeech() {
    const speechWindow = window as SpeechWindow;
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) return false;

    const recognition = new SpeechRecognition();
    browserRecognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      browserRecognitionRef.current = null;
      setListening(false);
    };
    recognition.onerror = () => {
      browserRecognitionRef.current = null;
      setListening(false);
      setError('Browser voice input failed. Type your address or try again.');
    };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (!transcript) return;

      const normalizedAddress = normalizeSpokenAddress(transcript);
      setAddress(normalizedAddress);
      setSpeechStatus(
        hasCompleteAddressSignal(normalizedAddress, country)
          ? `Heard: ${transcript}`
          : `Heard: ${transcript}. ${getAddressCompletionHint(normalizedAddress, country) || 'Please add more address detail before starting.'}`,
      );
    };
    recognition.start();
    return true;
  }

  async function toggleRecording() {
    if (listening) {
      browserRecognitionRef.current?.stop();
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      return;
    }

    setError('');
    setSpeechStatus('Listening for your full voting address.');
    if (tryBrowserSpeech()) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = async () => {
        setListening(false);
        stream.getTracks().forEach((track) => track.stop());
        try {
          const result = await transcribeAddress(new Blob(chunksRef.current, { type: mimeType }));
          if (result.normalizedAddress) setAddress(result.normalizedAddress);
          setSpeechStatus(
            result.transcript
              ? result.needsMoreDetail
                ? `Heard: ${result.transcript}. ${getAddressCompletionHint(result.normalizedAddress || result.transcript, country) || 'Please add more address detail before starting.'}`
                : `Heard: ${result.transcript}`
              : 'No speech was detected. Try again or type the address.',
          );
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Voice input could not start.');
          setSpeechStatus('');
        }
      };
      recorder.start();
      setListening(true);
    } catch {
      setError('Microphone permission is required for voice input.');
      setSpeechStatus('');
    }
  }

  return (
    <main className="elect-page">
      <a className="elect-skip-link" href="#address">
        Skip to address
      </a>
      <div className="elect-shell">
        <header className="elect-header">
          <div>
            <p className="elect-kicker">ELECTAI</p>
            <h1 className="elect-logo">Election Assistant</h1>
          </div>
          <div className="elect-auth-actions">
            <span className="elect-user-state" aria-live="polite">
              {getAuthLabel(profile, authStatus)}
            </span>
            {profile ? (
              <Button type="button" variant="secondary" size="sm" onClick={handleSignOut} aria-label="Sign out">
                <LogOut /> Sign out
              </Button>
            ) : (
              <>
                <Button type="button" variant="secondary" size="sm" onClick={handleGuestSignIn} aria-label="Continue as guest">
                  <UserRound /> Guest
                </Button>
                <Button type="button" size="sm" onClick={handleGoogleSignIn} aria-label="Sign in with Google">
                  <LogIn /> Google
                </Button>
              </>
            )}
          </div>
        </header>

        <section className="elect-layout">
          <div className="elect-primary">
            <div className="elect-hero">
              <Badge>
                <ShieldCheck /> {countryContent.badge}
              </Badge>
              <h2>Know exactly what to do before you vote.</h2>
              <p>
                Choose a country and enter your address. ELECTAI checks the configured Google and official election
                data providers, then walks you through the election, date, polling place, candidates, and next action.
              </p>
            </div>

            <Card className="elect-address-card">
              <form className="elect-address-form" onSubmit={submitAddress} aria-describedby="address-help address-hint location-status">
                <div className="elect-address-topline">
                  <div>
                    <p className="elect-card-kicker">Address intelligence</p>
                    <h3>Verify location, then start</h3>
                  </div>
                  <div className="elect-country-control">
                    <label htmlFor="country">Country</label>
                    <select
                      id="country"
                      className="elect-country-select"
                      value={country}
                      onChange={(event) => {
                        setCountry(event.target.value as SupportedCountry);
                        setError('');
                        setGuidance(null);
                        setSession(null);
                        setLocationSuggestions([]);
                        setLocationStatus('');
                        selectedLocationLabelRef.current = '';
                      }}
                    >
                      {COUNTRY_OPTIONS.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="elect-field-label" htmlFor="address">
                  {countryContent.addressLabel}
                </label>
                <div className="elect-address-row">
                  <div className="elect-input-wrap elect-location-field">
                    <Search className="elect-input-icon" />
                    <Input
                      id="address"
                      value={address}
                      onChange={(event) => {
                        selectedLocationLabelRef.current = '';
                        setAddress(event.target.value);
                        setError('');
                      }}
                      placeholder={countryContent.placeholder}
                      className="elect-address-input"
                      autoComplete="street-address"
                      aria-invalid={Boolean(error)}
                      aria-describedby="address-help address-hint speech-status location-status"
                    />
                    {locationSuggestions.length > 0 && (
                      <div className="elect-location-menu" role="listbox" aria-label="Google location suggestions">
                        {locationSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            role="option"
                            aria-selected={address === suggestion.label}
                            className="elect-location-option"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => chooseLocationSuggestion(suggestion)}
                          >
                            <MapPin aria-hidden="true" />
                            <span>
                              <strong>{suggestion.label}</strong>
                              <small>{formatLocationMeta(suggestion)}</small>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button type="submit" disabled={!canSubmit} size="lg" className="elect-start-button">
                    {loading ? 'Checking...' : 'Start'}
                  </Button>
                </div>
                <div className="elect-address-support">
                  <p id="address-help" className="elect-address-help">
                    {countryContent.help} Spoken input is reviewed before it is sent to Google or election-data services.
                  </p>
                  <p id="address-hint" className={addressHint ? 'elect-address-hint' : 'elect-address-ready'}>
                    {addressHint || 'Address has enough detail to begin.'}
                  </p>
                  <p id="location-status" className="elect-location-status" aria-live="polite">
                    {locationLoading ? 'Checking Google location data...' : locationStatus}
                  </p>
                </div>
              </form>
            </Card>

            <CivicQuestionPanel
              country={country}
              question={civicQuestion}
              answer={civicAnswer}
              loading={questionLoading}
              onQuestionChange={setCivicQuestion}
              onAsk={submitCivicQuestion}
            />

            <FeedbackPanel
              rating={feedbackRating}
              category={feedbackCategory}
              message={feedbackMessage}
              status={feedbackStatus}
              loading={feedbackLoading}
              onRatingChange={setFeedbackRating}
              onCategoryChange={setFeedbackCategory}
              onMessageChange={setFeedbackMessage}
              onSubmit={handleFeedbackSubmit}
            />

            <div className="elect-mic-row">
              <Button
                type="button"
                onClick={toggleRecording}
                aria-label={listening ? 'Stop voice input' : 'Start voice input'}
                aria-pressed={listening}
                aria-describedby="speech-status"
                variant={listening ? 'outline' : 'secondary'}
                size="mic"
                className={listening ? 'elect-mic-active' : 'elect-mic'}
                title={listening ? 'Stop voice input' : 'Start voice input'}
              >
                <Mic />
              </Button>
            </div>
            <p id="speech-status" className="elect-speech-status" aria-live="polite">
              {speechStatus}
            </p>

            {error && <Alert className="elect-error">{error}</Alert>}
            {authNotice && (
              <Alert className="elect-error">
                <div className="elect-notice-row">
                  <span>{authNotice}</span>
                  <button type="button" onClick={clearNotice}>
                    Dismiss
                  </button>
                </div>
              </Alert>
            )}

            {session && (
              <div className="elect-session">
                <StepRail activeStep={activeStep} />
                <Card className="elect-step-card">
                  <StepContent session={session} />
                  <Separator />
                  <div className="elect-step-actions">
                    <Button type="button" variant="secondary" onClick={() => moveStep(-1)} disabled={loading || activeStep === 1}>
                      <ChevronLeft /> Back
                    </Button>
                    <Button type="button" onClick={() => moveStep(1)} disabled={loading || activeStep === 5} className="elect-grow">
                      {activeStep === 5 ? 'Complete' : 'Continue'} <ChevronRight />
                    </Button>
                  </div>
                </Card>
              </div>
            )}
          </div>

          <aside className="elect-sidebar" aria-label="Election guidance">
            <GuidancePanel guidance={guidance} loading={loading} />
            <OfficialResourcesPanel resources={session?.electionData.officialResources} />
            <Card className="elect-transparency">
              <p className="elect-panel-title">Transparency</p>
              <p>
                Election facts come from the configured provider. Address text is used for Google address and voter-data services, not placed in the Gemini prompt.
              </p>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
}

function getCurrentHost() {
  return typeof window !== 'undefined' ? window.location.hostname : '';
}

function getAuthLabel(
  profile: { displayName: string; email: string; uid: string; isAnonymous: boolean } | null,
  status: string,
) {
  if (profile) {
    const name = profile.displayName || profile.email || profile.uid.slice(0, 8);
    if (status === 'restoring') return `Restoring ${name}`;
    return profile.isAnonymous ? `${name} ready` : name;
  }
  if (status === 'loading') return 'Checking session';
  return 'Guest optional';
}

function isPendingValue(value?: string | null) {
  return !value || value === MISSING;
}

function formatLocationMeta(suggestion: LocationSuggestion) {
  return [suggestion.locality, suggestion.state, suggestion.postalCode].filter(Boolean).join(', ') || 'Google verified address';
}

function formatLocationStatus(suggestion: LocationSuggestion) {
  const meta = formatLocationMeta(suggestion);
  return meta === 'Google verified address' ? 'Selected a Google verified address.' : `Selected: ${meta}.`;
}

function StepRail({ activeStep }: { activeStep: number }) {
  return (
    <div className="elect-progress">
      <StepProgress value={(activeStep / STEPS.length) * 100} />
      <ol className="elect-step-grid">
        {STEPS.map((step) => {
          const Icon = step.icon;
          const active = step.id === activeStep;
          const done = step.id < activeStep;
          return (
            <li key={step.id} className={active ? 'elect-step-pill elect-step-pill-active' : 'elect-step-pill'}>
              <Icon className={active || done ? 'elect-step-icon-active' : 'elect-step-icon'} />
              <span>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepContent({ session }: { session: UserSession }) {
  if (session.country === 'IN') {
    return <IndiaStepContent session={session} />;
  }

  const { election, pollingLocations, contests } = session.electionData;
  const firstLocation = pollingLocations[0];

  if (session.currentStep === 1) {
    return <Step title="Understand The Election" icon={<Info />} rows={[['Election', election.name], ['Election date', election.electionDay], ['Division', election.ocdDivisionId]]} />;
  }
  if (session.currentStep === 2) {
    return <Step title="Know When To Vote" icon={<Clock />} rows={[['Election day', election.electionDay], ['Upcoming election found', session.decisionFlags.hasUpcomingElection ? 'Yes' : MISSING]]} />;
  }
  if (session.currentStep === 3) {
    return <Step title="Know Where To Vote" icon={<MapPin />} rows={firstLocation ? [['Place', firstLocation.address.locationName], ['Address', formatPollingAddress(firstLocation)], ['Hours', firstLocation.pollingHours]] : [['Polling location', MISSING]]} />;
  }
  if (session.currentStep === 4) {
    return <CandidateList contests={contests} />;
  }
  return (
    <div>
      <Step title="Take The Next Action" icon={<CheckCircle2 />} rows={[['Review date', election.electionDay], ['Review polling place', firstLocation ? firstLocation.address.locationName : MISSING], ['Review candidates', session.decisionFlags.hasCandidateData ? 'Candidate data is listed below.' : MISSING]]} />
      <ActionLinks session={session} />
    </div>
  );
}

function IndiaStepContent({ session }: { session: UserSession }) {
  const { electionData } = session;
  const resources = electionData.officialResources;
  const address = formatCivicAddress(electionData.normalizedInput) || session.sanitizedAddress;

  if (session.currentStep === 1) {
    return (
      <Step
        title="Understand The India Workflow"
        icon={<Info />}
        rows={[
          ['Provider', electionData.dataProvider],
          ['Official source', resources.electionAuthorityName],
          ['Address checked', address],
          ['Status', electionData.providerStatus],
        ]}
      />
    );
  }

  if (session.currentStep === 2) {
    return (
      <Step
        title="Know When To Vote"
        icon={<Clock />}
        rows={[
          ['Election schedule', 'Check the current ECI election schedule for your state or constituency.'],
          ['Where to check', resources.electionInfoUrl],
          ['Why not automatic', 'A typed address alone does not return a verified India election date from your current APIs.'],
        ]}
      />
    );
  }

  if (session.currentStep === 3) {
    return (
      <Step
        title="Know Where To Vote"
        icon={<MapPin />}
        rows={[
          ['Polling booth lookup', 'Use ECI voter search with EPIC number, registered mobile, or voter details.'],
          ['Official portal', resources.votingLocationFinderUrl],
          ['Helpline', 'Call 1950 with your STD code if online lookup does not work.'],
        ]}
      />
    );
  }

  if (session.currentStep === 4) {
    return (
      <Step
        title="Understand The Candidates"
        icon={<Users />}
        rows={[
          ['Candidate affidavits', 'Available on the ECI Candidate Affidavit portal after nominations are filed.'],
          ['Official portal', resources.ballotInfoUrl],
          ['What to choose', 'Select the election and constituency on the official portal.'],
        ]}
      />
    );
  }

  return (
    <div>
      <Step
        title="Take The Next Action"
        icon={<CheckCircle2 />}
        rows={[
          ['First action', 'Verify your voter record on the official ECI voter search portal.'],
          ['Then', 'Use the returned voter details to confirm polling booth and constituency.'],
          ['Candidate check', 'Open Candidate Affidavit portal for the selected election and constituency.'],
        ]}
      />
      <IndiaActionLinks resources={resources} />
    </div>
  );
}

function Step({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: [string, string][] }) {
  return (
    <div>
      <div className="elect-section-heading">
        {icon}
        <h3>{title}</h3>
      </div>
      <dl className="elect-data-grid">
        {rows.map(([label, value]) => (
          <div key={label} className="elect-data-card">
            <dt>{label}</dt>
            <dd className={isPendingValue(value) ? 'elect-pending-value' : undefined}>
              {isPendingValue(value) ? 'Check the official source for this field.' : value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function CivicQuestionPanel({
  country,
  question,
  answer,
  loading,
  onQuestionChange,
  onAsk,
}: {
  country: SupportedCountry;
  question: string;
  answer: CivicQuestionResponse | null;
  loading: boolean;
  onQuestionChange: (value: string) => void;
  onAsk: (question?: string) => void;
}) {
  const suggestions = answer?.suggestedQuestions?.length ? answer.suggestedQuestions : INDIA_HELP_QUESTIONS;

  return (
    <Card className="elect-question-card">
      <div className="elect-question-topline">
        <div className="elect-section-heading elect-question-heading">
          <MessageCircle />
          <div>
            <p className="elect-card-kicker">Official-first answers</p>
            <h3>Voter Help Desk</h3>
          </div>
        </div>
        <Badge>
          <ShieldCheck /> {country === 'IN' ? 'ECI aware' : 'Official aware'}
        </Badge>
      </div>
      <form
        className="elect-question-form"
        onSubmit={(event) => {
          event.preventDefault();
          onAsk();
        }}
      >
        <Input
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          placeholder={country === 'IN' ? 'Ask about voter list, CM election, laws, polling booth...' : 'Ask a voter question...'}
          aria-label="Ask a voter question"
          className="elect-question-input"
        />
        <Button type="submit" disabled={loading || !question.trim()}>
          {loading ? 'Answering...' : <><Send /> Ask</>}
        </Button>
      </form>
      <div className="elect-question-chips" aria-label="Suggested voter questions">
        {suggestions.map((item, index) => (
          <Button
            key={`suggestion-${index}-${item}`}
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onAsk(item)}
            disabled={loading}
          >
            {item}
          </Button>
        ))}
      </div>
      {answer && (
        <div className="elect-answer" aria-live="polite">
          <div className="elect-answer-header">
            <CheckCircle2 />
            <p>Answer</p>
          </div>
          <p>{answer.answer}</p>
          {answer.sourceLinks.length > 0 && (
            <ul>
              {answer.sourceLinks.map((link) => (
                <li key={`${link.label}-${link.href}`}>
                  <a href={link.href} target="_blank" rel="noreferrer">
                    {link.label}
                    <ExternalLink aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          )}
          <span>{answer.transparencyNote}</span>
        </div>
      )}
    </Card>
  );
}

function FeedbackPanel({
  rating,
  category,
  message,
  status,
  loading,
  onRatingChange,
  onCategoryChange,
  onMessageChange,
  onSubmit,
}: {
  rating: number;
  category: FeedbackCategory;
  message: string;
  status: string;
  loading: boolean;
  onRatingChange: (value: number) => void;
  onCategoryChange: (value: FeedbackCategory) => void;
  onMessageChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Card className="elect-feedback-card">
      <div className="elect-feedback-head">
        <div className="elect-section-heading">
          <Info />
          <div>
            <p className="elect-card-kicker">Improve the assistant</p>
            <h3>Send Feedback</h3>
          </div>
        </div>
        <span>Saved to Firebase</span>
      </div>
      <form className="elect-feedback-form" onSubmit={onSubmit}>
        <div className="elect-rating-row" aria-label="Rate this experience from 1 to 5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className={value <= rating ? 'elect-rating-button elect-rating-button-active' : 'elect-rating-button'}
              onClick={() => onRatingChange(value)}
              aria-label={`${value} out of 5`}
              aria-pressed={rating === value}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="elect-feedback-grid">
          <label>
            Category
            <select className="elect-feedback-select" value={category} onChange={(event) => onCategoryChange(event.target.value as FeedbackCategory)}>
              {FEEDBACK_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          What should be better?
          <textarea
            className="elect-feedback-textarea"
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            placeholder="Tell us what was unclear, incomplete, confusing, or useful."
            maxLength={1200}
          />
        </label>
        <div className="elect-feedback-actions">
          <Button type="submit" disabled={loading || message.trim().length < 5}>
            {loading ? 'Saving...' : 'Send feedback'}
          </Button>
          <p className="elect-feedback-status" aria-live="polite">
            {status}
          </p>
        </div>
      </form>
    </Card>
  );
}

function IndiaActionLinks({ resources }: { resources: OfficialElectionResources }) {
  const voterSearch = safeExternalUrl(resources.electionRegistrationConfirmationUrl);
  const voterPortal = safeExternalUrl(resources.votingLocationFinderUrl);
  const candidatePortal = safeExternalUrl(resources.ballotInfoUrl);

  return (
    <div className="elect-action-links" aria-label="India election action links">
      {voterSearch && (
        <Button asChild variant="secondary">
          <a href={voterSearch} target="_blank" rel="noreferrer">
            <Search /> Check Voter Record
          </a>
        </Button>
      )}
      {voterPortal && (
        <Button asChild variant="secondary">
          <a href={voterPortal} target="_blank" rel="noreferrer">
            <MapPin /> Find Booth
          </a>
        </Button>
      )}
      {candidatePortal && (
        <Button asChild variant="secondary">
          <a href={candidatePortal} target="_blank" rel="noreferrer">
            <Users /> Candidates
          </a>
        </Button>
      )}
    </div>
  );
}

function CandidateList({ contests }: { contests: UserSession['electionData']['contests'] }) {
  const visibleContests = useMemo(() => contests.slice(0, 8), [contests]);
  return (
    <div>
      <div className="elect-section-heading">
        <Users />
        <h3>Understand The Candidates</h3>
      </div>
      <div className="elect-contest-list">
        {visibleContests.length ? visibleContests.map((contest) => (
          <div key={`${contest.office}-${contest.type}`} className="elect-data-card">
            <h4>{contest.office}</h4>
            <div className="elect-candidate-list">
              {contest.candidates.length ? contest.candidates.map((candidate) => {
                const candidateUrl = safeExternalUrl(candidate.candidateUrl);
                return (
                  <div key={`${contest.office}-${candidate.name}`} className="elect-candidate">
                    <div>
                      <p>{candidate.name}</p>
                      <span>{candidate.party}</span>
                    </div>
                    {candidateUrl && (
                      <a href={candidateUrl} target="_blank" rel="noreferrer">
                        Website <ExternalLink aria-hidden="true" />
                      </a>
                    )}
                  </div>
                );
              }) : <p className="elect-muted">Candidate details will appear after the official provider returns contests.</p>}
            </div>
          </div>
        )) : <div className="elect-data-card elect-muted">Candidate details will appear after the official provider returns contests.</div>}
      </div>
    </div>
  );
}

function GuidancePanel({ guidance, loading }: { guidance: GuidanceResponse | null; loading: boolean }) {
  const instructions = (guidance?.stepInstructions || []).filter((item) => !isPendingValue(item));
  const panelLines = guidance
    ? [
        { label: 'Timeline', value: guidance.timelineSummary },
        { label: 'Polling', value: guidance.pollingLocationDetails },
        { label: 'Candidates', value: guidance.candidateOverview },
        { label: 'Next action', value: guidance.nextConcreteAction, highlight: true },
      ].filter((item) => !isPendingValue(item.value))
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="elect-guide-title">
          <Info /> Plain-language guide
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="elect-skeleton-wrap">
            <div className="elect-skeleton" />
            <div className="elect-skeleton elect-skeleton-short" />
          </div>
        ) : (
          <div className="elect-guide-body">
            {!guidance ? (
              <div className="elect-guide-empty">
                <strong>Start with an address</strong>
                <span>Verified guidance, official links, and next actions will load here.</span>
              </div>
            ) : (
              <>
                {instructions.length > 0 && (
                  <ul>
                    {instructions.map((item, index) => (
                      <li key={`instruction-${index}-${item}`}>{item}</li>
                    ))}
                  </ul>
                )}
                {panelLines.length > 0 ? (
                  panelLines.map((item) => (
                    <PanelLine key={item.label} label={item.label} value={item.value} highlight={item.highlight} />
                  ))
                ) : (
                  <div className="elect-guide-empty">
                    <strong>Use official links</strong>
                    <span>The assistant found your workflow, but detailed fields should be confirmed on the official portal.</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PanelLine({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <section className="elect-panel-line">
      <p>{label}</p>
      <strong className={highlight ? 'elect-highlight' : undefined}>{value}</strong>
    </section>
  );
}

function OfficialResourcesPanel({ resources }: { resources?: OfficialElectionResources }) {
  const links = resources ? getOfficialLinks(resources) : [];

  return (
    <Card className="elect-resources" aria-labelledby="official-resources-title">
      <p id="official-resources-title" className="elect-panel-title">
        Official resources
      </p>
      {links.length ? (
        <ul className="elect-resource-list">
          {links.map((link) => (
            <li key={`${link.label}-${link.href}`}>
              <a href={link.href} target="_blank" rel="noreferrer">
                {link.label}
                <ExternalLink aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="elect-resource-empty">Enter a complete address to load official election office links.</p>
      )}
    </Card>
  );
}

function ActionLinks({ session }: { session: UserSession }) {
  const location = session.electionData.pollingLocations[0];
  const mapsUrl = location ? getGoogleMapsUrl(location) : null;
  const calendarUrl = getGoogleCalendarUrl(session);

  if (!mapsUrl && !calendarUrl) return null;

  return (
    <div className="elect-action-links" aria-label="Google action links">
      {mapsUrl && (
        <Button asChild variant="secondary">
          <a href={mapsUrl} target="_blank" rel="noreferrer">
            <Navigation /> Open in Maps
          </a>
        </Button>
      )}
      {calendarUrl && (
        <Button asChild variant="secondary">
          <a href={calendarUrl} target="_blank" rel="noreferrer">
            <CalendarPlus /> Add to Calendar
          </a>
        </Button>
      )}
    </div>
  );
}

function getOfficialLinks(resources: OfficialElectionResources) {
  return [
    { label: 'Election office', href: safeExternalUrl(resources.electionInfoUrl) },
    { label: 'Find voting location', href: safeExternalUrl(resources.votingLocationFinderUrl) },
    { label: 'Voter services', href: safeExternalUrl(resources.electionRegistrationUrl) },
    { label: 'Check voter status', href: safeExternalUrl(resources.electionRegistrationConfirmationUrl) },
    { label: 'Candidate information', href: safeExternalUrl(resources.ballotInfoUrl) },
    { label: 'Remote voting information', href: safeExternalUrl(resources.absenteeVotingInfoUrl) },
  ].filter((link): link is { label: string; href: string } => Boolean(link.href));
}

function formatPollingAddress(location: PollingLocation) {
  return formatCivicAddress(location.address) || MISSING;
}

function getGoogleMapsUrl(location: PollingLocation) {
  const query = formatPollingAddress(location);
  if (!query || query === MISSING) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function getGoogleCalendarUrl(session: UserSession) {
  const electionDay = session.electionData.election.electionDay;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(electionDay)) return null;

  const [year, month, day] = electionDay.split('-').map(Number);
  const start = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
  const endDate = new Date(Date.UTC(year, month - 1, day + 1));
  const end = `${endDate.getUTCFullYear()}${String(endDate.getUTCMonth() + 1).padStart(2, '0')}${String(endDate.getUTCDate()).padStart(2, '0')}`;
  const title = `Vote: ${session.electionData.election.name}`;
  const details = 'Review official election details in ELECTAI before voting.';

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(details)}`;
}
