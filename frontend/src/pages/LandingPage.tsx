import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import PageLayout from '../components/PageLayout';

function FeatureCard({ title, desc, color }: { title: string; desc: string; color: 'pink' | 'cyan' | 'purple' }) {
  const border = {
    pink: 'border-neon-pink/40 hover:border-neon-pink',
    cyan: 'border-neon-cyan/40 hover:border-neon-cyan',
    purple: 'border-neon-purple/40 hover:border-neon-purple',
  }[color];
  const shadow = {
    pink: 'hover:shadow-neon-pink',
    cyan: 'hover:shadow-neon-cyan',
    purple: 'hover:shadow-[0_0_20px_rgba(176,38,255,0.35)]',
  }[color];

  return (
    <div
      className={`glass-panel p-6 transition-all duration-300 hover:-translate-y-1 border-t-4 ${border} ${shadow}`}
    >
      <h3 className="font-pixel text-xs text-white mb-3">{title}</h3>
      <p className="text-sm text-slate-300 leading-relaxed">{desc}</p>
    </div>
  );
}

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <PageLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 text-center">
        <div className="mb-8 flex justify-center">
          <img
            src="/ZeTheta%20Logo.png"
            alt="ZECATHON logo"
            className="w-36 h-36 sm:w-48 sm:h-48 animate-float drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]"
          />
        </div>

        <h1 className="font-pixel text-3xl sm:text-5xl md:text-6xl text-white mb-4 text-shadow-neon leading-tight">
          ZECATHON
        </h1>
        <p className="text-lg sm:text-xl text-neon-cyan mb-2 pixel-caps">
          Code With Purpose & Innovate, Collaborate, Dominate
        </p>
        <p className="text-sm text-slate-400 mb-10 pixel-caps">
          A platform by Zetheta Algorithms
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link
            to={user ? '/hackathons' : '/register'}
            className="px-8 py-4 rounded neon-btn neon-btn-primary text-sm"
          >
            {user ? 'Enter Arena' : 'Join the Arena'}
          </Link>
          <Link
            to="/hackathons/new"
            className="px-8 py-4 rounded neon-btn neon-btn-ghost text-sm"
          >
            Host a Hackathon
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mb-16">
          <FeatureCard
            color="pink"
            title="Create Hackathons"
            desc="Set up problem statements, tracks, and evaluation criteria in minutes."
          />
          <FeatureCard
            color="cyan"
            title="Submit Projects"
            desc="Teams can submit GitHub repos or documents with optional PPTs."
          />
          <FeatureCard
            color="purple"
            title="AI Evaluation"
            desc="Tech and non-tech submissions are scored against hackathon rubrics."
          />
        </div>

        <div className="glass-panel inline-block px-8 py-6">
          <p className="text-neon-yellow font-pixel text-xs mb-3">HACKING NEVER STOPS</p>
          <p className="text-slate-300 text-sm">
            Build, evaluate, and celebrate the next generation of builders.
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
