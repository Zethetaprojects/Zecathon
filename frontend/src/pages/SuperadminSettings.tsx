import { useEffect, useState } from 'react';
import { adminApi, GlobalSettings, RolePermissions } from '../api/admin';
import { UserRole } from '../types';
import { formatError } from '../utils/formatError';
import PageLayout from '../components/PageLayout';
import BackButton from '../components/BackButton';
import LoadingScreen from '../components/LoadingScreen';

const ROLES: UserRole[] = ['superadmin', 'admin', 'organizer', 'judge', 'participant'];

const FEATURE_META: { key: string; label: string; group: string }[] = [
  { key: 'create_hackathon', label: 'Create hackathons', group: 'Hackathons' },
  { key: 'edit_hackathon', label: 'Edit hackathons', group: 'Hackathons' },
  { key: 'delete_hackathon', label: 'Delete hackathons', group: 'Hackathons' },
  { key: 'manage_problem_statements', label: 'Manage problem statements', group: 'Hackathons' },
  { key: 'create_team', label: 'Create teams', group: 'Teams' },
  { key: 'join_team', label: 'Join teams', group: 'Teams' },
  { key: 'manage_team_members', label: 'Manage team members', group: 'Teams' },
  { key: 'submit_project', label: 'Submit projects', group: 'Submissions' },
  { key: 'evaluate_submission', label: 'Evaluate submissions', group: 'Submissions' },
  { key: 'view_reports', label: 'View reports', group: 'Reports' },
  { key: 'view_leaderboard', label: 'View leaderboards', group: 'Reports' },
  { key: 'manage_users', label: 'Manage users', group: 'Admin' },
  { key: 'view_admin_panel', label: 'View admin panel', group: 'Admin' },
  { key: 'view_api_docs', label: 'View API docs', group: 'Admin' },
  { key: 'manage_settings', label: 'Manage settings', group: 'Admin' },
  { key: 'participate', label: 'Participate (teams / submissions)', group: 'General' },
];

const GROUP_ORDER = ['Hackathons', 'Teams', 'Submissions', 'Reports', 'Admin', 'General'];

const roleLabel = (role: string) =>
  role === 'superadmin' ? 'Superadmin' : role.charAt(0).toUpperCase() + role.slice(1);

function Toggle({
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-50 ${
        checked ? 'bg-neon-cyan' : 'bg-slate-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function SuperadminSettings() {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    adminApi
      .getSettings()
      .then((res) => setSettings(res.data))
      .catch((err) => setError(formatError(err, 'Failed to load settings')))
      .finally(() => setLoading(false));
  }, []);

  const setRegistration = (open: boolean) => {
    setSettings((prev) => (prev ? { ...prev, registration_open: open } : prev));
  };

  const setPermission = (role: UserRole, feature: string, enabled: boolean) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next: RolePermissions = { ...prev.role_permissions };
      next[role] = { ...next[role], [feature]: enabled };
      // Prevent locking superadmin out of settings.
      if (role === 'superadmin' && feature === 'manage_settings') {
        next.superadmin.manage_settings = true;
      }
      if (role === 'superadmin' && feature === 'view_admin_panel') {
        next.superadmin.view_admin_panel = true;
      }
      return { ...prev, role_permissions: next };
    });
  };

  const handleSave = async () => {
    if (!settings) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const { data } = await adminApi.updateSettings({
        registration_open: settings.registration_open,
        role_permissions: settings.role_permissions,
      });
      setSettings(data);
      setSuccess('Settings saved successfully.');
    } catch (err: any) {
      setError(formatError(err, 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    features: FEATURE_META.filter((f) => f.group === group),
  })).filter((g) => g.features.length > 0);

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <BackButton to="/admin" label="Back to admin panel" />
        </div>

        <div className="glass-panel p-6 mb-6">
          <h1 className="font-pixel text-lg text-white text-shadow-neon mb-2">PLATFORM SETTINGS</h1>
          <p className="text-slate-400 text-sm">
            Toggle registration and granular privileges for every role.
          </p>
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

        {loading ? (
          <div className="py-16">
            <LoadingScreen message="Loading settings..." />
          </div>
        ) : settings ? (
          <>
            <div className="glass-panel p-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-pixel text-xs text-neon-cyan mb-1">REGISTRATION</h2>
                  <p className="text-sm text-slate-300">
                    Allow new users to register on the platform.
                  </p>
                </div>
                <Toggle
                  checked={settings.registration_open}
                  onChange={setRegistration}
                  ariaLabel="Toggle registration"
                />
              </div>
            </div>

            <div className="glass-panel overflow-hidden mb-6">
              <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="font-pixel text-xs text-neon-cyan">ROLE PERMISSIONS</h2>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="inline-block w-3 h-3 rounded bg-neon-cyan" />
                  <span>Allowed</span>
                  <span className="inline-block w-3 h-3 rounded bg-slate-600 ml-2" />
                  <span>Denied</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-xs pixel-caps text-slate-400">
                      <th className="py-3 px-4 sticky left-0 bg-space-900/95 backdrop-blur">Feature</th>
                      {ROLES.map((role) => (
                        <th key={role} className="py-3 px-4 text-center min-w-[110px]">
                          {roleLabel(role)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.map((group) => (
                      <>
                        <tr key={group.group} className="bg-white/5">
                          <td
                            colSpan={ROLES.length + 1}
                            className="py-2 px-4 text-[10px] pixel-caps text-neon-purple tracking-wider"
                          >
                            {group.group}
                          </td>
                        </tr>
                        {group.features.map((feature) => (
                          <tr
                            key={feature.key}
                            className="border-b border-white/10 hover:bg-white/5 transition"
                          >
                            <td className="py-3 px-4 text-sm text-slate-300 sticky left-0 bg-space-900/95 backdrop-blur">
                              {feature.label}
                            </td>
                            {ROLES.map((role) => (
                              <td key={role} className="py-3 px-4 text-center">
                                <Toggle
                                  checked={!!settings.role_permissions[role]?.[feature.key]}
                                  onChange={(v) => setPermission(role, feature.key, v)}
                                  disabled={
                                    role === 'superadmin' &&
                                    (feature.key === 'manage_settings' || feature.key === 'view_admin_panel')
                                  }
                                  ariaLabel={`${role} ${feature.label}`}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="neon-btn neon-btn-primary px-6 py-2 text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save settings'}
              </button>
            </div>
          </>
        ) : (
          <div className="glass-panel p-8 text-center">
            <p className="text-slate-300">Could not load settings.</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
