import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useMusic } from './MusicProvider';
import { useEasterEggs } from '../hooks/useEasterEggs';
import { isAdmin, isOrganizer } from '../utils/role';
import EasterEggHunt from './EasterEggHunt';

function SoundMixer() {
  const {
    enabled,
    toggle,
    musicVolume,
    effectsVolume,
    setMusicVolume,
    setEffectsVolume,
  } = useMusic();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!popoverRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const slider = (
    label: string,
    icon: React.ReactNode,
    value: number,
    onChange: (v: number) => void
  ) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="pixel-caps">{label}</span>
        </div>
        <span className="font-mono text-neon-cyan">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={!enabled}
        className="w-full neon-slider"
        aria-label={`${label} volume`}
      />
    </div>
  );

  return (
    <div className="relative" data-sound-ignore>
      <button
        onClick={() => setOpen((o) => !o)}
        data-egg-trigger="sound-toggle"
        data-egg-message="Space soundtrack unlocked! +25 XP"
        data-egg-color="cyan"
        title={enabled ? 'Sound mixer' : 'Enable sound'}
        className={`micro-lift micro-pop w-9 h-9 rounded-lg border flex items-center justify-center transition relative ${
          enabled
            ? 'bg-neon-cyan/10 border-neon-cyan/40 text-neon-cyan'
            : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
        }`}
      >
        {enabled ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        )}
        {enabled && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-neon-pink animate-pulse" />
        )}
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full mt-2 w-64 p-4 glass-panel rounded-xl border border-white/10 shadow-2xl z-50"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="font-pixel text-xs text-white">SOUND MIXER</span>
            <button
              onClick={() => {
                if (!enabled) toggle();
                setOpen(false);
              }}
              className="text-[10px] text-neon-cyan hover:text-white transition"
            >
              {enabled ? 'Close' : 'Enable all'}
            </button>
          </div>

          <div className="space-y-4">
            {slider(
              'Background',
              <svg className="w-4 h-4 text-neon-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>,
              musicVolume,
              setMusicVolume
            )}
            {slider(
              'Effects',
              <svg className="w-4 h-4 text-neon-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>,
              effectsVolume,
              setEffectsVolume
            )}
          </div>

          <button
            onClick={toggle}
            className={`mt-4 w-full text-xs py-2 rounded-lg border transition ${
              enabled
                ? 'bg-white/5 border-white/10 text-slate-300 hover:text-neon-pink hover:border-neon-pink/40'
                : 'bg-neon-cyan/10 border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/20'
            }`}
          >
            {enabled ? 'Mute all' : 'Enable sound'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { discover, setMode } = useEasterEggs();
  const logoClicksRef = useRef<number[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

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

  const navLinks = user
    ? [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/hackathons', label: 'Hackathons' },
        ...(isAdmin(user.role) ? [{ to: '/admin', label: 'Admin' }] : []),
        ...(isOrganizer(user.role) ? [{ to: '/reports', label: 'Reports' }] : []),
      ]
    : [];

  return (
    <nav className="sticky top-4 z-50 mx-4 sm:mx-8">
      <div className="max-w-7xl mx-auto glass-panel rounded-2xl px-4 sm:px-6 py-3 border border-white/10">
        <div className="flex items-center justify-between gap-6">
          {/* Logo */}
          <Link to="/" onClick={handleLogoClick} className="flex items-center gap-3 group">
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

          {/* Center nav — logged-in only (desktop) */}
          {user && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition micro-lift"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          {/* Right auth + sound mixer + mobile menu */}
          <div className="flex items-center gap-3">
            <EasterEggHunt />
            <SoundMixer />
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

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="md:hidden w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center transition"
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {menuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-white/10">
            <div className="flex flex-col gap-1">
              {user ? (
                <>
                  {navLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setMenuOpen(false)}
                      className="px-4 py-3 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition"
                    >
                      {link.label}
                    </Link>
                  ))}
                  <div className="border-t border-white/10 my-1" />
                  <span className="px-4 py-2 text-xs text-slate-500 uppercase tracking-wider">Signed in as {user.username}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      handleLogout();
                    }}
                    className="px-4 py-3 rounded-lg text-sm text-left text-neon-pink hover:bg-neon-pink/10 transition"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="px-4 py-3 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMenuOpen(false)}
                    className="px-4 py-3 rounded-lg text-sm text-neon-cyan hover:bg-neon-cyan/10 transition"
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
