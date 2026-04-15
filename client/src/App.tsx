import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import SplashPage from './pages/SplashPage';
import ProfilePage from './pages/ProfilePage';

// Placeholder pages — we'll build these next
function LobbyPage() {
  return <div className="p-8 text-2xl font-bold">Lobby — coming soon</div>;
}
function GamePage() {
  return <div className="p-8 text-2xl font-bold">Game — coming soon</div>;
}
function StatsPage() {
  return <div className="p-8 text-2xl font-bold">Stats — coming soon</div>;
}

// Guard: redirects to / if not authenticated
function RequireAuth() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SplashPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/game/:matchId" element={<GamePage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
