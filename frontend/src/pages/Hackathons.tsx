import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { hackathonsApi } from '../api/hackathons';
import { Hackathon } from '../types';

export default function Hackathons() {
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    hackathonsApi
      .list()
      .then((res) => setHackathons(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load hackathons'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Hackathons</h1>
          <Link
            to="/hackathons/new"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Create hackathon
          </Link>
        </div>
        {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}
        {hackathons.length === 0 ? (
          <p className="text-gray-600">No hackathons yet. Create one to get started.</p>
        ) : (
          <ul className="divide-y">
            {hackathons.map((h) => (
              <li key={h.id} className="py-4">
                <Link to={`/hackathons/${h.id}`} className="text-lg font-semibold text-blue-700 hover:underline">
                  {h.name}
                </Link>
                <p className="text-gray-600 text-sm">{h.description}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
