import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import PageLayout from '../components/PageLayout';
import Footer from '../components/Footer';

const colorAccent = {
  pink: 'border-neon-pink/50 hover:border-neon-pink shadow-neon-pink',
  cyan: 'border-neon-cyan/50 hover:border-neon-cyan shadow-neon-cyan',
  purple: 'border-neon-purple/50 hover:border-neon-purple shadow-[0_0_20px_rgba(176,38,255,0.35)]',
  yellow: 'border-neon-yellow/50 hover:border-neon-yellow shadow-[0_0_20px_rgba(247,255,88,0.35)]',
} as const;

type AccentColor = keyof typeof colorAccent;

function FeatureCard({
  title,
  desc,
  color,
  icon,
}: {
  title: string;
  desc: string;
  color: AccentColor;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`glass-panel p-6 border-t-4 transition-all duration-300 hover:-translate-y-1 ${colorAccent[color]}`}
    >
      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-neon-cyan mb-4">
        {icon}
      </div>
      <h3 className="font-pixel text-xs text-white mb-3">{title}</h3>
      <p className="text-sm text-slate-300 leading-relaxed">{desc}</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="glass-panel px-6 py-5 text-center">
      <p className="font-pixel text-xl text-neon-cyan mb-2">{value}</p>
      <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
    </div>
  );
}

function Step({
  number,
  title,
  desc,
  icon,
}: {
  number: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative glass-panel p-6 border-l-4 border-neon-cyan hover:border-neon-pink transition">
      <div className="absolute -top-3 -left-3 w-8 h-8 rounded-lg bg-neon-pink text-space-900 font-pixel text-xs flex items-center justify-center shadow-neon-pink">
        {number}
      </div>
      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-neon-purple mb-4">
        {icon}
      </div>
      <h4 className="font-pixel text-xs text-white mb-2">{title}</h4>
      <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="pt-16 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel border border-neon-cyan/20 mb-8">
            <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse-glow" />
            <span className="text-xs text-slate-300 tracking-wide">AI-powered hackathon evaluation</span>
          </div>

          <div className="mb-8 flex justify-center">
            <img
              src="/ZeTheta%20Logo.png"
              alt="ZECATHON logo"
              className="w-32 h-32 sm:w-40 sm:h-40 animate-float drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]"
            />
          </div>

          <h1 className="font-pixel text-3xl sm:text-5xl md:text-6xl text-white mb-6 text-shadow-neon leading-tight">
            ZECATHON
          </h1>
          <p className="text-lg sm:text-xl text-neon-cyan mb-2 pixel-caps">
            Code With Purpose & Innovate, Collaborate, Dominate
          </p>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-400 mb-10 leading-relaxed">
            A platform by Zetheta Algorithms. Run tech and non-tech hackathons, upload problem statements,
            collect submissions, and let AI score every project with fair, transparent, hackathon-focused rubrics.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              to={user ? '/hackathons' : '/register'}
              className="px-8 py-4 rounded neon-btn neon-btn-primary text-sm"
            >
              {user ? 'Enter the Arena' : 'Join the Arena'}
            </Link>
            <Link to="/hackathons/new" className="px-8 py-4 rounded neon-btn neon-btn-ghost text-sm">
              Host a Hackathon
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <Stat value="8" label="Scoring categories" />
            <Stat value="1k" label="Points per rubric" />
            <Stat value="0.5" label="Score granularity" />
            <Stat value="∞" label="Hackathons hosted" />
          </div>
        </section>

        {/* Features */}
        <section className="py-20">
          <div className="text-center mb-14">
            <p className="text-neon-pink text-xs pixel-caps mb-3">Platform Features</p>
            <h2 className="font-pixel text-xl sm:text-2xl text-white text-shadow-neon mb-4">
              Everything you need to run a hackathon
            </h2>
            <p className="max-w-2xl mx-auto text-sm text-slate-400">
              From problem statement upload to final leaderboard, ZECATHON handles the heavy lifting so organisers can focus on the experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              color="pink"
              title="AI-Powered Scoring"
              desc="Tech repositories and non-tech documents are evaluated with calibrated, hackathon-specific rubrics."
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
            />
            <FeatureCard
              color="cyan"
              title="Tech Submissions"
              desc="Connect public GitHub repos. We analyse code, commits, README, architecture, and presentation."
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              }
            />
            <FeatureCard
              color="purple"
              title="Non-Tech Submissions"
              desc="Evaluate PDFs, DOCX, PPTX, and XLSX files. Optional supporting PPTs are merged into the analysis."
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            />
            <FeatureCard
              color="yellow"
              title="Live Leaderboards"
              desc="Rankings update automatically after evaluation. Anti-clustering keeps scores discrete and fair."
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
            />
            <FeatureCard
              color="pink"
              title="RBAC & Roles"
              desc="Admins, organisers, judges, and participants each get the right level of access and action."
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              }
            />
            <FeatureCard
              color="cyan"
              title="Discrete Scoring"
              desc="Tie-break logic ensures no two teams accidentally share the same score, so every rank is earned."
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              }
            />
          </div>
        </section>

        {/* How it works */}
        <section className="py-20">
          <div className="text-center mb-14">
            <p className="text-neon-cyan text-xs pixel-caps mb-3">How it works</p>
            <h2 className="font-pixel text-xl sm:text-2xl text-white text-shadow-neon mb-4">
              From setup to podium in four steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Step
              number="1"
              title="Create"
              desc="Organisers set up a hackathon and upload problem statements for each track."
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              }
            />
            <Step
              number="2"
              title="Assemble"
              desc="Participants create or join teams and pick the problem statement they want to solve."
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
            />
            <Step
              number="3"
              title="Submit"
              desc="Teams submit GitHub links for tech tracks or documents for non-tech tracks. PPTs are optional."
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              }
            />
            <Step
              number="4"
              title="Evaluate"
              desc="Judges trigger AI evaluation. Scores, verdicts, and leaderboards are ready in seconds."
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="glass-panel relative overflow-hidden p-10 sm:p-16 text-center border border-neon-purple/30">
            <div className="absolute inset-0 bg-gradient-to-br from-neon-purple/10 to-neon-pink/10 pointer-events-none" />
            <div className="relative">
              <h2 className="font-pixel text-xl sm:text-2xl text-white text-shadow-neon mb-4">
                Ready to run your next hackathon?
              </h2>
              <p className="max-w-xl mx-auto text-sm text-slate-400 mb-8">
                Set up a hackathon in minutes, invite teams, and let the AI evaluator handle the heavy lifting.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/hackathons/new" className="px-8 py-4 rounded neon-btn neon-btn-cyan text-sm">
                  Host a Hackathon
                </Link>
                <Link to="/hackathons" className="px-8 py-4 rounded neon-btn neon-btn-ghost text-sm">
                  Explore Hackathons
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </PageLayout>
  );
}
