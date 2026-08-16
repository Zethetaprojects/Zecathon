import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import { useAuth } from '../hooks/useAuth';
import { isAdmin } from '../utils/role';

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const color =
    method === 'GET' ? 'text-neon-cyan' : method === 'POST' ? 'text-neon-pink' : method === 'PUT' ? 'text-neon-yellow' : 'text-neon-purple';
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-b border-white/10 last:border-0">
      <span className={`font-mono text-xs font-semibold w-16 ${color}`}>{method}</span>
      <code className="font-mono text-xs text-slate-300 bg-white/5 px-2 py-1 rounded">{path}</code>
      <span className="text-sm text-slate-400 sm:ml-auto">{desc}</span>
    </div>
  );
}

export default function ApiDocsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !isAdmin(user.role)) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  if (!user || !isAdmin(user.role)) {
    return null;
  }

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="font-pixel text-lg text-white text-shadow-neon mb-2">API REFERENCE</h1>
          <p className="text-slate-400 text-sm">
            Base URL: <code className="text-neon-cyan">/api</code>. All authenticated routes need a Bearer token from{' '}
            <code className="text-neon-cyan">/auth/login</code>.
          </p>
        </div>

        <div className="glass-panel p-6 mb-6">
          <h2 className="font-pixel text-xs text-neon-cyan mb-4">AUTHENTICATION</h2>
          <Endpoint method="POST" path="/auth/register" desc="Create a new account (Student or Organizer)." />
          <Endpoint method="POST" path="/auth/login" desc="Get a JWT access token." />
          <Endpoint method="GET" path="/auth/me" desc="Current user profile." />
          <Endpoint method="GET" path="/auth/admin/users" desc="Admin only — list all users." />
        </div>

        <div className="glass-panel p-6 mb-6">
          <h2 className="font-pixel text-xs text-neon-cyan mb-4">HACKATHONS</h2>
          <Endpoint method="GET" path="/hackathons" desc="List all hackathons." />
          <Endpoint method="POST" path="/hackathons" desc="Organizer/Admin — create a hackathon." />
          <Endpoint method="POST" path="/hackathons/{id}/problem-statements" desc="Upload a problem statement." />
          <Endpoint method="GET" path="/hackathons/{id}/leaderboard" desc="Authenticated leaderboard." />
          <Endpoint method="GET" path="/leaderboard/public/{id}" desc="Public shareable leaderboard." />
        </div>

        <div className="glass-panel p-6 mb-6">
          <h2 className="font-pixel text-xs text-neon-cyan mb-4">TEAMS & SUBMISSIONS</h2>
          <Endpoint method="POST" path="/teams" desc="Create or join a team." />
          <Endpoint method="POST" path="/submissions" desc="Submit a project document or GitHub link." />
          <Endpoint method="GET" path="/submissions/{id}/report" desc="View evaluation report." />
        </div>

        <div className="glass-panel p-6 mb-6">
          <h2 className="font-pixel text-xs text-neon-cyan mb-4">EVALUATION</h2>
          <Endpoint method="POST" path="/evaluate/tech/{submission_id}" desc="Evaluate a tech submission." />
          <Endpoint method="POST" path="/evaluate/non-tech/{submission_id}" desc="Evaluate a non-tech submission." />
          <Endpoint method="POST" path="/evaluate/tech/{id}/retry" desc="Re-run a tech evaluation." />
          <Endpoint method="POST" path="/evaluate/non-tech/{id}/retry" desc="Re-run a non-tech evaluation." />
        </div>
      </div>
    </PageLayout>
  );
}
