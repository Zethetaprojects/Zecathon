import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { MusicProvider } from './components/MusicProvider';
import { EasterEggProvider } from './hooks/useEasterEggs';
import ErrorBoundary from './components/ErrorBoundary';
import EasterEggOverlay from './components/EasterEggOverlay';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Hackathons from './pages/Hackathons';
import CreateHackathon from './pages/CreateHackathon';
import HackathonDetail from './pages/HackathonDetail';
import HackathonTeams from './pages/HackathonTeams';
import Submit from './pages/Submit';
import Leaderboard from './pages/Leaderboard';
import PublicLeaderboard from './pages/PublicLeaderboard';
import AdminDashboard from './pages/AdminDashboard';
import DocsPage from './pages/DocsPage';
import ApiDocsPage from './pages/ApiDocsPage';
import RubricsPage from './pages/RubricsPage';
import SupportPage from './pages/SupportPage';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';

function App() {
  return (
    <ErrorBoundary>
      <MusicProvider>
        <EasterEggProvider>
          <AuthProvider>
            <EasterEggOverlay />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/public/leaderboard/:id" element={<PublicLeaderboard />} />
              <Route path="/docs" element={<DocsPage />} />
              <Route path="/api-docs" element={<ApiDocsPage />} />
              <Route path="/rubrics" element={<RubricsPage />} />
              <Route path="/support" element={<SupportPage />} />
              <Route element={<PrivateRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/admin" element={<AdminRoute />}>
                  <Route index element={<AdminDashboard />} />
                </Route>
                <Route path="/hackathons" element={<Hackathons />} />
                <Route path="/hackathons/new" element={<CreateHackathon />} />
                <Route path="/hackathons/:id" element={<HackathonDetail />} />
                <Route path="/hackathons/:id/teams" element={<HackathonTeams />} />
                <Route path="/hackathons/:id/leaderboard" element={<Leaderboard />} />
                <Route path="/hackathons/:hackathonId/submit/:teamId/:problemStatementId" element={<Submit />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </EasterEggProvider>
      </MusicProvider>
    </ErrorBoundary>
  );
}

export default App;
