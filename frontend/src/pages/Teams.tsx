import { Link } from 'react-router-dom';

export default function Teams() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Teams</h1>
        <p className="text-gray-600">Team management will be available in the next phase.</p>
        <Link to="/dashboard" className="text-blue-600 hover:underline text-sm">← Back to dashboard</Link>
      </div>
    </div>
  );
}
