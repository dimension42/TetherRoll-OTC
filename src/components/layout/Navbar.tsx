'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import LoginButton from '@/components/auth/LoginButton';

const navLinks = [
  { href: '/pools', label: 'Pools' },
  { href: '/escrow', label: 'Escrow' },
  { href: '/deposit', label: 'Deposit' },
  { href: '/features', label: 'Features' },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, authenticated } = useAuth();

  // VIP 메뉴는 승인된 계정의 화면에만 존재한다 — 미승인 유저에겐 노출 자체가 없음 (PRD §2.1)
  const showVip = authenticated && user?.vipStatus === 'approved';
  const showAdmin = authenticated && user?.isAdmin === true;

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(5,8,6,0.85)',
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
            {showVip && (
              <Link
                href="/vip"
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5"
                style={{
                  color: pathname.startsWith('/vip') ? '#00ff88' : '#8FA398',
                  background: pathname.startsWith('/vip') ? 'rgba(0,255,136,0.06)' : 'transparent',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full inline-block"
                  style={{ background: '#00ff88', boxShadow: '0 0 6px #00ff88' }}
                />
                VIP Desk
              </Link>
            )}
            {showAdmin && (
              <Link
                href="/admin"
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ml-1"
                style={{
                  color: pathname.startsWith('/admin') ? '#FF4D5E' : '#666',
                  background: pathname.startsWith('/admin') ? 'rgba(255,77,94,0.08)' : 'transparent',
                  border: '1px solid rgba(255,77,94,0.2)',
                }}
              >
                Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/pools/create" className="hidden sm:flex btn-primary text-sm py-2 px-4">
              + New Pool
            </Link>
            <LoginButton />
          </div>
        </div>
      </div>
    </header>
  );
}
