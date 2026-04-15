import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { nakamaClient } from '../services/nakamaClient';

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

      // Update the store with new username
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/lobby')}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ← Back to Lobby
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <div className="w-20" />
        </div>

        {/* Avatar + basic info */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
              {username.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-lg">{username}</p>
              <p className="text-gray-500 text-sm">{email}</p>
              <p className="text-gray-400 text-xs mt-1">ID: {userId.slice(0, 8)}...</p>
            </div>
          </div>

          {/* Update username form */}
          <form onSubmit={handleUpdateUsername} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                minLength={3}
                maxLength={20}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {message && (
              <div className={`p-3 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || newUsername === username}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg transition-colors"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Logout */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Account</h2>
          <button
            onClick={handleLogout}
            className="w-full py-2 px-4 border border-red-300 text-red-600 hover:bg-red-50 font-semibold rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>

      </div>
    </div>
  );
}
