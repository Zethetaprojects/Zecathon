import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useAuth } from '../hooks/useAuth';
import { formatError } from '../utils/formatError';
import PageLayout from '../components/PageLayout';
import type { UserRole } from '../types';

// Mirrors the backend password policy (app/schemas.py check_password_strength).
const PASSWORD_SYMBOLS = `!@#$%^&*()_+-=[]{}|;':",./<>?`;
const PASSWORD_RULES: { label: string; test: (pw: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'At least one letter', test: (pw) => /[A-Za-z]/.test(pw) },
  { label: 'At least one number', test: (pw) => /[0-9]/.test(pw) },
  { label: 'At least one symbol (e.g. ! @ # $ %)', test: (pw) => [...pw].some((c) => PASSWORD_SYMBOLS.includes(c)) },
];

const REGISTER_ROLES: { value: UserRole; label: string }[] = [
  { value: 'participant', label: 'Student (Participant)' },
  { value: 'organizer', label: 'Organizer' },
];

export default function Register() {
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'participant' as UserRole,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Show field errors once the user has tried to submit (not while they type the first characters).
  const [attempted, setAttempted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const passwordOk = PASSWORD_RULES.every((r) => r.test(form.password));
  const fieldErrors = {
    username: form.username.trim().length < 3 ? 'Username needs at least 3 characters.' : '',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? '' : 'Enter a valid email address, e.g. you@example.com.',
    password: passwordOk ? '' : 'Password does not meet all the rules below.',
  };
  const formValid = !fieldErrors.username && !fieldErrors.email && !fieldErrors.password;
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAttempted(true);
    // Validate here so a single click explains what is wrong, without a server round trip.
    if (!formValid) return;
    setBusy(true);
    try {
      await authApi.register({ ...form, username: form.username.trim(), email: form.email.trim() });
      const { data: tokenData } = await authApi.login({ username: form.username.trim(), password: form.password });
      localStorage.setItem('token', tokenData.access_token);
      const { data: user } = await authApi.me();
      await login(tokenData.access_token, user);
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
          <p className="text-slate-400 text-sm">Join ZECKATHON and start building</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="glass-panel p-8 space-y-5">
          {error && (
            <div role="alert" className="px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">
              {error.replace(/Value error, /g, '')}
            </div>
          )}
          {attempted && !formValid && !error && (
            <div role="alert" className="px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">
              Please fix the highlighted fields.
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
              autoComplete="username"
              aria-invalid={attempted && !!fieldErrors.username}
              className={`w-full rounded px-4 py-3 neon-input ${attempted && fieldErrors.username ? 'border-neon-pink/70' : ''}`}
              placeholder="flowuser"
            />
            {attempted && fieldErrors.username && <p className="mt-1.5 text-xs text-neon-pink">{fieldErrors.username}</p>}
          </div>

          <div>
            <label className="block text-xs pixel-caps text-slate-300 mb-2">Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
              aria-invalid={attempted && !!fieldErrors.email}
              className={`w-full rounded px-4 py-3 neon-input ${attempted && fieldErrors.email ? 'border-neon-pink/70' : ''}`}
              placeholder="you@example.com"
            />
            {attempted && fieldErrors.email && <p className="mt-1.5 text-xs text-neon-pink">{fieldErrors.email}</p>}
          </div>

          <div>
            <label className="block text-xs pixel-caps text-slate-300 mb-2">Password</label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
                aria-invalid={attempted && !!fieldErrors.password}
                aria-describedby="password-rules"
                className={`w-full rounded px-4 py-3 pr-16 neon-input ${attempted && fieldErrors.password ? 'border-neon-pink/70' : ''}`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 hover:text-neon-cyan"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <ul id="password-rules" className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5" aria-live="polite">
              {PASSWORD_RULES.map((rule) => {
                const met = rule.test(form.password);
                const missed = attempted && !met;
                return (
                  <li
                    key={rule.label}
                    className={`flex items-center gap-2 text-xs ${met ? 'text-neon-cyan' : missed ? 'text-neon-pink' : 'text-slate-400'}`}
                  >
                    <span
                      className={`w-4 h-4 flex-shrink-0 rounded-full border flex items-center justify-center text-[10px] ${
                        met ? 'border-neon-cyan bg-neon-cyan/15' : missed ? 'border-neon-pink' : 'border-slate-600'
                      }`}
                      aria-hidden="true"
                    >
                      {met ? '✓' : ''}
                    </span>
                    <span>
                      {rule.label}
                      <span className="sr-only">{met ? ' (done)' : ' (not yet)'}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <label className="block text-xs pixel-caps text-slate-300 mb-2">I am joining as</label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full rounded px-4 py-3 neon-input neon-select"
            >
              {REGISTER_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded neon-btn neon-btn-primary micro-lift micro-pop py-3 text-sm disabled:opacity-50"
          >
            {busy ? 'Creating...' : 'Register'}
          </button>

          <p className="text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-neon-cyan hover:text-white transition micro-shift">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </PageLayout>
  );
}
