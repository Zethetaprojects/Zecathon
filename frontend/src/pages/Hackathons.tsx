import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { hackathonsApi } from '../api/hackathons';
import { Hackathon } from '../types';
import { formatError } from '../utils/formatError';
import PageLayout from '../components/PageLayout';

export default function Hackathons() {
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    hackathonsApi
      .list()
      .then((res) => setHackathons(res.data))
      .catch((err) => setError(formatError(err, 'Failed to load hackathons')))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="font-pixel text-lg text-white text-shadow-neon">HACKATHONS</h1>
            <p className="text-slate-400 text-sm mt-1">Active arenas and missions</p>
          </div>
          <Link
            to="/hackathons/new"
            className="px-5 py-2.5 rounded neon-btn neon-btn-primary text-xs"
          >
            + Create hackathon
          </Link>
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
          <div className="glass-panel p-8 text-center">
            <p className="text-slate-300 mb-4">No hackathons yet. Be the first to create one.</p>
            <Link to="/hackathons/new" className="px-5 py-2 rounded neon-btn neon-btn-cyan text-xs">
              Create hackathon
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {hackathons.map((h) => (
              <Link
                key={h.id}
                to={`/hackathons/${h.id}`}
                className="glass-panel p-6 block border-l-4 border-neon-cyan/40 hover:border-neon-cyan transition-all duration-300 hover:-translate-y-1 hover:shadow-neon-cyan"
              >
                <h2 className="font-pixel text-xs text-white mb-2">{h.name}</h2>
                <p className="text-slate-300 text-sm line-clamp-2 mb-4">{h.description || 'No description provided.'}</p>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span>{h.problem_statements?.length || 0} problem statements</span>
                  <span>{h.teams?.length || 0} teams</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
