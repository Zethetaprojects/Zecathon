import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ConfirmProvider } from './hooks/useConfirm';
import { MusicProvider } from './components/MusicProvider';
import { EasterEggProvider } from './hooks/useEasterEggs';
import ErrorBoundary from './components/ErrorBoundary';
import EasterEggOverlay from './components/EasterEggOverlay';
import ConsoleEasterEgg from './components/ConsoleEasterEgg';
import TabAttention from './components/TabAttention';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Hackathons from './pages/Hackathons';
import CreateHackathon from './pages/CreateHackathon';
import HackathonDetail from './pages/HackathonDetail';
import HackathonTeams from './pages/HackathonTeams';
import EditHackathon from './pages/EditHackathon';
import Submit from './pages/Submit';
import Leaderboard from './pages/Leaderboard';
import PublicLeaderboard from './pages/PublicLeaderboard';
import AdminDashboard from './pages/AdminDashboard';
import SuperadminSettings from './pages/SuperadminSettings';
import DocsPage from './pages/DocsPage';
import ApiDocsPage from './pages/ApiDocsPage';
import RubricsPage from './pages/RubricsPage';
import SupportPage from './pages/SupportPage';
import PrivateRoute from './components/PrivateRoute';
import PermissionRoute from './components/PermissionRoute';
import SuperAdminRoute from './components/SuperAdminRoute';
import ReportsPage from './pages/ReportsPage';
import TeamReportPage from './pages/TeamReportPage';

function App() {
  return (
    <ErrorBoundary>
      <MusicProvider>
        <EasterEggProvider>
          <AuthProvider>
            <ConfirmProvider>
              <EasterEggOverlay />
              <ConsoleEasterEgg />
              <TabAttention />
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/public/leaderboard/:id" element={<PublicLeaderboard />} />
                <Route path="/docs" element={<DocsPage />} />
                <Route path="/rubrics" element={<RubricsPage />} />
                <Route path="/support" element={<SupportPage />} />
                <Route element={<PrivateRoute />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route element={<PermissionRoute feature="view_api_docs" />}>
                    <Route path="/api-docs" element={<ApiDocsPage />} />
                  </Route>
                  <Route element={<PermissionRoute feature="view_reports" />}>
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/reports/submission/:id" element={<TeamReportPage />} />
                  </Route>
                  <Route element={<PermissionRoute feature="edit_hackathon" />}>
                    <Route path="/hackathons/:id/edit" element={<EditHackathon />} />
                  </Route>
                  <Route element={<PermissionRoute feature="create_hackathon" />}>
                    <Route path="/hackathons/new" element={<CreateHackathon />} />
                  </Route>
                  <Route path="/admin" element={<PermissionRoute feature="view_admin_panel" />}>
                    <Route index element={<AdminDashboard />} />
                    <Route element={<SuperAdminRoute />}>
                      <Route path="settings" element={<SuperadminSettings />} />
                    </Route>
                  </Route>
                  <Route path="/hackathons" element={<Hackathons />} />
                  <Route path="/hackathons/:id" element={<HackathonDetail />} />
                  <Route path="/hackathons/:id/teams" element={<HackathonTeams />} />
                  <Route element={<PermissionRoute feature="view_leaderboard" />}>
                    <Route path="/hackathons/:id/leaderboard" element={<Leaderboard />} />
                  </Route>
                  <Route path="/hackathons/:hackathonId/submit/:teamId/:problemStatementId" element={<Submit />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ConfirmProvider>
          </AuthProvider>
        </EasterEggProvider>
      </MusicProvider>
    </ErrorBoundary>
  );
}

export default App;
