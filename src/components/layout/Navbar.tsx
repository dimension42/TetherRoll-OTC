'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ADMIN_ADDRESSES } from '@/lib/constants';
import LoginButton from '@/components/auth/LoginButton';

const navLinks = [
  { href: '/pools', label: 'Pools' },
  { href: '/escrow', label: 'Escrow' },
  { href: '/deposit', label: 'Deposit' },
  { href: '/features', label: 'Features' },
  { href: '/demo', label: 'Demo' },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, authenticated } = useAuth();

  const walletAddress = user?.wallet?.address;
  const email = user?.email?.address || user?.google?.email;
  const isAdmin = authenticated && (
    (walletAddress && ADMIN_ADDRESSES.map(a => a.toLowerCase()).includes(walletAddress.toLowerCase())) ||
    (email && ADMIN_EMAILS.includes(email.toLowerCase()))
  );

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(8,8,8,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-black font-black text-sm"
              style={{ background: 'linear-gradient(135deg, #00c9a7, #00a88a)' }}
            >
              TR
            </div>
            <span className="font-bold text-white text-lg tracking-tight hidden sm:block">
              Tether<span className="gradient-text">Roll</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  color: pathname.startsWith(link.href) ? '#00c9a7' : '#888',
                  background: pathname.startsWith(link.href) ? 'rgba(0,201,167,0.08)' : 'transparent',
                }}
              >
                {link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ml-1"
                style={{
                  color: pathname.startsWith('/admin') ? '#ff4466' : '#666',
                  background: pathname.startsWith('/admin') ? 'rgba(255,68,102,0.08)' : 'transparent',
                  border: '1px solid rgba(255,68,102,0.2)',
                }}
              >
                Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/pools/create"
              className="hidden sm:flex btn-primary text-sm py-2 px-4"
            >
              + New Pool
            </Link>
            <LoginButton />
          </div>
        </div>
      </div>
    </header>
  );
}

const ADMIN_EMAILS = [
  'admin@tetherroll.com',
  'culture@culturing.org',
];
