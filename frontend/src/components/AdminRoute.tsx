import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isAdmin } from '../utils/role';
import PageLayout from './PageLayout';
import LoadingScreen from './LoadingScreen';

export default function AdminRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <PageLayout className="flex items-center justify-center">
        <LoadingScreen message="Loading arena..." />
      </PageLayout>
    );
  }

  if (!user || !isAdmin(user.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
