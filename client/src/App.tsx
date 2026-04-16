import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import SplashPage from './pages/SplashPage';
import LobbyPage from './pages/LobbyPage';
import ProfilePage from './pages/ProfilePage';
import GamePage from './pages/GamePage';

// Placeholder pages — we'll build these next
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
