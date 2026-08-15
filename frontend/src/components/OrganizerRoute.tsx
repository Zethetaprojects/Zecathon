import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isOrganizer } from '../utils/role';
import PageLayout from './PageLayout';

export default function OrganizerRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <PageLayout className="flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neon-cyan pixel-caps text-sm">Loading arena...</p>
        </div>
      </PageLayout>
    );
  }

  if (!user || !isOrganizer(user.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
