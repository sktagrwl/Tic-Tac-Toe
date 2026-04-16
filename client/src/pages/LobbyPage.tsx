import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { findMatch } from '../services/matchService';
import { useGameStore } from '../stores/gameStore';
import { useNakamaSocket } from '../hooks/useNakamaSocket';

export default function LobbyPage() {
  const navigate = useNavigate();
  const { session, username } = useAuthStore();
  const setMatchId = useGameStore((s) => s.setMatchId);

  // Connect socket so it's ready before joining a match
  useNakamaSocket();

  const [isCreating, setIsCreating] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Create a new match and show the room code
  const handleCreateRoom = async () => {
    if (!session) return;
    setIsCreating(true);
    setError(null);
    try {
      const matchId = await findMatch(session);
      setRoomCode(matchId);
      setMatchId(matchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  // Join an existing match by room code — actual socket join happens in GamePage
  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setMatchId(joinCode.trim());
    navigate(`/game/${joinCode.trim()}`);
  };

  // Enter own created room — actual socket join happens in GamePage
  const handleEnterRoom = () => {
    if (!roomCode) return;
    navigate(`/game/${roomCode}`);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
  };

return (
    <div className="min-h-screen bg-gray-50">

    {/* Nav bar */}
      <nav className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            {username.charAt(0).toUpperCase()}
          </div>
          <span className="font-semibold text-gray-900">{username}</span>
        </div>
        <button
          onClick={() => navigate('/profile')}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Profile
        </button>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">

        {/* Welcome */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {username}
          </h1>
          <p className="text-gray-500 mt-1">Ready to play?</p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Quick Match / Create Room */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Quick Match
          </h2>
          <p className="text-gray-500 text-sm mb-4">
            Create a room and share the code with a friend
          </p>

          {/* Before creating */}
          {!roomCode && (
            <button
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors"
            >
              {isCreating ? 'Creating...' : 'Create Room'}
            </button>
          )}

          {/* After creating — show room code */}
          {roomCode && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <span className="flex-1 font-mono text-sm text-gray-700 break-all">
                  {roomCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-gray-400 text-center">
                Share this code with your friend, then click Enter Room
              </p>
              <button
                onClick={handleEnterRoom}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors"
              >
                Enter Room
              </button>
              <button
                onClick={() => setRoomCode('')}
                className="w-full py-2 text-sm text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Join by code */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Join a Room
          </h2>
          <p className="text-gray-500 text-sm mb-4">
            Enter a room code shared by your friend
          </p>
          <form onSubmit={handleJoinRoom} className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Paste room code here"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
            />
            <button
              type="submit"
              disabled={!joinCode.trim()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors"
            >
              Join
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
