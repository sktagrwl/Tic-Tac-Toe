import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { nakamaClient } from '../services/nakamaClient';
import Navbar from '../components/Navbar';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { session, username, email, userId, logout } = useAuthStore();

  const [newUsername, setNewUsername] = useState(username);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setIsLoading(true);
    setMessage(null);

    try {
      await nakamaClient.updateAccount(session, {
        username: newUsername,
        display_name: newUsername,
      });
      useAuthStore.setState({ username: newUsername });
      setMessage({ type: 'success', text: 'Username updated successfully' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update username',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-oxo-bg animate-fade-in">
      <Navbar showBack backPath="/lobby" backLabel="Lobby" />

      <div className="max-w-md mx-auto px-6 py-10 space-y-6">

        {/* Avatar + info */}
        <div className="flex flex-col items-center gap-3 pb-8 border-b border-oxo-border">
          <div className="w-20 h-20 rounded-full bg-oxo-accent flex items-center justify-center text-white text-3xl font-bold">
            {username.charAt(0).toUpperCase()}
          </div>
          <div className="text-center">
            <p className="font-semibold text-oxo-text text-xl">{username}</p>
            <p className="text-oxo-muted text-sm mt-0.5">{email}</p>
            <p className="text-oxo-faint text-xs mt-1 font-mono">ID: {userId.slice(0, 8)}...</p>
          </div>
        </div>

        {/* Update username form */}
        <form onSubmit={handleUpdateUsername} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-oxo-muted mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              minLength={3}
              maxLength={20}
              required
              className="input-oxo"
            />
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm border animate-fade-up ${
              message.type === 'success'
                ? 'bg-[#22c55e]/10 border-[#22c55e]/30 text-[#22c55e]'
                : 'bg-red-950/60 border-red-800 text-red-400'
            }`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || newUsername === username}
            className="btn-primary"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>

        {/* Danger zone */}
        <div className="pt-2 border-t border-oxo-border">
          <p className="text-xs text-oxo-faint mb-3 uppercase tracking-wider">Danger Zone</p>
          <button
            onClick={handleLogout}
            className="btn-danger"
          >
            Sign Out
          </button>
        </div>

      </div>
    </div>
  );
}
