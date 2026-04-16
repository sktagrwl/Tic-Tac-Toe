import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Session } from '@heroiclabs/nakama-js';
import { loginEmail, registerEmail, authenticateGoogle } from '../services/authService';

interface AuthState {
  // Data
  session: Session | null;
  userId: string;
  username: string;
  email: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state
      session: null,
      userId: '',
      username: '',
      email: '',
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const session = await loginEmail(email, password);
          set({
            session,
            userId: session.user_id ?? '',
            username: session.username ?? '',
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

      register: async (email, password, username) => {
        set({ isLoading: true, error: null });
        try {
          const session = await registerEmail(email, password, username);
          set({
            session,
            userId: session.user_id ?? '',
            username: session.username ?? '',
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
          set({
            session,
            userId: session.user_id ?? '',
            username: session.username ?? '',
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
          email: '',
          isAuthenticated: false,
          error: null,
        });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'ttt_auth',
      partialize: (state) => ({
        sessionToken: state.session?.token ?? null,
        refreshToken: state.session?.refresh_token ?? null,
        userId: state.userId,
        username: state.username,
        email: state.email,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const { sessionToken, refreshToken } = state as unknown as {
          sessionToken: string | null;
          refreshToken: string | null;
        };
        if (sessionToken && refreshToken) {
          state.session = Session.restore(sessionToken, refreshToken);
        }
      },
    }
  )
);
