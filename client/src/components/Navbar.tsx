import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

interface NavbarProps {
  showBack?: boolean;
  backPath?: string;
  backLabel?: string;
  borderless?: boolean;
}

function OxoLogo() {
  return (
    <span className="text-xl font-bold tracking-tight">
      <span className="text-oxo-o">O</span>
      <span className="text-oxo-x">X</span>
      <span className="text-oxo-o">O</span>
    </span>
  );
}

export default function Navbar({ showBack = false, backPath = '/lobby', backLabel = 'Lobby', borderless = false }: NavbarProps) {
  const navigate = useNavigate();
  const { isAuthenticated, username, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className={`bg-oxo-bg px-6 h-14 flex items-center justify-between ${borderless ? '' : 'border-b border-oxo-border'}`}>
      {/* Left — logo or back button */}
      {showBack ? (
        <button
          onClick={() => navigate(backPath)}
          className="text-sm text-oxo-faint hover:text-white transition-colors flex items-center gap-1.5"
        >
          ← {backLabel}
        </button>
      ) : (
        <button
          onClick={() => navigate('/')}
          className="hover:opacity-80 transition-opacity"
        >
          <OxoLogo />
        </button>
      )}

      {/* Right — auth controls */}
      {isAuthenticated ? (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-full bg-oxo-accent flex items-center justify-center text-white font-bold text-sm">
              {username.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-oxo-muted hidden sm:block">{username}</span>
            <span className="text-oxo-faint text-xs">▾</span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-oxo-surface border border-oxo-border rounded-xl shadow-2xl z-50 overflow-hidden">
              <button
                onClick={() => { navigate('/stats'); setMenuOpen(false); }}
                className="w-full text-left px-4 py-3 text-sm text-oxo-muted hover:bg-oxo-surface-2 hover:text-white transition-colors"
              >
                Stats
              </button>
              <button
                onClick={() => { navigate('/profile'); setMenuOpen(false); }}
                className="w-full text-left px-4 py-3 text-sm text-oxo-muted hover:bg-oxo-surface-2 hover:text-white transition-colors"
              >
                Profile
              </button>
              <div className="border-t border-oxo-border" />
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-3 text-sm text-rose-400 hover:bg-oxo-surface-2 transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => navigate('/login')}
          className="px-4 py-2 bg-oxo-accent hover:bg-oxo-accent-2 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Sign In
        </button>
      )}
    </nav>
  );
}
