import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { hackathonsApi, problemStatementsApi } from '../api/hackathons';
import { Hackathon, ProblemStatement } from '../types';

export default function HackathonDetail() {
  const { id } = useParams<{ id: string }>();
  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [psTitle, setPsTitle] = useState('');
  const [psDescription, setPsDescription] = useState('');
  const [psFile, setPsFile] = useState<File | null>(null);
  const [psBusy, setPsBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchHackathon = () => {
    hackathonsApi
      .get(Number(id))
      .then((res) => setHackathon(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load hackathon'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHackathon();
  }, [id]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!psTitle) return;
    setPsBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('title', psTitle);
      if (psDescription) form.append('description', psDescription);
      if (psFile) form.append('file', psFile);
      await problemStatementsApi.upload(Number(id), form);
      setPsTitle('');
      setPsDescription('');
      setPsFile(null);
      if (fileRef.current) fileRef.current.value = '';
      fetchHackathon();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload problem statement');
    } finally {
      setPsBusy(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!hackathon) return <div className="p-8">Hackathon not found</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <Link to="/hackathons" className="text-blue-600 text-sm hover:underline">
            ← Back to hackathons
          </Link>
        </div>
        <h1 className="text-3xl font-bold mb-2">{hackathon.name}</h1>
        <p className="text-gray-700 mb-6">{hackathon.description}</p>

        <div className="mb-6 flex gap-3">
          <Link
            to={`/hackathons/${id}/teams`}
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Manage teams & submissions
          </Link>
          <Link
            to={`/hackathons/${id}/leaderboard`}
            className="inline-block bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Leaderboard
          </Link>
        </div>

        {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Problem statements</h2>
          {hackathon.problem_statements?.length === 0 ? (
            <p className="text-gray-600 text-sm">No problem statements yet.</p>
          ) : (
            <ul className="divide-y mb-4">
              {hackathon.problem_statements?.map((ps: ProblemStatement) => (
                <li key={ps.id} className="py-3">
                  <p className="font-medium">{ps.title}</p>
                  <p className="text-sm text-gray-600">{ps.description}</p>
                  {ps.file_path && (
                    <a
                      href={ps.file_path}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View file
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleUpload} className="border rounded-lg p-4 bg-gray-50">
            <h3 className="font-semibold mb-3">Upload new problem statement</h3>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input
                value={psTitle}
                onChange={(e) => setPsTitle(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={psDescription}
                onChange={(e) => setPsDescription(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">File (optional)</label>
              <input
                ref={fileRef}
                type="file"
                onChange={(e) => setPsFile(e.target.files?.[0] || null)}
                className="mt-1 block w-full text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={psBusy}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {psBusy ? 'Uploading...' : 'Upload'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
