'use client';

import { createContext, useContext } from 'react';

export type AuthUser = {
  wallet?: { address: string };
  email?: { address: string };
  google?: { email: string };
  twitter?: { username: string };
  telegram?: { username: string };
} | null;

export type AuthState = {
  ready: boolean;
  authenticated: boolean;
  login: () => void;
  logout: () => Promise<void>;
  user: AuthUser;
  wallets: { address: string; walletClientType: string }[];
};

export const AuthContext = createContext<AuthState>({
  ready: true,
  authenticated: false,
  login: () => {},
  logout: async () => {},
  user: null,
  wallets: [],
});

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
