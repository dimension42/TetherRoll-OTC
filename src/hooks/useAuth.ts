'use client';

import { createContext, useContext } from 'react';

export type SessionUser = {
  id: string;
  email: string | null;
  walletAddress: string | null;
  displayName: string | null;
  vipStatus: 'none' | 'pending' | 'approved' | 'revoked';
  isAdmin: boolean;
  wallets: Array<{ address: string; source: string; isPrimary: boolean }>;
} | null;

export type AuthState = {
  ready: boolean;
  authenticated: boolean;
  user: SessionUser;
  /** 로그인 화면으로 이동 */
  login: () => void;
  logout: () => Promise<void>;
  /** 세션 재조회 (로그인 직후 호출) */
  refresh: () => Promise<void>;
};

export const AuthContext = createContext<AuthState>({
  ready: false,
  authenticated: false,
  user: null,
  login: () => {},
  logout: async () => {},
  refresh: async () => {},
});

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
