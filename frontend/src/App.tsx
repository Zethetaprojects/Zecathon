import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Hackathons from './pages/Hackathons';
import CreateHackathon from './pages/CreateHackathon';
import HackathonDetail from './pages/HackathonDetail';
import HackathonTeams from './pages/HackathonTeams';
import Submit from './pages/Submit';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/hackathons" element={<Hackathons />} />
          <Route path="/hackathons/new" element={<CreateHackathon />} />
          <Route path="/hackathons/:id" element={<HackathonDetail />} />
          <Route path="/hackathons/:id/teams" element={<HackathonTeams />} />
          <Route path="/hackathons/:hackathonId/submit/:teamId/:problemStatementId" element={<Submit />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
