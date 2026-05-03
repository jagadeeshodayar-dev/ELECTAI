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
  MapPin,
  Mic,
  Navigation,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { formatCivicAddress, getAddressCompletionHint, hasCompleteAddressSignal, normalizeSpokenAddress, safeExternalUrl } from '@/lib/address-utils';
import { auth, getFirebaseAuthMessage, signInWithGoogle } from '@/lib/firebase';
import { createAssistantSession, getGuidance, transcribeAddress } from '@/lib/api';
import { GuidanceResponse, MISSING, OfficialElectionResources, PollingLocation, UserSession } from '@/types';
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
  const [address, setAddress] = useState('');
  const [session, setSession] = useState<UserSession | null>(null);
  const [guidance, setGuidance] = useState<GuidanceResponse | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [localGuestId, setLocalGuestId] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const [speechStatus, setSpeechStatus] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const browserRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const activeStep = session?.currentStep || 1;
  const currentUserId = user?.uid || localGuestId;
  const addressHint = getAddressCompletionHint(address);
  const canSubmit = hasCompleteAddressSignal(address) && !loading;

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
    if (!hasCompleteAddressSignal(normalizedAddress)) {
      setError('Add street, city, state, and ZIP before starting. This keeps Google Civic from returning address parse errors.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await createAssistantSession(normalizedAddress, currentUserId);
      setSession(response.session);
      setGuidance(response.guidance);
      setSpeechStatus('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start the assistant.');
    } finally {
      setLoading(false);
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

  function handleGuestSignIn() {
    setError('');
    setAuthNotice('');

    if (!localGuestId) {
      const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? `local-guest-${crypto.randomUUID()}`
        : `local-guest-${Date.now()}`;
      setLocalGuestId(id);
    }

    setAuthNotice('Guest mode is ready for this device. You can use the MVP without Firebase Auth while authorized domains are being configured.');
  }

  async function handleGoogleSignIn() {
    setError('');
    setAuthNotice('');
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthNotice(getFirebaseAuthMessage(err));
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
        hasCompleteAddressSignal(normalizedAddress)
          ? `Heard: ${transcript}`
          : `Heard: ${transcript}. Please add city, state, and ZIP before starting.`,
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
                ? `Heard: ${result.transcript}. Please add city, state, and ZIP before starting.`
                : `Heard: ${result.transcript}`
              : 'No speech was detected. Try again or type the address.',
          );
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Voice input is not available.');
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
              {user ? (user.isAnonymous ? 'Guest ready' : user.displayName || user.email || 'Google ready') : localGuestId ? 'Guest ready' : 'Guest optional'}
            </span>
            <Button type="button" variant="secondary" size="sm" onClick={handleGuestSignIn} aria-label="Continue as guest">
              <UserRound /> Guest
            </Button>
            <Button type="button" size="sm" onClick={handleGoogleSignIn} aria-label="Sign in with Google">
              <LogIn /> Google
            </Button>
          </div>
        </header>

        <section className="elect-layout">
          <div className="elect-primary">
            <div className="elect-hero">
              <Badge>
                <ShieldCheck /> Verified Google Civic data only
              </Badge>
              <h2>Know exactly what to do before you vote.</h2>
              <p>
                Enter your address. ELECTAI checks official election data, then walks you through the election,
                date, polling place, candidates, and next action.
              </p>
            </div>

            <Card className="elect-address-card">
              <form onSubmit={submitAddress} aria-describedby="address-help address-hint">
                <label className="elect-field-label" htmlFor="address">
                  Full U.S. voting address
                </label>
                <div className="elect-address-row">
                  <div className="elect-input-wrap">
                    <Search className="elect-input-icon" />
                    <Input
                      id="address"
                      value={address}
                      onChange={(event) => {
                        setAddress(event.target.value);
                        setError('');
                      }}
                      placeholder="1600 Pennsylvania Ave NW, Washington, DC 20500"
                      className="elect-address-input"
                      autoComplete="street-address"
                      aria-invalid={Boolean(error)}
                      aria-describedby="address-help address-hint speech-status"
                    />
                  </div>
                  <Button type="submit" disabled={!canSubmit} size="lg">
                    {loading ? 'Checking...' : 'Start'}
                  </Button>
                </div>
                <p id="address-help" className="elect-address-help">
                  Include street, city, state, and ZIP. Spoken input is reviewed before it is sent to Google Civic.
                </p>
                <p id="address-hint" className={addressHint ? 'elect-address-hint' : 'sr-only'}>
                  {addressHint || 'Address looks complete.'}
                </p>
              </form>
            </Card>

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
            {authNotice && <Alert className="elect-error">{authNotice}</Alert>}

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
                Election facts come from Google Civic fields. Address text is used for Google address and voter-data services, not placed in the Gemini prompt.
              </p>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
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
            <dd>{value || MISSING}</dd>
          </div>
        ))}
      </dl>
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
              }) : <p className="elect-muted">{MISSING}</p>}
            </div>
          </div>
        )) : <div className="elect-data-card elect-muted">{MISSING}</div>}
      </div>
    </div>
  );
}

function GuidancePanel({ guidance, loading }: { guidance: GuidanceResponse | null; loading: boolean }) {
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
            <ul>
              {(guidance?.stepInstructions || ['Enter an address to begin.']).map((item) => <li key={item}>{item}</li>)}
            </ul>
            <PanelLine label="Timeline" value={guidance?.timelineSummary} />
            <PanelLine label="Polling" value={guidance?.pollingLocationDetails} />
            <PanelLine label="Candidates" value={guidance?.candidateOverview} />
            <PanelLine label="Next action" value={guidance?.nextConcreteAction} highlight />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PanelLine({ label, value, highlight = false }: { label: string; value?: string; highlight?: boolean }) {
  return (
    <section className="elect-panel-line">
      <p>{label}</p>
      <strong className={highlight ? 'elect-highlight' : undefined}>{value || MISSING}</strong>
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
            <li key={link.href}>
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
    { label: 'Registration', href: safeExternalUrl(resources.electionRegistrationUrl) },
    { label: 'Check registration', href: safeExternalUrl(resources.electionRegistrationConfirmationUrl) },
    { label: 'Ballot information', href: safeExternalUrl(resources.ballotInfoUrl) },
    { label: 'Absentee voting', href: safeExternalUrl(resources.absenteeVotingInfoUrl) },
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
