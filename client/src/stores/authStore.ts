import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Session } from '@heroiclabs/nakama-js';
import { loginEmail, registerEmail, authenticateGoogle } from '../services/authService';
import { nakamaClient } from '../services/nakamaClient';

interface AuthState {
  // Data
  session: Session | null;
  userId: string;
  username: string;
  displayName: string;
  email: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  sessionExpiredMessage: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string, firstName: string, lastName: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  clearSessionExpiredMessage: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state
      session: null,
      userId: '',
      username: '',
      displayName: '',
      email: '',
      isAuthenticated: false,
      isLoading: false,
      error: null,
      sessionExpiredMessage: null,

      // Actions
      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const session = await loginEmail(email, password);
          // Fetch display name stored in the Nakama account (set during registration or Google login).
          let displayName = '';
          try {
            const account = await nakamaClient.getAccount(session);
            displayName = account.user?.display_name ?? '';
          } catch { /* non-fatal — username shown as fallback in Navbar */ }
          set({
            session,
            userId: session.user_id ?? '',
            username: session.username ?? '',
            displayName,
            email,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Login failed',
            isLoading: false,
          });
        }
      },

      register: async (email, password, username, firstName, lastName) => {
        set({ isLoading: true, error: null });
        try {
          const session = await registerEmail(email, password, username);
          const displayName = [firstName, lastName].filter(Boolean).join(' ');
          if (displayName) {
            try {
              await nakamaClient.updateAccount(session, { display_name: displayName });
            } catch { /* non-fatal — account still created */ }
          }
          set({
            session,
            userId: session.user_id ?? '',
            username: session.username ?? '',
            displayName,
            email,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Registration failed',
            isLoading: false,
          });
        }
      },

      loginWithGoogle: async (idToken) => {
        set({ isLoading: true, error: null });
        try {
          const session = await authenticateGoogle(idToken);

          // Decode the Google JWT payload (base64url → base64 → JSON).
          // Google uses base64url encoding: `-` instead of `+`, `_` instead of `/`, no padding.
          // Nakama already verified the token server-side so we only need the claims here.
          let displayName = '';
          let email = '';
          let avatarUrl = '';
          try {
            const b64 = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            const claims = JSON.parse(atob(b64));
            displayName = claims.name ?? '';
            email = claims.email ?? '';
            avatarUrl = claims.picture ?? '';
          } catch { /* JWT decode failed — non-fatal */ }

          if (displayName || avatarUrl) {
            try {
              await nakamaClient.updateAccount(session, {
                display_name: displayName || undefined,
                avatar_url: avatarUrl || undefined,
              });
            } catch { /* non-fatal */ }
          }

          set({
            session,
            userId: session.user_id ?? '',
            username: session.username ?? '',
            displayName,
            email,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Google login failed',
            isLoading: false,
          });
        }
      },

      logout: () => {
        set({
          session: null,
          userId: '',
          username: '',
          displayName: '',
          email: '',
          isAuthenticated: false,
          error: null,
          sessionExpiredMessage: null,
        });
      },

      clearError: () => set({ error: null }),
      clearSessionExpiredMessage: () => set({ sessionExpiredMessage: null }),
    }),
    {
      name: 'ttt_auth',
      partialize: (state) => ({
        sessionToken: state.session?.token ?? null,
        refreshToken: state.session?.refresh_token ?? null,
        userId: state.userId,
        username: state.username,
        displayName: state.displayName,
        email: state.email,
        isAuthenticated: state.isAuthenticated,
        sessionExpiredMessage: state.sessionExpiredMessage,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const { sessionToken, refreshToken } = state as unknown as {
          sessionToken: string | null;
          refreshToken: string | null;
        };
        if (sessionToken && refreshToken) {
          const session = Session.restore(sessionToken, refreshToken);
          const nowSecs = Date.now() / 1000;
          if (session.isexpired(nowSecs) && session.isrefreshexpired(nowSecs)) {
            // Both tokens dead — clear auth state and queue a re-login message
            state.isAuthenticated = false;
            state.session = null;
            state.userId = '';
            state.username = '';
            state.displayName = '';
            state.email = '';
            (state as unknown as { sessionExpiredMessage: string }).sessionExpiredMessage =
              'Your session has expired. Please sign in again.';
          } else {
            state.session = session;
          }
        }
      },
    }
  )
);
