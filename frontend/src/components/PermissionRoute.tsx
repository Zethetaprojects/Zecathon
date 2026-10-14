import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Feature } from '../types';
import PageLayout from './PageLayout';
import LoadingScreen from './LoadingScreen';

/** Renders child routes only when the current user has the given feature permission. */
export default function PermissionRoute({ feature }: { feature: Feature }) {
  const { user, loading, can } = useAuth();

  if (loading) {
    return (
      <PageLayout className="flex items-center justify-center">
        <LoadingScreen message="Loading arena..." />
      </PageLayout>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!can(feature)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
