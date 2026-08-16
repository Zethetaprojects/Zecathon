import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, CreateUserPayload, PlatformStats } from '../api/admin';
import { User, UserRole } from '../types';
import { formatError } from '../utils/formatError';
import { isSuperAdmin } from '../utils/role';
import { useAuth } from '../hooks/useAuth';
import PageLayout from '../components/PageLayout';
import BackButton from '../components/BackButton';
import LoadingScreen from '../components/LoadingScreen';

const ALL_ROLES: UserRole[] = ['superadmin', 'admin', 'organizer', 'judge', 'participant'];
const ADMIN_ROLES: UserRole[] = ['admin', 'organizer', 'judge', 'participant'];

const INITIAL_FORM: CreateUserPayload = {
  username: '',
  email: '',
  password: '',
  role: 'participant',
};

const roleLabel = (role: string) =>
  role === 'superadmin' ? 'Superadmin' : role.charAt(0).toUpperCase() + role.slice(1);

export default function AdminDashboard() {
  const { user } = useAuth();
  const isSuper = user ? isSuperAdmin(user.role) : false;
  const roles = isSuper ? ALL_ROLES : ADMIN_ROLES;

  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [updating, setUpdating] = useState<Record<number, boolean>>({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateUserPayload>(INITIAL_FORM);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<Record<number, boolean>>({});
  const [resetPasswords, setResetPasswords] = useState<Record<number, string>>({});
  const [showResetFor, setShowResetFor] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    action: () => void;
  } | null>(null);

  const fetchUsers = () => {
    setLoading(true);
    adminApi
      .listUsers()
      .then((res) => setUsers(res.data))
      .catch((err) => setError(formatError(err, 'Failed to load users')))
      .finally(() => setLoading(false));
  };

  const fetchStats = () => {
    if (!isSuper) return;
    adminApi
      .stats()
      .then((res) => setStats(res.data))
      .catch((err) => setError(formatError(err, 'Failed to load stats')));
  };

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, []);

  const executeChangeRole = async (id: number, role: UserRole) => {
    setUpdating((prev) => ({ ...prev, [id]: true }));
    setError('');
    setSuccess('');
    try {
      const { data } = await adminApi.updateRole(id, role);
      setUsers((prev) => prev.map((u) => (u.id === id ? data : u)));
      setSuccess(`${data.username}'s role updated to ${roleLabel(data.role)}.`);
    } catch (err: any) {
      setError(formatError(err, 'Failed to update role'));
    } finally {
      setUpdating((prev) => ({ ...prev, [id]: false }));
    }
  };

  const changeRole = (id: number, role: UserRole) => {
    const target = users.find((u) => u.id === id);
    if (!target) return;
    setConfirm({
      title: 'Change role?',
      message: `Change ${target.username}'s role from ${roleLabel(target.role)} to ${roleLabel(role)}?`,
      action: () => executeChangeRole(id, role),
    });
  };

  const executeResetPassword = async (id: number) => {
    const password = resetPasswords[id]?.trim();
    if (!password) return;
    setError('');
    setSuccess('');
    setResetting((prev) => ({ ...prev, [id]: true }));
    try {
      await adminApi.resetPassword(id, password);
      setSuccess(`Password updated for user #${id}.`);
      setResetPasswords((prev) => ({ ...prev, [id]: '' }));
      setShowResetFor(null);
    } catch (err: any) {
      setError(formatError(err, 'Failed to reset password'));
    } finally {
      setResetting((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleResetPassword = (id: number) => {
    const target = users.find((u) => u.id === id);
    const password = resetPasswords[id]?.trim();
    if (!target || !password) return;
    setConfirm({
      title: 'Reset password?',
      message: `Reset password for ${target.username}?`,
      action: () => executeResetPassword(id),
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setCreating(true);
    try {
      const { data } = await adminApi.createUser(form);
      setUsers((prev) => [data, ...prev]);
      setForm(INITIAL_FORM);
      setShowForm(false);
      setSuccess(`User ${data.username} created as ${roleLabel(data.role)}.`);
      fetchStats();
    } catch (err: any) {
      setError(formatError(err, 'Failed to create user'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <BackButton to="/dashboard" label="Back to dashboard" />
        </div>
        <div className="glass-panel p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="font-pixel text-lg text-white text-shadow-neon">ADMIN PANEL</h1>
                {isSuper && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider bg-neon-purple/20 text-neon-purple border border-neon-purple/40">
                    SUPERADMIN
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-sm">Manage platform users, roles, and passwords.</p>
            </div>
            <div className="flex items-center gap-3">
              {isSuper && (
                <Link
                  to="/api-docs"
                  className="hidden sm:inline-block text-xs text-neon-cyan hover:text-white transition"
                >
                  API docs
                </Link>
              )}
              <button
                onClick={() => setShowForm((s) => !s)}
                className="neon-btn neon-btn-primary px-4 py-2 text-sm whitespace-nowrap"
              >
                {showForm ? 'Cancel' : 'Add user'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 px-4 py-3 rounded bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-sm">
            {success}
          </div>
        )}

        {isSuper && stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {[
              { label: 'Users', value: stats.users },
              { label: 'Hackathons', value: stats.hackathons },
              { label: 'Teams', value: stats.teams },
              { label: 'Submissions', value: stats.submissions },
              { label: 'Evaluations', value: stats.evaluations },
              { label: 'Admins', value: stats.users_by_role.admin + stats.users_by_role.superadmin },
            ].map((s) => (
              <div key={s.label} className="glass-panel p-4 text-center">
                <div className="font-pixel text-xl text-neon-cyan">{s.value}</div>
                <div className="text-[10px] pixel-caps text-slate-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleCreate} className="glass-panel p-6 mb-6">
            <h2 className="font-pixel text-xs text-neon-cyan mb-4">CREATE USER</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs pixel-caps text-slate-300 mb-2">Username</label>
                <input
                  type="text"
                  required
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  className="w-full rounded px-3 py-2 neon-input"
                  placeholder="username"
                />
              </div>
              <div>
                <label className="block text-xs pixel-caps text-slate-300 mb-2">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded px-3 py-2 neon-input"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-xs pixel-caps text-slate-300 mb-2">Password</label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full rounded px-3 py-2 neon-input"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-xs pixel-caps text-slate-300 mb-2">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                  className="w-full rounded px-3 py-2 neon-input neon-select"
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="text-xs text-slate-400 mb-4">
              Password must be at least 8 characters with one letter, one digit, and one symbol.
            </div>
            <button
              type="submit"
              disabled={creating}
              className="neon-btn neon-btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create user'}
            </button>
          </form>
        )}

        {loading ? (
          <div className="py-16">
            <LoadingScreen message="Loading users..." />
          </div>
        ) : users.length === 0 ? (
          <div className="glass-panel p-8 text-center">
            <p className="text-slate-300">No users found.</p>
          </div>
        ) : (
          <div className="glass-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-xs pixel-caps text-slate-400">
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-white/10 hover:bg-white/5 transition">
                      <td className="py-4 px-4 font-pixel text-neon-cyan text-xs">#{u.id}</td>
                      <td className="py-4 px-4 text-white font-semibold text-sm">{u.username}</td>
                      <td className="py-4 px-4 text-slate-300 text-sm">{u.email}</td>
                      <td className="py-4 px-4">
                        <select
                          value={u.role}
                          disabled={updating[u.id]}
                          onChange={(e) => changeRole(u.id, e.target.value as UserRole)}
                          className="rounded px-3 py-2 text-sm neon-input neon-select disabled:opacity-50"
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {roleLabel(role)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-4 px-4">
                        {showResetFor === u.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="password"
                              value={resetPasswords[u.id] || ''}
                              onChange={(e) =>
                                setResetPasswords((prev) => ({ ...prev, [u.id]: e.target.value }))
                              }
                              placeholder="New password"
                              className="rounded px-2 py-1 text-xs neon-input w-40"
                            />
                            <button
                              onClick={() => handleResetPassword(u.id)}
                              disabled={resetting[u.id]}
                              className="neon-btn px-2 py-1 text-xs disabled:opacity-50"
                            >
                              {resetting[u.id] ? '...' : 'Save'}
                            </button>
                            <button
                              onClick={() => setShowResetFor(null)}
                              className="text-xs text-slate-400 hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowResetFor(u.id)}
                            className="text-xs text-neon-cyan hover:text-white transition"
                          >
                            Reset password
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {confirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirm(null)} />
            <div className="relative glass-panel p-6 rounded-xl max-w-md w-full border border-white/10 shadow-2xl">
              <h3 className="font-pixel text-sm text-white mb-3">{confirm.title}</h3>
              <p className="text-sm text-slate-300 mb-6 leading-relaxed">{confirm.message}</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirm(null)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    confirm.action();
                    setConfirm(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-neon-pink hover:bg-neon-pink/90 text-white shadow-neon-pink transition"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
