'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { ADMIN_ADDRESSES } from '@/lib/constants';

const navLinks = [
  { href: '/pools', label: 'Pools' },
  { href: '/escrow', label: 'Escrow' },
  { href: '/profile', label: 'My Page' },
];

export default function Navbar() {
  const pathname = usePathname();
  const { address } = useAccount();
  const isAdmin = address && ADMIN_ADDRESSES.map(a => a.toLowerCase()).includes(address.toLowerCase());

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
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-black font-black text-sm"
              style={{ background: 'linear-gradient(135deg, #f0b429, #c9922a)' }}
            >
              OTC
            </div>
            <span className="font-bold text-white text-lg tracking-tight hidden sm:block">
              OTC<span className="gradient-text">Platform</span>
            </span>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  color: pathname.startsWith(link.href) ? '#f0b429' : '#888',
                  background: pathname.startsWith(link.href) ? 'rgba(240,180,41,0.08)' : 'transparent',
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

          {/* Connect Wallet */}
          <div className="flex items-center gap-3">
            <Link
              href="/pools/create"
              className="hidden sm:flex btn-primary text-sm py-2 px-4"
            >
              + New Pool
            </Link>
            <ConnectButton
              accountStatus="avatar"
              chainStatus="icon"
              showBalance={false}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
