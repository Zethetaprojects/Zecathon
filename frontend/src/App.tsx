import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import ErrorBoundary from './components/ErrorBoundary';
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
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<PrivateRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
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
    </ErrorBoundary>
  );
}

export default App;
