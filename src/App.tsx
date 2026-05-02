import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, ChevronRight, MapPin, Calendar, Users, Info, ArrowLeft, Mic, Search } from 'lucide-react';
import { VoterInfoResponse, UserSession } from './types';
import { getVoterInfo, getGuidance } from './lib/api';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const STEPS = [
  { id: 1, name: 'Start', icon: Info },
  { id: 2, name: 'When', icon: Calendar },
  { id: 3, name: 'Where', icon: MapPin },
  { id: 4, name: 'Who', icon: Users },
  { id: 5, name: 'Action', icon: CheckCircle2 },
];

export default function App() {
  const [address, setAddress] = useState('');
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guidance, setGuidance] = useState<{ summary: string; nextStep: string; alert?: string } | null>(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        // Recover session if exists?
      }
    });
  }, []);

  const handleStart = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!address) return;

    setLoading(true);
    setError(null);
    try {
      const electionData = await getVoterInfo(address);
      const newSession: UserSession = {
        id: crypto.randomUUID(),
        address,
        electionData,
        currentStep: 1,
        updatedAt: Date.now(),
        userId: auth.currentUser?.uid,
      };

      // Save to Firestore
      try {
        await setDoc(doc(db, 'sessions', newSession.id), newSession);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `sessions/${newSession.id}`);
      }
      
      setSession(newSession);
      const g = await getGuidance(newSession);
      setGuidance(g);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = async () => {
    if (!session) return;
    const nextIdx = session.currentStep + 1;
    if (nextIdx > 5) return;

    const updated = { ...session, currentStep: nextIdx, updatedAt: Date.now() };
    setSession(updated);
    setLoading(true);
    try {
      const g = await getGuidance(updated);
      setGuidance(g);
      try {
        await setDoc(doc(db, 'sessions', updated.id), updated);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `sessions/${updated.id}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const prevStep = async () => {
    if (!session || session.currentStep === 1) return;
    const prevIdx = session.currentStep - 1;
    const updated = { ...session, currentStep: prevIdx, updatedAt: Date.now() };
    setSession(updated);
    setLoading(true);
    try {
      const g = await getGuidance(updated);
      setGuidance(g);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setAddress(transcript);
    };
    recognition.start();
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">E</div>
            <h1 className="font-bold text-xl tracking-tight">Election Assistant</h1>
          </div>
          {session && (
            <div className="flex gap-1">
              {STEPS.map((step) => {
                const Icon = step.icon;
                const isActive = step.id === session.currentStep;
                const isCompleted = step.id < session.currentStep;
                return (
                  <div key={step.id} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    isActive ? 'bg-blue-600 text-white' : isCompleted ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Icon size={14} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {!session ? (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-xl mx-auto text-center py-12"
            >
              <h2 className="text-4xl font-extrabold mb-4 tracking-tight leading-tight">
                Ready to vote? <br /> <span className="text-blue-600">Let's get you prepared.</span>
              </h2>
              <p className="text-lg text-slate-600 mb-8">
                Enter your address to see your upcoming elections, polling locations, and candidates.
              </p>

              <form onSubmit={handleStart} className="relative group">
                <input
                  type="text"
                  placeholder="Enter your full street address"
                  className="w-full h-16 pl-14 pr-32 rounded-2xl border-2 border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all outline-none text-lg shadow-sm"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
                <Search className="absolute left-5 top-5 text-slate-400" size={24} />
                <div className="absolute right-2 top-2 flex gap-1">
                  <button
                    type="button"
                    onClick={startVoiceInput}
                    className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors ${
                      isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'hover:bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Mic size={20} />
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !address}
                    className="h-12 px-6 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:bg-slate-300 transition-colors"
                  >
                    {loading ? 'Finding...' : 'Start'}
                  </button>
                </div>
              </form>

              {error && (
                <p className="mt-4 text-red-600 font-medium bg-red-50 py-2 px-4 rounded-lg inline-block">
                  {error}
                </p>
              )}

              <div className="mt-12 grid grid-cols-3 gap-6 text-left">
                <div className="p-4 rounded-xl bg-white border border-slate-100">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-3">
                    <Info size={20} />
                  </div>
                  <h3 className="font-bold text-sm mb-1">Verified Data</h3>
                  <p className="text-xs text-slate-500">From official Google Civic API</p>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-100">
                  <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center mb-3">
                    <Users size={20} />
                  </div>
                  <h3 className="font-bold text-sm mb-1">Meet Candidates</h3>
                  <p className="text-xs text-slate-500">Know who is on your ballot</p>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-100">
                  <div className="w-10 h-10 bg-green-50 text-green-600 rounded-lg flex items-center justify-center mb-3">
                    <MapPin size={20} />
                  </div>
                  <h3 className="font-bold text-sm mb-1">Find Polling</h3>
                  <p className="text-xs text-slate-500">Locations and hours</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="wizard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8"
            >
              <div className="space-y-6">
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm min-h-[400px]">
                  <header className="flex items-center justify-between mb-8">
                     <button onClick={prevStep} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-medium">
                        <ArrowLeft size={18} /> Back
                     </button>
                     <span className="text-sm font-bold text-blue-600 uppercase tracking-widest">STEP {session.currentStep}</span>
                  </header>

                  <StepRenderer session={session} />
                </div>
                
                <div className="flex gap-4">
                  <button
                    onClick={nextStep}
                    disabled={loading || session.currentStep === 5}
                    className="flex-1 h-16 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                  >
                    {loading ? 'Processing...' : session.currentStep === 5 ? 'All Set!' : 'Continue'}
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>

              <aside className="space-y-6">
                <div className="bg-blue-600 text-white rounded-3xl p-6 shadow-xl shadow-blue-100">
                  <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-blue-100">
                    <Info size={18} /> AI Guide
                  </h3>
                  {loading ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-4 bg-blue-500 rounded w-full"></div>
                      <div className="h-4 bg-blue-500 rounded w-3/4"></div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm leading-relaxed text-blue-50">
                        {guidance?.summary || "Analyzing your election data..."}
                      </p>
                      <div className="bg-blue-700/50 rounded-xl p-4 border border-blue-500/30">
                        <p className="text-xs uppercase font-bold text-blue-300 mb-1">Next Action</p>
                        <p className="text-sm font-medium">
                          {guidance?.nextStep || "Prepare to vote!"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-3xl p-6 border border-slate-200">
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <MapPin size={18} className="text-slate-400" /> Current Address
                  </h3>
                  <p className="text-sm text-slate-600 italic">
                    "{session.address}"
                  </p>
                </div>
              </aside>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function StepRenderer({ session }: { session: UserSession }) {
  const { election, pollingLocations, contests } = session.electionData;

  switch (session.currentStep) {
    case 1:
      return (
        <div className="space-y-6">
          <h2 className="text-3xl font-black">{election.name}</h2>
          <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
            <p className="text-slate-600 leading-relaxed font-medium">
              You have an upcoming election! This is your official ballot guide powered by AI. 
              We'll walk you through dates, locations, and your local contests.
            </p>
          </div>
          <div className="flex items-center gap-4 text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <Calendar className="text-blue-600" />
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Election Date</p>
              <p className="font-bold">{election.electionDay}</p>
            </div>
          </div>
        </div>
      );
    case 2:
      return (
        <div className="space-y-6">
          <h2 className="text-3xl font-black">When to Vote</h2>
          <div className="grid gap-4">
             <div className="p-6 rounded-2xl border-2 border-slate-100 bg-white">
                <h3 className="font-bold text-xl mb-2 flex items-center gap-2">
                  <Calendar size={20} className="text-blue-600" /> Election Day
                </h3>
                <p className="text-slate-600">{election.electionDay}</p>
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-xs font-bold text-yellow-700">
                  Polls usually open early morning and close late evening.
                </div>
             </div>
          </div>
        </div>
      );
    case 3:
      return (
        <div className="space-y-6">
          <h2 className="text-3xl font-black">Where to Vote</h2>
          {pollingLocations && pollingLocations.length > 0 ? (
            <div className="grid gap-4">
              {pollingLocations.map((loc, i) => (
                <div key={i} className="p-6 rounded-2xl border-2 border-slate-100 bg-white hover:border-blue-200 transition-colors">
                  <h3 className="font-bold text-xl mb-2 flex items-center gap-2">
                    <MapPin size={20} className="text-blue-600" /> {loc.address.locationName || "Poll Location"}
                  </h3>
                  <p className="text-slate-600">
                    {loc.address.line1}, {loc.address.city}, {loc.address.state} {loc.address.zip}
                  </p>
                  {loc.pollingHours && (
                    <div className="mt-4 text-sm font-medium text-slate-500">
                      Hours: {loc.pollingHours}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="p-6 bg-slate-100 rounded-2xl text-slate-500 italic font-medium">This information is not available.</p>
          )}
        </div>
      );
    case 4:
      return (
        <div className="space-y-6">
          <header className="flex items-center justify-between">
            <h2 className="text-3xl font-black">On Your Ballot</h2>
            <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-500 uppercase">{contests?.length || 0} Contests</span>
          </header>
          <div className="grid gap-6">
            {contests?.map((contest, i) => (
              <div key={i} className="space-y-4">
                <div className="flex items-center gap-3">
                   <div className="w-1 bg-blue-600 h-6 rounded-full" />
                   <h3 className="font-black text-xl text-slate-800">{contest.office}</h3>
                </div>
                <div className="grid gap-3">
                  {contest.candidates?.map((can, j) => (
                    <div key={j} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4">
                        {can.photoUrl ? (
                          <img src={can.photoUrl} alt={can.name} className="w-12 h-12 rounded-xl object-cover border border-slate-100" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                            <Users size={20} />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-900">{can.name}</p>
                          <p className="text-xs font-bold text-blue-600 uppercase tracking-tighter">{can.party}</p>
                        </div>
                      </div>
                      {can.candidateUrl && (
                        <a href={can.candidateUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-slate-400 hover:text-blue-600 underline">Website</a>
                      )}
                    </div>
                  ))}
                  {(!contest.candidates || contest.candidates.length === 0) && (
                     <p className="text-sm text-slate-400 italic">No candidates listed in data.</p>
                  )}
                </div>
              </div>
            ))}
            {(!contests || contests.length === 0) && (
               <p className="p-6 bg-slate-100 rounded-2xl text-slate-500 italic font-medium">This information is not available.</p>
            )}
          </div>
        </div>
      );
    case 5:
      return (
        <div className="space-y-8 text-center">
          <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-4xl font-black">All Set!</h2>
          <p className="text-lg text-slate-600 max-w-md mx-auto">
            You've reviewed your election data. The most important step is to actually show up and vote on <strong>{election.electionDay}</strong>.
          </p>
          <div className="bg-white p-8 rounded-3xl border-2 border-dashed border-slate-200">
            <h3 className="font-bold text-slate-900 mb-4">Your Action Plan</h3>
            <ul className="text-left space-y-4 text-sm font-medium text-slate-700">
              <li className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">1</div>
                Bring a valid photo ID to the polls.
              </li>
              <li className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">2</div>
                Double-check your polling location hours.
              </li>
              <li className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">3</div>
                Review your choices before entering the booth.
              </li>
            </ul>
          </div>
        </div>
      );
    default:
      return null;
  }
}
