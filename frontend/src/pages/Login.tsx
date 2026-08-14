import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useAuth } from '../hooks/useAuth';
import { formatError } from '../utils/formatError';
import PageLayout from '../components/PageLayout';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data: tokenData } = await authApi.login({ username, password });
      localStorage.setItem('token', tokenData.access_token);
      const { data: user } = await authApi.me();
      login(tokenData.access_token, user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(formatError(err, 'Login failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageLayout className="flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-pixel text-xl text-white text-shadow-neon mb-2">LOGIN</h1>
          <p className="text-slate-400 text-sm">Enter the ZECATHON arena</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel p-8 space-y-5">
          {error && (
            <div className="px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs pixel-caps text-slate-300 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded px-4 py-3 neon-input"
              placeholder="flowuser"
            />
          </div>

          <div>
            <label className="block text-xs pixel-caps text-slate-300 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded px-4 py-3 neon-input"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded neon-btn neon-btn-primary micro-lift micro-pop py-3 text-sm disabled:opacity-50"
          >
            {busy ? 'Authenticating...' : 'Log in'}
          </button>

          <p className="text-center text-sm text-slate-400">
            No account?{' '}
            <Link to="/register" className="text-neon-cyan hover:text-white transition micro-shift">
              Register
            </Link>
          </p>
        </form>
      </div>
    </PageLayout>
  );
}
