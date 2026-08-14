import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useAuth } from '../hooks/useAuth';
import { formatError } from '../utils/formatError';
import PageLayout from '../components/PageLayout';

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await authApi.register(form);
      const { data: tokenData } = await authApi.login({ username: form.username, password: form.password });
      localStorage.setItem('token', tokenData.access_token);
      const { data: user } = await authApi.me();
      login(tokenData.access_token, user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(formatError(err, 'Registration failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageLayout className="flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-pixel text-xl text-white text-shadow-neon mb-2">CREATE ACCOUNT</h1>
          <p className="text-slate-400 text-sm">Join ZECATHON and start building</p>
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
              name="username"
              type="text"
              value={form.username}
              onChange={handleChange}
              required
              className="w-full rounded px-4 py-3 neon-input"
              placeholder="flowuser"
            />
          </div>

          <div>
            <label className="block text-xs pixel-caps text-slate-300 mb-2">Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full rounded px-4 py-3 neon-input"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs pixel-caps text-slate-300 mb-2">Password</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              className="w-full rounded px-4 py-3 neon-input"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded neon-btn neon-btn-primary py-3 text-sm disabled:opacity-50"
          >
            {busy ? 'Creating...' : 'Register'}
          </button>

          <p className="text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-neon-cyan hover:text-white transition">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </PageLayout>
  );
}
