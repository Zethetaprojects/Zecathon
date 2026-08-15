import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useMusic } from './MusicProvider';
import { useEasterEggs } from '../hooks/useEasterEggs';
import { isAdmin } from '../utils/role';
import EasterEggHunt from './EasterEggHunt';

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 ml-1 transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function FeatureItem({
  to,
  title,
  desc,
  icon,
}: {
  to: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="micro-lift flex items-start gap-3 p-3 rounded-lg hover:bg-white/10 transition"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded bg-neon-cyan/10 text-neon-cyan flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
      </div>
    </Link>
  );
}

function SoundToggle() {
  const { playing, toggle } = useMusic();
  return (
    <button
      onClick={toggle}
      data-egg-trigger="sound-toggle"
      data-egg-message="Space soundtrack unlocked! +25 XP"
      data-egg-color="cyan"
      title={playing ? 'Mute space music' : 'Play space music'}
      className="micro-lift micro-pop w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-neon-cyan flex items-center justify-center transition"
    >
      {playing ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
        </svg>
      )}
    </button>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { discover, setMode } = useEasterEggs();
  const logoClicksRef = useRef<number[]>([]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleLogoClick = () => {
    const now = Date.now();
    logoClicksRef.current = logoClicksRef.current.filter((t) => now - t < 2000);
    logoClicksRef.current.push(now);
    if (logoClicksRef.current.length >= 5) {
      logoClicksRef.current = [];
      discover('logo-fan', 'Logo fanatic! Disco mode unlocked 🎉', 'pink');
      setMode('disco');
    }
  };

  return (
    <nav className="sticky top-4 z-50 mx-4 sm:mx-8">
      <div className="max-w-7xl mx-auto glass-panel rounded-2xl px-4 sm:px-6 py-3 border border-white/10">
        <div className="flex items-center justify-between gap-6">
          {/* Logo */}
          <Link
            to="/"
            onClick={handleLogoClick}
            className="flex items-center gap-3 group"
          >
            <img
              src="/ZeTheta%20Logo.png"
              alt="Zetheta logo"
              className="w-9 h-9 object-contain transition group-hover:scale-110 group-hover:rotate-6"
            />
            <div className="flex flex-col leading-none">
              <span className="font-pixel text-xs sm:text-sm tracking-widest text-white group-hover:text-neon-cyan transition">
                ZECATHON
              </span>
              <span className="text-[10px] text-slate-400 tracking-wide hidden sm:inline">
                by Zetheta
              </span>
            </div>
          </Link>

          {/* Center nav — logged-in only */}
          {user && (
            <div className="hidden md:flex items-center gap-1">
              <div className="relative" ref={ref}>
                <button
                  onClick={() => setOpen(!open)}
                  className={`flex items-center px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition micro-lift ${open ? 'bg-white/10 text-white' : ''}`}
                >
                  Features
                  <ChevronDown open={open} />
                </button>

                {open && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-80 p-3 rounded-xl glass-panel border border-white/10 shadow-2xl">
                    <FeatureItem
                      to="/hackathons"
                      title="Tech Evaluation"
                      desc="Score GitHub repositories against hackathon rubrics."
                      icon={
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                      }
                    />
                    <FeatureItem
                      to="/hackathons"
                      title="Non-Tech Evaluation"
                      desc="Evaluate PDFs, PPTs, and documents with AI."
                      icon={
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      }
                    />
                    <FeatureItem
                      to="/hackathons"
                      title="Live Leaderboards"
                      desc="Discrete, ranked scores after every evaluation."
                      icon={
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      }
                    />
                  </div>
                )}
              </div>

              <Link
                to="/hackathons"
                className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition micro-lift"
              >
                Hackathons
              </Link>
              <Link
                to="/hackathons"
                className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition micro-lift"
              >
                Leaderboards
              </Link>
              <Link
                to="/dashboard"
                className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition micro-lift"
              >
                Dashboard
              </Link>
              {user && isAdmin(user.role) && (
                <Link
                  to="/admin"
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition micro-lift"
                >
                  Admin
                </Link>
              )}
            </div>
          )}

          {/* Right auth + sound toggle */}
          <div className="flex items-center gap-3">
            <EasterEggHunt />
            <SoundToggle />
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="micro-lift hidden sm:block text-sm text-slate-300 hover:text-white transition"
                >
                  {user.username}
                </Link>
                <button
                  onClick={handleLogout}
                  className="micro-lift micro-pop px-4 py-2 rounded-lg text-sm font-medium text-white bg-white/10 hover:bg-white/20 border border-white/10 transition"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="micro-lift hidden sm:block px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white transition"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="micro-lift micro-pop px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-neon-pink to-neon-purple hover:opacity-90 transition shadow-neon-pink"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
