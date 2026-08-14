import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <button
            onClick={logout}
            className="text-sm text-red-600 hover:text-red-800 border border-red-200 px-3 py-1 rounded"
          >
            Log out
          </button>
        </div>
        <p className="text-gray-700 mb-4">
          Welcome, <span className="font-semibold">{user?.username}</span>!
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/hackathons"
            className="block p-4 border rounded-lg hover:bg-blue-50 transition"
          >
            <h2 className="font-semibold text-lg">Hackathons</h2>
            <p className="text-sm text-gray-600">Create and manage hackathons.</p>
          </Link>
          <Link
            to="/teams"
            className="block p-4 border rounded-lg hover:bg-blue-50 transition"
          >
            <h2 className="font-semibold text-lg">Teams</h2>
            <p className="text-sm text-gray-600">Join a team and submit your project.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
