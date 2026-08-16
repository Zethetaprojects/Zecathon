import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useEasterEggs } from '../hooks/useEasterEggs';
import { isOrganizer } from '../utils/role';

function SocialIcon({ href, label, children, ...rest }: { href: string; label: string; children: React.ReactNode; [key: string]: any }) {
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noreferrer"
      className="micro-lift micro-glow w-9 h-9 rounded-lg glass-panel flex items-center justify-center text-slate-400 hover:text-neon-cyan hover:border-neon-cyan/50 transition"
      {...rest}
    >
      {children}
    </a>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="micro-shift block text-sm text-slate-400 hover:text-neon-cyan transition">
      {children}
    </Link>
  );
}

export default function Footer() {
  const { user } = useAuth();
  const { discover } = useEasterEggs();
  const [ccClicks, setCcClicks] = useState(0);

  const handleCopyrightClick = () => {
    const next = ccClicks + 1;
    setCcClicks(next);
    if (next === 3) {
      discover('copyright-click', 'You read the fine print. +75 XP', 'yellow');
    }
  };
  return (
    <footer className="border-t border-white/10 bg-space-900/60 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-3 group mb-4">
              <img
                src="/ZeTheta%20Logo.png"
                alt="Zetheta logo"
                className="w-10 h-10 object-contain transition group-hover:scale-110 group-hover:rotate-6"
              />
              <div className="leading-none">
                <span className="font-pixel text-sm tracking-widest text-white group-hover:text-neon-cyan transition">
                  ZECATHON
                </span>
                <span className="block text-[10px] text-slate-400 tracking-wide mt-1">
                  by Zetheta Algorithms
                </span>
              </div>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed">
              The AI-powered evaluation platform for tech and non-tech hackathons. Built for organisers, judges, and builders.
            </p>
          </div>

          {/* Product / Get Started */}
          <div>
            <h4 className="font-pixel text-[10px] tracking-widest text-white mb-4">
              {user ? 'PLATFORM' : 'GET STARTED'}
            </h4>
            <nav className="space-y-2">
              {user ? (
                <>
                  <FooterLink to="/hackathons">Hackathons</FooterLink>
                  {isOrganizer(user.role) && <FooterLink to="/hackathons/new">Host a Hackathon</FooterLink>}
                  <FooterLink to="/hackathons">Leaderboards</FooterLink>
                  <FooterLink to="/dashboard">Dashboard</FooterLink>
                </>
              ) : (
                <>
                  <FooterLink to="/register">Create account</FooterLink>
                  <FooterLink to="/login">Log in</FooterLink>
                  <FooterLink to="/">How it works</FooterLink>
                </>
              )}
            </nav>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-pixel text-[10px] tracking-widest text-white mb-4">RESOURCES</h4>
            <nav className="space-y-2">
              <FooterLink to="/docs">How it Works</FooterLink>
              {user && <FooterLink to="/api-docs">API Reference</FooterLink>}
              <FooterLink to="/rubrics">Evaluator Rubrics</FooterLink>
              <FooterLink to="/support">Support</FooterLink>
            </nav>
          </div>

          {/* Legal / Social */}
          <div>
            <h4 className="font-pixel text-[10px] tracking-widest text-white mb-4">CONNECT</h4>
            <div className="flex items-center gap-3 mb-6">
              <SocialIcon href="https://github.com" label="GitHub" data-egg-trigger="github-click" data-egg-message="GitHub star incoming! +25 XP" data-egg-color="cyan">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </SocialIcon>
              <SocialIcon href="https://twitter.com" label="X / Twitter" data-egg-trigger="twitter-click" data-egg-message="Tweet tweet! +25 XP" data-egg-color="cyan">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </SocialIcon>
              <SocialIcon href="https://linkedin.com" label="LinkedIn" data-egg-trigger="linkedin-click" data-egg-message="Professional network expanded. +25 XP" data-egg-color="cyan">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.852 3.37-1.852 3.601 0 4.267 2.37 4.267 5.455v6.888zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </SocialIcon>
              {/* Hidden teddy */}
              <button
                onClick={() => discover('hidden-teddy', 'You found the hidden teddy bear! +150 XP', 'pink')}
                title="?"
                className="micro-lift micro-glow w-9 h-9 rounded-lg glass-panel flex items-center justify-center text-slate-500/40 hover:text-neon-pink hover:border-neon-pink/50 transition opacity-40 hover:opacity-100"
                data-cursor-hover
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2a4 4 0 0 0-4 4 4 4 0 0 0-4-4 4 4 0 0 0-4 4c0 3.5 5 6 8 6s8-2.5 8-6a4 4 0 0 0-4-4Zm-2 11c-2 0-5 2-5 5v4h14v-4c0-3-3-5-5-5h-4Zm-2 3h2v2H8v-2Zm6 0h2v2h-2v-2Z" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Need help? Reach out at{' '}
              <a href="mailto:support@zetheta.com" className="text-slate-400 hover:text-neon-cyan transition">
                support@zetheta.com
              </a>
            </p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p
            onClick={handleCopyrightClick}
            className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition select-none"
          >
            © {new Date().getFullYear()} ZECATHON by Zetheta Algorithms. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/" className="micro-shift text-xs text-slate-500 hover:text-slate-300 transition">
              Privacy Policy
            </Link>
            <Link to="/" className="micro-shift text-xs text-slate-500 hover:text-slate-300 transition">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
