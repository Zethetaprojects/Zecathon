import { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useMusic } from './MusicProvider';
import { useEasterEggs } from '../hooks/useEasterEggs';
import { isAdmin, isOrganizer } from '../utils/role';
import EasterEggHunt from './EasterEggHunt';

function SoundToggle() {
  const { enabled, toggle } = useMusic();
  return (
    <button
      onClick={toggle}
      data-egg-trigger="sound-toggle"
      data-egg-message="Space soundtrack unlocked! +25 XP"
      data-egg-color="cyan"
      title={enabled ? 'Mute all sound' : 'Enable sound'}
      className="micro-lift micro-pop w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-neon-cyan flex items-center justify-center transition"
    >
      {enabled ? (
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
  const { discover, setMode } = useEasterEggs();
  const logoClicksRef = useRef<number[]>([]);

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
              <Link
                to="/hackathons"
                className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition micro-lift"
              >
                Hackathons
              </Link>
              <Link
                to="/dashboard"
                className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition micro-lift"
              >
                Dashboard
              </Link>
              {isAdmin(user.role) && (
                <Link
                  to="/admin"
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition micro-lift"
                >
                  Admin
                </Link>
              )}
              {isOrganizer(user.role) && (
                <Link
                  to="/reports"
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition micro-lift"
                >
                  Reports
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
