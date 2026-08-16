import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import PageLayout from './PageLayout';
import LoadingScreen from './LoadingScreen';

export default function PrivateRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <PageLayout className="flex items-center justify-center">
        <LoadingScreen message="Loading arena..." />
      </PageLayout>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
