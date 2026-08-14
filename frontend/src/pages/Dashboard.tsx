import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import { isOrganizer, isJudge } from '../utils/role';

function ActionCard({
  to,
  title,
  desc,
  color,
}: {
  to: string;
  title: string;
  desc: string;
  color: 'pink' | 'cyan' | 'purple' | 'yellow';
}) {
  const accent = {
    pink: 'border-neon-pink/40 hover:border-neon-pink hover:shadow-neon-pink',
    cyan: 'border-neon-cyan/40 hover:border-neon-cyan hover:shadow-neon-cyan',
    purple: 'border-neon-purple/40 hover:border-neon-purple hover:shadow-[0_0_20px_rgba(176,38,255,0.35)]',
    yellow: 'border-neon-yellow/40 hover:border-neon-yellow hover:shadow-[0_0_20px_rgba(247,255,88,0.35)]',
  }[color];

  return (
    <Link
      to={to}
      className={`micro-lift micro-glow block p-6 glass-panel border-t-4 transition-all duration-300 hover:-translate-y-1 ${accent}`}
    >
      <h2 className="font-pixel text-xs text-white mb-3">{title}</h2>
      <p className="text-sm text-slate-300">{desc}</p>
    </Link>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="glass-panel p-6 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="font-pixel text-lg text-white text-shadow-neon mb-1">COMMAND DECK</h1>
            <p className="text-slate-400 text-sm">
              Welcome back, <span className="text-neon-cyan font-semibold">{user?.username}</span>
              <span className="ml-2 px-2 py-0.5 rounded bg-neon-purple/20 text-neon-purple text-xs uppercase tracking-wider">
                {user?.role}
              </span>
            </p>
          </div>
          <button
            onClick={logout}
            className="micro-lift micro-pop px-4 py-2 rounded neon-btn neon-btn-ghost text-xs"
          >
            Log out
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ActionCard
            to="/hackathons"
            title="Browse Hackathons"
            desc="Explore all hackathons on the platform."
            color="pink"
          />
          {isOrganizer(user?.role) && (
            <ActionCard
              to="/hackathons/new"
              title="Host Hackathon"
              desc="Launch a new hackathon with problem statements and teams."
              color="cyan"
            />
          )}
          {isJudge(user?.role) && (
            <ActionCard
              to="/hackathons"
              title="Evaluate Projects"
              desc="Score tech or non-tech projects against rubrics."
              color="purple"
            />
          )}
          <ActionCard
            to="/hackathons"
            title="Leaderboards"
            desc="View ranked results once evaluations are complete."
            color="yellow"
          />
        </div>
      </div>
    </PageLayout>
  );
}
