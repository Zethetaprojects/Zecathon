import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isSuperAdmin } from '../utils/role';
import PageLayout from './PageLayout';
import LoadingScreen from './LoadingScreen';

export default function SuperAdminRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <PageLayout className="flex items-center justify-center">
        <LoadingScreen message="Loading arena..." />
      </PageLayout>
    );
  }

  if (!user || !isSuperAdmin(user.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
