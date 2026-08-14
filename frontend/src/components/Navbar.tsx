import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 glass-panel border-b border-white/10 rounded-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 bg-gradient-to-br from-neon-pink to-neon-purple rounded shadow-neon-pink group-hover:scale-110 transition" />
            <span className="font-pixel text-sm sm:text-base tracking-widest text-white group-hover:text-neon-cyan transition">
              ZECATHON
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link to="/" className="text-sm pixel-caps text-slate-300 hover:text-neon-cyan transition">
              Home
            </Link>
            <Link to="/hackathons" className="text-sm pixel-caps text-slate-300 hover:text-neon-cyan transition">
              Hackathons
            </Link>
            {user ? (
              <>
                <Link to="/dashboard" className="text-sm pixel-caps text-slate-300 hover:text-neon-cyan transition">
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm pixel-caps text-neon-pink hover:text-white transition"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm pixel-caps text-slate-300 hover:text-neon-cyan transition">
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded neon-btn neon-btn-primary text-xs"
                >
                  Register
                </Link>
              </>
            )}
          </div>

          {/* Mobile nav placeholder - kept simple for stability */}
          <div className="md:hidden text-xs text-slate-400">
            {user ? (
              <button onClick={handleLogout} className="text-neon-pink">Log out</button>
            ) : (
              <Link to="/login" className="text-neon-cyan">Login</Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
