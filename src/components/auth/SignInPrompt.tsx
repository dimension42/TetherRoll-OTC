'use client';

import { useAuth } from '@/hooks/useAuth';

export default function SignInPrompt({ label = 'Sign In' }: { label?: string }) {
  const { login } = useAuth();
  return (
    <button
      onClick={login}
      className="px-8 py-3 rounded-xl text-sm font-semibold text-black"
      style={{ background: 'linear-gradient(135deg, #00c9a7, #00a88a)' }}
    >
      {label}
    </button>
  );
}
