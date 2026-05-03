'use client';

import { useAuth } from '@/hooks/useAuth';
import { useState, useRef, useEffect } from 'react';

function shortenAddr(addr: string) {
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

export default function LoginButton() {
  const { login, logout, user, authenticated, ready } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!ready) {
    return (
      <div
        className="h-10 w-28 rounded-xl animate-pulse"
        style={{ background: 'rgba(255,255,255,0.05)' }}
      />
    );
  }

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-black transition-all hover:scale-105"
        style={{ background: 'linear-gradient(135deg, #00c9a7, #00a88a)' }}
      >
        Sign In
      </button>
    );
  }

  const wallet = user?.wallet;
  const email = user?.email?.address;
  const google = user?.google?.email;
  const twitter = user?.twitter?.username;
  const telegram = user?.telegram?.username;

  const displayName = twitter
    ? `@${twitter}`
    : telegram
    ? `@${telegram}`
    : email || google || (wallet ? shortenAddr(wallet.address) : 'User');

  const walletAddress = wallet?.address;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105"
        style={{
          background: 'rgba(0,201,167,0.1)',
          border: '1px solid rgba(0,201,167,0.25)',
          color: '#00c9a7',
        }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-black"
          style={{ background: 'linear-gradient(135deg, #00c9a7, #00a88a)' }}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
        <span className="hidden sm:block max-w-[120px] truncate">{displayName}</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {menuOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-64 rounded-xl overflow-hidden shadow-2xl z-50"
          style={{ background: '#151515', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-white text-sm font-semibold truncate">{displayName}</p>
            {walletAddress && (
              <p className="text-xs mt-1" style={{ color: '#666' }}>
                {shortenAddr(walletAddress)}
              </p>
            )}
            {email && (
              <p className="text-xs mt-0.5" style={{ color: '#666' }}>{email}</p>
            )}
          </div>
          <div className="p-1">
            <a
              href="/profile"
              className="block px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
              style={{ color: '#aaa' }}
              onClick={() => setMenuOpen(false)}
            >
              Profile
            </a>
            <a
              href="/deposit"
              className="block px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
              style={{ color: '#aaa' }}
              onClick={() => setMenuOpen(false)}
            >
              Deposit
            </a>
            <button
              onClick={() => { logout(); setMenuOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
              style={{ color: '#ff4466' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
