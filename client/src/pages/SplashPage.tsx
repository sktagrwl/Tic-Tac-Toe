import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '../stores/authStore';

type AuthMode = 'login' | 'register';

export default function SplashPage() {
  const navigate = useNavigate();
  const { login, register, loginWithGoogle, isLoading, error, clearError } = useAuthStore();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (mode === 'login') {
      await login(email, password);
    } else {
      await register(email, password, username);
    }

    const { isAuthenticated } = useAuthStore.getState();
    if (isAuthenticated) {
      navigate('/lobby');
    }
  };

  const switchMode = () => {
    clearError();
    setMode(mode === 'login' ? 'register' : 'login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-oxo-bg bg-dot-grid animate-fade-in">
      <div className="w-full max-w-sm bg-oxo-surface border border-oxo-border rounded-2xl p-8 shadow-2xl">

        {/* OXO Wordmark */}
        <div className="text-center mb-8">
          <div className="text-5xl font-bold tracking-tight mb-2 leading-none">
            <span className="text-oxo-o">O</span>
            <span className="text-oxo-x">X</span>
            <span className="text-oxo-o">O</span>
          </div>
          <p className="text-oxo-faint text-sm">
            {mode === 'login' ? 'Welcome back, player.' : 'Create your account.'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-800 text-red-400 rounded-lg text-sm animate-fade-up">
            {error}
          </div>
        )}

        {/* Google Sign-In */}
        <div className="mb-6 flex justify-center">
          <GoogleLogin
            onSuccess={async (credentialResponse) => {
              if (!credentialResponse.credential) return;
              clearError();
              await loginWithGoogle(credentialResponse.credential);
              const { isAuthenticated } = useAuthStore.getState();
              if (isAuthenticated) navigate('/lobby');
            }}
            onError={() => {
              useAuthStore.setState({ error: 'Google login failed' });
            }}
            width="320"
            text="continue_with"
            shape="rectangular"
            theme="filled_black"
          />
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-oxo-border" />
          <span className="text-xs text-oxo-faint">or</span>
          <div className="flex-1 h-px bg-oxo-border" />
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-oxo-muted mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={20}
                placeholder="Choose a username"
                className="input-oxo"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-oxo-muted mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="input-oxo"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-oxo-muted mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Min 8 characters"
              className="input-oxo"
            />
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary"
            >
              {isLoading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </div>
        </form>

        {/* Switch mode */}
        <p className="text-center text-sm text-oxo-faint mt-6">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={switchMode}
            className="text-oxo-accent-2 hover:text-oxo-accent font-medium transition-colors"
          >
            {mode === 'login' ? 'Register' : 'Sign In'}
          </button>
        </p>

        {/* Back to lobby */}
        <div className="text-center mt-4">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-oxo-faint hover:text-oxo-muted transition-colors"
          >
            ← Back to lobby
          </button>
        </div>

      </div>
    </div>
  );
}
