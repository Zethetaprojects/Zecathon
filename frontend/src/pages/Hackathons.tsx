import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { hackathonsApi } from '../api/hackathons';
import { Hackathon } from '../types';
import { formatError } from '../utils/formatError';
import { isOrganizer } from '../utils/role';
import { useAuth } from '../hooks/useAuth';
import PageLayout from '../components/PageLayout';

function EmptyState({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="glass-panel p-10 sm:p-16 text-center micro-lift">
      <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center">
        <svg className="w-12 h-12 text-neon-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      </div>
      <h2 className="font-pixel text-xs text-white text-shadow-neon mb-3">NO ARENAS YET</h2>
      <p className="text-slate-300 text-sm max-w-md mx-auto mb-6">
        {canCreate
          ? 'The arena is quiet. Launch the first hackathon and invite teams to compete.'
          : 'No hackathons are live right now. Check back soon or wait for an organiser to open an arena.'}
      </p>
      {canCreate && (
        <Link to="/hackathons/new" className="px-6 py-3 rounded neon-btn neon-btn-cyan text-xs micro-lift micro-pop">
          + Create hackathon
        </Link>
      )}
    </div>
  );
}

function formatDate(date?: string) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Hackathons() {
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<Record<number, boolean>>({});
  const { user } = useAuth();
  const canCreate = isOrganizer(user?.role);

  useEffect(() => {
    hackathonsApi
      .list()
      .then((res) => setHackathons(res.data))
      .catch((err) => setError(formatError(err, 'Failed to load hackathons')))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this hackathon and all its teams, submissions, and reports?')) return;
    setDeleting((prev) => ({ ...prev, [id]: true }));
    setError('');
    try {
      await hackathonsApi.delete(id);
      setHackathons((prev) => prev.filter((h) => h.id !== id));
    } catch (err: any) {
      setError(formatError(err, 'Failed to delete hackathon'));
    } finally {
      setDeleting((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Hero header */}
        <div className="relative overflow-hidden glass-panel p-8 sm:p-10 mb-8 border border-neon-cyan/20">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-neon-cyan/10 rounded-full blur-2xl" />
          <div className="relative">
            <p className="text-neon-cyan text-xs pixel-caps mb-2">Active Arenas</p>
            <h1 className="font-pixel text-xl sm:text-2xl text-white text-shadow-neon mb-2">
              HACKATHONS
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              Browse open arenas, join a team, submit your project, and climb the leaderboard.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="text-sm text-slate-400">
            {loading ? 'Loading...' : `${hackathons.length} arena${hackathons.length === 1 ? '' : 's'} found`}
          </div>
          {canCreate && (
            <Link
              to="/hackathons/new"
              className="px-5 py-2.5 rounded neon-btn neon-btn-primary text-xs micro-lift micro-pop"
            >
              + Create hackathon
            </Link>
          )}
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400 text-sm">Loading hackathons...</p>
          </div>
        ) : hackathons.length === 0 ? (
          <EmptyState canCreate={canCreate} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {hackathons.map((h) => (
              <Link
                key={h.id}
                to={`/hackathons/${h.id}`}
                className="group glass-panel p-6 block border-l-4 border-neon-cyan/40 hover:border-neon-cyan transition-all duration-300 hover:-translate-y-1 hover:shadow-neon-cyan micro-lift"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h2 className="font-pixel text-xs text-white group-hover:text-neon-cyan transition">
                    {h.name}
                  </h2>
                  <span className="px-2 py-1 rounded text-[10px] bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 uppercase tracking-wider">
                    Open
                  </span>
                </div>
                <p className="text-slate-300 text-sm line-clamp-2 mb-4">
                  {h.description || 'No description provided.'}
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs text-slate-400 mb-4">
                  <div className="glass-panel px-3 py-2">
                    <span className="block text-[10px] text-slate-500 uppercase tracking-wider">Problems</span>
                    <span className="text-white font-semibold">{h.problem_statement_count ?? 0}</span>
                  </div>
                  <div className="glass-panel px-3 py-2">
                    <span className="block text-[10px] text-slate-500 uppercase tracking-wider">Teams</span>
                    <span className="text-white font-semibold">{h.team_count ?? 0}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    {formatDate(h.start_date) || 'Date TBD'}
                    {h.end_date && ` → ${formatDate(h.end_date)}`}
                  </span>
                  <div className="flex items-center gap-3">
                    {canCreate && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDelete(h.id);
                        }}
                        disabled={deleting[h.id]}
                        className="text-neon-pink hover:text-white transition disabled:opacity-50"
                        title="Delete hackathon"
                      >
                        {deleting[h.id] ? '...' : 'Delete'}
                      </button>
                    )}
                    <span className="text-neon-cyan group-hover:translate-x-1 transition transform">
                      View arena →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
