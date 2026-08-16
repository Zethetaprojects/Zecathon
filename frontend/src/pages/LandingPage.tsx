import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isOrganizer } from '../utils/role';
import { ScrollReveal } from '../hooks/useInView';
import { hackathonsApi } from '../api/hackathons';
import { Hackathon, PublicStats, User } from '../types';
import { getHackathonStatus, formatHackathonDateRange, getCountdownTarget } from '../utils/hackathon';
import Countdown from '../components/Countdown';
import PageLayout from '../components/PageLayout';

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
      className={`micro-lift micro-glow glass-panel p-6 border-t-4 transition-all duration-300 hover:-translate-y-1 ${colorAccent[color]}`}
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
    <div
      className="micro-lift micro-glow glass-panel px-6 py-5 text-center cursor-pointer"
      data-egg-trigger="stat-click"
      data-egg-message="Numbers are fun. +25 XP"
      data-egg-color="yellow"
    >
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
    <div className="micro-lift micro-glow relative glass-panel p-6 border-l-4 border-neon-cyan hover:border-neon-pink transition">
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

const statusStyles = {
  upcoming: 'bg-neon-purple/10 text-neon-purple border-neon-purple/20',
  open: 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20',
  ended: 'bg-neon-pink/10 text-neon-pink border-neon-pink/20',
};

function resolveBannerUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return path.startsWith('/') ? path : `/uploads/${path.split('/').pop()}`;
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function HackathonCard({ h, user }: { h: Hackathon; user?: User | null }) {
  const status = getHackathonStatus(h.start_date, h.end_date);
  const { target, label } = getCountdownTarget(h.start_date, h.end_date);
  const bannerUrl = resolveBannerUrl(h.banner_path);

  return (
    <div className="glass-panel overflow-hidden micro-lift micro-glow border border-white/5 hover:border-neon-cyan/30 transition flex flex-col h-full min-w-[280px] sm:min-w-[320px] snap-start">
      <div className="relative h-36 bg-gradient-to-br from-space-900 to-slate-900">
        {bannerUrl ? (
          <img src={bannerUrl} alt={`${h.name} banner`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <span
            className={`px-2 py-1 rounded text-[10px] border uppercase tracking-wider ${statusStyles[status.status]}`}
          >
            {status.label}
          </span>
        </div>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-pixel text-xs text-white mb-2">{h.name}</h3>
        <p className="text-sm text-slate-400 line-clamp-2 mb-3 flex-1">{h.description || 'No description provided.'}</p>
        <div className="text-xs font-mono text-neon-cyan mb-3">
          {status.status === 'ended' ? 'Ended' : <Countdown targetDate={target} label={label} />}
        </div>
        <p className="text-[10px] text-slate-500 mb-4">{formatHackathonDateRange(h.start_date, h.end_date)}</p>
        <div className="flex items-center justify-between mt-auto">
          <span className="text-xs text-slate-500">
            {h.team_count ?? 0} team{(h.team_count ?? 0) === 1 ? '' : 's'}
          </span>
          {user ? (
            <Link to={`/hackathons/${h.id}`} className="px-3 py-1.5 rounded text-xs neon-btn neon-btn-cyan">
              View arena
            </Link>
          ) : (
            <Link to="/login" className="px-3 py-1.5 rounded text-xs neon-btn neon-btn-ghost">
              Log in to join
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function FeaturedBanner({ h, user }: { h: Hackathon; user?: User | null }) {
  const status = getHackathonStatus(h.start_date, h.end_date);
  const { target, label } = getCountdownTarget(h.start_date, h.end_date);
  const bannerUrl = resolveBannerUrl(h.banner_path);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-space-900 to-slate-900 mb-10 group micro-lift">
      <div className="relative h-52 sm:h-64 md:h-80">
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt={`${h.name} banner`}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            <svg className="w-16 h-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-space-900/95 via-space-900/50 to-transparent" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="px-2 py-1 rounded text-[10px] border uppercase tracking-wider bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20">
            Featured
          </span>
          <span className={`px-2 py-1 rounded text-[10px] border uppercase tracking-wider ${statusStyles[status.status]}`}>
            {status.label}
          </span>
        </div>
        <h3 className="font-pixel text-xl sm:text-2xl text-white text-shadow-neon mb-2">{h.name}</h3>
        <p className="text-sm text-slate-300 max-w-2xl mb-3 line-clamp-2">{h.description || 'No description provided.'}</p>
        <div className="text-xs font-mono text-neon-cyan mb-4">
          {status.status === 'ended' ? 'Ended' : <Countdown targetDate={target} label={label} />}
        </div>
        <Link
          to={user ? `/hackathons/${h.id}` : '/login'}
          className="inline-block px-6 py-2.5 rounded neon-btn neon-btn-primary text-xs micro-lift"
        >
          {user ? 'View arena' : 'Log in to join'}
        </Link>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const [upcoming, setUpcoming] = useState<Hackathon[]>([]);
  const [stats, setStats] = useState<PublicStats>({
    total_hackathons: 0,
    total_teams: 0,
    total_submissions: 0,
    total_evaluations: 0,
  });
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollCarousel = (direction: 'left' | 'right') => {
    const el = carouselRef.current;
    if (!el) return;
    const scrollAmount = el.offsetWidth * 0.85;
    el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  };

  useEffect(() => {
    hackathonsApi
      .publicList()
      .then((res) => setUpcoming(res.data))
      .catch(() => setUpcoming([]))
      .finally(() => setLoadingUpcoming(false));

    hackathonsApi
      .publicStats()
      .then((res) => setStats(res.data))
      .catch(() => {});
  }, []);

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <ScrollReveal zoom>
          <section className="pt-16 pb-20 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel border border-neon-cyan/20 mb-8">
              <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse-glow" />
              <span className="text-xs text-slate-300 tracking-wide">AI-powered hackathon evaluation</span>
            </div>

            <div className="mb-8 flex justify-center">
              <img
                src="/ZeTheta%20Logo.png"
                alt="ZECATHON logo"
                className="w-32 h-32 sm:w-40 sm:h-40 animate-float drop-shadow-[0_0_20px_rgba(255,255,255,0.15)] cursor-pointer"
                data-egg-trigger="hero-logo"
                data-egg-message="The logo sees you. +25 XP"
                data-egg-color="purple"
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
              {user ? (
                <>
                  <Link to="/hackathons" className="px-8 py-4 rounded neon-btn neon-btn-primary micro-lift micro-pop text-sm">
                    Enter the Arena
                  </Link>
                  {isOrganizer(user.role) && (
                    <Link to="/hackathons/new" className="px-8 py-4 rounded neon-btn neon-btn-ghost micro-lift micro-pop text-sm">
                      Host a Hackathon
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Link to="/register" className="px-8 py-4 rounded neon-btn neon-btn-primary micro-lift micro-pop text-sm">
                    Join the Arena
                  </Link>
                  <Link to="/login" className="px-8 py-4 rounded neon-btn neon-btn-ghost micro-lift micro-pop text-sm">
                    Log in
                  </Link>
                </>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              <Stat value={formatNumber(stats.total_hackathons)} label="Hackathons" />
              <Stat value={formatNumber(stats.total_teams)} label="Teams" />
              <Stat value={formatNumber(stats.total_submissions)} label="Submissions" />
              <Stat value={formatNumber(stats.total_evaluations)} label="Evaluations" />
            </div>
          </section>
        </ScrollReveal>

        {/* Upcoming hackathons */}
        <ScrollReveal>
          <section className="py-12">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <p className="text-neon-cyan text-xs pixel-caps mb-2">Upcoming Arenas</p>
                <h2 className="font-pixel text-xl sm:text-2xl text-white text-shadow-neon">
                  Open hackathons
                </h2>
              </div>
              {user ? (
                <Link to="/hackathons" className="text-sm text-neon-cyan hover:text-white transition">
                  View all →
                </Link>
              ) : (
                <Link to="/register" className="text-sm text-neon-cyan hover:text-white transition">
                  Log in to register →
                </Link>
              )}
            </div>

            {loadingUpcoming ? (
              <div className="text-center py-12">
                <div className="w-10 h-10 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Loading hackathons...</p>
              </div>
            ) : upcoming.length === 0 ? (
              <div className="glass-panel p-8 text-center">
                <p className="text-slate-300 text-sm">No upcoming hackathons right now. Check back soon.</p>
              </div>
            ) : (
              <>
                {/* Featured banner */}
                <FeaturedBanner h={upcoming[0]} user={user} />

                {/* Carousel */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-slate-400">Browse all open arenas</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => scrollCarousel('left')}
                        aria-label="Scroll left"
                        className="p-2 rounded border border-white/10 text-slate-300 hover:text-neon-cyan hover:border-neon-cyan/50 transition micro-lift"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollCarousel('right')}
                        aria-label="Scroll right"
                        className="p-2 rounded border border-white/10 text-slate-300 hover:text-neon-cyan hover:border-neon-cyan/50 transition micro-lift"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div
                    ref={carouselRef}
                    className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {upcoming.map((h) => (
                      <HackathonCard key={h.id} h={h} user={user} />
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>
        </ScrollReveal>

        {/* Features */}
        <ScrollReveal>
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
        </ScrollReveal>

        {/* How it works */}
        <ScrollReveal>
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
        </ScrollReveal>

        {/* CTA */}
        <ScrollReveal zoom>
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
                  {user ? (
                    <>
                      {isOrganizer(user.role) ? (
                        <Link to="/hackathons/new" className="px-8 py-4 rounded neon-btn neon-btn-cyan micro-lift micro-pop text-sm">
                          Host a Hackathon
                        </Link>
                      ) : (
                        <Link to="/hackathons" className="px-8 py-4 rounded neon-btn neon-btn-cyan micro-lift micro-pop text-sm">
                          Explore Hackathons
                        </Link>
                      )}
                      <Link to="/hackathons" className="px-8 py-4 rounded neon-btn neon-btn-ghost micro-lift micro-pop text-sm">
                        Explore Hackathons
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link to="/register" className="px-8 py-4 rounded neon-btn neon-btn-cyan micro-lift micro-pop text-sm">
                        Create your account
                      </Link>
                      <Link to="/login" className="px-8 py-4 rounded neon-btn neon-btn-ghost micro-lift micro-pop text-sm">
                        Log in
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        </ScrollReveal>
      </div>

    </PageLayout>
  );
}
