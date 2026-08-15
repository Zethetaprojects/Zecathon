import { useEffect, useState } from 'react';
import { adminApi } from '../api/admin';
import { User, UserRole } from '../types';
import { formatError } from '../utils/formatError';
import PageLayout from '../components/PageLayout';

const ROLES: UserRole[] = ['admin', 'organizer', 'judge', 'participant'];

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<Record<number, boolean>>({});

  const fetchUsers = () => {
    setLoading(true);
    adminApi
      .listUsers()
      .then((res) => setUsers(res.data))
      .catch((err) => setError(formatError(err, 'Failed to load users')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const changeRole = async (id: number, role: UserRole) => {
    setUpdating((prev) => ({ ...prev, [id]: true }));
    setError('');
    try {
      const { data } = await adminApi.updateRole(id, role);
      setUsers((prev) => prev.map((u) => (u.id === id ? data : u)));
    } catch (err: any) {
      setError(formatError(err, 'Failed to update role'));
    } finally {
      setUpdating((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="glass-panel p-6 mb-8">
          <h1 className="font-pixel text-lg text-white text-shadow-neon mb-2">ADMIN PANEL</h1>
          <p className="text-slate-400 text-sm">Manage platform users and roles.</p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400 text-sm">Loading users...</p>
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
                          className="rounded px-3 py-2 text-sm neon-input disabled:opacity-50"
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
